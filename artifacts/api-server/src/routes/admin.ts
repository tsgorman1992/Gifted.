import { Router } from "express";
import { db, gifts, usersTable, emailLogs } from "@workspace/db";
import { desc, isNotNull, isNull, eq, ilike, count, gte, lte, ne, and, sql } from "drizzle-orm";
import { physicalGifts, conversations, messages } from "@workspace/db";
import rateLimit from "express-rate-limit";

const router = Router();

// Protect all admin endpoints — 30 requests per 5 minutes per IP.
// A real operator will never come close to this; it stops brute-force
// password guessing without locking out legitimate access.
const adminRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait before trying again." },
  skip: (req) => {
    // Never rate-limit correctly authenticated requests
    const pw = process.env.ADMIN_PASSWORD;
    const provided =
      (req.headers["x-admin-key"] as string | undefined) ||
      (req.query.key as string | undefined);
    return !!pw && provided === pw;
  },
});

router.use(adminRateLimit);

function checkAuth(req: import("express").Request, res: import("express").Response): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    res.status(503).json({ error: "Admin not configured (ADMIN_PASSWORD not set)" });
    return false;
  }
  const provided =
    (req.headers["x-admin-key"] as string | undefined) ||
    (req.query.key as string | undefined);
  if (provided !== pw) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/admin/stats", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [all, userCount, newUsersResult] = await Promise.all([
      db.select({
        id:           gifts.id,
        paid:         gifts.paid,
        amount:       gifts.amount,
        openedAt:     gifts.openedAt,
        redeemedAt:   gifts.redeemedAt,
        cashoutPaidAt:gifts.cashoutPaidAt,
        experience:   gifts.experience,
        senderUserId: gifts.senderUserId,
        createdAt:    gifts.createdAt,
      }).from(gifts),
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, oneWeekAgo)),
    ]);

    const paidGifts     = all.filter(g => g.paid);
    const redeemedGifts = paidGifts.filter(g => g.redeemedAt != null);

    const total          = all.length;
    const paid           = paidGifts.length;
    const redeemed       = redeemedGifts.length;
    const pending        = redeemedGifts.filter(g => g.cashoutPaidAt == null).length;
    const totalUsers     = Number(userCount[0]?.count ?? 0);
    const newUsersWeek   = Number(newUsersResult[0]?.count ?? 0);

    const volume = paidGifts
      .filter(g => g.amount)
      .reduce((sum, g) => sum + parseFloat(g.amount ?? "0"), 0);

    const pendingVolume = redeemedGifts
      .filter(g => g.cashoutPaidAt == null && g.amount)
      .reduce((sum, g) => sum + parseFloat(g.amount ?? "0"), 0);

    const feeRevenue = volume * 0.08;

    const paidWithAmount = paidGifts.filter(g => g.amount && parseFloat(g.amount) > 0);
    const avgAmount = paidWithAmount.length > 0
      ? paidWithAmount.reduce((sum, g) => sum + parseFloat(g.amount!), 0) / paidWithAmount.length
      : 0;

    // Open rate = opened paid gifts / all paid gifts (includes free gifts)
    const paidOpened = paidGifts.filter(g => g.openedAt != null).length;
    const openRate = paid > 0 ? Math.round((paidOpened / paid) * 100) : 0;

    // Redeem rate = redeemed cash gifts / opened cash gifts only
    // Free gifts (no amount) are excluded — they can never be redeemed
    const paidOpenedWithAmount = paidGifts.filter(g => g.openedAt != null && g.amount && parseFloat(g.amount) > 0).length;
    const redeemRate = paidOpenedWithAmount > 0 ? Math.round((redeemed / paidOpenedWithAmount) * 100) : 0;

    // Repeat senders — senderUserIds with > 1 paid gift
    const senderCounts: Record<string, number> = {};
    for (const g of paidGifts) {
      if (g.senderUserId) senderCounts[g.senderUserId] = (senderCounts[g.senderUserId] ?? 0) + 1;
    }
    const repeatSenders = Object.values(senderCounts).filter(c => c > 1).length;

    // Top experience among paid gifts
    const expCounts: Record<string, number> = {};
    for (const g of paidGifts) {
      if (g.experience) expCounts[g.experience] = (expCounts[g.experience] ?? 0) + 1;
    }
    const topExperience = Object.entries(expCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    res.json({
      total, paid, redeemed, pending,
      volume, pendingVolume, feeRevenue, avgAmount,
      totalUsers, newUsersWeek,
      openRate, redeemRate,
      repeatSenders, topExperience,
    });
  } catch (err) {
    console.error("[admin] stats error:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/admin/cashouts", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const rows = await db
      .select()
      .from(gifts)
      .where(isNotNull(gifts.redeemedAt))
      .orderBy(desc(gifts.redeemedAt));

    res.json(rows.map(g => ({
      id:            g.id,
      recipientName: g.recipientName,
      senderName:    g.senderName,
      amount:        g.amount,
      payoutMethod:  g.payoutMethod,
      payoutHandle:  g.payoutHandle,
      payoutName:    g.payoutName,
      redeemedAt:    g.redeemedAt,
      cashoutPaidAt: g.cashoutPaidAt,
      createdAt:     g.createdAt,
    })));
  } catch (err) {
    console.error("[admin] cashouts error:", err);
    res.status(500).json({ error: "Failed to load cashouts" });
  }
});

