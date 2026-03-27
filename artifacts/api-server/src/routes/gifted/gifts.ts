import { Router } from "express";
import { Readable } from "stream";
import { nanoid } from "nanoid";
import { createHmac, timingSafeEqual } from "crypto";
import { db, gifts } from "@workspace/db";
import { eq, desc, isNull, and, sql } from "drizzle-orm";
import twilio from "twilio";
import { sendGiftOpenedNotice, sendPackageDeliveredEmail } from "../../lib/email";
import { ObjectStorageService, ObjectNotFoundError } from "../../lib/objectStorage";

function normPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

async function smsSender(senderPhone: string | null, body: string) {
  if (!senderPhone) return;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const tok  = process.env.TWILIO_AUTH_TOKEN;
  if (!from || !sid || !tok) return;
  try {
    const client = twilio(sid, tok);
    await client.messages.create({ from: normPhone(from), to: normPhone(senderPhone), body });
  } catch (err) {
    console.error("[smsSender] failed:", err);
  }
}

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

async function assertGiftIsDeletable(giftId: string): Promise<void> {
  const [gift] = await db
    .select({ paid: gifts.paid, amount: gifts.amount, redeemedAt: gifts.redeemedAt })
    .from(gifts)
    .where(eq(gifts.id, giftId))
    .limit(1);

  if (!gift) return;

  const hasPaidBalance =
    gift.paid === true &&
    gift.amount != null &&
    parseFloat(gift.amount) > 0 &&
    gift.redeemedAt == null;

  if (hasPaidBalance) {
    const err = new Error("This gift has an unredeemed balance — it can't be removed until the recipient claims their funds") as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }
}

async function registerAfterShipTracking(carrier: string, trackingNumber: string, giftId: string): Promise<string | null> {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.aftership.com/tracking/2024-07/trackings", {
      method: "POST",
      headers: {
        "as-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tracking_number: trackingNumber,
        slug: carrier,
        custom_fields: { gift_id: giftId },
      }),
    });
    const json = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (response.ok) {
      const id = (json?.data as Record<string, unknown> | undefined)?.tracking as Record<string, unknown> | undefined;
      const aftershipId = (id?.id ?? (json?.data as Record<string, unknown> | undefined)?.id) as string | undefined;
      console.log(`[AfterShip] Registered tracking for gift ${giftId}: ${carrier} ${trackingNumber} (id: ${aftershipId ?? "unknown"})`);
      return aftershipId ?? null;
    }
    const meta = json?.meta as Record<string, unknown> | undefined;
    if (meta?.code === 4003) {
      const aftershipId = (json?.data as Record<string, unknown> | undefined)?.id as string | undefined;
      console.log(`[AfterShip] Tracking already exists for gift ${giftId}: ${carrier} ${trackingNumber} (id: ${aftershipId ?? "unknown"})`);
      return aftershipId ?? null;
    }
    console.error(`[AfterShip] Registration failed for gift ${giftId}: HTTP ${response.status} ${response.statusText} — ${JSON.stringify(json)}`);
    return null;
  } catch (err) {
    console.error("[AfterShip] Failed to register tracking:", err);
    return null;
  }
}

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
      trackingCarrier,
      trackingNumber,
    } = req.body;

    if (!recipientName || !senderName || !experience || !occasion || !giftTitle) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const VALID_CARRIERS = new Set(["usps", "ups", "fedex", "dhl", "canada-post", "amazon", "lasership", "ontrac"]);
    const hasCarrier = !!trackingCarrier;
    const hasNumber = !!trackingNumber;
    if (hasCarrier !== hasNumber) {
      res.status(400).json({ error: "trackingCarrier and trackingNumber must be provided together" });
      return;
    }
    if (hasCarrier && !VALID_CARRIERS.has(trackingCarrier)) {
      res.status(400).json({ error: "Invalid tracking carrier" });
      return;
    }

    if (amount && parseFloat(amount) < 10) {
      res.status(400).json({ error: "Minimum gift balance is $10." });
      return;
    }

    const id = nanoid(12);
    const senderUserId  = (req as any).user?.id    ?? null;
    const senderEmail   = (req as any).user?.email ?? null;

    const scheduledForRaw = req.body.scheduledFor as string | undefined;
    const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : null;

    await db.insert(gifts).values({
      id,
      senderUserId,
      senderEmail,
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
      paid: !amount || parseFloat(amount) === 0,
      scheduledFor: scheduledFor,
      trackingCarrier: trackingCarrier || null,
      trackingNumber: trackingNumber || null,
    });

    if (trackingCarrier && trackingNumber) {
      registerAfterShipTracking(trackingCarrier, trackingNumber, id)
        .then((aftershipId) => {
          if (aftershipId) {
            db.update(gifts).set({ aftershipTrackingId: aftershipId }).where(eq(gifts.id, id)).catch(() => {});
          }
        })
        .catch(() => {});
    }

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
      hasRecipientPhone: !!gift.recipientPhone,
      redemptionVerified: gift.redemptionVerified ?? false,
    });
  } catch (err) {
    console.error("Error fetching gift:", err);
    res.status(500).json({ error: "Failed to fetch gift" });
  }
});

