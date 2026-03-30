import { Router } from "express";
import { nanoid } from "nanoid";
import { db, physicalGifts } from "@workspace/db";
import { eq, and, isNull, or } from "drizzle-orm";

const router = Router();

const VALID_CARRIERS = new Set(["usps", "ups", "fedex", "dhl", "amazon", "lasership", "ontrac", "canada-post"]);

async function registerAfterShipTracking(carrier: string, trackingNumber: string, recordId: string): Promise<string | null> {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.aftership.com/tracking/2024-07/trackings", {
      method: "POST",
      headers: { "as-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        tracking_number: trackingNumber,
        slug: carrier,
        custom_fields: { physical_gift_id: recordId },
      }),
    });
    const json = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (response.ok) {
      const data = (json?.data as Record<string, unknown> | undefined);
      const tracking = (data?.tracking as Record<string, unknown> | undefined);
      const aftershipId = (tracking?.id ?? data?.id) as string | undefined;
      return aftershipId ?? null;
    }
    const meta = json?.meta as Record<string, unknown> | undefined;
    if (meta?.code === 4003) {
      const aftershipId = (json?.data as Record<string, unknown> | undefined)?.id as string | undefined;
      return aftershipId ?? null;
    }
    console.error("[AfterShip physical] Registration failed:", JSON.stringify(json));
    return null;
  } catch (err) {
    console.error("[AfterShip physical] Error:", err);
    return null;
  }
}

async function fetchAfterShipTracking(aftershipId: string) {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(`https://api.aftership.com/tracking/2024-07/trackings/${aftershipId}`, {
      headers: { "as-api-key": apiKey },
    });
    if (!response.ok) return null;
    const json = await response.json() as Record<string, unknown>;
    const tracking = (json?.data as Record<string, unknown> | undefined)?.tracking as Record<string, unknown> | undefined;
    if (!tracking) return null;

    const checkpoints = (tracking.checkpoints as Array<Record<string, unknown>> | undefined) ?? [];
    const events = checkpoints.map((c) => ({
      status: (c.tag as string) ?? "Unknown",
      message: (c.message as string) ?? "",
      location: (c.city as string) ?? (c.country_name as string) ?? undefined,
      timestamp: (c.checkpoint_time as string) ?? new Date().toISOString(),
    }));

    const isDelivered = (tracking.tag as string) === "Delivered";
    const deliveredAt = isDelivered
      ? (checkpoints.find(c => c.tag === "Delivered")?.checkpoint_time as string | undefined)
      : null;

    return { events, deliveredAt: deliveredAt ? new Date(deliveredAt) : null };
  } catch (err) {
    console.error("[AfterShip physical] Fetch error:", err);
    return null;
  }
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated?.()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// GET /api/gifted/physical-gifts — list user's physical gifts
router.get("/gifted/physical-gifts", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const rows = await db
      .select()
      .from(physicalGifts)
      .where(
        and(
          eq(physicalGifts.userId, userId),
          or(eq(physicalGifts.hidden, false), isNull(physicalGifts.hidden))
        )
      )
      .orderBy(physicalGifts.createdAt);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching physical gifts:", err);
    res.status(500).json({ error: "Failed to load physical gifts" });
  }
});

// POST /api/gifted/physical-gifts — create
router.post("/gifted/physical-gifts", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { label, recipientName, senderName, direction, carrier, trackingNumber, giftId } = req.body;

    if (!label?.trim()) {
      res.status(400).json({ error: "Label is required" });
      return;
    }
    if (carrier && !VALID_CARRIERS.has(carrier)) {
      res.status(400).json({ error: "Invalid carrier" });
      return;
    }
    if ((carrier && !trackingNumber) || (!carrier && trackingNumber)) {
      res.status(400).json({ error: "Carrier and tracking number must be provided together" });
      return;
    }

    const id = nanoid(12);
    const [row] = await db
      .insert(physicalGifts)
      .values({
        id,
        userId,
        label: label.trim(),
        recipientName: recipientName?.trim() || null,
        senderName: senderName?.trim() || null,
        direction: direction === "received" ? "received" : "sent",
        carrier: carrier || null,
        trackingNumber: trackingNumber?.trim() || null,
        giftId: giftId || null,
      })
      .returning();

    if (carrier && trackingNumber) {
      registerAfterShipTracking(carrier, trackingNumber, id)
        .then((aftershipId) => {
          if (aftershipId) {
            db.update(physicalGifts)
              .set({ aftershipTrackingId: aftershipId })
              .where(eq(physicalGifts.id, id))
              .catch(() => {});
          }
        })
        .catch(() => {});
    }

    res.json(row);
  } catch (err) {
    console.error("Error creating physical gift:", err);
    res.status(500).json({ error: "Failed to create" });
  }
});

// PATCH /api/gifted/physical-gifts/:id/refresh — re-fetch tracking from AfterShip
router.patch("/gifted/physical-gifts/:id/refresh", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const [row] = await db
      .select()
      .from(physicalGifts)
      .where(and(eq(physicalGifts.id, id), eq(physicalGifts.userId, userId)))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (!row.aftershipTrackingId && row.carrier && row.trackingNumber) {
      const aftershipId = await registerAfterShipTracking(row.carrier, row.trackingNumber, id);
      if (aftershipId) {
        await db.update(physicalGifts).set({ aftershipTrackingId: aftershipId }).where(eq(physicalGifts.id, id));
        row.aftershipTrackingId = aftershipId;
      }
    }

    if (!row.aftershipTrackingId) {
      res.json({ updated: false, message: "No AfterShip tracking registered yet" });
      return;
    }

    const fresh = await fetchAfterShipTracking(row.aftershipTrackingId);
    if (!fresh) {
      res.json({ updated: false, message: "Could not fetch tracking data" });
      return;
    }

    const [updated] = await db
      .update(physicalGifts)
      .set({
        trackingStatus: fresh.events,
        deliveredAt: fresh.deliveredAt ?? row.deliveredAt,
      })
      .where(eq(physicalGifts.id, id))
      .returning();

    res.json({ updated: true, record: updated });
  } catch (err) {
    console.error("Error refreshing physical gift tracking:", err);
    res.status(500).json({ error: "Failed to refresh tracking" });
  }
});

// PATCH /api/gifted/physical-gifts/:id/hide — soft delete
router.patch("/gifted/physical-gifts/:id/hide", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    await db
      .update(physicalGifts)
      .set({ hidden: true })
      .where(and(eq(physicalGifts.id, id), eq(physicalGifts.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    console.error("Error hiding physical gift:", err);
    res.status(500).json({ error: "Failed to remove" });
  }
});

export default router;