router.get("/admin/gifts", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const rows = await db
      .select({
        id:              gifts.id,
        recipientName:   gifts.recipientName,
        senderName:      gifts.senderName,
        amount:          gifts.amount,
        paid:            gifts.paid,
        experience:      gifts.experience,
        occasion:        gifts.occasion,
        openedAt:        gifts.openedAt,
        redeemedAt:      gifts.redeemedAt,
        cashoutPaidAt:   gifts.cashoutPaidAt,
        createdAt:       gifts.createdAt,
        senderEmail:     gifts.senderEmail,
        payoutMethod:    gifts.payoutMethod,
        payoutHandle:    gifts.payoutHandle,
        reaction:            gifts.reaction,
        recipientUserId:     gifts.recipientUserId,
        senderUserId:        gifts.senderUserId,
        redemptionVerified:  gifts.redemptionVerified,
      })
      .from(gifts)
      .orderBy(desc(gifts.createdAt));

    res.json(rows);
  } catch (err) {
    console.error("[admin] gifts error:", err);
    res.status(500).json({ error: "Failed to load gifts" });
  }
});

// GET /api/admin/users — all accounts with gift counts
router.get("/admin/users", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const users = await db
      .select({
        id:           usersTable.id,
        email:        usersTable.email,
        firstName:    usersTable.firstName,
        lastName:     usersTable.lastName,
        displayName:  usersTable.displayName,
        payoutMethod: usersTable.payoutMethod,
        payoutHandle: usersTable.payoutHandle,
        createdAt:    usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    const [sentCounts, receivedCounts] = await Promise.all([
      db.select({ userId: gifts.senderUserId, cnt: count() })
        .from(gifts).where(isNotNull(gifts.senderUserId)).groupBy(gifts.senderUserId),
      db.select({ userId: gifts.recipientUserId, cnt: count() })
        .from(gifts).where(isNotNull(gifts.recipientUserId)).groupBy(gifts.recipientUserId),
    ]);

    const sentMap     = Object.fromEntries(sentCounts.map(r => [r.userId, Number(r.cnt)]));
    const receivedMap = Object.fromEntries(receivedCounts.map(r => [r.userId, Number(r.cnt)]));

    res.json(users.map(u => ({
      ...u,
      giftsSent:     sentMap[u.id]     ?? 0,
      giftsReceived: receivedMap[u.id] ?? 0,
    })));
  } catch (err) {
    console.error("[admin] users error:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// PATCH /api/admin/gifts/:id/mark-cashout-paid
router.patch("/admin/gifts/:id/mark-cashout-paid", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const updated = await db
      .update(gifts)
      .set({ cashoutPaidAt: new Date() })
      .where(eq(gifts.id, req.params.id))
      .returning({ id: gifts.id, cashoutPaidAt: gifts.cashoutPaidAt });

    if (updated.length === 0) { res.status(404).json({ error: "Gift not found" }); return; }
    console.log(`[admin] cashout marked paid: gift ${req.params.id}`);
    res.json({ ok: true, ...updated[0] });
  } catch (err) {
    console.error("[admin] mark-cashout-paid error:", err);
    res.status(500).json({ error: "Failed to mark cashout paid" });
  }
});

// PATCH /api/admin/gifts/:id/mark-paid
router.patch("/admin/gifts/:id/mark-paid", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const updated = await db
      .update(gifts)
      .set({ paid: true })
      .where(eq(gifts.id, req.params.id))
      .returning({ id: gifts.id, paid: gifts.paid });

    if (updated.length === 0) { res.status(404).json({ error: "Gift not found" }); return; }
    console.log(`[admin] gift marked paid: ${req.params.id}`);
    res.json({ ok: true, ...updated[0] });
  } catch (err) {
    console.error("[admin] mark-paid error:", err);
    res.status(500).json({ error: "Failed to mark gift paid" });
  }
});