router.patch("/gifted/gifts/:id/opened", async (req, res) => {
  try {
    const { id } = req.params;
    const [gift] = await db
      .select({ id: gifts.id, openedAt: gifts.openedAt, senderPhone: gifts.senderPhone, senderEmail: gifts.senderEmail, senderName: gifts.senderName, recipientName: gifts.recipientName })
      .from(gifts).where(eq(gifts.id, id)).limit(1);
    if (!gift) return res.status(404).json({ error: "Gift not found" });
    if (!gift.openedAt) {
      await db.update(gifts).set({ openedAt: new Date() }).where(eq(gifts.id, id));
      if (gift.senderPhone) {
        smsSender(
          gift.senderPhone,
          `gifted. 🎁\n${gift.recipientName} just opened your gift! Head to your dashboard to see their reaction.\n\nReply STOP to opt out.`
        );
      } else if (gift.senderEmail) {
        sendGiftOpenedNotice({
          to: gift.senderEmail,
          senderName: gift.senderName,
          recipientName: gift.recipientName,
          giftId: gift.id,
        }).catch(() => {});
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("Error marking opened:", err);
    return res.status(500).json({ error: "Failed to mark opened" });
  }
});

router.patch("/gifted/gifts/:id/sender-phone", async (req, res) => {
  try {
    const { id } = req.params;
    const { senderPhone } = req.body as { senderPhone: string };
    if (!senderPhone || typeof senderPhone !== "string") {
      res.status(400).json({ error: "senderPhone is required" });
      return;
    }
    const [gift] = await db.select({ id: gifts.id }).from(gifts).where(eq(gifts.id, id)).limit(1);
    if (!gift) { res.status(404).json({ error: "Gift not found" }); return; }
    await db.update(gifts).set({ senderPhone: senderPhone.trim() }).where(eq(gifts.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Error updating senderPhone:", err);
    res.status(500).json({ error: "Failed to save phone" });
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
      .where(and(eq(gifts.senderUserId, userId), sql`(${gifts.senderHidden} IS NULL OR ${gifts.senderHidden} = false)`))
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
        scheduledFor: g.scheduledFor,
        scheduleDelivered: g.scheduleDelivered,
        createdAt: g.createdAt,
      }))
    );
  } catch (err) {
    console.error("Error fetching my-gifts:", err);
    res.status(500).json({ error: "Failed to fetch gifts" });
  }
});

// PATCH /api/gifted/gifts/:id/claim — link an anonymous gift to the authenticated user
router.patch("/gifted/gifts/:id/claim", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const { id } = req.params;

    const [exists] = await db
      .select({ id: gifts.id })
      .from(gifts)
      .where(eq(gifts.id, id))
      .limit(1);
    if (!exists) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }

    const updated = await db
      .update(gifts)
      .set({ senderUserId: userId })
      .where(and(eq(gifts.id, id), isNull(gifts.senderUserId)))
      .returning({ id: gifts.id });

    if (updated.length === 0) {
      res.status(409).json({ error: "Gift already owned" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Error claiming gift:", err);
    res.status(500).json({ error: "Failed to claim gift" });
  }
});

