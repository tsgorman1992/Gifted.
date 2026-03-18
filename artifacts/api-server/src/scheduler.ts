import { db } from "@workspace/db";
import { gifts } from "@workspace/db/schema";
import { and, isNotNull, lte, eq } from "drizzle-orm";
import twilio from "twilio";

function getTwilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
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

    for (const gift of pending) {
      try {
        const appOrigin = process.env.APP_ORIGIN ?? "https://gifted.page";
        const giftUrl   = `${appOrigin}/open/${gift.id}`;

        if (gift.recipientPhone && client && fromPhone) {
          const senderLabel = gift.senderName ? `${gift.senderName}` : "Someone special";
          await client.messages.create({
            to:   gift.recipientPhone,
            from: fromPhone,
            body: `${senderLabel} sent you a gift on gifted. ✨\n\nOpen it here: ${giftUrl}`,
          });
        }

        await db
          .update(gifts)
          .set({ scheduleDelivered: true })
          .where(eq(gifts.id, gift.id));

        console.log(`[scheduler] Delivered scheduled gift ${gift.id} to ${gift.recipientName}`);
      } catch (err) {
        console.error(`[scheduler] Failed to deliver gift ${gift.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] Error running scheduled gift delivery:", err);
  }
}

export function startScheduler() {
  const INTERVAL_MS = 10 * 60 * 1000;
  console.log("[scheduler] Started — checking every 10 minutes for scheduled gifts.");
  setInterval(sendScheduledGifts, INTERVAL_MS);
  sendScheduledGifts();
}