// POST /api/admin/gifts/:id/unhide-sender
// Restores a gift to the sender's dashboard (reverses a sender soft-hide).
router.post("/admin/gifts/:id/unhide-sender", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const updated = await db
      .update(gifts)
      .set({ senderHidden: false })
      .where(eq(gifts.id, req.params.id))
      .returning({ id: gifts.id, senderHidden: gifts.senderHidden });
    if (updated.length === 0) { res.status(404).json({ error: "Gift not found" }); return; }
    console.log(`[admin] sender-hidden cleared for gift: ${req.params.id}`);
    res.json({ ok: true, ...updated[0] });
  } catch (err) {
    console.error("[admin] unhide-sender error:", err);
    res.status(500).json({ error: "Failed to unhide gift" });
  }
});

// POST /api/admin/gifts/:id/bypass-verification
// Marks phone verification as passed so recipient can redeem without OTP.
// Use when the sender entered the wrong number or the SMS was never received.
router.post("/admin/gifts/:id/bypass-verification", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const updated = await db
      .update(gifts)
      .set({ redemptionVerified: true })
      .where(eq(gifts.id, req.params.id))
      .returning({ id: gifts.id, redemptionVerified: gifts.redemptionVerified });
    if (updated.length === 0) { res.status(404).json({ error: "Gift not found" }); return; }
    console.log(`[admin] phone verification bypassed for gift: ${req.params.id}`);
    res.json({ ok: true, ...updated[0] });
  } catch (err) {
    console.error("[admin] bypass-verification error:", err);
    res.status(500).json({ error: "Failed to bypass verification" });
  }
});

// PATCH /api/admin/gifts/:id/recipient-phone
// Corrects the recipient phone number and resets verification so a fresh OTP
// can be sent to the correct number.
// Body: { phone: "+1xxxxxxxxxx" }
router.patch("/admin/gifts/:id/recipient-phone", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone || typeof phone !== "string") {
      res.status(400).json({ error: "phone is required" });
      return;
    }
    const updated = await db
      .update(gifts)
      .set({ recipientPhone: phone, redemptionVerified: false })
      .where(eq(gifts.id, req.params.id))
      .returning({ id: gifts.id, recipientPhone: gifts.recipientPhone, redemptionVerified: gifts.redemptionVerified });
    if (updated.length === 0) { res.status(404).json({ error: "Gift not found" }); return; }
    console.log(`[admin] recipient phone updated for gift: ${req.params.id} → ${phone}`);
    res.json({ ok: true, ...updated[0] });
  } catch (err) {
    console.error("[admin] recipient-phone error:", err);
    res.status(500).json({ error: "Failed to update recipient phone" });
  }
});

