import { Router } from "express";
import twilio from "twilio";

const router = Router();

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not configured");
  return twilio(sid, token);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 7) return `+${digits}`;
  return phone;
}

/**
 * POST /api/gifted/send-link
 * Sends the gift link to a phone number via SMS.
 */
router.post("/api/gifted/send-link", async (req, res) => {
  try {
    const { phone, giftUrl, recipientName, senderName } = req.body as {
      phone: string;
      giftUrl: string;
      recipientName?: string;
      senderName?: string;
    };

    if (!phone || !giftUrl) {
      return res.status(400).json({ error: "phone and giftUrl are required" });
    }

    const to = normalizePhone(phone);
    const fromName = senderName || "Someone";
    const toName = recipientName ? ` ${recipientName}` : "";
    const body = `Hey${toName}, ${fromName} made you something 🎁\n${giftUrl}`;

    const client = getTwilioClient();
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!fromNumber) {
      return res.status(500).json({ error: "Twilio phone number not configured" });
    }

    await client.messages.create({ to, from: fromNumber, body });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[send-link] error:", err);
    return res.status(500).json({ error: "Failed to send SMS" });
  }
});

export default router;
