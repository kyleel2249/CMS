import { Router } from "express";
import { db, leadsTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { emit } from "../lib/events";
import { computeLeadScore } from "../lib/scoring";

const router = Router();

function toResponse(l: typeof leadsTable.$inferSelect) {
  const { score, breakdown, band } = computeLeadScore(l);
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone ?? null,
    company: l.company ?? null,
    source: l.source,
    status: l.status,
    score: l.score,
    notes: l.notes ?? null,
    createdAt: l.createdAt.toISOString(),
    scoreBreakdown: breakdown,
    scoreBand: band,
    liveScore: score,
  };
}

router.get("/leads", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Number(req.query.limit ?? 50);
    let query = db.select().from(leadsTable);
    if (status) {
      query = query.where(eq(leadsTable.status, status)) as typeof query;
    }
    const rows = await query.orderBy(desc(leadsTable.createdAt)).limit(limit);
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

router.post("/leads", async (req, res) => {
  try {
    const draft = { ...req.body };
    if (draft.score == null) {
      const { score } = computeLeadScore({
        email: draft.email,
        company: draft.company ?? null,
        phone: draft.phone ?? null,
        notes: draft.notes ?? null,
        source: draft.source ?? "other",
        status: draft.status ?? "new",
        createdAt: new Date(),
      });
      draft.score = score;
    }
    const [row] = await db.insert(leadsTable).values(draft).returning();
    await db.insert(activityTable).values({
      type: "lead",
      title: "New lead captured",
      description: `${row.name} from ${row.company ?? row.source} — score ${row.score}`,
    });
    await emit("sales", "lead.created", { name: row.name, company: row.company }, row.id);
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create lead" });
  }
});

router.post("/leads/:id/recalculate-score", async (req, res) => {
  try {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, Number(req.params.id)));
    if (!lead) return res.status(404).json({ error: "Not found" });
    const { score } = computeLeadScore(lead);
    const [row] = await db
      .update(leadsTable)
      .set({ score })
      .where(eq(leadsTable.id, lead.id))
      .returning();
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to recalculate score" });
  }
});

router.post("/leads/recalculate-scores", async (req, res) => {
  try {
    const leads = await db.select().from(leadsTable);
    let updated = 0;
    for (const lead of leads) {
      const { score } = computeLeadScore(lead);
      if (score !== lead.score) {
        await db.update(leadsTable).set({ score }).where(eq(leadsTable.id, lead.id));
        updated += 1;
      }
    }
    res.json({ total: leads.length, updated });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to recalculate scores" });
  }
});

router.patch("/leads/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(leadsTable)
      .set(req.body)
      .where(eq(leadsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update lead" });
  }
});

router.delete("/leads/:id", async (req, res) => {
  try {
    await db.delete(leadsTable).where(eq(leadsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

export default router;
