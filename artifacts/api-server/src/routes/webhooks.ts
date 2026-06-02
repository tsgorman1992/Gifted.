import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db, usersTable, emailLogs } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * Verify a Resend (Svix-based) webhook signature.
 *
 * Resend uses Svix for webhook delivery. The signing algorithm:
 *   1. signedContent = `${svix-id}.${svix-timestamp}.${rawBody}`
 *   2. key = base64-decode(secret after stripping "whsec_" prefix)
 *   3. HMAC-SHA256(signedContent, key) → base64
 *   4. Compare against each "v1,<sig>" entry in svix-signature header
 *
 * Returns true if at least one signature matches and the timestamp is recent.
 */
function verifyResendSignature(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  const svixId        = String(headers["svix-id"]        ?? "");
  const svixTimestamp = String(headers["svix-timestamp"] ?? "");
  const svixSig       = String(headers["svix-signature"] ?? "");

  if (!svixId || !svixTimestamp || !svixSig) return false;

  // Reject requests older than 5 minutes to prevent replay attacks
  const tsSec = parseInt(svixTimestamp, 10);
  if (isNaN(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 300) return false;

  // Strip "whsec_" prefix and base64-decode to get raw key bytes
  const rawKey = Buffer.from(secret.replace(/^whsec_/, ""), "base64");

  // Build the signed content string
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody.toString("utf8")}`;

  // Compute expected HMAC
  const expectedSig = createHmac("sha256", rawKey)
    .update(signedContent)
    .digest("base64");

  // svix-signature may contain multiple space-separated "v1,<sig>" values
  const sigs = svixSig.split(" ").map(s => s.replace(/^v1,/, ""));
  for (const sig of sigs) {
    try {
      const sigBuf = Buffer.from(sig, "base64");
      const expBuf = Buffer.from(expectedSig, "base64");
      if (sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)) {
        return true;
      }
    } catch {
      // malformed signature — try next
    }
  }
  return false;
}

/**
 * POST /api/webhooks/resend
 * Receives Resend delivery events and updates email_logs + user bounce/complaint flags.
 *
 * Events handled:
 *   email.delivered  → status = 'delivered'
 *   email.bounced    → status = 'bounced',    user.emailBounced    = true
 *   email.complained → status = 'complained', user.emailComplained = true
 */
router.post("/webhooks/resend", async (req, res) => {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  const rawBody: Buffer = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body ?? ""));

  if (webhookSecret) {
    const valid = verifyResendSignature(
      rawBody,
      req.headers as Record<string, string | string[] | undefined>,
      webhookSecret,
    );
    if (!valid) {
      console.warn("[resend-webhook] Invalid or missing signature — rejecting");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
  } else {
    console.warn(
      process.env.NODE_ENV === "production"
        ? "[resend-webhook] RESEND_WEBHOOK_SECRET not set in production — accepting unauthenticated event"
        : "[resend-webhook] RESEND_WEBHOOK_SECRET not set — skipping signature check (dev mode)"
    );
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
  } catch {
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  const eventType = body.type as string | undefined;
  const data      = body.data as Record<string, unknown> | undefined;
  const emailId   = data?.email_id as string | undefined;   // Resend's message ID

  if (!eventType || !emailId) {
    res.status(200).json({ ok: true, skipped: "missing type or email_id" });
    return;
  }

  const statusMap: Record<string, string> = {
    "email.delivered":  "delivered",
    "email.bounced":    "bounced",
    "email.complained": "complained",
  };

  const newStatus = statusMap[eventType];
  if (!newStatus) {
    // Unknown event type — acknowledge and ignore
    res.status(200).json({ ok: true, skipped: `unhandled event type: ${eventType}` });
    return;
  }

  try {
    // Update email_logs row matching the Resend message ID
    const updated = await db
      .update(emailLogs)
      .set({ status: newStatus })
      .where(eq(emailLogs.resendMessageId, emailId))
      .returning({ id: emailLogs.id, userId: emailLogs.userId, email: emailLogs.email });

    console.log(`[resend-webhook] ${eventType} for ${emailId} — updated ${updated.length} log row(s)`);

    // For bounces and complaints, flag the user so future emails are suppressed
    if (newStatus === "bounced" || newStatus === "complained") {
      const affectedEmails = [...new Set(updated.map(r => r.email).filter(Boolean))];
      const affectedUserIds = [...new Set(updated.map(r => r.userId).filter(Boolean))] as string[];

      const flagField = newStatus === "bounced"
        ? { emailBounced: true }
        : { emailComplained: true };

      // Update by userId when available (faster)
      for (const uid of affectedUserIds) {
        await db.update(usersTable).set(flagField).where(eq(usersTable.id, uid));
      }

      // Also update any users matched by email address who weren't caught above
      for (const email of affectedEmails) {
        await db.update(usersTable).set(flagField).where(eq(usersTable.email, email));
      }

      console.log(`[resend-webhook] Flagged users for ${newStatus}: ${affectedEmails.join(", ") || "(by userId only)"}`);
    }

    res.status(200).json({ ok: true, updated: updated.length });
  } catch (err) {
    console.error("[resend-webhook] DB error:", err);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

export default router;
