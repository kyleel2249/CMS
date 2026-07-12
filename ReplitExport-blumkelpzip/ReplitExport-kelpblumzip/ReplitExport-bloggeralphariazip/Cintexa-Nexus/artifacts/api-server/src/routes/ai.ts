import { Router } from "express";
import { db, aiInsightsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";
import * as ai from "../lib/ai";

const router = Router();

router.get("/ai/status", (_req, res) => {
  res.json({ enabled: ai.aiEnabled() });
});

router.get("/ai/insights", async (req, res) => {
  try {
    const { module, entityId, kind, limit } = req.query;
    const conditions = [];
    if (module) conditions.push(eq(aiInsightsTable.module, String(module)));
    if (kind) conditions.push(eq(aiInsightsTable.kind, String(kind)));
    if (entityId) conditions.push(eq(aiInsightsTable.entityId, Number(entityId)));

    let query = db.select().from(aiInsightsTable);
    if (conditions.length) {
      query = query.where(and(...conditions)) as typeof query;
    }
    const rows = await query.orderBy(desc(aiInsightsTable.createdAt)).limit(Number(limit ?? 20));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

router.post("/ai/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    if (!ai.aiEnabled()) {
      return res.json({
        reply:
          "NEXUS AI isn't fully activated yet — connect an OpenAI API key in Secrets to unlock live reasoning over your CRM, support, marketing, and finance data.",
        suggestions: ["Show me this week's pipeline", "Which deals need attention?", "What's my revenue forecast?"],
        enabled: false,
      });
    }

    const reply = await ai.chat(message, history ?? []);
    return res.json({
      reply: reply ?? "I couldn't generate a response — please try again.",
      suggestions: [
        "Show me this week's pipeline",
        "Which deals need attention?",
        "Generate a board summary",
        "What's my revenue forecast?",
      ],
      enabled: true,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "AI service unavailable" });
  }
});

router.get("/ai/morning-brief", async (req, res) => {
  try {
    const brief = await ai.morningBrief();
    return res.json({ ...brief, enabled: ai.aiEnabled() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to generate brief" });
  }
});

router.post("/ai/leads/:id/qualify", async (req, res) => {
  try {
    if (!ai.aiEnabled()) return res.status(400).json({ error: "AI is not configured. Add OPENAI_API_KEY." });
    const insight = await ai.qualifyLead(Number(req.params.id));
    if (!insight) return res.status(404).json({ error: "Lead not found or AI unavailable" });
    return res.json(insight);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to qualify lead" });
  }
});

router.post("/ai/tickets/:id/triage", async (req, res) => {
  try {
    if (!ai.aiEnabled()) return res.status(400).json({ error: "AI is not configured. Add OPENAI_API_KEY." });
    const insight = await ai.triageTicket(Number(req.params.id));
    if (!insight) return res.status(404).json({ error: "Ticket not found or AI unavailable" });
    return res.json(insight);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to triage ticket" });
  }
});

router.post("/ai/campaigns/:id/generate-copy", async (req, res) => {
  try {
    if (!ai.aiEnabled()) return res.status(400).json({ error: "AI is not configured. Add OPENAI_API_KEY." });
    const insight = await ai.generateMarketingCopy(Number(req.params.id), req.body?.brief);
    if (!insight) return res.status(404).json({ error: "Campaign not found or AI unavailable" });
    return res.json(insight);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to generate campaign copy" });
  }
});

router.post("/ai/finance/forecast", async (req, res) => {
  try {
    const forecast = await ai.financeForecast();
    return res.json({ ...forecast, enabled: ai.aiEnabled() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to generate forecast" });
  }
});

export default router;
