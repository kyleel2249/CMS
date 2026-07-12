import { Router } from "express";
import { db, aiInsightsTable, dealsTable, invoicesTable, leadsTable, contactsTable } from "@workspace/db";
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

// ── Win Probability Scoring ───────────────────────────────────────────────────

router.get("/ai/deals/win-probability", async (req, res) => {
  try {
    const deals = await db.select().from(dealsTable).orderBy(desc(dealsTable.createdAt)).limit(50);

    const scored = deals.map((deal) => {
      // Heuristic scoring when AI is not enabled
      let score = deal.probability ?? 10;

      // Stage bonuses
      const stageBonus: Record<string, number> = {
        prospecting: 0, qualification: 5, proposal: 10,
        negotiation: 15, "closed-won": 40, "closed-lost": -40,
      };
      score += stageBonus[deal.stage] ?? 0;

      // Value signal
      const value = Number(deal.value ?? 0);
      if (value > 50000) score -= 5; // larger deals take longer
      if (value < 5000) score += 5;

      // Clamp
      score = Math.max(0, Math.min(99, score));

      return {
        id: deal.id,
        title: deal.title,
        stage: deal.stage,
        value: Number(deal.value),
        probability: deal.probability,
        winProbability: score,
        contactName: deal.contactName,
        companyName: deal.companyName,
        expectedCloseDate: deal.expectedCloseDate,
      };
    });

    res.json({ deals: scored, enabled: ai.aiEnabled() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to score deals" });
  }
});

// ── Revenue Intelligence ──────────────────────────────────────────────────────

router.get("/ai/revenue-intelligence", async (req, res) => {
  try {
    const [allDeals, allInvoices, allLeads] = await Promise.all([
      db.select().from(dealsTable).orderBy(desc(dealsTable.createdAt)).limit(100),
      db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt)).limit(100),
      db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt)).limit(50),
    ]);

    const pipelineValue = allDeals
      .filter((d) => !["closed-won", "closed-lost"].includes(d.stage))
      .reduce((acc, d) => acc + Number(d.value ?? 0) * ((d.probability ?? 10) / 100), 0);

    const closedWonValue = allDeals
      .filter((d) => d.stage === "closed-won")
      .reduce((acc, d) => acc + Number(d.value ?? 0), 0);

    const totalInvoiced = allInvoices.reduce((acc, i) => acc + Number(i.amount ?? 0), 0);
    const totalPaid = allInvoices.filter((i) => i.status === "paid").reduce((acc, i) => acc + Number(i.amount ?? 0), 0);

    const hotLeads = allLeads.filter((l) => (l.score ?? 0) >= 70).length;

    // Trend: last 6 months
    const months: Record<string, { revenue: number; deals: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { revenue: 0, deals: 0 };
    }
    allDeals
      .filter((d) => d.stage === "closed-won")
      .forEach((deal) => {
        const d = deal.createdAt;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in months) {
          months[key].revenue += Number(deal.value ?? 0);
          months[key].deals += 1;
        }
      });

    const trend = Object.entries(months).map(([month, data]) => ({ month, ...data }));

    const insights = [
      pipelineValue > 0 ? `Weighted pipeline is $${Math.round(pipelineValue / 1000)}K — ${allDeals.filter((d) => !["closed-won","closed-lost"].includes(d.stage)).length} open deals` : "No active pipeline found",
      hotLeads > 0 ? `${hotLeads} hot lead${hotLeads > 1 ? "s" : ""} scoring ≥70 — ready for outreach` : "No high-score leads right now",
      totalInvoiced > 0 ? `${Math.round((totalPaid / totalInvoiced) * 100)}% of invoiced revenue collected` : "No invoices yet",
    ];

    res.json({ pipelineValue, closedWonValue, totalInvoiced, totalPaid, hotLeads, trend, insights, enabled: ai.aiEnabled() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to compute revenue intelligence" });
  }
});

// ── Copilot (cross-module context-aware chat) ─────────────────────────────────

router.post("/ai/copilot", async (req, res) => {
  try {
    const { message, context, history } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    if (!ai.aiEnabled()) {
      const staticReplies: Record<string, string> = {
        pipeline: "Your pipeline has several deals in negotiation stage. Focus on closing those first.",
        revenue: "Revenue is trending positively. Q4 looks strong based on pipeline coverage.",
        forecast: "Based on current pipeline, you're on track to hit 87% of quarterly target.",
      };
      const key = Object.keys(staticReplies).find((k) => message.toLowerCase().includes(k));
      return res.json({
        reply: key ? staticReplies[key] : "I can help you analyze your CRM data, pipeline, revenue, and more. Connect OpenAI to unlock full AI reasoning.",
        suggestions: ["What deals need attention?", "Summarize this week's activity", "What's my revenue forecast?"],
        enabled: false,
      });
    }

    const systemPrompt = `You are NEXUS Copilot, an AI assistant embedded in a CRM platform. You have access to the user's sales pipeline, contacts, support tickets, finance data, and project status. ${context ? `Current context: ${context}` : ""} Be concise, data-driven, and actionable.`;
    const reply = await ai.chat(message, [{ role: "system", content: systemPrompt }, ...(history ?? [])]);

    return res.json({
      reply: reply ?? "I couldn't generate a response.",
      suggestions: ["What's my win rate this quarter?", "Which deals need follow-up?", "Summarize overdue invoices"],
      enabled: true,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Copilot unavailable" });
  }
});

// ── Anomaly explanations ──────────────────────────────────────────────────────

router.post("/ai/anomalies/:id/explain", async (req, res) => {
  try {
    const { anomalyTitle, anomalyDescription, module } = req.body;
    if (!ai.aiEnabled()) {
      return res.json({ explanation: `This anomaly was detected in the ${module ?? "system"} module. Review recent changes to identify the root cause.`, enabled: false });
    }
    const prompt = `A CRM anomaly was detected:\nTitle: ${anomalyTitle}\nDescription: ${anomalyDescription}\nModule: ${module}\n\nProvide a concise 2-3 sentence explanation of what likely caused this, what business impact it may have, and one recommended action.`;
    const explanation = await ai.chat(prompt, []);
    return res.json({ explanation: explanation ?? "Unable to generate explanation.", enabled: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to explain anomaly" });
  }
});

// ── Deal insights ─────────────────────────────────────────────────────────────

router.post("/ai/deals/:id/insights", async (req, res) => {
  try {
    const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, Number(req.params.id)));
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    if (!ai.aiEnabled()) {
      return res.json({
        risk: deal.probability && deal.probability < 30 ? "high" : "medium",
        nextAction: "Schedule a follow-up call to discuss timeline.",
        enabled: false,
      });
    }

    const prompt = `Analyze this CRM deal and respond with JSON only:\n{"risk":"low|medium|high","nextAction":"<one recommended next step>","insight":"<one insight about this deal>"}\n\nDeal: ${JSON.stringify({ title: deal.title, value: deal.value, stage: deal.stage, probability: deal.probability, expectedCloseDate: deal.expectedCloseDate, notes: deal.notes })}`;
    const reply = await ai.chat(prompt, []);
    let parsed: any = {};
    try { const m = (reply ?? "").match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch { /**/ }
    return res.json({ ...parsed, enabled: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to generate deal insights" });
  }
});

export default router;
