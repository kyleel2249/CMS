import { Router } from "express";
import { db, webhooksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function toResponse(w: typeof webhooksTable.$inferSelect) {
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    events: w.events,
    isActive: w.isActive,
    deliveriesTotal: w.deliveriesTotal,
    deliveriesSuccess: w.deliveriesSuccess,
    lastDeliveredAt: w.lastDeliveredAt ? w.lastDeliveredAt.toISOString() : null,
    createdAt: w.createdAt.toISOString(),
  };
}

router.get("/webhooks", async (req, res) => {
  try {
    const rows = await db.select().from(webhooksTable).orderBy(desc(webhooksTable.createdAt));
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch webhooks" });
  }
});

router.post("/webhooks", async (req, res) => {
  try {
    const [row] = await db.insert(webhooksTable).values(req.body).returning();
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create webhook" });
  }
});

router.patch("/webhooks/:id", async (req, res) => {
  try {
    const [row] = await db.update(webhooksTable).set(req.body).where(eq(webhooksTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update webhook" });
  }
});

router.delete("/webhooks/:id", async (req, res) => {
  try {
    await db.delete(webhooksTable).where(eq(webhooksTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete webhook" });
  }
});

router.post("/webhooks/:id/toggle", async (req, res) => {
  try {
    const [row] = await db.select().from(webhooksTable).where(eq(webhooksTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    const [updated] = await db.update(webhooksTable)
      .set({ isActive: !row.isActive })
      .where(eq(webhooksTable.id, row.id))
      .returning();
    res.json(toResponse(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to toggle webhook" });
  }
});

router.post("/webhooks/:id/test", async (req, res) => {
  try {
    const [row] = await db.select().from(webhooksTable).where(eq(webhooksTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });

    let success = false;
    try {
      const response = await fetch(row.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Nexus-Event": "test", "X-Nexus-Delivery": `test-${Date.now()}` },
        body: JSON.stringify({ event: "test", timestamp: new Date().toISOString(), data: { message: "NEXUS webhook test delivery" } }),
        signal: AbortSignal.timeout(5000),
      });
      success = response.ok;
    } catch {
      success = false;
    }

    const [updated] = await db.update(webhooksTable)
      .set({ deliveriesTotal: row.deliveriesTotal + 1, deliveriesSuccess: success ? row.deliveriesSuccess + 1 : row.deliveriesSuccess, lastDeliveredAt: new Date() })
      .where(eq(webhooksTable.id, row.id))
      .returning();
    res.json({ success, webhook: toResponse(updated) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to test webhook" });
  }
});

export default router;
