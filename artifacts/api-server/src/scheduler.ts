import { db } from "@workspace/db";
import { gifts, contactOccasions, contacts, usersTable } from "@workspace/db/schema";
import { and, isNotNull, isNull, lte, eq, sql } from "drizzle-orm";
import twilio from "twilio";
import { sendSenderNudgeEmail, sendSenderSecondNudgeEmail, sendUnredeemedSenderEmail, sendScheduledGiftReadyEmail, sendPackageDeliveredEmail, sendOccasionReminderEmail } from "./lib/email";

// ─── Floating occasion date helpers (server-side) ─────────────────────────────

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const d = new Date(year, month - 1, 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + (n - 1) * 7);
  return d.getDate();
}

function computeFloatingDate(floatingKey: string, year: number): { month: number; day: number } {
  switch (floatingKey) {
    case "mothers-day":  return { month: 5,  day: nthWeekdayOfMonth(year, 5,  0, 2) };
    case "fathers-day":  return { month: 6,  day: nthWeekdayOfMonth(year, 6,  0, 3) };
    case "thanksgiving": return { month: 11, day: nthWeekdayOfMonth(year, 11, 4, 4) };
    default:             return { month: 1,  day: 1 };
  }
}

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
          data?: Record<string, unknown> & { tracking?: Record<string, unknown> };
        };
        // ID-based endpoint: { data: { id, tag, checkpoints, ... } }
        // Slug/number endpoint: { data: { tracking: { id, tag, checkpoints, ... } } }
        const tracking = json?.data?.tracking ?? json?.data;
        if (!tracking || !tracking.tag) continue;

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
        console.log(`[AfterShip poll] ${gift.id}: tag=${tag}, checkpoints=${events.length}`);

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
    const oneDayAgo    = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ── First nudge: 24 hours after creation, not yet opened, no nudge yet ──
    const firstNudge = await db
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
          lte(gifts.createdAt, oneDayAgo),
        ),
      );

    for (const gift of firstNudge) {
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
          console.warn(`[scheduler] Gift ${gift.id} has no phone or email — nudge skipped`);
        }
        await db.update(gifts).set({ nudgeSentAt: new Date() }).where(eq(gifts.id, gift.id));
        console.log(`[scheduler] First nudge sent for gift ${gift.id}`);
      } catch (err) {
        console.error(`[scheduler] First nudge failed for gift ${gift.id}:`, err);
      }
    }

    // ── Second nudge: 7 days after creation, still not opened, first nudge already sent ──
    const secondNudge = await db
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
          isNotNull(gifts.nudgeSentAt),
          isNull(gifts.nudge2SentAt),
          lte(gifts.createdAt, sevenDaysAgo),
        ),
      );

    for (const gift of secondNudge) {
      try {
        if (gift.senderPhone) {
          const giftUrl = `${appOrigin}/open/${gift.id}`;
          const body = [
            `gifted. 🎁 Still here — ${gift.recipientName}'s gift hasn't been opened yet.`,
            ``,
            `Here's the link if you're ready to send it:`,
            giftUrl,
            ``,
            `Reply STOP to opt out.`,
          ].join("\n");
          await smsSender(gift.senderPhone, body);
        } else if (gift.senderEmail) {
          await sendSenderSecondNudgeEmail({
            to: gift.senderEmail,
            senderName: gift.senderName,
            recipientName: gift.recipientName,
            giftId: gift.id,
          });
        } else {
          console.warn(`[scheduler] Gift ${gift.id} has no phone or email — second nudge skipped`);
        }
        await db.update(gifts).set({ nudge2SentAt: new Date() }).where(eq(gifts.id, gift.id));
        console.log(`[scheduler] Second nudge sent for gift ${gift.id}`);
      } catch (err) {
        console.error(`[scheduler] Second nudge failed for gift ${gift.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] nudgeStaleGifts error:", err);
  }
}

async function sendUnredeemedReminders() {
  try {
    const appOrigin  = process.env.APP_ORIGIN ?? "https://gifted.page";
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // ── 60-day: sender email if gift paid + has amount + never redeemed ──
    const unredeemed = await db
      .select({
        id: gifts.id,
        recipientName: gifts.recipientName,
        senderName: gifts.senderName,
        senderEmail: gifts.senderEmail,
        amount: gifts.amount,
        recipientPhone: gifts.recipientPhone,
      })
      .from(gifts)
      .where(
        and(
          eq(gifts.paid, true),
          isNull(gifts.redeemedAt),
          isNotNull(gifts.amount),
          isNull(gifts.unredeemedFinalReminderSentAt),
          lte(gifts.createdAt, sixtyDaysAgo),
        ),
      );

    for (const gift of unredeemed) {
      try {
        // SMS the recipient if we have their phone (7-day bump before the sender gets the 60-day email)
        if (gift.recipientPhone) {
          const giftUrl = `${appOrigin}/open/${gift.id}`;
          const body = [
            `gifted. 🎁 You have a gift waiting from ${gift.senderName}!`,
            ``,
            `Your gift includes a cash balance — tap the link to open and claim it:`,
            giftUrl,
            ``,
            `Reply STOP to opt out.`,
          ].join("\n");
          await smsSender(gift.recipientPhone, body);
          console.log(`[scheduler] Recipient nudge SMS sent for unredeemed gift ${gift.id}`);
        }

        // Email the sender
        if (gift.senderEmail && gift.amount) {
          await sendUnredeemedSenderEmail({
            to: gift.senderEmail,
            senderName: gift.senderName,
            recipientName: gift.recipientName,
            amount: gift.amount,
          });
          console.log(`[scheduler] Unredeemed final notice sent to sender for gift ${gift.id}`);
        }

        await db.update(gifts)
          .set({ unredeemedFinalReminderSentAt: new Date() })
          .where(eq(gifts.id, gift.id));
      } catch (err) {
        console.error(`[scheduler] Unredeemed reminder failed for gift ${gift.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] sendUnredeemedReminders error:", err);
  }
}

async function sendOccasionReminders() {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();

    // 7-day advance + day-of, both gated to 12–13 UTC (= 7am EST / 8am EDT)
    const REMINDER_DAYS = [0, 7];
    const utcHour = now.getUTCHours();

    // All occasion reminders only fire in the 12:00–12:59 UTC window
    if (utcHour < 12 || utcHour >= 13) return;

    for (const daysAway of REMINDER_DAYS) {

      const target = new Date(now);
      target.setDate(target.getDate() + daysAway);
      const targetMonth = target.getMonth() + 1;
      const targetDay = target.getDate();

      // Fixed-date occasions matching today/7d
      const fixedUpcoming = await db
        .select({
          occasionId: contactOccasions.id,
          occasionLabel: contactOccasions.label,
          lastReminderSentYear: contactOccasions.lastReminderSentYear,
          contactName: contacts.name,
          userEmail: usersTable.email,
          userFirstName: usersTable.firstName,
        })
        .from(contactOccasions)
        .innerJoin(contacts, eq(contactOccasions.contactId, contacts.id))
        .innerJoin(usersTable, eq(contactOccasions.userId, usersTable.id))
        .where(
          and(
            eq(contactOccasions.month, targetMonth),
            eq(contactOccasions.day, targetDay),
          )
        );

      // Floating occasions — fetch all and filter by computed date
      const allFloating = await db
        .select({
          occasionId: contactOccasions.id,
          occasionLabel: contactOccasions.label,
          floatingKey: contactOccasions.floatingKey,
          lastReminderSentYear: contactOccasions.lastReminderSentYear,
          contactName: contacts.name,
          userEmail: usersTable.email,
          userFirstName: usersTable.firstName,
        })
        .from(contactOccasions)
        .innerJoin(contacts, eq(contactOccasions.contactId, contacts.id))
        .innerJoin(usersTable, eq(contactOccasions.userId, usersTable.id))
        .where(isNotNull(contactOccasions.floatingKey));

      const floatingUpcoming = allFloating.filter(occ => {
        if (!occ.floatingKey) return false;
        const { month, day } = computeFloatingDate(occ.floatingKey, currentYear);
        return month === targetMonth && day === targetDay;
      });

      const upcoming = [
        ...fixedUpcoming,
        ...floatingUpcoming.map(o => ({ ...o, floatingKey: undefined })),
      ];

      for (const occ of upcoming) {
        if (!occ.userEmail) continue;
        if (occ.lastReminderSentYear === currentYear) continue;

        try {
          await sendOccasionReminderEmail({
            to: occ.userEmail,
            userName: occ.userFirstName ?? "",
            contactName: occ.contactName,
            occasionLabel: occ.occasionLabel,
            daysAway,
          });

          await db
            .update(contactOccasions)
            .set({ lastReminderSentYear: currentYear })
            .where(eq(contactOccasions.id, occ.occasionId));
        } catch (err) {
          console.error(`[scheduler] Occasion reminder failed for occasion ${occ.occasionId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[scheduler] sendOccasionReminders error:", err);
  }
}

export function startScheduler() {
  const INTERVAL_MS = 10 * 60 * 1000;
  console.log("[scheduler] Started — checking every 10 minutes for scheduled gifts, tracking updates, stale gift nudges, unredeemed reminders, and occasion reminders.");
  setInterval(async () => {
    await sendScheduledGifts();
    await pollAfterShipTrackings();
    await nudgeStaleGifts();
    await sendUnredeemedReminders();
    await sendOccasionReminders();
  }, INTERVAL_MS);
  sendScheduledGifts();
  pollAfterShipTrackings();
  nudgeStaleGifts();
  sendUnredeemedReminders();
  sendOccasionReminders();
}
