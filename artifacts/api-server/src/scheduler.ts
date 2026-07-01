import { db } from "@workspace/db";
import { gifts, contactOccasions, contacts, usersTable, emailLogs } from "@workspace/db/schema";
import { and, isNotNull, isNull, lte, eq, sql, or, inArray } from "drizzle-orm";
import twilio from "twilio";
import Stripe from "stripe";
import { sendSenderNudgeEmail, sendSenderSecondNudgeEmail, sendUnredeemedSenderEmail, sendScheduledGiftReadyEmail, sendPackageDeliveredEmail, sendOccasionReminderEmail, sendHappyBirthdayEmail, sendDripEmail1, sendDripEmail2, sendDripEmail3, sendMonthlyDigest, sendAbandonedGiftEmail } from "./lib/email";
import { ObjectStorageService } from "./lib/objectStorage";

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

function normPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

async function smsSender(phone: string | null, body: string) {
  if (!phone) return;
  const client = getTwilioClient();
  const rawFrom = process.env.TWILIO_PHONE_NUMBER;
  if (!client || !rawFrom) return;
  const from = normPhone(rawFrom);
  const to   = normPhone(phone);
  console.log(`[scheduler/smsSender] from=${from} to=${to}`);
  try {
    await client.messages.create({ to, from, body });
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
          eq(gifts.paid, true),           // never notify for unpaid gifts
        ),
      );

    if (!pending.length) return;

    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    const client    = getTwilioClient();
    const appOrigin = process.env.APP_ORIGIN ?? "https://gifted.page";

    for (const gift of pending) {
      try {
        const readyUrl = `${appOrigin}/api/ready/${gift.id}`;

        // SMS body — single link so iMessage/Android Messages unfurl the rich gift preview card
        const smsBody = [
          `gifted. ✨ Your moment for ${gift.recipientName} is ready — tap to open → copy the share link → text it to ${gift.recipientName} directly:`,
          readyUrl,
          ``,
          `Reply STOP to opt out.`,
        ].join("\n");

        let smsSent   = false;
        let emailSent = false;

        // ── SMS to the SENDER (send if phone available) ──
        if (gift.senderPhone && client && fromPhone) {
          try {
            await client.messages.create({
              to:   normPhone(gift.senderPhone),
              from: normPhone(fromPhone),
              body: smsBody,
            });
            smsSent = true;
            console.log(`[scheduler] SMS sent to sender for gift ${gift.id}`);
          } catch (smsErr) {
            console.error(`[scheduler] SMS failed for gift ${gift.id}:`, smsErr);
          }
        }

        // ── Email to the SENDER (always send if email available, SMS + email together) ──
        if (gift.senderEmail) {
          try {
            await sendScheduledGiftReadyEmail({
              to: gift.senderEmail,
              senderName: gift.senderName,
              recipientName: gift.recipientName,
              giftId: gift.id,
            });
            emailSent = true;
            console.log(`[scheduler] Email sent to sender for gift ${gift.id}`);
          } catch (emailErr) {
            console.error(`[scheduler] Email failed for gift ${gift.id}:`, emailErr);
          }
        }

        // ── Mark delivered if at least one channel succeeded, or no contact info at all ──
        const hasContact = !!(gift.senderPhone || gift.senderEmail);
        if (smsSent || emailSent || !hasContact) {
          await db
            .update(gifts)
            .set({ scheduleDelivered: true })
            .where(eq(gifts.id, gift.id));
          console.log(`[scheduler] Gift ${gift.id} marked delivered (sms=${smsSent}, email=${emailSent})`);
        } else {
          // Both channels failed — leave scheduleDelivered=false so next tick retries
          console.warn(`[scheduler] Gift ${gift.id} — all notifications failed, will retry next tick`);
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

        let events: TrackingEvent[] = checkpoints
          .map((cp) => ({
            status:    (cp.tag as string)             ?? "",
            message:   (cp.subtag_message as string)  || (cp.message as string) || "",
            location:  (cp.city as string)            ?? (cp.state as string)   ?? (cp.country_name as string) ?? undefined,
            timestamp: (cp.checkpoint_time as string) ?? new Date().toISOString(),
          }))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // AfterShip sometimes has a tag but no checkpoint events yet — synthesize one so the UI shows something
        if (events.length === 0 && tag && tag !== "Pending") {
          events = [{ status: tag, message: "", location: undefined, timestamp: new Date().toISOString() }];
        }

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
                `gifted. 📦 Your package for ${updated.recipientName} just arrived!\n\nReply STOP to opt out.`,
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
    // Skip gifts that are still waiting for their scheduled delivery — the scheduler
    // will notify the sender at the right time; nudging early would be confusing.
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
          or(isNull(gifts.scheduledFor), eq(gifts.scheduleDelivered, true)),
        ),
      );

    for (const gift of firstNudge) {
      try {
        if (gift.senderPhone) {
          const giftUrl = `${appOrigin}/open/${gift.id}`;
          const body = [
            `gifted. ✨ Your moment for ${gift.recipientName} hasn't been opened yet.`,
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
          or(isNull(gifts.scheduledFor), eq(gifts.scheduleDelivered, true)),
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
            `gifted. ✨ You have a moment waiting from ${gift.senderName}!`,
            ``,
            `Your moment includes a gift balance — tap the link to open and claim it:`,
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

/** Convert a UTC Date to its wall-clock components in Eastern Time (handles DST). */
function getEasternDateParts(utc: Date): { year: number; month: number; day: number; hour: number } {
  // toLocaleString with timeZone gives us the ET wall clock, parse it back
  const etStr = utc.toLocaleString("en-US", { timeZone: "America/New_York" });
  const etDate = new Date(etStr);
  return {
    year:  etDate.getFullYear(),
    month: etDate.getMonth() + 1,
    day:   etDate.getDate(),
    hour:  etDate.getHours(),
  };
}

async function sendOccasionReminders() {
  try {
    const now = new Date();
    const et = getEasternDateParts(now);
    const currentYear = et.year;

    // Fire once per day in the 8:00–8:59 AM ET window — uses ET date for correct day boundaries
    const REMINDER_DAYS = [0, 7];
    if (et.hour < 8 || et.hour >= 9) return;

    for (const daysAway of REMINDER_DAYS) {
      // Compute target date by doing pure UTC calendar arithmetic on ET date components.
      // Avoids timezone confusion — constructing a Date from "YYYY-MMT00:00:00" without
      // a timezone suffix parses as server local time (UTC on Replit), which would shift
      // the date back by the ET offset when converted back to ET.
      const targetDate  = new Date(Date.UTC(et.year, et.month - 1, et.day + daysAway));
      const targetMonth = targetDate.getUTCMonth() + 1;
      const targetDay   = targetDate.getUTCDate();

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

// Track users emailed today to avoid duplicates across scheduler ticks
const _birthdayEmailedToday = new Map<string, string>(); // userId → "YYYY-MM-DD"

async function sendBirthdayEmails() {
  try {
    const now = new Date();
    const et = getEasternDateParts(now);

    // Only send birthday emails between 8:00 AM and 8:59 PM ET so they land
    // at a sensible time of day and never cross into 11:59 PM ET territory.
    if (et.hour < 8 || et.hour >= 21) return;

    const mm = String(et.month).padStart(2, "0");
    const dd = String(et.day).padStart(2, "0");
    const todayMD = `${mm}-${dd}`; // "MM-DD" in ET
    const todayStr = `${et.year}-${mm}-${dd}`; // dedup key in ET

    const matches = await db
      .select({ id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName })
      .from(usersTable)
      .where(eq(usersTable.birthday, todayMD));

    for (const user of matches) {
      if (!user.email) continue;
      // Skip if already sent today (ET)
      if (_birthdayEmailedToday.get(user.id) === todayStr) continue;

      await sendHappyBirthdayEmail({
        to:        user.email,
        firstName: user.firstName ?? "",
      });
      _birthdayEmailedToday.set(user.id, todayStr);
    }

    // Prune old entries (keep map small)
    for (const [uid, date] of _birthdayEmailedToday) {
      if (date !== todayStr) _birthdayEmailedToday.delete(uid);
    }
  } catch (err) {
    console.error("[scheduler] sendBirthdayEmails error:", err);
  }
}

async function autoRefund90Days() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.warn("[scheduler] autoRefund90Days: STRIPE_SECRET_KEY not set — skipping");
    return;
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  try {
    const unredeemed = await db
      .select({
        id:                   gifts.id,
        stripePaymentIntentId: gifts.stripePaymentIntentId,
        recipientName:        gifts.recipientName,
        senderName:           gifts.senderName,
        amount:               gifts.amount,
      })
      .from(gifts)
      .where(
        and(
          eq(gifts.paid, true),
          isNull(gifts.redeemedAt),
          isNull(gifts.autoRefundedAt),
          isNotNull(gifts.stripePaymentIntentId),
          lte(gifts.createdAt, ninetyDaysAgo),
        ),
      );

    if (!unredeemed.length) return;

    for (const gift of unredeemed) {
      try {
        await stripe.refunds.create({ payment_intent: gift.stripePaymentIntentId! });
        await db
          .update(gifts)
          .set({ autoRefundedAt: new Date() })
          .where(eq(gifts.id, gift.id));
        console.log(`[scheduler] Auto-refunded gift ${gift.id} (${gift.amount ?? "unknown"}) for ${gift.recipientName} — 90-day unredeemed`);
      } catch (err) {
        console.error(`[scheduler] autoRefund90Days failed for gift ${gift.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] autoRefund90Days error:", err);
  }
}

async function deleteExpiredMedia() {
  const storage = new ObjectStorageService();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const oneYearAgo    = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  try {
    // Case A: redeemed 90+ days ago and still has media
    // Case B: paid, never redeemed, created 365+ days ago and still has media
    const expired = await db
      .select({ id: gifts.id, videoPath: gifts.videoPath, photoPaths: gifts.photoPaths })
      .from(gifts)
      .where(
        and(
          or(
            isNotNull(gifts.videoPath),
            isNotNull(gifts.photoPaths),
          ),
          or(
            and(isNotNull(gifts.redeemedAt), lte(gifts.redeemedAt, ninetyDaysAgo)),
            and(eq(gifts.paid, true), isNull(gifts.redeemedAt), lte(gifts.createdAt, oneYearAgo)),
          ),
        ),
      );

    if (!expired.length) return;

    for (const gift of expired) {
      try {
        let allDeleted = true;

        if (gift.videoPath) {
          try {
            await storage.deleteObjectEntity(gift.videoPath);
          } catch (err) {
            console.error(`[scheduler] Failed to delete video for gift ${gift.id}:`, err);
            allDeleted = false;
          }
        }

        if (gift.photoPaths && gift.photoPaths.length > 0) {
          for (const photoPath of gift.photoPaths) {
            try {
              await storage.deleteObjectEntity(photoPath);
            } catch (err) {
              console.error(`[scheduler] Failed to delete photo ${photoPath} for gift ${gift.id}:`, err);
              allDeleted = false;
            }
          }
        }

        if (allDeleted) {
          await db
            .update(gifts)
            .set({ videoPath: null, photoPaths: null })
            .where(eq(gifts.id, gift.id));
          console.log(`[scheduler] Media deleted for gift ${gift.id}`);
        } else {
          console.warn(`[scheduler] Media cleanup incomplete for gift ${gift.id} — will retry next tick`);
        }
      } catch (err) {
        console.error(`[scheduler] Error cleaning up media for gift ${gift.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] deleteExpiredMedia error:", err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilNextOccurrence(month: number, day: number, today: Date): number {
  const year = today.getFullYear();
  const msPerDay = 1000 * 60 * 60 * 24;
  const thisYear = new Date(year, month - 1, day);
  const diff = Math.floor((thisYear.getTime() - today.getTime()) / msPerDay);
  if (diff >= 0) return diff;
  const nextYear = new Date(year + 1, month - 1, day);
  return Math.floor((nextYear.getTime() - today.getTime()) / msPerDay);
}

// ─── Drip email campaigns ──────────────────────────────────────────────────────

async function sendDripEmails() {
  try {
    const threeDaysAgo  = new Date(Date.now() - 3  * 24 * 60 * 60 * 1000);
    const sevenDaysAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── Step 0 → 1: account >3 days old, never sent a paid gift ──
    // Personalise with the first gift they ever received (the one that drove signup).
    const step0Candidates = await db
      .select({
        id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName,
        emailBounced: usersTable.emailBounced, emailComplained: usersTable.emailComplained,
      })
      .from(usersTable)
      .where(and(
        isNotNull(usersTable.email),
        eq(usersTable.dripStep, 0),
        eq(usersTable.unsubscribedMarketing, false),
        lte(usersTable.createdAt, threeDaysAgo),
      ));

    if (step0Candidates.length) {
      const ids = step0Candidates.map(u => u.id);
      const hasSentRows = await db
        .selectDistinct({ senderUserId: gifts.senderUserId })
        .from(gifts)
        .where(and(eq(gifts.paid, true), inArray(gifts.senderUserId, ids)));
      const hasSent = new Set(hasSentRows.map(r => r.senderUserId));
      const eligible = step0Candidates.filter(u => !hasSent.has(u.id));

      // Batch-load the first received gift for each eligible user
      const eligibleIds = eligible.map(u => u.id);
      const receivedGiftRows = eligibleIds.length
        ? await db
            .select({
              recipientUserId: gifts.recipientUserId,
              senderName:      gifts.senderName,
              occasion:        gifts.occasion,
              amount:          gifts.amount,
              createdAt:       gifts.createdAt,
            })
            .from(gifts)
            .where(and(
              inArray(gifts.recipientUserId, eligibleIds),
              eq(gifts.paid, true),
            ))
        : [];

      // Keep only the earliest received gift per user
      const firstReceivedMap = new Map<string, { senderName: string; occasion: string; amount: string | null }>();
      for (const row of receivedGiftRows) {
        if (!row.recipientUserId) continue;
        const existing = firstReceivedMap.get(row.recipientUserId);
        if (!existing || row.createdAt! < (existing as any)._createdAt) {
          firstReceivedMap.set(row.recipientUserId, {
            senderName: row.senderName,
            occasion:   row.occasion,
            amount:     row.amount,
            _createdAt: row.createdAt,
          } as any);
        }
      }

      // Dedupe: batch-check who already received drip1 (prevents double-send on scheduler overlap)
      const alreadySentDrip1Rows = eligibleIds.length
        ? await db.select({ userId: emailLogs.userId }).from(emailLogs)
            .where(and(eq(emailLogs.type, "drip1"), inArray(emailLogs.userId, eligibleIds)))
        : [];
      const alreadySentDrip1 = new Set(alreadySentDrip1Rows.map(r => r.userId).filter(Boolean) as string[]);

      for (const user of eligible) {
        try {
          // Already sent — just advance step to stay in sync
          if (alreadySentDrip1.has(user.id)) {
            await db.update(usersTable).set({ dripStep: 1, dripLastSentAt: new Date() }).where(eq(usersTable.id, user.id));
            console.log(`[drip] Email 1 already logged for ${user.email} — advancing step`);
            continue;
          }
          // Bounced/complained — advance step to exit queue without sending
          if (user.emailBounced || user.emailComplained) {
            await db.update(usersTable).set({ dripStep: 1, dripLastSentAt: new Date() }).where(eq(usersTable.id, user.id));
            console.log(`[drip] Skipping email 1 for ${user.email} (suppressed) — advancing step`);
            continue;
          }
          const received = firstReceivedMap.get(user.id);
          const sent = await sendDripEmail1({
            to:         user.email!,
            firstName:  user.firstName,
            userId:     user.id,
            senderName: received?.senderName ?? null,
            occasion:   received?.occasion   ?? null,
            amount:     received?.amount     ?? null,
          });
          if (sent) {
            await db.update(usersTable)
              .set({ dripStep: 1, dripLastSentAt: new Date() })
              .where(eq(usersTable.id, user.id));
            console.log(`[drip] Email 1 sent to ${user.email}`);
          }
        } catch (err) {
          console.error(`[drip] Email 1 failed for ${user.id}:`, err);
        }
      }
    }

    // ── Step 1 → 2: Email 1 sent >7 days ago (~day 10 post-signup), still no gift sent ──
    const step1Candidates = await db
      .select({
        id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName,
        emailBounced: usersTable.emailBounced, emailComplained: usersTable.emailComplained,
      })
      .from(usersTable)
      .where(and(
        isNotNull(usersTable.email),
        eq(usersTable.dripStep, 1),
        eq(usersTable.unsubscribedMarketing, false),
        isNotNull(usersTable.dripLastSentAt),
        lte(usersTable.dripLastSentAt, sevenDaysAgo),
      ));

    if (step1Candidates.length) {
      const ids = step1Candidates.map(u => u.id);
      const hasSentRows = await db
        .selectDistinct({ senderUserId: gifts.senderUserId })
        .from(gifts)
        .where(and(eq(gifts.paid, true), inArray(gifts.senderUserId, ids)));
      const hasSent = new Set(hasSentRows.map(r => r.senderUserId));
      const eligible = step1Candidates.filter(u => !hasSent.has(u.id));

      const eligibleIds2 = eligible.map(u => u.id);
      const alreadySentDrip2Rows = eligibleIds2.length
        ? await db.select({ userId: emailLogs.userId }).from(emailLogs)
            .where(and(eq(emailLogs.type, "drip2"), inArray(emailLogs.userId, eligibleIds2)))
        : [];
      const alreadySentDrip2 = new Set(alreadySentDrip2Rows.map(r => r.userId).filter(Boolean) as string[]);

      for (const user of eligible) {
        try {
          if (alreadySentDrip2.has(user.id)) {
            await db.update(usersTable).set({ dripStep: 2, dripLastSentAt: new Date() }).where(eq(usersTable.id, user.id));
            console.log(`[drip] Email 2 already logged for ${user.email} — advancing step`);
            continue;
          }
          if (user.emailBounced || user.emailComplained) {
            await db.update(usersTable).set({ dripStep: 2, dripLastSentAt: new Date() }).where(eq(usersTable.id, user.id));
            console.log(`[drip] Skipping email 2 for ${user.email} (suppressed) — advancing step`);
            continue;
          }
          const sent = await sendDripEmail2({ to: user.email!, firstName: user.firstName, userId: user.id });
          if (sent) {
            await db.update(usersTable)
              .set({ dripStep: 2, dripLastSentAt: new Date() })
              .where(eq(usersTable.id, user.id));
            console.log(`[drip] Email 2 sent to ${user.email}`);
          }
        } catch (err) {
          console.error(`[drip] Email 2 failed for ${user.id}:`, err);
        }
      }
    }

    // ── Step 2 → 3: Email 2 sent >30 days ago, still no gift sent ──
    const step2Candidates = await db
      .select({
        id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName,
        emailBounced: usersTable.emailBounced, emailComplained: usersTable.emailComplained,
      })
      .from(usersTable)
      .where(and(
        isNotNull(usersTable.email),
        eq(usersTable.dripStep, 2),
        eq(usersTable.unsubscribedMarketing, false),
        isNotNull(usersTable.dripLastSentAt),
        lte(usersTable.dripLastSentAt, thirtyDaysAgo),
      ));

    if (step2Candidates.length) {
      const ids = step2Candidates.map(u => u.id);
      const hasSentRows = await db
        .selectDistinct({ senderUserId: gifts.senderUserId })
        .from(gifts)
        .where(and(eq(gifts.paid, true), inArray(gifts.senderUserId, ids)));
      const hasSent = new Set(hasSentRows.map(r => r.senderUserId));
      const eligible = step2Candidates.filter(u => !hasSent.has(u.id));

      if (eligible.length) {
        // Batch-load upcoming occasions for all eligible users
        const eligibleIds = eligible.map(u => u.id);
        const now = new Date();
        const et = getEasternDateParts(now);
        const today = new Date(et.year, et.month - 1, et.day);

        const allOccasions = await db
          .select({
            userId:      contactOccasions.userId,
            label:       contactOccasions.label,
            month:       contactOccasions.month,
            day:         contactOccasions.day,
            floatingKey: contactOccasions.floatingKey,
            contactName: contacts.name,
          })
          .from(contactOccasions)
          .innerJoin(contacts, eq(contactOccasions.contactId, contacts.id))
          .where(inArray(contactOccasions.userId, eligibleIds));

        const occasionMap = new Map<string, Array<{ contactName: string; label: string; daysAway: number }>>();
        for (const occ of allOccasions) {
          let month = occ.month;
          let day   = occ.day;
          if (occ.floatingKey) {
            const fd = computeFloatingDate(occ.floatingKey, et.year);
            month = fd.month; day = fd.day;
          }
          if (!month || !day) continue;
          const daysAway = daysUntilNextOccurrence(month, day, today);
          if (daysAway > 60) continue;
          if (!occasionMap.has(occ.userId)) occasionMap.set(occ.userId, []);
          occasionMap.get(occ.userId)!.push({ contactName: occ.contactName, label: occ.label, daysAway });
        }
        for (const list of occasionMap.values()) list.sort((a, b) => a.daysAway - b.daysAway);

        const eligibleIds3 = eligible.map(u => u.id);
        const alreadySentDrip3Rows = eligibleIds3.length
          ? await db.select({ userId: emailLogs.userId }).from(emailLogs)
              .where(and(eq(emailLogs.type, "drip3"), inArray(emailLogs.userId, eligibleIds3)))
          : [];
        const alreadySentDrip3 = new Set(alreadySentDrip3Rows.map(r => r.userId).filter(Boolean) as string[]);

        for (const user of eligible) {
          try {
            if (alreadySentDrip3.has(user.id)) {
              await db.update(usersTable).set({ dripStep: 3, dripLastSentAt: new Date() }).where(eq(usersTable.id, user.id));
              console.log(`[drip] Email 3 already logged for ${user.email} — advancing step`);
              continue;
            }
            if (user.emailBounced || user.emailComplained) {
              await db.update(usersTable).set({ dripStep: 3, dripLastSentAt: new Date() }).where(eq(usersTable.id, user.id));
              console.log(`[drip] Skipping email 3 for ${user.email} (suppressed) — advancing step`);
              continue;
            }
            const upcomingOccasions = occasionMap.get(user.id) ?? [];
            const sent = await sendDripEmail3({
              to:               user.email!,
              firstName:        user.firstName,
              userId:           user.id,
              upcomingOccasions,
            });
            if (sent) {
              await db.update(usersTable)
                .set({ dripStep: 3, dripLastSentAt: new Date() })
                .where(eq(usersTable.id, user.id));
              console.log(`[drip] Email 3 sent to ${user.email}`);
            }
          } catch (err) {
            console.error(`[drip] Email 3 failed for ${user.id}:`, err);
          }
        }
      }
    }
  } catch (err) {
    console.error("[scheduler] sendDripEmails error:", err);
  }
}

// ─── Abandoned gift nudge ──────────────────────────────────────────────────────

async function sendAbandonedGiftEmails() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const abandoned = await db
      .select({
        id:           gifts.id,
        senderUserId: gifts.senderUserId,
        senderEmail:  gifts.senderEmail,
        senderName:   gifts.senderName,
        recipientName: gifts.recipientName,
      })
      .from(gifts)
      .where(and(
        eq(gifts.paid, false),
        lte(gifts.createdAt, oneDayAgo),
        isNull(gifts.autoRefundedAt),
        isNotNull(gifts.recipientName),
        isNotNull(gifts.senderUserId),
        isNotNull(gifts.senderEmail),
        isNull(gifts.abandonedNudgeSentAt),
      ));

    for (const gift of abandoned) {
      try {
        if (!gift.senderEmail || !gift.senderUserId) continue;
        const sent = await sendAbandonedGiftEmail({
          to:            gift.senderEmail,
          userId:        gift.senderUserId,
          recipientName: gift.recipientName!,
        });
        if (sent) {
          await db.update(gifts)
            .set({ abandonedNudgeSentAt: new Date() })
            .where(eq(gifts.id, gift.id));
          console.log(`[abandoned] Nudge sent for gift ${gift.id}`);
        }
      } catch (err) {
        console.error(`[abandoned] Failed for gift ${gift.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] sendAbandonedGiftEmails error:", err);
  }
}

// ─── Monthly occasions digest ──────────────────────────────────────────────────

async function sendMonthlyDigestEmails() {
  try {
    const now = new Date();
    const et = getEasternDateParts(now);

    // Only send during the 8:00–8:59 AM ET window; per-user digestLastSentAt
    // month check ensures each user receives at most one digest per month,
    // and catch-up works on any day after the 1st if deploy was mid-month.
    if (et.hour < 8 || et.hour >= 9) return;

    // Get all users with email who haven't unsubscribed
    const allUsers = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        digestLastSentAt: usersTable.digestLastSentAt,
      })
      .from(usersTable)
      .where(and(
        isNotNull(usersTable.email),
        eq(usersTable.unsubscribedMarketing, false),
      ));

    // Filter to those who haven't received digest this month yet
    const eligible = allUsers.filter(u => {
      if (!u.digestLastSentAt) return true;
      const sentEt = getEasternDateParts(u.digestLastSentAt);
      return sentEt.year !== et.year || sentEt.month !== et.month;
    });

    if (!eligible.length) return;

    // Batch-load occasions for all eligible users
    const eligibleIds = eligible.map(u => u.id);
    const allOccasions = await db
      .select({
        userId: contactOccasions.userId,
        label: contactOccasions.label,
        month: contactOccasions.month,
        day: contactOccasions.day,
        contactName: contacts.name,
      })
      .from(contactOccasions)
      .innerJoin(contacts, eq(contactOccasions.contactId, contacts.id))
      .where(and(
        inArray(contactOccasions.userId, eligibleIds),
        isNotNull(contactOccasions.month),
        isNotNull(contactOccasions.day),
      ));

    // Group occasions by userId, computing days until next occurrence
    const today = new Date(et.year, et.month - 1, et.day);
    const DIGEST_WINDOW = 60;

    const occasionMap = new Map<string, Array<{ contactName: string; label: string; daysAway: number }>>();
    for (const occ of allOccasions) {
      if (!occ.month || !occ.day) continue;
      const daysAway = daysUntilNextOccurrence(occ.month, occ.day, today);
      if (daysAway > DIGEST_WINDOW) continue;
      if (!occasionMap.has(occ.userId)) occasionMap.set(occ.userId, []);
      occasionMap.get(occ.userId)!.push({ contactName: occ.contactName, label: occ.label, daysAway });
    }

    // Sort each user's occasions by daysAway ascending
    for (const list of occasionMap.values()) {
      list.sort((a, b) => a.daysAway - b.daysAway);
    }

    for (const user of eligible) {
      try {
        const upcomingOccasions = occasionMap.get(user.id) ?? [];
        const sent = await sendMonthlyDigest({
          to: user.email!,
          firstName: user.firstName,
          userId: user.id,
          upcomingOccasions,
        });
        if (sent) {
          await db.update(usersTable)
            .set({ digestLastSentAt: new Date() })
            .where(eq(usersTable.id, user.id));
          console.log(`[digest] Monthly digest sent to ${user.email}`);
        }
      } catch (err) {
        console.error(`[digest] Failed for ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] sendMonthlyDigestEmails error:", err);
  }
}

export function startScheduler() {
  const INTERVAL_MS = 10 * 60 * 1000;
  console.log("[scheduler] Started — checking every 10 minutes for scheduled gifts, tracking updates, stale gift nudges, unredeemed reminders, occasion reminders, drip emails, abandoned gift nudges, monthly digest, expired media cleanup, 90-day auto-refunds, and birthday emails.");
  setInterval(async () => {
    await sendScheduledGifts();
    await pollAfterShipTrackings();
    await nudgeStaleGifts();
    await sendUnredeemedReminders();
    await sendOccasionReminders();
    await sendBirthdayEmails();
    await sendDripEmails();
    await sendAbandonedGiftEmails();
    await sendMonthlyDigestEmails();
    await deleteExpiredMedia();
    await autoRefund90Days();
  }, INTERVAL_MS);
  sendScheduledGifts();
  pollAfterShipTrackings();
  nudgeStaleGifts();
  sendUnredeemedReminders();
  sendOccasionReminders();
  sendBirthdayEmails();
  sendDripEmails();
  sendAbandonedGiftEmails();
  sendMonthlyDigestEmails();
  deleteExpiredMedia();
  autoRefund90Days();
}
