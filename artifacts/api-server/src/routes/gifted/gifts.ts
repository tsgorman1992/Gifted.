import { Router } from "express";
import { nanoid } from "nanoid";
import { db, gifts } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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
      amount,
      intent,
    } = req.body;

    if (!recipientName || !senderName || !experience || !occasion || !giftTitle) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const id = nanoid(12);
    const senderUserId = (req as any).user?.id ?? null;

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
      amount: amount || null,
      intent: intent || null,
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
      amount: gift.amount,
      intent: gift.intent,
      paid: gift.paid,
      redeemedAt: gift.redeemedAt,
      createdAt: gift.createdAt,
    });
  } catch (err) {
    console.error("Error fetching gift:", err);
    res.status(500).json({ error: "Failed to fetch gift" });
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
        amount: g.amount,
        paid: g.paid,
        redeemedAt: g.redeemedAt,
        createdAt: g.createdAt,
      }))
    );
  } catch (err) {
    console.error("Error fetching my-gifts:", err);
    res.status(500).json({ error: "Failed to fetch gifts" });
  }
});

export default router;
