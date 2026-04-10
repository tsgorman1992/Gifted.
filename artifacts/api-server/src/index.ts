import app from "./app";
import { startScheduler } from "./scheduler";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function runStartupMigrations() {
  try {
    await db.execute(sql`ALTER TABLE gifts ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS gifts_idempotency_key_unique ON gifts(idempotency_key) WHERE idempotency_key IS NOT NULL`);
  } catch (err) {
    console.warn("[migrations] Non-fatal migration warning:", err);
  }
}

/**
 * Batch sibling-payment self-heal.
 * Runs at startup and finds all unpaid gifts that have a paid sibling:
 *   same sender (by userId or email) + same recipientName + same amount
 *   created within ±5 minutes of each other.
 * Propagates paid=true + stripePaymentIntentId from the paid sibling.
 * This permanently fixes orphaned duplicates (e.g. gift XylYa8c-o5mt for Brian)
 * that were created before the idempotency/lazy-init fixes were deployed.
 */
async function healOrphanedDuplicates() {
  try {
    const healed = await db.execute(sql`
      UPDATE gifts AS g
      SET
        paid                    = true,
        stripe_payment_intent_id = s.stripe_payment_intent_id,
        sender_email            = COALESCE(s.sender_email, g.sender_email),
        sender_hidden           = true
      FROM (
        SELECT DISTINCT ON (unpaid.id)
          unpaid.id          AS unpaid_id,
          paid.stripe_payment_intent_id,
          paid.sender_email
        FROM gifts AS unpaid
        JOIN gifts AS paid ON (
          paid.paid = true
          AND paid.id <> unpaid.id
          AND (
            (unpaid.sender_user_id IS NOT NULL AND paid.sender_user_id = unpaid.sender_user_id)
            OR (unpaid.sender_email IS NOT NULL AND paid.sender_email = unpaid.sender_email)
          )
          AND paid.recipient_name = unpaid.recipient_name
          AND paid.amount = unpaid.amount
          AND paid.created_at BETWEEN (unpaid.created_at - INTERVAL '5 minutes')
                                  AND (unpaid.created_at + INTERVAL '5 minutes')
        )
        WHERE unpaid.paid = false
          AND unpaid.amount IS NOT NULL
          AND unpaid.amount::numeric > 0
          AND (unpaid.sender_user_id IS NOT NULL OR unpaid.sender_email IS NOT NULL)
      ) AS s
      WHERE g.id = s.unpaid_id
      RETURNING g.id
    `);
    const count = (healed as any).rowCount ?? 0;
    if (count > 0) {
      console.log(`[startup-heal] Healed ${count} orphaned duplicate gift(s) — paid status propagated from sibling.`);
    }
  } catch (err) {
    console.warn("[startup-heal] Non-fatal sibling heal warning:", err);
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!process.env.GIFTED_BASE_URL) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "GIFTED_BASE_URL is required in production. Set it to the canonical public URL (e.g. https://gifted.page) so OG share image URLs are reachable by link preview crawlers."
    );
  }
  console.warn("WARNING: GIFTED_BASE_URL is not set. OG share image URLs will use the request host, which may be incorrect in production.");
}

runStartupMigrations()
  .then(() => healOrphanedDuplicates())
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      if (process.env.GIFTED_BASE_URL) {
        console.log(`Share base URL: ${process.env.GIFTED_BASE_URL}`);
      }
      const twilioNum = process.env.TWILIO_PHONE_NUMBER;
      console.log(`[config] TWILIO_PHONE_NUMBER=${twilioNum ? twilioNum.slice(0, 6) + "****" + twilioNum.slice(-2) : "NOT SET"}`);
      startScheduler();
    });
  });