// PATCH /api/gifted/gifts/:id/save-received — link a gift to the authenticated recipient
router.patch("/gifted/gifts/:id/save-received", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const { id } = req.params;

    const [exists] = await db
      .select({ id: gifts.id, recipientUserId: gifts.recipientUserId, senderUserId: gifts.senderUserId, senderEmail: gifts.senderEmail })
      .from(gifts)
      .where(eq(gifts.id, id))
      .limit(1);

    if (!exists) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }

    const userEmail = (req as any).user?.email as string | null | undefined;

    const isSenderById = exists.senderUserId != null && exists.senderUserId === userId;
    const isSenderByEmail = !isSenderById && exists.senderUserId == null && userEmail != null && exists.senderEmail != null && exists.senderEmail.toLowerCase() === userEmail.toLowerCase();

    if (isSenderById || isSenderByEmail) {
      res.status(403).json({ error: "You cannot save your own gift as received", isSender: true });
      return;
    }

    if (exists.recipientUserId && exists.recipientUserId !== userId) {
      res.status(409).json({ error: "Gift already saved by another recipient" });
      return;
    }

    if (exists.recipientUserId === userId) {
      res.json({ ok: true, alreadySaved: true });
      return;
    }

    const updated = await db
      .update(gifts)
      .set({ recipientUserId: userId })
      .where(and(eq(gifts.id, id), isNull(gifts.recipientUserId)))
      .returning({ id: gifts.id });

    if (updated.length === 0) {
      res.status(409).json({ error: "Gift already saved by another recipient" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Error saving received gift:", err);
    res.status(500).json({ error: "Failed to save gift" });
  }
});

// GET /api/gifted/received-gifts — get all gifts where the authenticated user is the recipient
router.get("/gifted/received-gifts", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const userEmail = (req as any).user?.email as string | null | undefined;

    const rows = await db
      .select()
      .from(gifts)
      .where(and(
        eq(gifts.recipientUserId, userId),
        sql`(${gifts.recipientHidden} IS NULL OR ${gifts.recipientHidden} = false)`,
        sql`(${gifts.senderUserId} IS NULL OR ${gifts.senderUserId} != ${userId})`,
        ...(userEmail
          ? [sql`NOT (${gifts.senderUserId} IS NULL AND lower(${gifts.senderEmail}) = lower(${userEmail}))`]
          : [])
      ))
      .orderBy(sql`${gifts.openedAt} DESC NULLS LAST`, desc(gifts.createdAt));

    res.json(
      rows.map((g) => ({
        id: g.id,
        senderName: g.senderName,
        recipientName: g.recipientName,
        giftTitle: g.giftTitle,
        occasion: g.occasion,
        experience: g.experience,
        amount: (g.amount && parseFloat(g.amount) > 0) ? g.amount : null,
        openedAt: g.openedAt,
        redeemedAt: g.redeemedAt,
        createdAt: g.createdAt,
      }))
    );
  } catch (err) {
    console.error("Error fetching received gifts:", err);
    res.status(500).json({ error: "Failed to fetch received gifts" });
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
      `Hey ${recipientName || "there"} 🎁\n\n${senderName || "Someone"} made something just for you.\n\nTap to open:\n${giftUrl}`
    );
    res.json({ method: "email", mailtoUrl: `mailto:${contact.trim()}?subject=${subject}&body=${body}` });
    return;
  }

  if (isPhone) {
    // SMS to unverified recipients is not permitted — return the gift URL for the sender to forward themselves
    res.status(400).json({ error: "Please copy the link and send it directly from your own messages app." });
    return;
  }

  res.status(400).json({ error: "Please enter a valid phone number or email address." });
});

// PATCH /api/gifted/gifts/:id/hide-received — soft-delete: hides a received gift from recipient's dashboard
router.patch("/gifted/gifts/:id/hide-received", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const { id } = req.params;
    const [gift] = await db
      .select({ id: gifts.id, recipientUserId: gifts.recipientUserId })
      .from(gifts)
      .where(eq(gifts.id, id))
      .limit(1);

    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }
    if (gift.recipientUserId !== userId) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }

    await db.update(gifts).set({ recipientHidden: true }).where(eq(gifts.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Error hiding received gift:", err);
    res.status(500).json({ error: "Failed to hide gift" });
  }
});

