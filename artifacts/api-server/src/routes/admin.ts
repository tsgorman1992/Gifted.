import { Router } from "express";
import { db, gifts, usersTable } from "@workspace/db";
import { desc, isNotNull, eq, ilike, count, gte, sql } from "drizzle-orm";
import { physicalGifts, conversations, messages } from "@workspace/db";

const router = Router();

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

    const paidGifts    = all.filter(g => g.paid);
    const openedGifts  = all.filter(g => g.openedAt != null);
    const redeemedGifts = all.filter(g => g.redeemedAt != null);

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

    const feeRevenue = volume * 0.05;

    const paidWithAmount = paidGifts.filter(g => g.amount && parseFloat(g.amount) > 0);
    const avgAmount = paidWithAmount.length > 0
      ? paidWithAmount.reduce((sum, g) => sum + parseFloat(g.amount!), 0) / paidWithAmount.length
      : 0;

    // Open rate = opened paid gifts / all paid gifts
    const paidOpened = paidGifts.filter(g => g.openedAt != null).length;
    const openRate = paid > 0 ? Math.round((paidOpened / paid) * 100) : 0;

    // Redeem rate = redeemed / opened paid
    const redeemRate = paidOpened > 0 ? Math.round((redeemed / paidOpened) * 100) : 0;

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
        id:            gifts.id,
        recipientName: gifts.recipientName,
        senderName:    gifts.senderName,
        amount:        gifts.amount,
        paid:          gifts.paid,
        experience:    gifts.experience,
        occasion:      gifts.occasion,
        openedAt:      gifts.openedAt,
        redeemedAt:    gifts.redeemedAt,
        cashoutPaidAt: gifts.cashoutPaidAt,
        createdAt:     gifts.createdAt,
        senderEmail:   gifts.senderEmail,
        payoutMethod:  gifts.payoutMethod,
        payoutHandle:  gifts.payoutHandle,
        reaction:      gifts.reaction,
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
router.patch("/admin/gifts/:id/set-recipient", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const { recipientUserId } = req.body as { recipientUserId?: string };
  if (!recipientUserId) { res.status(400).json({ error: "recipientUserId required" }); return; }
  try {
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

export default router;
