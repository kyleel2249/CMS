import { Router } from "express";
import { db, ticketsTable, activityTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { emit } from "../lib/events";
import { computeSlaStatus, summarizeSla } from "../lib/sla";
import { suggestAssignee } from "../lib/routing";

const router = Router();

function toResponse(t: typeof ticketsTable.$inferSelect) {
  return {
    id: t.id,
    subject: t.subject,
    description: t.description ?? null,
    status: t.status,
    priority: t.priority,
    channel: t.channel,
    contactName: t.contactName,
    assignedTo: t.assignedTo ?? null,
    tags: t.tags ? t.tags.split(",").filter(Boolean) : [],
    createdAt: t.createdAt.toISOString(),
    firstRespondedAt: t.firstRespondedAt ? t.firstRespondedAt.toISOString() : null,
    resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
    sla: computeSlaStatus(t),
  };
}

const OPEN_STATUSES = new Set(["open", "in_progress", "waiting"]);
const CLOSED_STATUSES = new Set(["resolved", "closed"]);

router.get("/tickets/sla-summary", async (req, res) => {
  try {
    const rows = await db.select().from(ticketsTable);
    res.json(summarizeSla(rows));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to compute SLA summary" });
  }
});

router.get("/tickets/suggest-assignee", async (req, res) => {
  try {
    const result = await suggestAssignee();
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to suggest assignee" });
  }
});

router.get("/tickets", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const limit = Number(req.query.limit ?? 50);

    const conditions = [];
    if (status) conditions.push(eq(ticketsTable.status, status));
    if (priority) conditions.push(eq(ticketsTable.priority, priority));

    const rows = await db
      .select()
      .from(ticketsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(ticketsTable.createdAt))
      .limit(limit);
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.post("/tickets", async (req, res) => {
  try {
    const body = { ...req.body };
    if (Array.isArray(body.tags)) body.tags = body.tags.join(",");
    const [row] = await db.insert(ticketsTable).values(body).returning();
    await db.insert(activityTable).values({
      type: "ticket",
      title: "Support ticket opened",
      description: `${row.priority.toUpperCase()} — ${row.subject}`,
    });
    await emit("support", "ticket.created", { subject: row.subject }, row.id);
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

router.patch("/tickets/:id", async (req, res) => {
  try {
    const [existing] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const body = { ...req.body };
    if (Array.isArray(body.tags)) body.tags = body.tags.join(",");

    // Auto-stamp SLA milestones: first response fires the moment a ticket
    // leaves "open" (someone engaged with it); resolution fires the moment
    // it lands in resolved/closed. Never overwrite an existing timestamp.
    if (body.status && body.status !== existing.status) {
      if (!existing.firstRespondedAt && OPEN_STATUSES.has(body.status) && body.status !== "open") {
        body.firstRespondedAt = new Date();
      }
      if (!existing.resolvedAt && CLOSED_STATUSES.has(body.status)) {
        body.resolvedAt = new Date();
        if (!existing.firstRespondedAt && !body.firstRespondedAt) body.firstRespondedAt = body.resolvedAt;
      }
    }
    if (body.assignedTo && !existing.assignedTo && !existing.firstRespondedAt && !body.firstRespondedAt) {
      body.firstRespondedAt = new Date();
    }

    const [row] = await db
      .update(ticketsTable)
      .set(body)
      .where(eq(ticketsTable.id, Number(req.params.id)))
      .returning();
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

router.delete("/tickets/:id", async (req, res) => {
  try {
    await db.delete(ticketsTable).where(eq(ticketsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

export default router;
