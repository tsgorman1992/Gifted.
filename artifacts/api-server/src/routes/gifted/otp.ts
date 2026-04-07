import { Router } from "express";
import { db, gifts } from "@workspace/db";
import { eq } from "drizzle-orm";
import twilio from "twilio";

const router = Router();

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not configured");
  return twilio(sid, token);
}

function getVerifyServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) throw new Error("TWILIO_VERIFY_SERVICE_SID not configured");
  return sid;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 7) return `+${digits}`;
  return phone;
}

/**
 * POST /api/gifted/send-otp
 * Sends a verification code via Twilio Verify to the recipient's phone on file.
 * The code is managed entirely by Twilio — nothing is stored in our database.
 */
router.post("/gifted/send-otp", async (req, res) => {
  try {
    const { giftId } = req.body as { giftId: string };
    if (!giftId) {
      res.status(400).json({ error: "giftId is required" });
      return;
    }

    const [gift] = await db
      .select({
        id: gifts.id,
        recipientPhone: gifts.recipientPhone,
        redemptionVerified: gifts.redemptionVerified,
        redeemedAt: gifts.redeemedAt,
      })
      .from(gifts)
      .where(eq(gifts.id, giftId))
      .limit(1);

    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }

    if (!gift.recipientPhone) {
      res.status(400).json({ error: "No phone number on file for this gift" });
      return;
    }

    if (gift.redemptionVerified) {
      res.status(400).json({ error: "This gift has already been verified" });
      return;
    }

    if (gift.redeemedAt) {
      res.status(400).json({ error: "This gift has already been redeemed" });
      return;
    }

    const client = getTwilioClient();
    const serviceSid = getVerifyServiceSid();
    const to = normalizePhone(gift.recipientPhone);

    console.log(`[OTP/Verify] Sending verification to ${to} for gift ${giftId}`);

    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({ to, channel: "sms" });

    console.log(`[OTP/Verify] status=${verification.status} sid=${verification.sid}`);

    res.json({ success: true, message: "Verification code sent" });
  } catch (err: any) {
    console.error("[OTP/Verify] send-otp error:", err);
    if (err.message?.includes("not configured")) {
      res.status(503).json({ error: "SMS service not configured" });
    } else if (err.code === 60200) {
      res.status(400).json({ error: "Invalid phone number format" });
    } else if (err.code === 60203) {
      res.status(429).json({ error: "Max verification attempts reached. Please wait before trying again." });
    } else {
      res.status(500).json({ error: "Failed to send verification code" });
    }
  }
});

/**
 * POST /api/gifted/verify-otp
 * Verifies the code via Twilio Verify and marks the gift as redemption-verified.
 */
router.post("/gifted/verify-otp", async (req, res) => {
  try {
    const { giftId, code } = req.body as { giftId: string; code: string };
    if (!giftId || !code) {
      res.status(400).json({ error: "giftId and code are required" });
      return;
    }

    const [gift] = await db
      .select({
        id: gifts.id,
        recipientPhone: gifts.recipientPhone,
        redemptionVerified: gifts.redemptionVerified,
      })
      .from(gifts)
      .where(eq(gifts.id, giftId))
      .limit(1);

    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }

    if (gift.redemptionVerified) {
      res.json({ success: true, alreadyVerified: true });
      return;
    }

    if (!gift.recipientPhone) {
      res.status(400).json({ error: "No phone number on file for this gift" });
      return;
    }

    const client = getTwilioClient();
    const serviceSid = getVerifyServiceSid();
    const to = normalizePhone(gift.recipientPhone);

    console.log(`[OTP/Verify] Checking code for ${to}, gift ${giftId}`);

    const check = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to, code: code.trim() });

    console.log(`[OTP/Verify] check status=${check.status}`);

    if (check.status !== "approved") {
      res.status(400).json({ error: "Incorrect code. Please try again." });
      return;
    }

    await db
      .update(gifts)
      .set({ redemptionVerified: true })
      .where(eq(gifts.id, giftId));

    res.json({ success: true });
  } catch (err: any) {
    console.error("[OTP/Verify] verify-otp error:", err);
    if (err.code === 20404) {
      res.status(400).json({ error: "No verification code was sent. Please request a new code." });
    } else {
      res.status(500).json({ error: "Failed to verify code" });
    }
  }
});

export default router;
