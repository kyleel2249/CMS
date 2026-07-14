import { Router } from "express";
import { db, automationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import * as ai from "../lib/ai";
import { runAutomationAction } from "../lib/automations";

const router = Router();

function toResponse(a: typeof automationsTable.$inferSelect) {
  return {
    id: a.id,
    name: a.name,
    description: a.description ?? null,
    trigger: a.trigger,
    triggerConfig: a.triggerConfig,
    action: a.action,
    actionConfig: a.actionConfig,
    status: a.status,
    runsTotal: a.runsTotal,
    runsSuccess: a.runsSuccess,
    lastRunAt: a.lastRunAt ? a.lastRunAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/automations", async (req, res) => {
  try {
    const rows = await db.select().from(automationsTable).orderBy(desc(automationsTable.createdAt));
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch automations" });
  }
});

router.post("/automations", async (req, res) => {
  try {
    const [row] = await db.insert(automationsTable).values(req.body).returning();
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create automation" });
  }
});

router.get("/automations/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(automationsTable).where(eq(automationsTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch automation" });
  }
});

router.patch("/automations/:id", async (req, res) => {
  try {
    const [row] = await db.update(automationsTable).set(req.body).where(eq(automationsTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update automation" });
  }
});

router.delete("/automations/:id", async (req, res) => {
  try {
    await db.delete(automationsTable).where(eq(automationsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete automation" });
  }
});

router.post("/automations/:id/toggle", async (req, res) => {
  try {
    const [row] = await db.select().from(automationsTable).where(eq(automationsTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    const [updated] = await db.update(automationsTable)
      .set({ status: row.status === "active" ? "paused" : "active" })
      .where(eq(automationsTable.id, row.id))
      .returning();
    res.json(toResponse(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to toggle automation" });
  }
});

router.post("/automations/:id/run", async (req, res) => {
  try {
    const [row] = await db.select().from(automationsTable).where(eq(automationsTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });

    const outcome = await runAutomationAction(row.action);
    const succeeded = outcome.success > 0 || outcome.processed === 0;

    const [updated] = await db.update(automationsTable)
      .set({
        runsTotal: row.runsTotal + 1,
        runsSuccess: row.runsSuccess + (succeeded ? 1 : 0),
        lastRunAt: new Date(),
      })
      .where(eq(automationsTable.id, row.id))
      .returning();
    res.json({ success: succeeded, processed: outcome.processed, automation: toResponse(updated) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to run automation" });
  }
});

router.post("/ai/automations/suggest", async (req, res) => {
  try {
    if (!ai.aiEnabled()) {
      return res.json({
        suggestions: [
          { name: "Auto-qualify new leads", trigger: "lead.created", action: "ai.qualify_lead", description: "When a lead is created, automatically qualify them using AI scoring." },
          { name: "Triage support tickets", trigger: "ticket.created", action: "ai.triage_ticket", description: "Assign priority and draft a reply for every new support ticket." },
          { name: "Chase overdue invoices", trigger: "invoice.overdue", action: "email.send_reminder", description: "Automatically send a payment reminder email when an invoice passes its due date." },
        ],
        enabled: false,
      });
    }
    const suggestions = await ai.suggestAutomations();
    return res.json({ suggestions, enabled: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

export default router;
