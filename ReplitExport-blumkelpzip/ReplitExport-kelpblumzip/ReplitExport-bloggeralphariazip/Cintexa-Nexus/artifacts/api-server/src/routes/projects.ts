import { Router } from "express";
import { db, projectsTable, tasksTable, activityTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";

const router = Router();

async function toResponse(p: typeof projectsTable.$inferSelect) {
  const [{ taskCount }] = await db
    .select({ taskCount: count() })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, p.id));
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    status: p.status,
    progress: p.progress,
    owner: p.owner ?? null,
    dueDate: p.dueDate ?? null,
    taskCount: Number(taskCount),
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/projects", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Number(req.query.limit ?? 50);
    let query = db.select().from(projectsTable);
    if (status) {
      query = query.where(eq(projectsTable.status, status)) as typeof query;
    }
    const rows = await query.orderBy(desc(projectsTable.createdAt)).limit(limit);
    const result = await Promise.all(rows.map(toResponse));
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const [row] = await db.insert(projectsTable).values(req.body).returning();
    await db.insert(activityTable).values({
      type: "task",
      title: "Project created",
      description: `"${row.name}" started by ${row.owner ?? "unassigned"}`,
    });
    res.status(201).json(await toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/projects/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(projectsTable)
      .set(req.body)
      .where(eq(projectsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(await toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    await db.delete(projectsTable).where(eq(projectsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
