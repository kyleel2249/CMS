import { Router } from "express";
import { db, campaignsTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { emit } from "../lib/events";
import { buildInsightsReport, computeBenchmarks, computeCampaignInsight } from "../lib/campaignInsights";

const router = Router();

function toResponse(c: typeof campaignsTable.$inferSelect, benchmarks?: ReturnType<typeof computeBenchmarks>) {
  const insight = benchmarks ? computeCampaignInsight(c, benchmarks) : null;
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    audienceSize: c.audienceSize,
    sent: c.sent ?? null,
    opened: c.opened ?? null,
    clicked: c.clicked ?? null,
    converted: c.converted ?? null,
    scheduledAt: c.scheduledAt ?? null,
    createdAt: c.createdAt.toISOString(),
    performanceScore: insight?.performanceScore ?? null,
    performanceBand: insight?.band ?? null,
    openRate: insight?.rates.openRate ?? null,
    clickRate: insight?.rates.clickRate ?? null,
    conversionRate: insight?.rates.conversionRate ?? null,
  };
}

router.get("/campaigns/insights", async (req, res) => {
  try {
    const rows = await db.select().from(campaignsTable);
    res.json(buildInsightsReport(rows));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to compute campaign insights" });
  }
});

router.get("/campaigns", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Number(req.query.limit ?? 50);
    let query = db.select().from(campaignsTable);
    if (status) {
      query = query.where(eq(campaignsTable.status, status)) as typeof query;
    }
    const rows = await query.orderBy(desc(campaignsTable.createdAt)).limit(limit);
    const benchmarks = computeBenchmarks(rows);
    res.json(rows.map((r) => toResponse(r, benchmarks)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

router.post("/campaigns", async (req, res) => {
  try {
    const [row] = await db.insert(campaignsTable).values(req.body).returning();
    await db.insert(activityTable).values({
      type: "campaign",
      title: "Campaign created",
      description: `${row.type.toUpperCase()} campaign "${row.name}" — ${row.audienceSize.toLocaleString()} recipients`,
    });
    await emit("marketing", "campaign.created", { name: row.name }, row.id);
    const allRows = await db.select().from(campaignsTable);
    res.status(201).json(toResponse(row, computeBenchmarks(allRows)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

router.patch("/campaigns/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(campaignsTable)
      .set(req.body)
      .where(eq(campaignsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    const allRows = await db.select().from(campaignsTable);
    res.json(toResponse(row, computeBenchmarks(allRows)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  try {
    await db.delete(campaignsTable).where(eq(campaignsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

export default router;
