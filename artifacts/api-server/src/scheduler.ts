import { db } from "@workspace/db";
import { gifts } from "@workspace/db/schema";
import { and, isNotNull, isNull, lte, eq } from "drizzle-orm";
import twilio from "twilio";
import { sendSenderNudgeEmail, sendScheduledGiftReadyEmail, sendPackageDeliveredEmail } from "./lib/email";

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
          ``,
          `Reply STOP to opt out.`,
        ].join("\n");

        let smsSent = false;

        // ── SMS to the SENDER — they forward it themselves ──
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

        // ── Mark delivered only if SMS succeeded ──
        // If SMS fails (network issue, missing credentials), leave scheduleDelivered=false
        // so the next scheduler tick picks it up and retries automatically.
        if (smsSent) {
          await db
            .update(gifts)
            .set({ scheduleDelivered: true })
            .where(eq(gifts.id, gift.id));
          console.log(`[scheduler] Gift ${gift.id} marked delivered`);
        } else if (!gift.senderPhone) {
          // No phone on file — try email fallback, then mark delivered so we don't loop forever
          if (gift.senderEmail) {
            await sendScheduledGiftReadyEmail({
              to: gift.senderEmail,
              senderName: gift.senderName,
              recipientName: gift.recipientName,
              giftId: gift.id,
            }).catch(() => {});
          }
          await db
            .update(gifts)
            .set({ scheduleDelivered: true })
            .where(eq(gifts.id, gift.id));
          console.warn(`[scheduler] Gift ${gift.id} has no sender phone — marked delivered${gift.senderEmail ? " (email fallback sent)" : " without notification"}`);
        } else {
          console.warn(`[scheduler] Gift ${gift.id} — SMS failed, will retry next tick`);
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
        aftershipTrackingId: gifts.aftershipTrackingId,
        senderPhone: gifts.senderPhone,
        senderEmail: gifts.senderEmail,
        senderName: gifts.senderName,
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
        // Prefer AfterShip's internal ID (ID-based endpoint is the correct 2024-07 format).
        // Fall back to slug/number for legacy gifts that don't have an ID yet.
        let aftershipId = gift.aftershipTrackingId;
        const url = aftershipId
          ? `https://api.aftership.com/tracking/2024-07/trackings/${aftershipId}`
          : `https://api.aftership.com/tracking/2024-07/trackings/${gift.trackingCarrier}/${gift.trackingNumber}`;

        const res = await fetch(url, {
          headers: {
            "as-api-key": apiKey,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          // Auto-recover: if no AfterShip ID stored, re-register to obtain one for next poll
          if (!aftershipId && gift.trackingCarrier && gift.trackingNumber) {
            console.warn(`[AfterShip poll] ${gift.id}: HTTP ${res.status} — no ID stored, attempting re-register…`);
            const regRes = await fetch("https://api.aftership.com/tracking/2024-07/trackings", {
              method: "POST",
              headers: { "as-api-key": apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({ tracking_number: gift.trackingNumber, slug: gift.trackingCarrier, custom_fields: { gift_id: gift.id } }),
            });
            const regJson = await regRes.json().catch(() => null) as Record<string, unknown> | null;
            const regMeta = regJson?.meta as Record<string, unknown> | undefined;
            const regData = regJson?.data as Record<string, unknown> | undefined;
            // Extract ID from success (201) or "already exists" (4003)
            const recoveredId = regRes.ok
              ? (regData?.tracking as Record<string, unknown> | undefined)?.id as string | undefined ?? regData?.id as string | undefined
              : regMeta?.code === 4003 ? regData?.id as string | undefined : undefined;
            if (recoveredId) {
              await db.update(gifts).set({ aftershipTrackingId: recoveredId }).where(eq(gifts.id, gift.id));
              aftershipId = recoveredId;
              console.log(`[AfterShip poll] ${gift.id}: recovered AfterShip ID ${recoveredId} — will use next tick`);
            } else {
              console.warn(`[AfterShip poll] ${gift.id}: HTTP ${res.status} — ${errBody}`);
            }
          } else {
            console.warn(`[AfterShip poll] ${gift.id}: HTTP ${res.status} — ${errBody}`);
          }
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
            .returning({ senderPhone: gifts.senderPhone, senderEmail: gifts.senderEmail, senderName: gifts.senderName, recipientName: gifts.recipientName });

          if (updated) {
            if (updated.senderPhone) {
              await smsSender(
                updated.senderPhone,
                `gifted. 🎁 Your gift to ${updated.recipientName} just arrived!\n\nReply STOP to opt out.`,
              );
              console.log(`[AfterShip poll] Gift ${gift.id} delivered — sender SMS sent.`);
            } else if (updated.senderEmail) {
              await sendPackageDeliveredEmail({
                to: updated.senderEmail,
                senderName: updated.senderName,
                recipientName: updated.recipientName,
              }).catch(() => {});
              console.log(`[AfterShip poll] Gift ${gift.id} delivered — sender email sent (no phone).`);
            } else {
              console.warn(`[AfterShip poll] Gift ${gift.id} delivered — no sender contact info.`);
            }
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

async function nudgeStaleGifts() {
  try {
    const appOrigin = process.env.APP_ORIGIN ?? "https://gifted.page";
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const stale = await db
      .select({
        id: gifts.id,
        recipientName: gifts.recipientName,
        senderName: gifts.senderName,
        senderPhone: gifts.senderPhone,
        senderEmail: gifts.senderEmail,
      })
      .from(gifts)
      .where(
        and(
          eq(gifts.paid, true),
          isNull(gifts.openedAt),
          isNull(gifts.nudgeSentAt),
          lte(gifts.createdAt, threeDaysAgo),
        ),
      );

    if (!stale.length) return;

    for (const gift of stale) {
      try {
        if (gift.senderPhone) {
          const giftUrl = `${appOrigin}/open/${gift.id}`;
          const body = [
            `gifted. 🎁 Your gift to ${gift.recipientName} hasn't been opened yet.`,
            ``,
            `If you haven't sent the link yet, here it is — forward it whenever you're ready:`,
            giftUrl,
            ``,
            `Reply STOP to opt out.`,
          ].join("\n");
          await smsSender(gift.senderPhone, body);
        } else if (gift.senderEmail) {
          await sendSenderNudgeEmail({
            to: gift.senderEmail,
            senderName: gift.senderName,
            recipientName: gift.recipientName,
            giftId: gift.id,
          });
        } else {
          // No contact info — stamp nudgeSentAt anyway to avoid infinite loop
          console.warn(`[scheduler] Gift ${gift.id} has no phone or email — nudge skipped`);
        }

        await db
          .update(gifts)
          .set({ nudgeSentAt: new Date() })
          .where(eq(gifts.id, gift.id));

        console.log(`[scheduler] Nudge sent for stale gift ${gift.id}`);
      } catch (err) {
        console.error(`[scheduler] Nudge failed for gift ${gift.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] nudgeStaleGifts error:", err);
  }
}

export function startScheduler() {
  const INTERVAL_MS = 10 * 60 * 1000;
  console.log("[scheduler] Started — checking every 10 minutes for scheduled gifts, tracking updates, and stale gift nudges.");
  setInterval(async () => {
    await sendScheduledGifts();
    await pollAfterShipTrackings();
    await nudgeStaleGifts();
  }, INTERVAL_MS);
  sendScheduledGifts();
  pollAfterShipTrackings();
  nudgeStaleGifts();
}
