import { Router } from "express";
import { db, notesTable } from "@workspace/db";
import { eq, desc, like, or } from "drizzle-orm";

const router = Router();

function toResponse(n: typeof notesTable.$inferSelect) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    author: n.author,
    color: n.color,
    isPinned: Boolean(n.isPinned),
    entityType: n.entityType ?? null,
    entityId: n.entityId ?? null,
    tags: n.tags ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

router.get("/notes", async (req, res) => {
  try {
    const { search, entityType, entityId, limit, offset } = req.query;
    let query = db.select().from(notesTable);

    if (entityType) query = query.where(eq(notesTable.entityType, String(entityType))) as typeof query;
    if (entityId) query = query.where(eq(notesTable.entityId, Number(entityId))) as typeof query;
    if (search) {
      const s = `%${search}%`;
      query = query.where(or(like(notesTable.title, s), like(notesTable.content, s))) as typeof query;
    }

    const rows = await query
      .orderBy(desc(notesTable.isPinned), desc(notesTable.updatedAt))
      .limit(Number(limit ?? 50))
      .offset(Number(offset ?? 0));
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

router.post("/notes", async (req, res) => {
  try {
    const [row] = await db.insert(notesTable).values(req.body).returning();
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.get("/notes/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(notesTable).where(eq(notesTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch note" });
  }
});

router.patch("/notes/:id", async (req, res) => {
  try {
    const [row] = await db.update(notesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(notesTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update note" });
  }
});

router.delete("/notes/:id", async (req, res) => {
  try {
    await db.delete(notesTable).where(eq(notesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

router.patch("/notes/:id/pin", async (req, res) => {
  try {
    const [current] = await db.select().from(notesTable).where(eq(notesTable.id, Number(req.params.id)));
    if (!current) return res.status(404).json({ error: "Not found" });
    const [row] = await db.update(notesTable)
      .set({ isPinned: current.isPinned ? 0 : 1, updatedAt: new Date() })
      .where(eq(notesTable.id, Number(req.params.id)))
      .returning();
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to pin note" });
  }
});

export default router;
