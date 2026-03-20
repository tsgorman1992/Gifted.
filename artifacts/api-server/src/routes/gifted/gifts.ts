import { Router } from "express";
import { nanoid } from "nanoid";
import { db, gifts } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import twilio from "twilio";

function getTwilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio not configured");
  return twilio(sid, token);
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

const router = Router();

router.post("/gifted/gifts", async (req, res) => {
  try {
    const {
      recipientName,
      recipientPhone,
      senderName,
      experience,
      occasion,
      giftTitle,
      personalNote,
      videoPath,
      photoPaths,
      playlistUrl,
      extraLinks,
      amount,
      intent,
    } = req.body;

    if (!recipientName || !senderName || !experience || !occasion || !giftTitle) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (amount && parseFloat(amount) < 10) {
      res.status(400).json({ error: "Minimum gift balance is $10." });
      return;
    }

    const id = nanoid(12);
    const senderUserId = (req as any).user?.id ?? null;

    const scheduledForRaw = req.body.scheduledFor as string | undefined;
    const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : null;

    await db.insert(gifts).values({
      id,
      senderUserId,
      recipientName,
      recipientPhone: recipientPhone || null,
      senderName,
      experience,
      occasion,
      giftTitle,
      personalNote: personalNote || null,
      videoPath: videoPath || null,
      photoPaths: photoPaths && photoPaths.length > 0 ? photoPaths : null,
      playlistUrl: playlistUrl || null,
      extraLinks: (Array.isArray(extraLinks) && extraLinks.length > 0) ? extraLinks : null,
      amount: amount || null,
      intent: intent || null,
      scheduledFor: scheduledFor,
    });

    res.json({ id });
  } catch (err) {
    console.error("Error creating gift:", err);
    res.status(500).json({ error: "Failed to create gift" });
  }
});

router.get("/gifted/gifts/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [gift] = await db.select().from(gifts).where(eq(gifts.id, id)).limit(1);

    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }

    res.json({
      id: gift.id,
      senderUserId: gift.senderUserId,
      recipientName: gift.recipientName,
      senderName: gift.senderName,
      experience: gift.experience,
      occasion: gift.occasion,
      giftTitle: gift.giftTitle,
      personalNote: gift.personalNote,
      videoPath: gift.videoPath,
      photoPaths: gift.photoPaths,
      playlistUrl: gift.playlistUrl,
      extraLinks: gift.extraLinks,
      amount: (gift.amount && parseFloat(gift.amount) > 0) ? gift.amount : null,
      intent: gift.intent,
      paid: gift.paid,
      openedAt: gift.openedAt,
      redeemedAt: gift.redeemedAt,
      reaction: gift.reaction,
      reactionAt: gift.reactionAt,
      createdAt: gift.createdAt,
    });
  } catch (err) {
    console.error("Error fetching gift:", err);
    res.status(500).json({ error: "Failed to fetch gift" });
  }
});

router.patch("/gifted/gifts/:id/opened", async (req, res) => {
  try {
    const { id } = req.params;
    const [gift] = await db.select({ id: gifts.id, openedAt: gifts.openedAt }).from(gifts).where(eq(gifts.id, id)).limit(1);
    if (!gift) return res.status(404).json({ error: "Gift not found" });
    if (!gift.openedAt) {
      await db.update(gifts).set({ openedAt: new Date() }).where(eq(gifts.id, id));
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("Error marking opened:", err);
    return res.status(500).json({ error: "Failed to mark opened" });
  }
});

router.patch("/gifted/gifts/:id/reaction", async (req, res) => {
  try {
    const { id } = req.params;
    const { reaction } = req.body as { reaction: string };

    if (!reaction || typeof reaction !== "string" || reaction.trim().length === 0) {
      res.status(400).json({ error: "reaction is required" });
      return;
    }

    const [gift] = await db.select({ id: gifts.id }).from(gifts).where(eq(gifts.id, id)).limit(1);
    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }

    await db
      .update(gifts)
      .set({ reaction: reaction.trim(), reactionAt: new Date() })
      .where(eq(gifts.id, id));

    res.json({ ok: true });
  } catch (err) {
    console.error("Error saving reaction:", err);
    res.status(500).json({ error: "Failed to save reaction" });
  }
});

router.get("/gifted/my-gifts", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(gifts)
      .where(eq(gifts.senderUserId, userId))
      .orderBy(desc(gifts.createdAt));

    res.json(
      rows.map((g) => ({
        id: g.id,
        recipientName: g.recipientName,
        senderName: g.senderName,
        giftTitle: g.giftTitle,
        occasion: g.occasion,
        experience: g.experience,
        amount: g.amount,
        paid: g.paid,
        openedAt: g.openedAt,
        redeemedAt: g.redeemedAt,
        reaction: g.reaction,
        reactionAt: g.reactionAt,
        createdAt: g.createdAt,
      }))
    );
  } catch (err) {
    console.error("Error fetching my-gifts:", err);
    res.status(500).json({ error: "Failed to fetch gifts" });
  }
});

// POST /api/gifted/send-gift — send a gift link via SMS (phone) or mailto (email)
router.post("/gifted/send-gift", async (req, res) => {
  const { giftId, contact, recipientName, senderName, giftUrl } = req.body;

  if (!giftId || !contact || !giftUrl) {
    res.status(400).json({ error: "Missing required fields." });
    return;
  }

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
  const isPhone = /^[\d\s().+\-]{7,}$/.test(contact.trim());

  if (isEmail) {
    // Return mailto link — client opens it
    const subject = encodeURIComponent(`You've got a gift 🎁`);
    const body = encodeURIComponent(
      `Hey ${recipientName || "there"},\n\n${senderName || "Someone"} sent you a gift on gifted.\n\nOpen it here: ${giftUrl}\n\nEnjoy! 🎁`
    );
    res.json({ method: "email", mailtoUrl: `mailto:${contact.trim()}?subject=${subject}&body=${body}` });
    return;
  }

  if (isPhone) {
    try {
      const from = process.env.TWILIO_PHONE_NUMBER;
      if (!from) throw new Error("No Twilio number");
      const client = getTwilioClient();
      const to = normalizePhone(contact);
      const body = `Hey ${recipientName || "there"} 🎁\n\n${senderName || "Someone"} sent you a gift on gifted.\n\nOpen it here: ${giftUrl}`;
      await client.messages.create({ from, to, body });
      res.json({ method: "sms", success: true });
    } catch (err) {
      console.error("Twilio send error:", err);
      res.status(500).json({ error: "Could not send SMS. Please copy the link and send it manually." });
    }
    return;
  }

  res.status(400).json({ error: "Please enter a valid phone number or email address." });
});

export default router;
