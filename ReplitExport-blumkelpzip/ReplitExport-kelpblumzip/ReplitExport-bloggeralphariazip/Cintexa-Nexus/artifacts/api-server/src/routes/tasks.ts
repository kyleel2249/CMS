import { Router } from "express";
import { db, tasksTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function toResponse(t: typeof tasksTable.$inferSelect) {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    priority: t.priority,
    projectId: t.projectId ?? null,
    assignedTo: t.assignedTo ?? null,
    dueDate: t.dueDate ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/tasks", async (req, res) => {
  try {
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const status = req.query.status as string | undefined;
    const limit = Number(req.query.limit ?? 50);

    const conditions = [];
    if (projectId != null) conditions.push(eq(tasksTable.projectId, projectId));
    if (status) conditions.push(eq(tasksTable.status, status));

    const rows = await db
      .select()
      .from(tasksTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tasksTable.createdAt))
      .limit(limit);
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const [row] = await db.insert(tasksTable).values(req.body).returning();
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(tasksTable)
      .set(req.body)
      .where(eq(tasksTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    await db.delete(tasksTable).where(eq(tasksTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
