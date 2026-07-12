import { Router } from "express";
import { db } from "@workspace/db";
import { goalsTable, keyResultsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { mapMetricsToOKRs } from "../lib/ai";

const router = Router();

// List all goals with their key results
router.get("/goals", async (req, res) => {
  try {
    const goals = await db.select().from(goalsTable).orderBy(desc(goalsTable.year), goalsTable.quarter);
    const krs   = await db.select().from(keyResultsTable);
    const krsByGoal = krs.reduce<Record<number, typeof krs>>((acc, kr) => {
      (acc[kr.goalId] ??= []).push(kr);
      return acc;
    }, {});
    res.json(goals.map((g) => ({ ...g, keyResults: krsByGoal[g.id] ?? [] })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

// Create a goal
router.post("/goals", async (req, res) => {
  try {
    const { title, description, owner, quarter, year } = req.body;
    if (!title || !owner || !quarter || !year) return res.status(400).json({ error: "title, owner, quarter, year required" });
    const [goal] = await db.insert(goalsTable).values({ title, description, owner, quarter, year }).returning();
    res.status(201).json({ ...goal, keyResults: [] });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// Update goal
router.patch("/goals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, status, progress } = req.body;
    const [goal] = await db.update(goalsTable)
      .set({ title, description, status, progress, updatedAt: new Date() })
      .where(eq(goalsTable.id, id))
      .returning();
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    res.json(goal);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update goal" });
  }
});

// Delete goal
router.delete("/goals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(keyResultsTable).where(eq(keyResultsTable.goalId, id));
    await db.delete(goalsTable).where(eq(goalsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

// Add key result to a goal
router.post("/goals/:id/key-results", async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const { title, targetValue, currentValue, unit, linkedMetric, autoTracked } = req.body;
    if (!title || targetValue == null) return res.status(400).json({ error: "title and targetValue required" });
    const [kr] = await db.insert(keyResultsTable).values({
      goalId, title, targetValue, currentValue: currentValue ?? 0,
      unit: unit ?? "number", linkedMetric: linkedMetric ?? null,
      autoTracked: autoTracked ?? false,
    }).returning();
    res.status(201).json(kr);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create key result" });
  }
});

// Update key result
router.patch("/goals/key-results/:krId", async (req, res) => {
  try {
    const krId = Number(req.params.krId);
    const { title, targetValue, currentValue, unit, status, linkedMetric, autoTracked } = req.body;
    const [kr] = await db.update(keyResultsTable)
      .set({ title, targetValue, currentValue, unit, status, linkedMetric, autoTracked, updatedAt: new Date() })
      .where(eq(keyResultsTable.id, krId))
      .returning();
    if (!kr) return res.status(404).json({ error: "Key result not found" });
    res.json(kr);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update key result" });
  }
});

// Delete key result
router.delete("/goals/key-results/:krId", async (req, res) => {
  try {
    const krId = Number(req.params.krId);
    await db.delete(keyResultsTable).where(eq(keyResultsTable.id, krId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete key result" });
  }
});

// AI: sync live metrics → auto-tracked KRs + generate narratives
router.post("/goals/ai/sync", async (req, res) => {
  try {
    const result = await mapMetricsToOKRs();
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to sync metrics" });
  }
});

export default router;
