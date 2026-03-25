import { db } from "@workspace/db";
import { gifts } from "@workspace/db/schema";
import { and, isNotNull, isNull, lte, eq } from "drizzle-orm";
import twilio from "twilio";
import { sendScheduledDeliveryNotice } from "./lib/email";

interface TrackingEvent {
  status: string;
  message: string;
  location?: string;
  timestamp: string;
}

function getTwilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

async function smsSender(phone: string | null, body: string) {
  if (!phone) return;
  const client = getTwilioClient();
  const from   = process.env.TWILIO_PHONE_NUMBER;
  if (!client || !from) return;
  try {
    await client.messages.create({ to: phone, from, body });
  } catch (err) {
    console.error("[scheduler] SMS failed:", err);
  }
}

async function sendScheduledGifts() {
  try {
    const now = new Date();
    const pending = await db
      .select()
      .from(gifts)
      .where(
        and(
          isNotNull(gifts.scheduledFor),
          lte(gifts.scheduledFor, now),
          eq(gifts.scheduleDelivered, false),
        ),
      );

    if (!pending.length) return;

    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    const client    = getTwilioClient();
    const appOrigin = process.env.APP_ORIGIN ?? "https://gifted.page";

    for (const gift of pending) {
      try {
        const giftUrl = `${appOrigin}/open/${gift.id}`;

        // Build the forward-ready SMS for the sender
        const smsBody = [
          `gifted. 🎁 Your gift for ${gift.recipientName} is live!`,
          ``,
          `Copy this link and send it to them — when it comes from you, it lands differently:`,
          giftUrl,
        ].join("\n");

        let smsSent   = false;
        let emailSent = false;

        // ── Channel 1: SMS to the SENDER (they forward it themselves) ──
        if (gift.senderPhone && client && fromPhone) {
          try {
            await client.messages.create({
              to:   gift.senderPhone,
              from: fromPhone,
              body: smsBody,
            });
            smsSent = true;
            console.log(`[scheduler] SMS sent to sender for gift ${gift.id}`);
          } catch (smsErr) {
            console.error(`[scheduler] SMS failed for gift ${gift.id}:`, smsErr);
          }
        }

        // ── Channel 2: Email to the sender as backup ──
        if (gift.senderEmail) {
          try {
            await sendScheduledDeliveryNotice({
              to:            gift.senderEmail,
              senderName:    gift.senderName,
              recipientName: gift.recipientName,
              giftId:        gift.id,
              occasion:      gift.occasion,
            });
            emailSent = true;
          } catch (emailErr) {
            console.error(`[scheduler] Email failed for gift ${gift.id}:`, emailErr);
          }
        }

        // ── Mark delivered only if at least one channel succeeded ──
        // If both fail (network issue, missing credentials), leave scheduleDelivered=false
        // so the next scheduler tick picks it up and retries automatically.
        if (smsSent || emailSent) {
          await db
            .update(gifts)
            .set({ scheduleDelivered: true })
            .where(eq(gifts.id, gift.id));
          console.log(`[scheduler] Gift ${gift.id} marked delivered (sms=${smsSent} email=${emailSent})`);
        } else if (!gift.senderPhone && !gift.senderEmail) {
          // No contact info at all — mark delivered so we don't loop forever
          await db
            .update(gifts)
            .set({ scheduleDelivered: true })
            .where(eq(gifts.id, gift.id));
          console.warn(`[scheduler] Gift ${gift.id} has no sender contact — marked delivered without notification`);
        } else {
          console.warn(`[scheduler] Gift ${gift.id} — all channels failed, will retry next tick`);
        }
      } catch (err) {
        console.error(`[scheduler] Failed to process gift ${gift.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] Error running scheduled gift delivery:", err);
  }
}

async function pollAfterShipTrackings() {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  if (!apiKey) return;

  try {
    const activeGifts = await db
      .select({
        id: gifts.id,
        trackingCarrier: gifts.trackingCarrier,
        trackingNumber: gifts.trackingNumber,
        senderPhone: gifts.senderPhone,
        recipientName: gifts.recipientName,
        trackingDeliveredAt: gifts.trackingDeliveredAt,
      })
      .from(gifts)
      .where(
        and(
          isNotNull(gifts.trackingNumber),
          isNotNull(gifts.trackingCarrier),
          isNull(gifts.trackingDeliveredAt),
        ),
      );

    if (!activeGifts.length) return;

    console.log(`[AfterShip poll] Checking ${activeGifts.length} active shipment(s)…`);

    for (const gift of activeGifts) {
      try {
        const url = `https://api.aftership.com/tracking/2024-07/trackings/${gift.trackingCarrier}/${gift.trackingNumber}`;
        const res = await fetch(url, {
          headers: {
            "as-api-key": apiKey,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          console.warn(`[AfterShip poll] ${gift.id}: HTTP ${res.status} — ${errBody}`);
          continue;
        }

        const json = (await res.json()) as {
          data?: { tracking?: Record<string, unknown> };
        };
        const tracking = json?.data?.tracking;
        if (!tracking) continue;

        const tag = (tracking.tag as string | undefined) ?? "";
        const checkpoints = (tracking.checkpoints as Array<Record<string, unknown>> | undefined) ?? [];

        const events: TrackingEvent[] = checkpoints
          .map((cp) => ({
            status:    (cp.tag as string)             ?? "",
            message:   (cp.subtag_message as string)  || (cp.message as string) || "",
            location:  (cp.city as string)            ?? (cp.state as string)   ?? (cp.country_name as string) ?? undefined,
            timestamp: (cp.checkpoint_time as string) ?? new Date().toISOString(),
          }))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const isDelivered = tag === "Delivered";

        await db
          .update(gifts)
          .set({ trackingStatus: events.length > 0 ? events : undefined })
          .where(eq(gifts.id, gift.id));

        if (isDelivered) {
          const [updated] = await db
            .update(gifts)
            .set({ trackingDeliveredAt: new Date() })
            .where(and(eq(gifts.id, gift.id), isNull(gifts.trackingDeliveredAt)))
            .returning({ senderPhone: gifts.senderPhone, recipientName: gifts.recipientName });

          if (updated?.senderPhone) {
            await smsSender(
              updated.senderPhone,
              `Your gift to ${updated.recipientName} just arrived 🎁`,
            );
            console.log(`[AfterShip poll] Gift ${gift.id} delivered — sender SMS sent.`);
          }
        } else {
          console.log(`[AfterShip poll] Gift ${gift.id}: tag="${tag}", ${events.length} checkpoint(s).`);
        }
      } catch (err) {
        console.error(`[AfterShip poll] Error checking gift ${gift.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[AfterShip poll] Fatal error:", err);
  }
}

export function startScheduler() {
  const INTERVAL_MS = 10 * 60 * 1000;
  console.log("[scheduler] Started — checking every 10 minutes for scheduled gifts and tracking updates.");
  setInterval(async () => {
    await sendScheduledGifts();
    await pollAfterShipTrackings();
  }, INTERVAL_MS);
  sendScheduledGifts();
  pollAfterShipTrackings();
}
