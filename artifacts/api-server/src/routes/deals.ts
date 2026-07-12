import { Router } from "express";
import { db, dealsTable, activityTable } from "@workspace/db";
import { eq, desc, sum, count } from "drizzle-orm";
import { computeForecast } from "../lib/forecast";

const router = Router();

function toResponse(d: typeof dealsTable.$inferSelect) {
  return {
    id: d.id,
    title: d.title,
    value: Number(d.value),
    stage: d.stage,
    probability: d.probability,
    contactName: d.contactName,
    companyName: d.companyName ?? null,
    expectedCloseDate: d.expectedCloseDate ?? null,
    notes: d.notes ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}

router.get("/deals/pipeline-summary", async (req, res) => {
  try {
    const stages = [
      "prospecting",
      "qualification",
      "proposal",
      "negotiation",
      "closed_won",
      "closed_lost",
    ];
    const results = await Promise.all(
      stages.map(async (stage) => {
        const [{ cnt, total }] = await db
          .select({ cnt: count(), total: sum(dealsTable.value) })
          .from(dealsTable)
          .where(eq(dealsTable.stage, stage));
        return { stage, count: Number(cnt), value: Number(total ?? 0) };
      })
    );
    res.json(results);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch pipeline summary" });
  }
});

router.get("/deals/forecast", async (req, res) => {
  try {
    const forecast = await computeForecast();
    res.json(forecast);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to compute forecast" });
  }
});

router.get("/deals", async (req, res) => {
  try {
    const stage = req.query.stage as string | undefined;
    const limit = Number(req.query.limit ?? 50);
    let query = db.select().from(dealsTable);
    if (stage) {
      query = query.where(eq(dealsTable.stage, stage)) as typeof query;
    }
    const rows = await query.orderBy(desc(dealsTable.createdAt)).limit(limit);
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch deals" });
  }
});

router.post("/deals", async (req, res) => {
  try {
    const body = { ...req.body, value: String(req.body.value) };
    const [row] = await db.insert(dealsTable).values(body).returning();
    await db.insert(activityTable).values({
      type: "deal",
      title: "New deal created",
      description: `${row.title} — $${Number(row.value).toLocaleString()} in ${row.stage}`,
    });
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create deal" });
  }
});

router.patch("/deals/:id", async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.value != null) body.value = String(body.value);
    const [row] = await db
      .update(dealsTable)
      .set(body)
      .where(eq(dealsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update deal" });
  }
});

router.delete("/deals/:id", async (req, res) => {
  try {
    await db.delete(dealsTable).where(eq(dealsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete deal" });
  }
});

export default router;
