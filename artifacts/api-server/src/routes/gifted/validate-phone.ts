import { Router } from "express";
import twilio from "twilio";

const router = Router();

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 7) return `+${digits}`;
  return phone;
}

function isUsNumber(e164: string): boolean {
  return e164.startsWith("+1") && e164.length === 12;
}

/**
 * POST /gifted/validate-phone
 * Validates a phone number via Twilio Lookup v2.
 * Only validates US numbers — non-US numbers pass through.
 * On any Twilio error or timeout, returns { valid: true } (fail open).
 */
router.post("/gifted/validate-phone", async (req, res) => {
  try {
    const { phone } = req.body as { phone: string };
    if (!phone) {
      res.status(400).json({ error: "phone is required" });
      return;
    }

    const e164 = normalizePhone(phone);

    if (!isUsNumber(e164)) {
      res.json({ valid: true });
      return;
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      res.json({ valid: true });
      return;
    }

    const client = twilio(sid, token);

    const result = await Promise.race([
      client.lookups.v2.phoneNumbers(e164).fetch(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Twilio Lookup timeout")), 5000)
      ),
    ]);

    res.json({ valid: result.valid });
  } catch (err: any) {
    console.error("[validate-phone] Twilio Lookup error (failing open):", err?.message ?? err);
    res.json({ valid: true });
  }
});

export default router;
