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

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
 * Generates a 6-digit OTP and sends it via SMS to the recipient's phone on file.
 */
router.post("/gifted/send-otp", async (req, res) => {
  try {
    const { giftId } = req.body as { giftId: string };
    if (!giftId) {
      res.status(400).json({ error: "giftId is required" });
      return;
    }

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, giftId)).limit(1);
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

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.update(gifts).set({
      redemptionOtp: otp,
      redemptionOtpExpiry: expiry,
    }).where(eq(gifts.id, giftId));

    const client = getTwilioClient();
    const rawFrom = process.env.TWILIO_PHONE_NUMBER;
    if (!rawFrom) throw new Error("TWILIO_PHONE_NUMBER not configured");
    const fromNumber = normalizePhone(rawFrom);
    const toNumber   = normalizePhone(gift.recipientPhone);

    console.log(`[OTP] Sending from=${fromNumber} to=${toNumber}`);

    const msg = await client.messages.create({
      body: `Your gifted. verification code is ${otp}. Expires in 10 min. Do not share it with anyone. Reply STOP to opt out, HELP for help. Msg & data rates may apply.`,
      from: fromNumber,
      to: toNumber,
    });

    console.log(`[OTP] Twilio SID=${msg.sid} status=${msg.status} errorCode=${msg.errorCode}`);

    res.json({ success: true, message: "Verification code sent" });
  } catch (err: any) {
    console.error("send-otp error:", err);
    if (err.message?.includes("not configured")) {
      res.status(503).json({ error: "SMS service not configured" });
    } else {
      res.status(500).json({ error: "Failed to send verification code" });
    }
  }
});

/**
 * POST /api/gifted/verify-otp
 * Verifies the OTP and marks the gift as redemption-verified.
 */
router.post("/gifted/verify-otp", async (req, res) => {
  try {
    const { giftId, code } = req.body as { giftId: string; code: string };
    if (!giftId || !code) {
      res.status(400).json({ error: "giftId and code are required" });
      return;
    }

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, giftId)).limit(1);
    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }

    if (gift.redemptionVerified) {
      res.json({ success: true, alreadyVerified: true });
      return;
    }

    if (!gift.redemptionOtp || !gift.redemptionOtpExpiry) {
      res.status(400).json({ error: "No verification code was sent. Please request a new code." });
      return;
    }

    if (new Date() > gift.redemptionOtpExpiry) {
      res.status(400).json({ error: "Verification code has expired. Please request a new one." });
      return;
    }

    if (gift.redemptionOtp !== code.trim()) {
      res.status(400).json({ error: "Incorrect code. Please try again." });
      return;
    }

    await db.update(gifts).set({
      redemptionVerified: true,
      redemptionOtp: null,
      redemptionOtpExpiry: null,
    }).where(eq(gifts.id, giftId));

    res.json({ success: true });
  } catch (err) {
    console.error("verify-otp error:", err);
    res.status(500).json({ error: "Failed to verify code" });
  }
});

export default router;
