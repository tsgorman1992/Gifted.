import { Router } from "express";
import { db, gifts } from "@workspace/db";
import { desc, isNotNull, isNull, eq } from "drizzle-orm";

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
    const all = await db.select({
      id: gifts.id,
      paid: gifts.paid,
      amount: gifts.amount,
      redeemedAt: gifts.redeemedAt,
      createdAt: gifts.createdAt,
    }).from(gifts);

    const total     = all.length;
    const paid      = all.filter(g => g.paid).length;
    const redeemed  = all.filter(g => g.redeemedAt != null).length;
    const pending   = all.filter(g => g.paid && g.redeemedAt == null).length;

    const volume = all
      .filter(g => g.paid && g.amount)
      .reduce((sum, g) => sum + parseFloat(g.amount ?? "0"), 0);

    const pendingVolume = all
      .filter(g => g.paid && g.redeemedAt == null && g.amount)
      .reduce((sum, g) => sum + parseFloat(g.amount ?? "0"), 0);

    res.json({ total, paid, redeemed, pending, volume, pendingVolume });
  } catch (err) {
    console.error("[admin] stats error:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/admin/cashouts", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    // Intentionally does NOT filter on senderHidden — operator visibility must
    // never be limited by sender-side hide actions. Senders hiding a gift from
    // their own dashboard does not affect the operator's ability to process payouts.
    const rows = await db
      .select()
      .from(gifts)
      .where(isNotNull(gifts.redeemedAt))
      .orderBy(desc(gifts.redeemedAt));

    const cashouts = rows.map(g => ({
      id:           g.id,
      recipientName:g.recipientName,
      senderName:   g.senderName,
      amount:       g.amount,
      payoutMethod: g.payoutMethod,
      payoutHandle: g.payoutHandle,
      payoutName:   g.payoutName,
      redeemedAt:   g.redeemedAt,
      createdAt:    g.createdAt,
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
    // Intentionally does NOT filter on senderHidden — operator visibility must
    // never be limited by sender-side hide actions. All gifts are visible here
    // regardless of whether the sender has hidden them from their own dashboard.
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

export default router;