// POST /api/admin/backfill-user-payouts — one-time: copies payout method+handle
// from each user's most recent gift redemption onto their user profile row.
router.post("/admin/backfill-user-payouts", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const result = await db.execute(sql`
      UPDATE users u
      SET
        payout_method = g.payout_method,
        payout_handle = g.payout_handle
      FROM (
        SELECT DISTINCT ON (recipient_user_id)
          recipient_user_id,
          payout_method,
          payout_handle
        FROM gifts
        WHERE recipient_user_id IS NOT NULL
          AND payout_method IS NOT NULL
          AND payout_handle IS NOT NULL
        ORDER BY recipient_user_id, redeemed_at DESC NULLS LAST
      ) g
      WHERE u.id = g.recipient_user_id
        AND u.payout_method IS NULL
      RETURNING u.id, u.first_name, u.payout_method, u.payout_handle
    `);
    console.log(`[admin] backfill-user-payouts: updated ${result.rows.length} users`);
    res.json({ updated: result.rows.length, rows: result.rows });
  } catch (err) {
    console.error("[admin] backfill-user-payouts error:", err);
    res.status(500).json({ error: "Backfill failed" });
  }
});

// DELETE /api/admin/gifts/:id — permanently removes a single gift record
router.delete("/admin/gifts/:id", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const deleted = await db
      .delete(gifts)
      .where(eq(gifts.id, req.params.id))
      .returning({ id: gifts.id });
    if (deleted.length === 0) { res.status(404).json({ error: "Gift not found" }); return; }
    console.log(`[admin] gift deleted: ${req.params.id}`);
    res.json({ ok: true, deleted: deleted[0].id });
  } catch (err) {
    console.error("[admin] delete gift error:", err);
    res.status(500).json({ error: "Failed to delete gift" });
  }
});

// DELETE /api/admin/wipe — wipes all gift/transaction data, keeps user accounts
// Body must include { confirm: "WIPE" }
router.delete("/admin/wipe", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const { confirm } = req.body as { confirm?: string };
  if (confirm !== "WIPE") {
    res.status(400).json({ error: 'Body must include { "confirm": "WIPE" }' });
    return;
  }
  try {
    // Delete in dependency order — conversations/messages reference gifts via giftId
    await db.delete(messages);
    await db.delete(conversations);
    await db.delete(physicalGifts);
    await db.delete(gifts);
    console.log("[admin] ⚠️  All gift/transaction data wiped by operator");
    res.json({ ok: true, wiped: ["messages", "conversations", "physical_gifts", "gifts"] });
  } catch (err) {
    console.error("[admin] wipe error:", err);
    res.status(500).json({ error: "Wipe failed" });
  }
});

// GET /api/admin/gift/:id — full details of a single gift
router.get("/admin/gift/:id", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const [gift] = await db.select().from(gifts).where(eq(gifts.id, req.params.id)).limit(1);
    if (!gift) { res.status(404).json({ error: "Gift not found" }); return; }

    let senderUser = null;
    if (gift.senderUserId) {
      const [u] = await db.select({ id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName })
        .from(usersTable).where(eq(usersTable.id, gift.senderUserId)).limit(1);
      senderUser = u ?? null;
    }
    let recipientUser = null;
    if (gift.recipientUserId) {
      const [u] = await db.select({ id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName })
        .from(usersTable).where(eq(usersTable.id, gift.recipientUserId)).limit(1);
      recipientUser = u ?? null;
    }

    res.json({ gift, senderUser, recipientUser });
  } catch (err) {
    console.error("[admin] gift detail error:", err);
    res.status(500).json({ error: "Failed to load gift" });
  }
});

// GET /api/admin/users/search?email=xxx
router.get("/admin/users/search", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const email = (req.query.email as string | undefined)?.trim();
  if (!email) { res.status(400).json({ error: "email query param required" }); return; }
  try {
    const users = await db.select({ id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName, createdAt: usersTable.createdAt })
      .from(usersTable).where(ilike(usersTable.email, `%${email}%`)).limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to search users" });
  }
});

