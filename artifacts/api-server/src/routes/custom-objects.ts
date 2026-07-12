import { Router } from "express";
import { db, customObjectDefsTable, customObjectRecordsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ── Definitions ──────────────────────────────────────────────────────────────

router.get("/custom-objects/defs", async (req, res) => {
  try {
    const rows = await db.select().from(customObjectDefsTable).orderBy(customObjectDefsTable.name);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch custom object definitions" });
  }
});

router.post("/custom-objects/defs", async (req, res) => {
  try {
    const [row] = await db.insert(customObjectDefsTable).values({
      ...req.body,
      fields: req.body.fields ?? [],
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create custom object definition" });
  }
});

router.patch("/custom-objects/defs/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(customObjectDefsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(customObjectDefsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update definition" });
  }
});

router.delete("/custom-objects/defs/:id", async (req, res) => {
  try {
    await db.delete(customObjectRecordsTable).where(eq(customObjectRecordsTable.objectDefId, Number(req.params.id)));
    await db.delete(customObjectDefsTable).where(eq(customObjectDefsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete definition" });
  }
});

// ── Records ──────────────────────────────────────────────────────────────────

router.get("/custom-objects/defs/:defId/records", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(customObjectRecordsTable)
      .where(eq(customObjectRecordsTable.objectDefId, Number(req.params.defId)))
      .orderBy(desc(customObjectRecordsTable.createdAt))
      .limit(Number(req.query.limit ?? 100));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

router.post("/custom-objects/defs/:defId/records", async (req, res) => {
  try {
    const [row] = await db
      .insert(customObjectRecordsTable)
      .values({ objectDefId: Number(req.params.defId), data: req.body.data ?? {} })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create record" });
  }
});

router.patch("/custom-objects/records/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(customObjectRecordsTable)
      .set({ data: req.body.data, updatedAt: new Date() })
      .where(eq(customObjectRecordsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update record" });
  }
});

router.delete("/custom-objects/records/:id", async (req, res) => {
  try {
    await db.delete(customObjectRecordsTable).where(eq(customObjectRecordsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete record" });
  }
});

export default router;
