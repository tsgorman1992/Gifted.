import { Router } from "express";
import { db, contacts, contactOccasions } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

// GET /api/gifted/contacts — list all contacts for the authenticated user
router.get("/gifted/contacts", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .orderBy(asc(contacts.name));

    const occasions = await db
      .select()
      .from(contactOccasions)
      .where(eq(contactOccasions.userId, userId))
      .orderBy(asc(contactOccasions.month), asc(contactOccasions.day));

    const occasionsByContact = occasions.reduce<Record<string, typeof occasions>>((acc, o) => {
      if (!acc[o.contactId]) acc[o.contactId] = [];
      acc[o.contactId].push(o);
      return acc;
    }, {});

    res.json(rows.map(c => ({
      ...c,
      occasions: occasionsByContact[c.id] ?? [],
    })));
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

// POST /api/gifted/contacts — create a contact
router.post("/gifted/contacts", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { name, phone, email, notes } = req.body as { name?: string; phone?: string; email?: string; notes?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }

  try {
    const [contact] = await db.insert(contacts).values({
      userId,
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      notes: notes?.trim() || null,
    }).returning();

    res.json({ ...contact, occasions: [] });
  } catch (err) {
    console.error("Error creating contact:", err);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

// PUT /api/gifted/contacts/:id — update a contact
router.put("/gifted/contacts/:id", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { name, phone, email, notes } = req.body as { name?: string; phone?: string; email?: string; notes?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }

  try {
    const [updated] = await db
      .update(contacts)
      .set({
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        notes: notes?.trim() || null,
      })
      .where(and(eq(contacts.id, req.params.id), eq(contacts.userId, userId)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Contact not found" }); return; }
    res.json(updated);
  } catch (err) {
    console.error("Error updating contact:", err);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

// DELETE /api/gifted/contacts/:id — delete a contact
router.delete("/gifted/contacts/:id", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    await db
      .delete(contacts)
      .where(and(eq(contacts.id, req.params.id), eq(contacts.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting contact:", err);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

// POST /api/gifted/contacts/:id/occasions — add an occasion to a contact
router.post("/gifted/contacts/:id/occasions", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { label, month, day } = req.body as { label?: string; month?: number; day?: number };
  if (!label?.trim() || !month || !day) { res.status(400).json({ error: "label, month, and day are required" }); return; }
  if (month < 1 || month > 12 || day < 1 || day > 31) { res.status(400).json({ error: "Invalid month or day" }); return; }

  try {
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, req.params.id), eq(contacts.userId, userId)))
      .limit(1);
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

    const [occasion] = await db.insert(contactOccasions).values({
      contactId: req.params.id,
      userId,
      label: label.trim(),
      month,
      day,
    }).returning();

    res.json(occasion);
  } catch (err) {
    console.error("Error adding occasion:", err);
    res.status(500).json({ error: "Failed to add occasion" });
  }
});

// DELETE /api/gifted/contacts/:contactId/occasions/:occasionId — remove an occasion
router.delete("/gifted/contacts/:contactId/occasions/:occasionId", async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    await db
      .delete(contactOccasions)
      .where(and(
        eq(contactOccasions.id, req.params.occasionId),
        eq(contactOccasions.userId, userId),
      ));
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting occasion:", err);
    res.status(500).json({ error: "Failed to delete occasion" });
  }
});

export default router;