// PATCH /api/admin/gifts/:id/set-recipient
// Pass recipientUserId: null to clear the assignment (so the real recipient can re-claim).
router.patch("/admin/gifts/:id/set-recipient", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const { recipientUserId } = req.body as { recipientUserId?: string | null };
  if (recipientUserId === undefined) {
    res.status(400).json({ error: "recipientUserId required (pass null to clear)" }); return;
  }
  try {
    if (recipientUserId === null) {
      const updated = await db
        .update(gifts)
        .set({ recipientUserId: null })
        .where(eq(gifts.id, req.params.id))
        .returning({ id: gifts.id });
      if (updated.length === 0) { res.status(404).json({ error: "Gift not found" }); return; }
      console.log(`[admin] gift ${req.params.id} recipient cleared`);
      res.json({ ok: true, giftId: req.params.id, recipientUserId: null, recipientEmail: null });
      return;
    }

    const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, recipientUserId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const updated = await db
      .update(gifts)
      .set({ recipientUserId })
      .where(eq(gifts.id, req.params.id))
      .returning({ id: gifts.id });

    if (updated.length === 0) { res.status(404).json({ error: "Gift not found" }); return; }
    console.log(`[admin] gift ${req.params.id} recipient set to ${user.email} (${recipientUserId})`);
    res.json({ ok: true, giftId: req.params.id, recipientUserId, recipientEmail: user.email });
  } catch (err) {
    console.error("[admin] set-recipient error:", err);
    res.status(500).json({ error: "Failed to update recipient" });
  }
});

// GET /api/admin/trends — month-over-month metrics for last 12 months
router.get("/admin/trends", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    // Build the list of last 12 months as "YYYY-MM" strings
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    // ── Monthly gift metrics (raw SQL via sql tag) ─────────────────────────
    const giftMonthlyRaw = await db.execute(sql`
      SELECT
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE paid = true)                                                                          AS gift_count,
        COALESCE(SUM(amount::numeric) FILTER (WHERE paid = true), 0)                                                AS volume,
        COUNT(*) FILTER (WHERE paid = true AND opened_at IS NOT NULL)                                               AS opens,
        COUNT(*) FILTER (WHERE paid = true AND opened_at IS NOT NULL AND amount IS NOT NULL AND amount::numeric > 0) AS opens_with_amount,
        COUNT(*) FILTER (WHERE paid = true AND redeemed_at IS NOT NULL AND amount IS NOT NULL AND amount::numeric > 0) AS redeems
      FROM gifts
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `);

    // ── Monthly new user signups ───────────────────────────────────────────
    const userMonthlyRaw = await db.execute(sql`
      SELECT
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
        COUNT(*) AS new_users
      FROM users
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `);

    // ── Experience breakdown (all paid gifts, all time, no nulls/blanks) ──
    const expBreakdownRaw = await db.execute(sql`
      SELECT experience, COUNT(*) AS cnt
      FROM gifts
      WHERE paid = true
        AND experience IS NOT NULL
        AND experience <> ''
      GROUP BY experience
      ORDER BY cnt DESC
    `);

    // ── Occasion breakdown (all paid gifts, all time, no nulls/blanks) ──────
    const occBreakdownRaw = await db.execute(sql`
      SELECT occasion, COUNT(*) AS cnt
      FROM gifts
      WHERE paid = true
        AND occasion IS NOT NULL
        AND occasion <> ''
      GROUP BY occasion
      ORDER BY cnt DESC
    `);

    // Normalize to maps
    type Row = Record<string, unknown>;
    const giftMap = Object.fromEntries(
      (giftMonthlyRaw.rows as Row[]).map(r => [r.month as string, r])
    );
    const userMap = Object.fromEntries(
      (userMonthlyRaw.rows as Row[]).map(r => [r.month as string, r])
    );

    // Fill all 12 months (including zero months)
    const monthly = months.map(m => {
      const g = giftMap[m] ?? {};
      const u = userMap[m] ?? {};
      const giftCount       = Number(g.gift_count        ?? 0);
      const opens           = Number(g.opens             ?? 0);
      const opensWithAmount = Number(g.opens_with_amount ?? 0);
      const redeems         = Number(g.redeems           ?? 0);
      return {
        month:      m,
        giftCount,
        volume:     parseFloat(String(g.volume ?? "0")),
        feeRevenue: parseFloat(String(g.volume ?? "0")) * 0.08,
        opens,
        redeems,
        openRate:   giftCount       > 0 ? Math.round((opens   / giftCount)       * 100) : 0,
        redeemRate: opensWithAmount > 0 ? Math.round((redeems / opensWithAmount) * 100) : 0,
        newUsers:   Number(u.new_users ?? 0),
      };
    });

    const experienceBreakdown = (expBreakdownRaw.rows as Row[]).map(r => ({
      name:  r.experience as string,
      count: Number(r.cnt),
    }));

    const occasionBreakdown = (occBreakdownRaw.rows as Row[]).map(r => ({
      name:  r.occasion as string,
      count: Number(r.cnt),
    }));

    res.json({ monthly, experienceBreakdown, occasionBreakdown });
  } catch (err) {
    console.error("[admin] trends error:", err);
    res.status(500).json({ error: "Failed to load trends" });
  }
});

