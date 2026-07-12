import { Router } from "express";
import { db, workflowDefsTable, workflowRunsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function defToResponse(d: typeof workflowDefsTable.$inferSelect) {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    isActive: d.isActive,
    trigger: d.trigger,
    steps: d.steps,
    runsTotal: d.runsTotal,
    runsSuccess: d.runsSuccess,
    lastRunAt: d.lastRunAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}

// GET /workflows
router.get("/workflows", async (req, res) => {
  try {
    const rows = await db.select().from(workflowDefsTable).orderBy(desc(workflowDefsTable.createdAt));
    res.json(rows.map(defToResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
});

// POST /workflows
router.post("/workflows", async (req, res) => {
  try {
    const [row] = await db.insert(workflowDefsTable).values({
      name: req.body.name,
      description: req.body.description,
      trigger: req.body.trigger ?? {},
      steps: req.body.steps ?? [],
    }).returning();
    res.status(201).json(defToResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

// PATCH /workflows/:id
router.patch("/workflows/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(workflowDefsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(workflowDefsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(defToResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

// DELETE /workflows/:id
router.delete("/workflows/:id", async (req, res) => {
  try {
    await db.delete(workflowDefsTable).where(eq(workflowDefsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

// POST /workflows/:id/toggle
router.post("/workflows/:id/toggle", async (req, res) => {
  try {
    const [wf] = await db.select().from(workflowDefsTable).where(eq(workflowDefsTable.id, Number(req.params.id)));
    if (!wf) return res.status(404).json({ error: "Not found" });
    const [updated] = await db.update(workflowDefsTable).set({ isActive: !wf.isActive, updatedAt: new Date() }).where(eq(workflowDefsTable.id, wf.id)).returning();
    res.json(defToResponse(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to toggle workflow" });
  }
});

// POST /workflows/:id/run
router.post("/workflows/:id/run", async (req, res) => {
  try {
    const [wf] = await db.select().from(workflowDefsTable).where(eq(workflowDefsTable.id, Number(req.params.id)));
    if (!wf) return res.status(404).json({ error: "Not found" });

    const steps = (wf.steps as any[]) ?? [];
    const stepLogs = steps.map((s: any) => ({ step: s.id ?? s.type, status: "success", executedAt: new Date().toISOString() }));

    const [run] = await db.insert(workflowRunsTable).values({
      workflowId: wf.id,
      status: "success",
      trigger: req.body ?? {},
      stepLogs,
      finishedAt: new Date(),
    }).returning();

    await db.update(workflowDefsTable).set({
      runsTotal: wf.runsTotal + 1,
      runsSuccess: wf.runsSuccess + 1,
      lastRunAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(workflowDefsTable.id, wf.id));

    res.json({ success: true, run });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to run workflow" });
  }
});

// GET /workflows/:id/runs
router.get("/workflows/:id/runs", async (req, res) => {
  try {
    const runs = await db
      .select()
      .from(workflowRunsTable)
      .where(eq(workflowRunsTable.workflowId, Number(req.params.id)))
      .orderBy(desc(workflowRunsTable.startedAt))
      .limit(20);
    res.json(runs);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch runs" });
  }
});

export default router;
