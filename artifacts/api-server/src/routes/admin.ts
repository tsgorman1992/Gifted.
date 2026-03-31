import { Router } from "express";
import { db, gifts, usersTable } from "@workspace/db";
import { desc, isNotNull, isNull, eq, ilike, sql, count } from "drizzle-orm";

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
    const [all, userCount] = await Promise.all([
      db.select({
        id: gifts.id,
        paid: gifts.paid,
        amount: gifts.amount,
        redeemedAt: gifts.redeemedAt,
        cashoutPaidAt: gifts.cashoutPaidAt,
        createdAt: gifts.createdAt,
      }).from(gifts),
      db.select({ count: count() }).from(usersTable),
    ]);

    const total          = all.length;
    const paid           = all.filter(g => g.paid).length;
    const redeemed       = all.filter(g => g.redeemedAt != null).length;
    const pending        = all.filter(g => g.redeemedAt != null && g.cashoutPaidAt == null).length;
    const totalUsers     = userCount[0]?.count ?? 0;

    const volume = all
      .filter(g => g.paid && g.amount)
      .reduce((sum, g) => sum + parseFloat(g.amount ?? "0"), 0);

    const pendingVolume = all
      .filter(g => g.redeemedAt != null && g.cashoutPaidAt == null && g.amount)
      .reduce((sum, g) => sum + parseFloat(g.amount ?? "0"), 0);

    res.json({ total, paid, redeemed, pending, volume, pendingVolume, totalUsers });
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

    const cashouts = rows.map(g => ({
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
    }));

    res.json(cashouts);
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

// GET /api/admin/users — all registered accounts with gift counts
router.get("/admin/users", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const users = await db
      .select({
        id:              usersTable.id,
        email:           usersTable.email,
        firstName:       usersTable.firstName,
        lastName:        usersTable.lastName,
        displayName:     usersTable.displayName,
        payoutMethod:    usersTable.payoutMethod,
        payoutHandle:    usersTable.payoutHandle,
        createdAt:       usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    // Get gift counts per user in two queries (sent + received)
    const sentCounts = await db
      .select({ userId: gifts.senderUserId, cnt: count() })
      .from(gifts)
      .where(isNotNull(gifts.senderUserId))
      .groupBy(gifts.senderUserId);

    const receivedCounts = await db
      .select({ userId: gifts.recipientUserId, cnt: count() })
      .from(gifts)
      .where(isNotNull(gifts.recipientUserId))
      .groupBy(gifts.recipientUserId);

    const sentMap    = Object.fromEntries(sentCounts.map(r => [r.userId, Number(r.cnt)]));
    const receivedMap = Object.fromEntries(receivedCounts.map(r => [r.userId, Number(r.cnt)]));

    const result = users.map(u => ({
      ...u,
      giftsSent:     sentMap[u.id]     ?? 0,
      giftsReceived: receivedMap[u.id] ?? 0,
    }));

    res.json(result);
  } catch (err) {
    console.error("[admin] users error:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// PATCH /api/admin/gifts/:id/mark-cashout-paid — record that the operator has sent the payout
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