/**
 * POST /api/admin/gifts/:id/heal-payment
 * Manually triggers the sibling-payment self-heal for a specific gift.
 * Finds a paid sibling gift (same sender, same recipient+amount, ±5 min window)
 * and propagates paid=true to the target gift. Used for operational remediation
 * of orphaned duplicate gifts that bypassed idempotency guards.
 */
router.post("/admin/gifts/:id/heal-payment", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const giftId = req.params.id;

  try {
    const [gift] = await db
      .select()
      .from(gifts)
      .where(eq(gifts.id, giftId))
      .limit(1);

    if (!gift) {
      res.status(404).json({ error: "Gift not found" });
      return;
    }

    if (gift.paid) {
      res.json({ alreadyPaid: true, gift: { id: gift.id, paid: gift.paid } });
      return;
    }

    if (!gift.amount || parseFloat(gift.amount) <= 0) {
      res.status(400).json({ error: "Gift has no payable amount" });
      return;
    }

    if (!gift.senderUserId && !gift.senderEmail) {
      res.status(400).json({ error: "Gift has no sender identifier" });
      return;
    }

    const windowMs = 5 * 60 * 1000;
    const createdAt   = new Date(gift.createdAt);
    const windowStart = new Date(createdAt.getTime() - windowMs);
    const windowEnd   = new Date(createdAt.getTime() + windowMs);

    const senderCondition = gift.senderUserId
      ? eq(gifts.senderUserId, gift.senderUserId)
      : eq(gifts.senderEmail, gift.senderEmail!);

    const [paidSibling] = await db
      .select({
        id:                     gifts.id,
        paid:                   gifts.paid,
        stripePaymentIntentId:  gifts.stripePaymentIntentId,
        senderEmail:            gifts.senderEmail,
      })
      .from(gifts)
      .where(and(
        senderCondition,
        eq(gifts.recipientName, gift.recipientName),
        eq(gifts.amount, gift.amount!),
        ne(gifts.id, gift.id),
        eq(gifts.paid, true),
        gte(gifts.createdAt, windowStart),
        lte(gifts.createdAt, windowEnd),
      ))
      .limit(1);

    if (!paidSibling) {
      res.status(422).json({
        error: "No paid sibling found within 5-minute window",
        hint: "Confirm the canonical gift was actually paid in Stripe before running heal",
      });
      return;
    }

    const [updated] = await db
      .update(gifts)
      .set({
        paid:                  true,
        stripePaymentIntentId: paidSibling.stripePaymentIntentId,
        senderEmail:           paidSibling.senderEmail ?? gift.senderEmail,
      })
      .where(eq(gifts.id, gift.id))
      .returning();

    console.log(`[admin/heal-payment] Healed gift ${giftId} via sibling ${paidSibling.id}`);
    res.json({ healed: true, from: paidSibling.id, gift: updated });
  } catch (err) {
    console.error("[admin/heal-payment] Error:", err);
    res.status(500).json({ error: "Failed to heal payment status" });
  }
});

