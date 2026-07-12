import { Router } from "express";
import { db, projectDocumentsTable, projectMilestonesTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";

const router = Router();

// ── Documents ─────────────────────────────────────────────────────────────────

router.get("/projects/:id/documents", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(projectDocumentsTable)
      .where(eq(projectDocumentsTable.projectId, Number(req.params.id)))
      .orderBy(desc(projectDocumentsTable.isPinned), desc(projectDocumentsTable.updatedAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

router.post("/projects/:id/documents", async (req, res) => {
  try {
    const [row] = await db.insert(projectDocumentsTable).values({
      projectId: Number(req.params.id),
      title: req.body.title,
      content: req.body.content ?? "",
      author: req.body.author,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create document" });
  }
});

router.patch("/projects/documents/:id", async (req, res) => {
  try {
    const [row] = await db.update(projectDocumentsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(projectDocumentsTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update document" });
  }
});

router.delete("/projects/documents/:id", async (req, res) => {
  try {
    await db.delete(projectDocumentsTable).where(eq(projectDocumentsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// ── Milestones ────────────────────────────────────────────────────────────────

router.get("/projects/:id/milestones", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(projectMilestonesTable)
      .where(eq(projectMilestonesTable.projectId, Number(req.params.id)))
      .orderBy(asc(projectMilestonesTable.order));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

router.post("/projects/:id/milestones", async (req, res) => {
  try {
    const [row] = await db.insert(projectMilestonesTable).values({
      projectId: Number(req.params.id),
      title: req.body.title,
      description: req.body.description,
      dueDate: req.body.dueDate,
      order: req.body.order ?? 0,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create milestone" });
  }
});

router.patch("/projects/milestones/:id", async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.status === "completed" && !body.completedAt) body.completedAt = new Date();
    const [row] = await db.update(projectMilestonesTable).set(body).where(eq(projectMilestonesTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update milestone" });
  }
});

router.delete("/projects/milestones/:id", async (req, res) => {
  try {
    await db.delete(projectMilestonesTable).where(eq(projectMilestonesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete milestone" });
  }
});

export default router;