// PATCH /api/gifted/gifts/:id/hide — soft-delete: hides a sent gift from sender's dashboard
router.patch("/gifted/gifts/:id/hide", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const { id } = req.params;
    const [gift] = await db
      .select({ id: gifts.id, senderUserId: gifts.senderUserId })
      .from(gifts)
      .where(eq(gifts.id, id))
      .limit(1);

    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }
    if (gift.senderUserId !== userId) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }

    await assertGiftIsDeletable(id);

    await db.update(gifts).set({ senderHidden: true }).where(eq(gifts.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    if (err?.statusCode === 409) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error("Error hiding gift:", err);
    res.status(500).json({ error: "Failed to hide gift" });
  }
});

// GET /api/gifted/gifts/:id/video/download — proxies the gift video through the server
// so mobile browsers can save it locally (Content-Disposition: attachment).
// Public endpoint — gated only by knowing the gift ID.
const _objectStorageService = new ObjectStorageService();
router.get("/gifted/gifts/:id/video/download", async (req, res) => {
  try {
    const { id } = req.params;
    const [gift] = await db
      .select({ videoPath: gifts.videoPath })
      .from(gifts)
      .where(eq(gifts.id, id))
      .limit(1);

    if (!gift || !gift.videoPath) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const objectFile = await _objectStorageService.getObjectEntityFile(gift.videoPath);
    const response = await _objectStorageService.downloadObject(objectFile, 3600);

    res.setHeader("Content-Disposition", 'attachment; filename="gift-video.mp4"');
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "content-disposition") {
        res.setHeader(key, value);
      }
    });
    res.status(response.status);

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    console.error("Error downloading gift video:", err);
    res.status(500).json({ error: "Failed to download video" });
  }
});

// GET /api/gifted/gifts/:id/template — return content-only fields for "Send again" pre-fill
// Only the owner of the gift can access this. No status/payment fields returned.
router.get("/gifted/gifts/:id/template", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    const [gift] = await db
      .select({
        senderUserId: gifts.senderUserId,
        recipientName: gifts.recipientName,
        senderName: gifts.senderName,
        experience: gifts.experience,
        occasion: gifts.occasion,
        giftTitle: gifts.giftTitle,
        personalNote: gifts.personalNote,
        videoPath: gifts.videoPath,
        photoPaths: gifts.photoPaths,
        playlistUrl: gifts.playlistUrl,
        extraLinks: gifts.extraLinks,
        amount: gifts.amount,
        intent: gifts.intent,
      })
      .from(gifts)
      .where(eq(gifts.id, req.params.id))
      .limit(1);

    if (!gift) { res.status(404).json({ error: "Gift not found" }); return; }
    if (gift.senderUserId !== userId) { res.status(403).json({ error: "Not your gift" }); return; }

    res.json({
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
      amount: gift.amount,
      intent: gift.intent,
    });
  } catch (err) {
    console.error("Error fetching gift template:", err);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// GET /api/gifted/gifts/:id/tracking — public, gated by knowing the gift ID
router.get("/gifted/gifts/:id/tracking", async (req, res) => {
  try {
    const { id } = req.params;
    const [gift] = await db
      .select({
        trackingCarrier: gifts.trackingCarrier,
        trackingNumber: gifts.trackingNumber,
        trackingStatus: gifts.trackingStatus,
        trackingDeliveredAt: gifts.trackingDeliveredAt,
      })
      .from(gifts)
      .where(eq(gifts.id, id))
      .limit(1);

    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }

    if (!gift.trackingCarrier || !gift.trackingNumber) {
      res.json({ hasTracking: false });
      return;
    }

    res.json({
      hasTracking: true,
      carrier: gift.trackingCarrier,
      trackingNumber: gift.trackingNumber,
      events: gift.trackingStatus ?? [],
      deliveredAt: gift.trackingDeliveredAt,
    });
  } catch (err) {
    console.error("Error fetching tracking:", err);
    res.status(500).json({ error: "Failed to fetch tracking" });
  }
});