// GET /api/admin/ghost-drafts — count orphaned draft records (dry-run)
router.get("/admin/ghost-drafts", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM gifts
      WHERE sender_user_id IS NULL
        AND paid = false
        AND scheduled_for IS NULL
        AND created_at < NOW() - INTERVAL '14 days'
    `);
    res.json({ count: Number((result.rows[0] as Record<string, unknown>)?.cnt ?? 0) });
  } catch (err) {
    console.error("[admin] ghost-drafts count error:", err);
    res.status(500).json({ error: "Failed to count ghost drafts" });
  }
});

// DELETE /api/admin/ghost-drafts — permanently delete orphaned draft records
// Safety rules (enforced in SQL): senderUserId IS NULL, paid = false,
// scheduledFor IS NULL, older than 14 days. Paid gifts are never touched.
router.delete("/admin/ghost-drafts", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const result = await db.execute(sql`
      DELETE FROM gifts
      WHERE sender_user_id IS NULL
        AND paid = false
        AND scheduled_for IS NULL
        AND created_at < NOW() - INTERVAL '14 days'
      RETURNING id
    `);
    const deleted = result.rows.length;
    console.log(`[admin] ghost drafts cleaned: ${deleted} records deleted`);
    res.json({ ok: true, deleted });
  } catch (err) {
    console.error("[admin] ghost-drafts delete error:", err);
    res.status(500).json({ error: "Failed to delete ghost drafts" });
  }
});

/**
 * GET /api/internal/email-metrics
 * Live snapshot of email sequence performance. Admin-auth required.
 */
router.get("/internal/email-metrics", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { emailLogs } = await import("@workspace/db");
    const { isNotNull: isNotNullEl } = await import("drizzle-orm");

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const oneDayAgo   = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      step0EligibleRows,
      drip1Rows,
      drip2Rows,
      drip3Rows,
      dripConvertedRows,
      abandonedEligibleRows,
      nudgesSentRows,
      abandonedConvertedRows,
      deliveryRows,
      sourceRows,
    ] = await Promise.all([
      // drip sequence eligible (step=0, email present, account >3 days, not unsubscribed)
      db.select({ id: usersTable.id }).from(usersTable).where(
        and(
          isNotNull(usersTable.email),
          eq(usersTable.dripStep, 0),
          eq(usersTable.unsubscribedMarketing, false),
          lte(usersTable.createdAt, threeDaysAgo),
        )
      ),
      // drip1 sent count
      db.select({ id: emailLogs.id }).from(emailLogs).where(eq(emailLogs.type, "drip1")),
      // drip2 sent count
      db.select({ id: emailLogs.id }).from(emailLogs).where(eq(emailLogs.type, "drip2")),
      // drip3 sent count
      db.select({ id: emailLogs.id }).from(emailLogs).where(eq(emailLogs.type, "drip3")),
      // converted to sender via drip (dripStep != 0 and has sent a paid gift)
      db.select({ id: usersTable.id }).from(usersTable).where(
        and(
          isNotNull(usersTable.firstSentAt),
          sql`${usersTable.firstSentSource} IN ('drip1','drip2','drip3')`,
        )
      ),
      // abandoned gift nudge eligible (unpaid, >24h, not nudged, has recipient)
      db.select({ id: gifts.id }).from(gifts).where(
        and(
          eq(gifts.paid, false),
          lte(gifts.createdAt, oneDayAgo),
          isNull(gifts.autoRefundedAt),
          isNotNull(gifts.recipientName),
          isNotNull(gifts.senderUserId),
          isNotNull(gifts.senderEmail),
          isNull(gifts.abandonedNudgeSentAt),
        )
      ),
      // nudges sent
      db.select({ id: emailLogs.id }).from(emailLogs).where(eq(emailLogs.type, "abandoned_nudge")),
      // converted via abandoned nudge
      db.select({ id: usersTable.id }).from(usersTable).where(
        and(
          isNotNull(usersTable.firstSentAt),
          eq(usersTable.firstSentSource, "abandoned_nudge"),
        )
      ),
      // delivery health — count by status
      db.select({
        status: emailLogs.status,
        count:  count(),
      }).from(emailLogs).groupBy(emailLogs.status),
      // source breakdown
      db.select({
        source: usersTable.firstSentSource,
        count:  count(),
      }).from(usersTable).where(isNotNullEl(usersTable.firstSentAt)).groupBy(usersTable.firstSentSource),
    ]);

    // Delivery health
    const statusMap: Record<string, number> = {};
    for (const row of deliveryRows) statusMap[row.status ?? "sent"] = Number(row.count);
    const totalSent    = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const delivered    = statusMap["delivered"] ?? 0;
    const bounced      = statusMap["bounced"]   ?? 0;
    const complained   = statusMap["complained"] ?? 0;
    const deliveryRate = totalSent > 0 ? `${((delivered / totalSent) * 100).toFixed(1)}%` : "n/a";

    // Drip sequence
    const dripStep0 = step0EligibleRows.length;
    const d1 = drip1Rows.length;
    const d2 = drip2Rows.length;
    const d3 = drip3Rows.length;
    const dripConverted = dripConvertedRows.length;
    const dripBase = d1 || 1;
    const dripConversionRate = `${((dripConverted / dripBase) * 100).toFixed(1)}%`;

    // Abandoned nudge
    const nudgesEligible = abandonedEligibleRows.length;
    const nudgesSent = nudgesSentRows.length;
    const nudgesConverted = abandonedConvertedRows.length;
    const nudgeConversionRate = nudgesSent > 0
      ? `${((nudgesConverted / nudgesSent) * 100).toFixed(1)}%`
      : "n/a";

    // Source breakdown
    const srcMap: Record<string, number> = {};
    for (const row of sourceRows) srcMap[row.source ?? "organic"] = Number(row.count);

    res.json({
      drip_sequence: {
        step0_eligible:     dripStep0,
        drip1_sent:         d1,
        drip2_sent:         d2,
        drip3_sent:         d3,
        converted_to_sender: dripConverted,
        conversion_rate:    dripConversionRate,
      },
      abandoned_nudge: {
        eligible_gifts:  nudgesEligible,
        nudges_sent:     nudgesSent,
        converted:       nudgesConverted,
        conversion_rate: nudgeConversionRate,
      },
      delivery_health: {
        total_sent:    totalSent,
        delivered,
        bounced,
        complained,
        delivery_rate: deliveryRate,
      },
      source_breakdown: {
        drip1:         srcMap["drip1"]          ?? 0,
        drip2:         srcMap["drip2"]          ?? 0,
        drip3:         srcMap["drip3"]          ?? 0,
        abandoned_nudge: srcMap["abandoned_nudge"] ?? 0,
        digest:        srcMap["digest"]         ?? 0,
        organic:       srcMap["organic"]        ?? 0,
      },
    });
  } catch (err) {
    console.error("[admin] email-metrics error:", err);
    res.status(500).json({ error: "Failed to fetch email metrics" });
  }
});

// ── Email campaign dashboard ──────────────────────────────────────────────────
router.get("/internal/email-campaign", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const [step0Rows, step1Rows, step2Rows, step3Rows, convertedRows, users, logs] = await Promise.all([
      db.select({ id: usersTable.id }).from(usersTable).where(
        and(isNotNull(usersTable.email), eq(usersTable.dripStep, 0),
          eq(usersTable.unsubscribedMarketing, false), lte(usersTable.createdAt, threeDaysAgo))
      ),
      db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.dripStep, 1)),
      db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.dripStep, 2)),
      db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.dripStep, 3)),
      db.select({ id: usersTable.id }).from(usersTable).where(isNotNull(usersTable.firstSentAt)),
      db.select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        dripStep: usersTable.dripStep,
        dripLastSentAt: usersTable.dripLastSentAt,
        createdAt: usersTable.createdAt,
        emailBounced: usersTable.emailBounced,
        emailComplained: usersTable.emailComplained,
        unsubscribedMarketing: usersTable.unsubscribedMarketing,
        firstSentAt: usersTable.firstSentAt,
        firstSentSource: usersTable.firstSentSource,
      }).from(usersTable).where(isNotNull(usersTable.email)).orderBy(desc(usersTable.createdAt)),
      db.select({
        type: emailLogs.type,
        email: emailLogs.email,
        sentAt: emailLogs.sentAt,
        status: emailLogs.status,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      }).from(emailLogs)
        .leftJoin(usersTable, eq(emailLogs.userId, usersTable.id))
        .orderBy(desc(emailLogs.sentAt))
        .limit(300),
    ]);

    res.json({
      pipeline: {
        step0Eligible: step0Rows.length,
        step1: step1Rows.length,
        step2: step2Rows.length,
        step3: step3Rows.length,
        converted: convertedRows.length,
      },
      users,
      logs,
    });
  } catch (err) {
    console.error("[admin] email-campaign error:", err);
    res.status(500).json({ error: "Failed to fetch email campaign data" });
  }
});

export default router;
