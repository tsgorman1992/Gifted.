import app from "./app";
import { startScheduler } from "./scheduler";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function runStartupMigrations() {
  try {
    await db.execute(sql`ALTER TABLE gifts ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS gifts_idempotency_key_unique ON gifts(idempotency_key) WHERE idempotency_key IS NOT NULL`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS drip_step INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS drip_last_sent_at TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribed_marketing BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_last_sent_at TIMESTAMPTZ`);
  } catch (err) {
    console.warn("[migrations] Non-fatal migration warning:", err);
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

runStartupMigrations().then(() => {
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