// POST /api/gifted/aftership-webhook — AfterShip delivery webhook
router.post("/gifted/aftership-webhook", async (req, res) => {
  try {
    // AfterShip signature verification (HMAC-SHA256 over raw request body bytes)
    // AFTERSHIP_WEBHOOK_SECRET is the dedicated webhook signing secret from AfterShip dashboard.
    // In production (NODE_ENV=production), this secret is REQUIRED — missing it causes a hard fail.
    const webhookSecret = process.env.AFTERSHIP_WEBHOOK_SECRET;
    const isProduction = process.env.NODE_ENV === "production";
    const signature = req.headers["aftership-hmac-sha256"] as string | undefined;

    // Raw body is a Buffer because express.raw() is applied to this route in app.ts
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    if (webhookSecret) {
      if (!signature) {
        res.status(401).json({ error: "Missing webhook signature" });
        return;
      }
      const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("base64");
      try {
        const sigBuf = Buffer.from(signature, "base64");
        const expBuf = Buffer.from(expected, "base64");
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          res.status(401).json({ error: "Invalid webhook signature" });
          return;
        }
      } catch {
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }
    } else {
      // No webhook secret configured — skip signature check and log a warning.
      // We rely on AfterShip polling as the primary mechanism; webhooks are a bonus.
      console.warn(
        isProduction
          ? "[AfterShip webhook] AFTERSHIP_WEBHOOK_SECRET not set in production — accepting unauthenticated webhook (polling is primary)"
          : "[AfterShip webhook] AFTERSHIP_WEBHOOK_SECRET not set — skipping signature check (dev mode)"
      );
    }

    // Parse raw body into JSON (express.raw() doesn't auto-parse)
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      res.status(400).json({ error: "Invalid JSON payload" });
      return;
    }

    // AfterShip v4 webhook: body.msg is the tracking object directly (tag/checkpoints at msg level).
    // Also handle body.msg.tracking (forwarded) and body.data.tracking shapes.
    const msg = body.msg as Record<string, unknown> | undefined;
    const msgTracking = msg?.tracking as Record<string, unknown> | undefined;
    const dataTracking = (body.data as Record<string, unknown> | undefined)?.tracking as Record<string, unknown> | undefined;
    const msgDirect = typeof msg?.tag === "string" ? msg : undefined;
    const tracking: Record<string, unknown> | undefined = msgTracking ?? dataTracking ?? msgDirect;

    if (!tracking) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    const customFields = tracking.custom_fields as Record<string, string> | undefined;
    const giftId = customFields?.gift_id;
    if (!giftId) {
      res.status(200).json({ ok: true, skipped: "no gift_id" });
      return;
    }

    const tag = (tracking.tag as string | undefined) ?? "";
    const checkpoints = (tracking.checkpoints as Array<Record<string, unknown>> | undefined) ?? [];

    const events = checkpoints
      .map((cp) => ({
        status:    (cp.tag as string)            ?? "",
        message:   (cp.subtag_message as string) || (cp.message as string) || "",
        location:  (cp.city as string)           ?? (cp.state as string)   ?? (cp.country_name as string) ?? undefined,
        timestamp: (cp.checkpoint_time as string) ?? new Date().toISOString(),
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const isDelivered = tag === "Delivered";

    // Always update trackingStatus so richer checkpoint data is captured on any webhook
    await db
      .update(gifts)
      .set({
        trackingStatus: events.length > 0 ? events : undefined,
      })
      .where(eq(gifts.id, giftId));

    if (isDelivered) {
      // Atomically mark delivered only on first transition (idempotent SMS guard)
      // The WHERE clause fails silently if already delivered, preventing duplicate SMS
      const [gift] = await db
        .update(gifts)
        .set({ trackingDeliveredAt: new Date() })
        .where(and(eq(gifts.id, giftId), isNull(gifts.trackingDeliveredAt)))
        .returning({ senderPhone: gifts.senderPhone, senderEmail: gifts.senderEmail, senderName: gifts.senderName, recipientName: gifts.recipientName });

      // Only notify if this was the first delivery event (row was actually updated)
      if (gift) {
        if (gift.senderPhone) {
          smsSender(
            gift.senderPhone,
            `gifted. 🎁 Your gift to ${gift.recipientName} just arrived!\n\nReply STOP to opt out.`
          );
        } else if (gift.senderEmail) {
          sendPackageDeliveredEmail({
            to: gift.senderEmail,
            senderName: gift.senderName,
            recipientName: gift.recipientName,
          }).catch(() => {});
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[AfterShip webhook] error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
