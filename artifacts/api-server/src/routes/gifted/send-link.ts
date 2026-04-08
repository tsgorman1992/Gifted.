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
router.post("/gifted/send-link", async (req, res) => {
  try {
    const { phone, giftUrl, recipientName, senderName, selfSend } = req.body as {
      phone: string;
      giftUrl: string;
      recipientName?: string;
      senderName?: string;
      selfSend?: boolean;
    };

    if (!phone || !giftUrl) {
      return res.status(400).json({ error: "phone and giftUrl are required" });
    }

    const to = normalizePhone(phone);
    const fromName = senderName || "Someone";
    const toName = recipientName || "there";

    // selfSend: link is going to the sender's own phone so they can forward it.
    // Do NOT say "Tap to open" — they should copy and forward, not open the gift themselves.
    const body = selfSend
      ? `gifted.: Your gift link for ${toName} is ready.\n\nCopy this link and paste it into iMessage or WhatsApp — when it comes from your number, they'll open it:\n${giftUrl}\n\nReply STOP to unsubscribe, HELP for help. Msg&data rates may apply.`
      : `gifted. 🎁 ${fromName} made something just for you.\n\nTap to open:\n${giftUrl}\n\nReply STOP to unsubscribe, HELP for help. Msg&data rates may apply.`;

    const client = getTwilioClient();
    const rawFrom = process.env.TWILIO_PHONE_NUMBER;
    if (!rawFrom) {
      return res.status(500).json({ error: "Twilio phone number not configured" });
    }
    const fromNumber = normalizePhone(rawFrom);
    console.log(`[send-link] from=${fromNumber} to=${to}`);

    await client.messages.create({ to, from: fromNumber, body });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[send-link] error:", err);
    return res.status(500).json({ error: "Failed to send SMS" });
  }
});

export default router;
