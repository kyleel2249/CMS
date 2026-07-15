import OpenAI from "openai";
import { logger } from "./logger";
import {
  db,
  aiInsightsTable,
  leadsTable,
  ticketsTable,
  campaignsTable,
  invoicesTable,
  dealsTable,
  contactsTable,
  projectsTable,
  knowledgeArticlesTable,
  automationsTable,
  notesTable,
  goalsTable,
  keyResultsTable,
} from "@workspace/db";
import { count, sum, desc, eq } from "drizzle-orm";

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://cintexa-nexus.replit.app",
        "X-Title": "Cintexa Nexus",
      },
    });
  }
  return client;
}

export function aiEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY);
}

const MODEL = "google/gemini-2.5-flash";

async function completeJson<T>(system: string, user: string): Promise<T | null> {
  const openai = getClient();
  if (!openai) return null;
  const resp = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: system + " Always respond with valid JSON only." },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });
  const raw = resp.choices[0]?.message?.content;
  if (!raw) return null;
  // Strip markdown code fences if the model wraps JSON in them
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.error({ err, raw }, "failed to parse AI JSON response");
    return null;
  }
}

async function completeText(system: string, user: string): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;
  const resp = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return resp.choices[0]?.message?.content ?? null;
}

async function saveInsight(params: {
  module: string;
  kind: string;
  entityId: number | null;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(aiInsightsTable)
    .values({
      module: params.module,
      kind: params.kind,
      entityId: params.entityId,
      title: params.title,
      content: params.content,
      metadata: params.metadata ?? {},
    })
    .returning();
  return row;
}

// ---- The AI "employee" acting inside each module -------------------------

export async function qualifyLead(leadId: number) {
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
  if (!lead) return null;

  const result = await completeJson<{
    score: number;
    qualification: "hot" | "warm" | "cold" | "unqualified";
    reasoning: string;
    nextAction: string;
  }>(
    "You are NEXUS AI, an autonomous sales development rep for a B2B SaaS company. Score and qualify inbound leads. Respond only with JSON: { score: 0-100, qualification: 'hot'|'warm'|'cold'|'unqualified', reasoning: string (1-2 sentences), nextAction: string (a concrete next step) }.",
    `Lead: ${JSON.stringify({
      name: lead.name,
      company: lead.company,
      source: lead.source,
      notes: lead.notes,
      currentScore: lead.score,
    })}`,
  );

  if (!result) return null;

  await db
    .update(leadsTable)
    .set({
      score: result.score,
      status: result.qualification === "unqualified" ? "unqualified" : "qualified",
    })
    .where(eq(leadsTable.id, leadId));

  return saveInsight({
    module: "sales",
    kind: "lead_qualification",
    entityId: leadId,
    title: `Qualified: ${lead.name} (${result.qualification})`,
    content: `${result.reasoning} Next action: ${result.nextAction}`,
    metadata: result,
  });
}

export async function triageTicket(ticketId: number) {
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId));
  if (!ticket) return null;

  const result = await completeJson<{
    priority: "low" | "medium" | "high" | "urgent";
    sentiment: "positive" | "neutral" | "negative";
    draftReply: string;
  }>(
    "You are NEXUS AI, an autonomous customer support agent. Triage the ticket and draft a helpful, empathetic first reply. Respond only with JSON: { priority: 'low'|'medium'|'high'|'urgent', sentiment: 'positive'|'neutral'|'negative', draftReply: string (2-4 sentences, ready to send) }.",
    `Ticket: ${JSON.stringify({
      subject: ticket.subject,
      description: ticket.description,
      channel: ticket.channel,
      contactName: ticket.contactName,
    })}`,
  );

  if (!result) return null;

  await db
    .update(ticketsTable)
    .set({ priority: result.priority })
    .where(eq(ticketsTable.id, ticketId));

  return saveInsight({
    module: "support",
    kind: "ticket_triage",
    entityId: ticketId,
    title: `Draft reply — ${ticket.subject}`,
    content: result.draftReply,
    metadata: { priority: result.priority, sentiment: result.sentiment },
  });
}

export async function generateMarketingCopy(campaignId: number, brief?: string) {
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  if (!campaign) return null;

  const content = await completeText(
    "You are NEXUS AI, an autonomous marketing copywriter. Write tight, high-converting campaign copy: a subject line and a 3-4 sentence body. No preamble, no markdown headers.",
    `Campaign: "${campaign.name}" (type: ${campaign.type}, audience size: ${campaign.audienceSize}). ${brief ? `Brief: ${brief}` : "Write copy appropriate to the campaign name and type."}`,
  );
  if (!content) return null;

  return saveInsight({
    module: "marketing",
    kind: "marketing_copy",
    entityId: campaignId,
    title: `Copy draft — ${campaign.name}`,
    content,
  });
}

export async function financeForecast() {
  const [[{ totalPaid }], [{ totalOutstanding }], deals] = await Promise.all([
    db.select({ totalPaid: sum(invoicesTable.amount) }).from(invoicesTable).where(eq(invoicesTable.status, "paid")),
    db.select({ totalOutstanding: sum(invoicesTable.amount) }).from(invoicesTable).where(eq(invoicesTable.status, "overdue")),
    db.select().from(dealsTable),
  ]);

  const openPipelineValue = deals
    .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
    .reduce((sum, d) => sum + Number(d.value), 0);
  const weightedPipeline = deals
    .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
    .reduce((sum, d) => sum + (Number(d.value) * d.probability) / 100, 0);

  const summary = {
    totalPaid: Number(totalPaid ?? 0),
    totalOutstanding: Number(totalOutstanding ?? 0),
    openPipelineValue,
    weightedPipeline: Math.round(weightedPipeline),
  };

  const narrative = await completeText(
    "You are NEXUS AI, an autonomous finance analyst. Given these figures, write a 3-4 sentence revenue forecast narrative for an exec audience: confident, specific, and actionable. No markdown.",
    JSON.stringify(summary),
  );

  const insight = await saveInsight({
    module: "finance",
    kind: "finance_forecast",
    entityId: null,
    title: "Revenue forecast",
    content: narrative ?? `Paid revenue: $${summary.totalPaid}. Weighted pipeline: $${summary.weightedPipeline}. Outstanding: $${summary.totalOutstanding}.`,
    metadata: summary,
  });

  return { ...summary, narrative: insight.content, insightId: insight.id };
}

export async function morningBrief() {
  const [
    [{ totalContacts }],
    [{ totalDeals }],
    [{ openTickets }],
    [{ totalLeads }],
    [{ activeProjects }],
    [{ overdueInvoices }],
    recentDeals,
  ] = await Promise.all([
    db.select({ totalContacts: count() }).from(contactsTable),
    db.select({ totalDeals: count() }).from(dealsTable),
    db.select({ openTickets: count() }).from(ticketsTable).where(eq(ticketsTable.status, "open")),
    db.select({ totalLeads: count() }).from(leadsTable),
    db.select({ activeProjects: count() }).from(projectsTable).where(eq(projectsTable.status, "active")),
    db.select({ overdueInvoices: count() }).from(invoicesTable).where(eq(invoicesTable.status, "overdue")),
    db.select().from(dealsTable).orderBy(desc(dealsTable.id)).limit(5),
  ]);

  const snapshot = {
    totalContacts,
    totalDeals,
    openTickets,
    totalLeads,
    activeProjects,
    overdueInvoices,
    recentDeals: recentDeals.map((d) => ({ title: d.title, stage: d.stage, value: d.value })),
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const result = await completeJson<{
    headline: string;
    insights: string[];
    priorities: string[];
  }>(
    "You are NEXUS AI, the tireless chief-of-staff for this company. Write a morning briefing for the exec team grounded ONLY in the data given. Respond only with JSON: { headline: string, insights: string[] (4-5 items), priorities: string[] (3-4 concrete action items) }.",
    JSON.stringify(snapshot),
  );

  const brief = result ?? {
    headline: "System operational — all modules nominal.",
    insights: [
      `${totalContacts} contacts, ${totalDeals} deals, and ${totalLeads} leads tracked across the pipeline.`,
      `${openTickets} support tickets currently open.`,
      `${activeProjects} active projects in flight.`,
      `${overdueInvoices} invoices overdue and need follow-up.`,
    ],
    priorities: ["Connect an OpenAI API key to unlock AI-generated daily briefings."],
  };

  await saveInsight({
    module: "executive",
    kind: "morning_brief",
    entityId: null,
    title: brief.headline,
    content: brief.insights.join(" "),
    metadata: brief,
  });

  return { date: today, ...brief };
}

export async function chat(message: string, history: { role: "user" | "assistant"; content: string }[] = []) {
  const [stats, pipeline, [{ openTickets }], [{ overdueInvoices }], [{ activeProjects }]] = await Promise.all([
    db.select({ totalContacts: count() }).from(contactsTable),
    db.select().from(dealsTable),
    db.select({ openTickets: count() }).from(ticketsTable).where(eq(ticketsTable.status, "open")),
    db.select({ overdueInvoices: count() }).from(invoicesTable).where(eq(invoicesTable.status, "overdue")),
    db.select({ activeProjects: count() }).from(projectsTable).where(eq(projectsTable.status, "active")),
  ]);

  const context = {
    totalContacts: stats[0]?.totalContacts ?? 0,
    openDeals: pipeline.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost").length,
    pipelineValue: pipeline.reduce((sum, d) => sum + Number(d.value), 0),
    closedWon: pipeline.filter((d) => d.stage === "closed_won").reduce((sum, d) => sum + Number(d.value), 0),
    openTickets,
    overdueInvoices,
    activeProjects,
  };

  const openai = getClient();
  if (!openai) return null;

  const resp = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are NEXUS AI, the always-on operating intelligence for this company's unified business platform. You have live access to CRM, sales pipeline, support, marketing, finance, projects, knowledge base, and automations data. You are the company's smartest employee — proactive, concise, concrete, and always suggest the next best action. Current live snapshot: ${JSON.stringify(context)}`,
      },
      ...history,
      { role: "user", content: message },
    ],
  });

  return resp.choices[0]?.message?.content ?? null;
}

export async function summarizeKnowledgeArticle(articleId: number) {
  const [article] = await db.select().from(knowledgeArticlesTable).where(eq(knowledgeArticlesTable.id, articleId));
  if (!article) return null;

  const summary = await completeText(
    "You are NEXUS AI, a knowledge management assistant. Write a concise 2-3 sentence summary of this knowledge base article that captures the key takeaway. No markdown.",
    `Title: ${article.title}\n\nContent: ${article.content}`,
  );

  if (!summary) return null;

  await db.update(knowledgeArticlesTable).set({ aiSummary: summary }).where(eq(knowledgeArticlesTable.id, articleId));

  return saveInsight({
    module: "knowledge",
    kind: "article_summary",
    entityId: articleId,
    title: `Summary: ${article.title}`,
    content: summary,
  });
}

export async function suggestAutomations() {
  const [contacts, deals, tickets, invoices, leads] = await Promise.all([
    db.select({ total: count() }).from(contactsTable),
    db.select().from(dealsTable).limit(5),
    db.select({ open: count() }).from(ticketsTable).where(eq(ticketsTable.status, "open")),
    db.select({ overdue: count() }).from(invoicesTable).where(eq(invoicesTable.status, "overdue")),
    db.select({ total: count() }).from(leadsTable),
  ]);

  const existing = await db.select({ action: automationsTable.action }).from(automationsTable);

  const snapshot = {
    totalContacts: contacts[0]?.total,
    openTickets: tickets[0]?.open,
    overdueInvoices: invoices[0]?.overdue,
    totalLeads: leads[0]?.total,
    topDeals: deals.map((d) => ({ stage: d.stage, value: d.value })),
    existingAutomations: existing.map((a) => a.action),
  };

  const result = await completeJson<{
    suggestions: Array<{ name: string; trigger: string; action: string; description: string; impact: string }>;
  }>(
    "You are NEXUS AI, an automation architect. Based on this company's live data, suggest 4-5 high-impact workflow automations that don't already exist. Each must address a real business gap visible in the data. Respond only with JSON: { suggestions: [{ name: string, trigger: string, action: string, description: string (1 sentence), impact: string (measurable business outcome) }] }.",
    JSON.stringify(snapshot),
  );

  return result?.suggestions ?? [];
}

export type AnomalySeverity = "critical" | "warning" | "info";

export type Anomaly = {
  id: string;
  module: string;
  metric: string;
  severity: AnomalySeverity;
  current: number;
  baseline: number;
  deviation: number;
  unit: string;
  title: string;
  description: string;
  aiExplanation: string | null;
  suggestedAction: string | null;
  detectedAt: string;
};

export async function mapMetricsToOKRs() {
  const [
    allInvoices,
    allDeals,
    allTickets,
    allLeads,
    allProjects,
    allAutomations,
    allGoals,
    allKRs,
  ] = await Promise.all([
    db.select().from(invoicesTable),
    db.select().from(dealsTable),
    db.select().from(ticketsTable),
    db.select().from(leadsTable),
    db.select().from(projectsTable),
    db.select().from(automationsTable),
    db.select().from(goalsTable),
    db.select().from(keyResultsTable),
  ]);

  const paidRevenue   = allInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const closedDeals   = allDeals.filter((d) => d.stage === "closed_won" || d.stage === "closed_lost");
  const wonDeals      = allDeals.filter((d) => d.stage === "closed_won");
  const winRate       = closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0;
  const openDeals     = allDeals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const avgDealSize   = wonDeals.length > 0 ? Math.round(wonDeals.reduce((s, d) => s + Number(d.value), 0) / wonDeals.length) : 0;
  const openTickets   = allTickets.filter((t) => t.status === "open").length;
  const ticketOpenRate= allTickets.length > 0 ? Math.round((openTickets / allTickets.length) * 100) : 0;
  const qualLeads     = allLeads.filter((l) => l.status === "qualified" || (l.score ?? 0) >= 60).length;
  const leadConversion= allLeads.length > 0 ? Math.round((qualLeads / allLeads.length) * 100) : 0;
  const completedProjects = allProjects.filter((p) => p.status === "completed").length;
  const activeAutomations = allAutomations.filter((a) => a.status === "active").length;
  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value), 0);

  const liveMetrics: Record<string, number> = {
    revenue:             paidRevenue,
    win_rate:            winRate,
    avg_deal_size:       avgDealSize,
    open_deals:          openDeals.length,
    pipeline_value:      pipelineValue,
    ticket_open_rate:    ticketOpenRate,
    open_tickets:        openTickets,
    lead_conversion:     leadConversion,
    projects_completed:  completedProjects,
    active_automations:  activeAutomations,
  };

  // Update auto-tracked KRs with live values
  const updatedKRIds: number[] = [];
  for (const kr of allKRs.filter((k) => k.autoTracked && k.linkedMetric)) {
    const live = liveMetrics[kr.linkedMetric!];
    if (live === undefined) continue;
    const progress = Math.min(Math.round((live / kr.targetValue) * 100), 100);
    const status   = progress >= 100 ? "completed" : progress >= 70 ? "on_track" : progress >= 40 ? "at_risk" : "behind";
    await db.update(keyResultsTable)
      .set({ currentValue: live, status, updatedAt: new Date() })
      .where(eq(keyResultsTable.id, kr.id));
    updatedKRIds.push(kr.id);
  }

  // Recompute goal progress from KR averages
  const freshKRs = await db.select().from(keyResultsTable);
  for (const goal of allGoals) {
    const goalKRs = freshKRs.filter((k) => k.goalId === goal.id);
    if (goalKRs.length === 0) continue;
    const avgProgress = Math.round(
      goalKRs.reduce((s, k) => s + Math.min((k.currentValue / k.targetValue) * 100, 100), 0) / goalKRs.length
    );
    const status = avgProgress >= 80 ? "on_track" : avgProgress >= 50 ? "at_risk" : "behind";
    await db.update(goalsTable)
      .set({ progress: avgProgress, status, updatedAt: new Date() })
      .where(eq(goalsTable.id, goal.id));
  }

  // AI narrative per goal
  const freshGoals = await db.select().from(goalsTable);
  const freshGoalsWithKRs = freshGoals.map((g) => ({
    ...g,
    keyResults: freshKRs.filter((k) => k.goalId === g.id),
  }));

  const narrativeResult = await completeJson<{ narratives: Array<{ goalId: number; narrative: string }> }>(
    "You are NEXUS AI, the OKR intelligence layer. For each goal, write a 2-sentence narrative forecast grounded in the current progress data — predict whether the goal will be hit by quarter end, cite the most critical KR, and name one concrete action. Respond only with JSON: { narratives: [{ goalId: number, narrative: string }] }.",
    JSON.stringify(freshGoalsWithKRs.map((g) => ({
      goalId: g.id,
      title: g.title,
      progress: g.progress,
      status: g.status,
      quarter: g.quarter,
      year: g.year,
      keyResults: g.keyResults.map((k) => ({
        title: k.title,
        current: k.currentValue,
        target: k.targetValue,
        unit: k.unit,
        progress: Math.min(Math.round((k.currentValue / k.targetValue) * 100), 100),
        status: k.status,
      })),
    })))
  );

  if (narrativeResult?.narratives) {
    for (const { goalId, narrative } of narrativeResult.narratives) {
      await db.update(goalsTable).set({ aiNarrative: narrative, updatedAt: new Date() }).where(eq(goalsTable.id, goalId));
    }
  }

  const finalGoals = await db.select().from(goalsTable);
  const finalKRs   = await db.select().from(keyResultsTable);

  return {
    goals: finalGoals.map((g) => ({ ...g, keyResults: finalKRs.filter((k) => k.goalId === g.id) })),
    liveMetrics,
    updatedKRCount: updatedKRIds.length,
  };
}

export async function detectAnomalies(): Promise<Anomaly[]> {
  const [
    allTickets,
    allInvoices,
    allDeals,
    allLeads,
    allAutomations,
    allContacts,
    allProjects,
  ] = await Promise.all([
    db.select().from(ticketsTable),
    db.select().from(invoicesTable),
    db.select().from(dealsTable),
    db.select().from(leadsTable),
    db.select().from(automationsTable),
    db.select().from(contactsTable),
    db.select().from(projectsTable),
  ]);

  const rawAnomalies: Array<Omit<Anomaly, "aiExplanation" | "suggestedAction" | "detectedAt">> = [];

  // 1. Support ticket surge — open tickets > 30% of total
  const openTickets = allTickets.filter((t) => t.status === "open").length;
  const urgentTickets = allTickets.filter((t) => t.priority === "urgent" && t.status === "open").length;
  const ticketOpenRate = allTickets.length > 0 ? openTickets / allTickets.length : 0;
  const baselineTicketRate = 0.25;
  if (ticketOpenRate > baselineTicketRate) {
    rawAnomalies.push({
      id: "ticket-open-rate",
      module: "support",
      metric: "Open ticket rate",
      severity: urgentTickets > 0 ? "critical" : ticketOpenRate > 0.4 ? "warning" : "info",
      current: Math.round(ticketOpenRate * 100),
      baseline: Math.round(baselineTicketRate * 100),
      deviation: Math.round(((ticketOpenRate - baselineTicketRate) / baselineTicketRate) * 100),
      unit: "%",
      title: `${openTickets} open tickets (${Math.round(ticketOpenRate * 100)}% of total)`,
      description: `${urgentTickets} urgent ticket${urgentTickets !== 1 ? "s" : ""} require immediate attention. Baseline: ≤${Math.round(baselineTicketRate * 100)}% open rate.`,
    });
  }

  // 2. Invoice overdue rate — overdue > 20% of total outstanding
  const overdueInvoices = allInvoices.filter((i) => i.status === "overdue");
  const pendingInvoices = allInvoices.filter((i) => i.status !== "paid");
  const overdueRate = pendingInvoices.length > 0 ? overdueInvoices.length / pendingInvoices.length : 0;
  const overdueAmount = overdueInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const baselineOverdueRate = 0.2;
  if (overdueRate > baselineOverdueRate) {
    rawAnomalies.push({
      id: "invoice-overdue-rate",
      module: "finance",
      metric: "Invoice overdue rate",
      severity: overdueRate > 0.4 ? "critical" : "warning",
      current: Math.round(overdueRate * 100),
      baseline: Math.round(baselineOverdueRate * 100),
      deviation: Math.round(((overdueRate - baselineOverdueRate) / baselineOverdueRate) * 100),
      unit: "%",
      title: `$${overdueAmount.toLocaleString()} overdue (${Math.round(overdueRate * 100)}% of outstanding)`,
      description: `${overdueInvoices.length} invoice${overdueInvoices.length !== 1 ? "s" : ""} past due. Healthy threshold: <${Math.round(baselineOverdueRate * 100)}% overdue.`,
    });
  }

  // 3. Deal stall — >40% of open deals in early stages (prospecting/qualification)
  const openDeals = allDeals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const stalledDeals = openDeals.filter((d) => ["prospecting", "qualification"].includes(d.stage));
  const stallRate = openDeals.length > 0 ? stalledDeals.length / openDeals.length : 0;
  const baselineStallRate = 0.3;
  if (stallRate > baselineStallRate) {
    rawAnomalies.push({
      id: "deal-stall-rate",
      module: "sales",
      metric: "Pipeline stall rate",
      severity: stallRate > 0.6 ? "critical" : "warning",
      current: Math.round(stallRate * 100),
      baseline: Math.round(baselineStallRate * 100),
      deviation: Math.round(((stallRate - baselineStallRate) / baselineStallRate) * 100),
      unit: "%",
      title: `${stalledDeals.length} deals stalled in early stages`,
      description: `${Math.round(stallRate * 100)}% of open pipeline is in prospecting/qualification. Healthy ratio: <${Math.round(baselineStallRate * 100)}%.`,
    });
  }

  // 4. Lead qualification gap — >35% of leads unqualified
  const unqualifiedLeads = allLeads.filter((l) => l.status === "unqualified" || (l.score !== null && l.score < 40));
  const leadQualGap = allLeads.length > 0 ? unqualifiedLeads.length / allLeads.length : 0;
  const baselineLeadGap = 0.25;
  if (leadQualGap > baselineLeadGap) {
    rawAnomalies.push({
      id: "lead-qualification-gap",
      module: "crm",
      metric: "Lead qualification gap",
      severity: leadQualGap > 0.5 ? "warning" : "info",
      current: Math.round(leadQualGap * 100),
      baseline: Math.round(baselineLeadGap * 100),
      deviation: Math.round(((leadQualGap - baselineLeadGap) / baselineLeadGap) * 100),
      unit: "%",
      title: `${unqualifiedLeads.length} leads below qualification threshold`,
      description: `${Math.round(leadQualGap * 100)}% of leads are unqualified or low-score. Target: <${Math.round(baselineLeadGap * 100)}%.`,
    });
  }

  // 5. Automation failure rate — any automation with <80% success
  const failingAutomations = allAutomations.filter(
    (a) => a.runsTotal > 0 && a.runsSuccess / a.runsTotal < 0.8
  );
  if (failingAutomations.length > 0) {
    const worstRate = Math.min(
      ...failingAutomations.map((a) => Math.round((a.runsSuccess / a.runsTotal) * 100))
    );
    rawAnomalies.push({
      id: "automation-failure-rate",
      module: "automations",
      metric: "Automation success rate",
      severity: worstRate < 60 ? "critical" : "warning",
      current: worstRate,
      baseline: 80,
      deviation: Math.round(((worstRate - 80) / 80) * 100),
      unit: "%",
      title: `${failingAutomations.length} automation${failingAutomations.length !== 1 ? "s" : ""} below 80% success rate`,
      description: `Worst performer: "${failingAutomations[0]?.name}" at ${worstRate}% success. Healthy threshold: ≥80%.`,
    });
  }

  // 6. Win rate drop — if win rate < 20%
  const closedDeals = allDeals.filter((d) => d.stage === "closed_won" || d.stage === "closed_lost");
  const wonDeals = closedDeals.filter((d) => d.stage === "closed_won");
  const winRate = closedDeals.length > 0 ? (wonDeals.length / closedDeals.length) * 100 : null;
  const baselineWinRate = 25;
  if (winRate !== null && winRate < baselineWinRate) {
    rawAnomalies.push({
      id: "win-rate-below-target",
      module: "sales",
      metric: "Deal win rate",
      severity: winRate < 15 ? "critical" : "warning",
      current: Math.round(winRate),
      baseline: baselineWinRate,
      deviation: Math.round(((winRate - baselineWinRate) / baselineWinRate) * 100),
      unit: "%",
      title: `Win rate at ${Math.round(winRate)}% — below ${baselineWinRate}% target`,
      description: `${wonDeals.length} deals won out of ${closedDeals.length} closed. Improving to ${baselineWinRate}% would add significant revenue.`,
    });
  }

  // 7. Project at-risk — any project past 80% progress but not completed
  const atRiskProjects = allProjects.filter(
    (p) => p.status === "active" && p.progress !== null && p.progress >= 80
  );
  if (atRiskProjects.length > 0) {
    rawAnomalies.push({
      id: "projects-near-completion",
      module: "projects",
      metric: "Near-completion projects",
      severity: "info",
      current: atRiskProjects.length,
      baseline: 0,
      deviation: atRiskProjects.length * 100,
      unit: "count",
      title: `${atRiskProjects.length} project${atRiskProjects.length !== 1 ? "s" : ""} near completion`,
      description: `"${atRiskProjects[0]?.name}" and others are ≥80% done — push to close before sprint end.`,
    });
  }

  if (rawAnomalies.length === 0) return [];

  // Generate AI explanations in one batch call
  const openai = getClient();
  let aiResults: Array<{ explanation: string; suggestedAction: string }> | null = null;

  if (openai) {
    const batchResult = await completeJson<{
      analyses: Array<{ explanation: string; suggestedAction: string }>;
    }>(
      "You are NEXUS AI, the business intelligence layer of a unified operating platform. For each anomaly detected in the company's metrics, write: 1) A 2-sentence explanation of why this is anomalous and what it signals about the business, grounded in the data given. 2) One specific, concrete action someone should take in the next 48 hours. Respond only with JSON: { analyses: [{ explanation: string, suggestedAction: string }] } — same order and count as the input anomalies.",
      JSON.stringify(
        rawAnomalies.map((a) => ({
          id: a.id,
          module: a.module,
          metric: a.metric,
          severity: a.severity,
          title: a.title,
          description: a.description,
          current: a.current,
          baseline: a.baseline,
          deviation: a.deviation,
          unit: a.unit,
        }))
      )
    );
    aiResults = batchResult?.analyses ?? null;
  }

  const now = new Date().toISOString();

  return rawAnomalies.map((raw, i) => ({
    ...raw,
    aiExplanation: aiResults?.[i]?.explanation ?? null,
    suggestedAction: aiResults?.[i]?.suggestedAction ?? null,
    detectedAt: now,
  }));
}

export async function commentOnEvent(event: {
  type: string;
  title: string;
  description: string;
  module: string;
  metadata?: Record<string, unknown>;
}) {
  const openai = getClient();
  if (!openai) return null;

  const [deals, [{ openTickets }], [{ totalContacts }]] = await Promise.all([
    db.select().from(dealsTable),
    db.select({ openTickets: count() }).from(ticketsTable).where(eq(ticketsTable.status, "open")),
    db.select({ totalContacts: count() }).from(contactsTable),
  ]);

  const avgDealVelocityDays = 18;
  const avgDealValue = deals.length
    ? Math.round(deals.reduce((s, d) => s + Number(d.value), 0) / deals.length)
    : 0;

  const context = { avgDealVelocityDays, avgDealValue, openTickets, totalContacts, totalDeals: deals.length };

  const result = await completeText(
    `You are NEXUS AI, the autonomous intelligence layer of a B2B SaaS company's operating platform. Given a business event, write a 1-2 sentence insight that adds meaningful context beyond the raw event — compare to benchmarks, flag risks, highlight opportunities, or suggest the next action. Be specific and concrete. Use the company snapshot provided. No markdown, no preamble.`,
    `Event: ${event.type}\nTitle: ${event.title}\nDescription: ${event.description}\nModule: ${event.module}\nCompany snapshot: ${JSON.stringify(context)}`,
  );

  return result;
}

// ── Specialist AI Agents ──────────────────────────────────────────────────────

export async function hedgeFundCio() {
  const [allInvoices, allDeals, allLeads, allContacts] = await Promise.all([
    db.select().from(invoicesTable),
    db.select().from(dealsTable),
    db.select().from(contactsTable),
    db.select().from(leadsTable),
  ]);

  const paidRevenue = allInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const outstandingRevenue = allInvoices.filter((i) => i.status !== "paid").reduce((s, i) => s + Number(i.amount), 0);
  const overdueRevenue = allInvoices.filter((i) => i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0);
  const openDeals = allDeals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const wonDeals = allDeals.filter((d) => d.stage === "closed_won");
  const weightedPipeline = openDeals.reduce((s, d) => s + (Number(d.value) * d.probability) / 100, 0);
  const closedDeals = allDeals.filter((d) => d.stage === "closed_won" || d.stage === "closed_lost");
  const winRate = closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0;

  const portfolio = {
    paidRevenue,
    outstandingRevenue,
    overdueRevenue,
    weightedPipeline: Math.round(weightedPipeline),
    winRate,
    totalDeals: allDeals.length,
    openDeals: openDeals.length,
    totalContacts: allContacts.length,
    qualifiedLeads: allLeads.filter((l) => l.status === "qualified").length,
  };

  const result = await completeJson<{ thesis: string; rating: string; topRisk: string; topOpportunity: string }>(
    "You are NEXUS AI operating as a world-class hedge fund Chief Investment Officer. Analyze this company's financial and pipeline portfolio. Rate business health as Strong/Healthy/Caution/Distressed and provide an investment-grade thesis. Respond only with JSON: { thesis: string (3-4 sentences, exec-level), rating: 'Strong'|'Healthy'|'Caution'|'Distressed', topRisk: string (1 sentence), topOpportunity: string (1 sentence) }.",
    JSON.stringify(portfolio),
  );
  if (!result) return null;

  return saveInsight({
    module: "finance",
    kind: "hedge_fund_cio",
    entityId: null,
    title: `CIO Portfolio Rating: ${result.rating}`,
    content: `${result.thesis} Top risk: ${result.topRisk} Top opportunity: ${result.topOpportunity}`,
    metadata: { ...result, portfolio },
  });
}

export async function quantResearcher() {
  const [allLeads, allDeals, allInvoices] = await Promise.all([
    db.select().from(leadsTable),
    db.select().from(dealsTable),
    db.select().from(invoicesTable),
  ]);

  const scores = allLeads.map((l) => l.score ?? 0).filter((s) => s > 0);
  const meanScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
  const variance = scores.length > 1 ? scores.reduce((s, v) => s + Math.pow(v - meanScore, 2), 0) / (scores.length - 1) : 0;
  const stdDev = Math.sqrt(variance);

  const dealValues = allDeals.map((d) => Number(d.value));
  const meanDealValue = dealValues.length > 0 ? dealValues.reduce((s, v) => s + v, 0) / dealValues.length : 0;
  const dealStdDev = dealValues.length > 1
    ? Math.sqrt(dealValues.reduce((s, v) => s + Math.pow(v - meanDealValue, 2), 0) / (dealValues.length - 1))
    : 0;

  const closedDeals = allDeals.filter((d) => d.stage === "closed_won" || d.stage === "closed_lost");
  const wonDeals = closedDeals.filter((d) => d.stage === "closed_won");
  const winRate = closedDeals.length > 0 ? wonDeals.length / closedDeals.length : 0;
  const winRateCI95 = closedDeals.length > 0 ? 1.96 * Math.sqrt((winRate * (1 - winRate)) / closedDeals.length) : 0;

  const stats = {
    leadScoreMean: Math.round(meanScore),
    leadScoreStdDev: Math.round(stdDev),
    leadCount: scores.length,
    dealValueMean: Math.round(meanDealValue),
    dealValueStdDev: Math.round(dealStdDev),
    dealCount: dealValues.length,
    winRate: Math.round(winRate * 100),
    winRateCI95Lower: Math.round(Math.max(0, (winRate - winRateCI95) * 100)),
    winRateCI95Upper: Math.round(Math.min(100, (winRate + winRateCI95) * 100)),
    totalInvoiced: allInvoices.reduce((s, i) => s + Number(i.amount), 0),
  };

  const result = await completeText(
    "You are NEXUS AI operating as a quantitative trading researcher from Renaissance Technologies. Analyze these business statistics with a rigorous quant lens. Surface non-obvious patterns, flag statistical anomalies, and give 2-3 alpha signals the team should act on. Be precise, cite numbers. No markdown headers.",
    JSON.stringify(stats),
  );

  return saveInsight({
    module: "analytics",
    kind: "quant_researcher",
    entityId: null,
    title: `Quant Analysis — Win rate ${stats.winRate}% (95% CI: ${stats.winRateCI95Lower}–${stats.winRateCI95Upper}%)`,
    content: result ?? `Lead score μ=${stats.leadScoreMean} σ=${stats.leadScoreStdDev}. Deal value μ=${stats.dealValueMean.toLocaleString()} σ=${stats.dealValueStdDev.toLocaleString()}. Win rate ${stats.winRate}%.`,
    metadata: stats,
  });
}

export async function bloombergTerminal() {
  const [allInvoices, allDeals, allLeads, allTickets, allProjects, allContacts] = await Promise.all([
    db.select().from(invoicesTable),
    db.select().from(dealsTable),
    db.select().from(leadsTable),
    db.select().from(ticketsTable),
    db.select().from(projectsTable),
    db.select().from(contactsTable),
  ]);

  const paid = allInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const overdue = allInvoices.filter((i) => i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0);
  const openDeals = allDeals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const wonDeals = allDeals.filter((d) => d.stage === "closed_won");
  const closedDeals = allDeals.filter((d) => d.stage === "closed_won" || d.stage === "closed_lost");

  const terminal = {
    REV: paid,
    ODUE: overdue,
    PIPE: openDeals.reduce((s, d) => s + Number(d.value), 0),
    WPIPE: Math.round(openDeals.reduce((s, d) => s + (Number(d.value) * d.probability) / 100, 0)),
    WINR: closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0,
    NDEALS: allDeals.length,
    NLEADS: allLeads.length,
    QUAL_LEADS: allLeads.filter((l) => l.status === "qualified").length,
    TCKTS_OPEN: allTickets.filter((t) => t.status === "open").length,
    PROJ_ACTIVE: allProjects.filter((p) => p.status === "active").length,
    CONTACTS: allContacts.length,
    ARPU: wonDeals.length > 0 ? Math.round(wonDeals.reduce((s, d) => s + Number(d.value), 0) / wonDeals.length) : 0,
  };

  const narrative = await completeText(
    "You are NEXUS AI operating as a Bloomberg Terminal architect. Format a concise terminal-style intelligence summary: lead with the most critical number, then give 3-4 bullet data points with brief interpretation. Keep it tight and analytical, like a Bloomberg function screen. No markdown headers, use ALL-CAPS tickers like a terminal.",
    JSON.stringify(terminal),
  );

  return saveInsight({
    module: "analytics",
    kind: "bloomberg_terminal",
    entityId: null,
    title: `NEXUS Terminal — REV ${paid.toLocaleString()} | WPIPE ${terminal.WPIPE.toLocaleString()} | WINR ${terminal.WINR}%`,
    content: narrative ?? Object.entries(terminal).map(([k, v]) => `${k}: ${v}`).join(" | "),
    metadata: terminal,
  });
}

export async function multiagentEngineer() {
  const allAutomations = await db.select().from(automationsTable);

  const active = allAutomations.filter((a) => a.status === "active");
  const paused = allAutomations.filter((a) => a.status === "paused");
  const failing = allAutomations.filter((a) => a.runsTotal > 5 && a.runsSuccess / a.runsTotal < 0.85);
  const neverRun = allAutomations.filter((a) => a.runsTotal === 0);
  const triggerMap = allAutomations.reduce<Record<string, number>>((acc, a) => {
    acc[a.trigger] = (acc[a.trigger] ?? 0) + 1;
    return acc;
  }, {});

  const fleetReport = {
    totalAgents: allAutomations.length,
    activeAgents: active.length,
    pausedAgents: paused.length,
    failingAgents: failing.map((a) => ({ name: a.name, successRate: Math.round((a.runsSuccess / a.runsTotal) * 100) })),
    neverRunAgents: neverRun.map((a) => a.name),
    triggerDistribution: triggerMap,
    totalRunsToday: allAutomations.reduce((s, a) => s + a.runsTotal, 0),
    avgSuccessRate: active.length > 0
      ? Math.round(active.filter((a) => a.runsTotal > 0).reduce((s, a) => s + (a.runsSuccess / a.runsTotal) * 100, 0) / Math.max(1, active.filter((a) => a.runsTotal > 0).length))
      : 0,
  };

  const result = await completeText(
    "You are NEXUS AI operating as an AI multi-agent systems engineer. Audit this automation fleet. Identify coordination gaps, single points of failure, missing trigger coverage, and underperforming agents. Recommend 2-3 specific architectural improvements. Be technical and actionable. No markdown headers.",
    JSON.stringify(fleetReport),
  );

  return saveInsight({
    module: "automations",
    kind: "multiagent_engineer",
    entityId: null,
    title: `Agent Fleet Audit — ${active.length} active, ${failing.length} failing, ${neverRun.length} idle`,
    content: result ?? `Fleet: ${fleetReport.totalAgents} agents (${active.length} active, ${paused.length} paused). Avg success rate: ${fleetReport.avgSuccessRate}%.`,
    metadata: fleetReport,
  });
}

export async function fullstackDeveloper() {
  const allProjects = await db.select().from(projectsTable);

  const active = allProjects.filter((p) => p.status === "active");
  const completed = allProjects.filter((p) => p.status === "completed");
  const onHold = allProjects.filter((p) => p.status === "on_hold");
  const highProgress = active.filter((p) => (p.progress ?? 0) >= 80);
  const stalled = active.filter((p) => (p.progress ?? 0) < 20);
  const avgProgress = active.length > 0
    ? Math.round(active.reduce((s, p) => s + (p.progress ?? 0), 0) / active.length)
    : 0;

  const devSnapshot = {
    totalProjects: allProjects.length,
    active: active.length,
    completed: completed.length,
    onHold: onHold.length,
    avgProgress,
    nearDone: highProgress.map((p) => ({ name: p.name, progress: p.progress })),
    stalled: stalled.map((p) => ({ name: p.name, progress: p.progress })),
    completionRate: allProjects.length > 0 ? Math.round((completed.length / allProjects.length) * 100) : 0,
  };

  const result = await completeText(
    "You are NEXUS AI operating as a senior full-stack software developer. Review this project portfolio for delivery risks, blocked work, and scope creep signals. Flag what needs unblocking in the next sprint and suggest one concrete process improvement. No markdown headers.",
    JSON.stringify(devSnapshot),
  );

  return saveInsight({
    module: "projects",
    kind: "fullstack_developer",
    entityId: null,
    title: `Dev Health — ${active.length} active projects, ${avgProgress}% avg progress, ${stalled.length} stalled`,
    content: result ?? `${active.length} active projects at ${avgProgress}% avg progress. ${highProgress.length} near completion. ${stalled.length} stalled below 20%.`,
    metadata: devSnapshot,
  });
}

export async function financialDataEngineer() {
  const [allInvoices, allDeals, allContacts, allLeads] = await Promise.all([
    db.select().from(invoicesTable),
    db.select().from(dealsTable),
    db.select().from(contactsTable),
    db.select().from(leadsTable),
  ]);

  const zeroAmountInvoices = allInvoices.filter((i) => Number(i.amount) === 0).length;
  const nullDealValues = allDeals.filter((d) => !d.value || Number(d.value) === 0).length;
  const nullScoreLeads = allLeads.filter((l) => l.score === null).length;
  const contactsWithoutEmail = allContacts.filter((c) => !c.email).length;
  const duplicateStatuses = allInvoices.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  const dataQuality = {
    totalInvoices: allInvoices.length,
    zeroAmountInvoices,
    totalDeals: allDeals.length,
    nullValueDeals: nullDealValues,
    totalLeads: allLeads.length,
    unscoredLeads: nullScoreLeads,
    totalContacts: allContacts.length,
    contactsMissingEmail: contactsWithoutEmail,
    invoiceStatusDistribution: duplicateStatuses,
    overallQualityScore: Math.round(
      100 - ((zeroAmountInvoices + nullDealValues + nullScoreLeads + contactsWithoutEmail) /
        Math.max(1, allInvoices.length + allDeals.length + allLeads.length + allContacts.length)) * 100
    ),
  };

  const result = await completeText(
    "You are NEXUS AI operating as a financial data engineer. Audit this data quality report. Identify the most critical data integrity issues, their likely business impact, and 2-3 remediation steps the team should prioritize. Be specific about what bad data costs. No markdown headers.",
    JSON.stringify(dataQuality),
  );

  return saveInsight({
    module: "finance",
    kind: "financial_data_engineer",
    entityId: null,
    title: `Data Quality Score: ${dataQuality.overallQualityScore}% — ${zeroAmountInvoices + nullDealValues + nullScoreLeads + contactsWithoutEmail} issues found`,
    content: result ?? `Quality: ${dataQuality.overallQualityScore}%. Issues: ${zeroAmountInvoices} zero-amount invoices, ${nullDealValues} null-value deals, ${nullScoreLeads} unscored leads, ${contactsWithoutEmail} contacts missing email.`,
    metadata: dataQuality,
  });
}

export async function mlScientist() {
  const [allLeads, allDeals, allContacts] = await Promise.all([
    db.select().from(leadsTable),
    db.select().from(dealsTable),
    db.select().from(contactsTable),
  ]);

  const leadsBySource = allLeads.reduce<Record<string, { total: number; qualified: number }>>((acc, l) => {
    const src = l.source ?? "unknown";
    if (!acc[src]) acc[src] = { total: 0, qualified: 0 };
    acc[src].total++;
    if (l.status === "qualified" || (l.score ?? 0) >= 60) acc[src].qualified++;
    return acc;
  }, {});

  const dealsByStage = allDeals.reduce<Record<string, number>>((acc, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1;
    return acc;
  }, {});

  const highValueDeals = allDeals.filter((d) => Number(d.value) >= 50000);
  const highValueWinRate = highValueDeals.length > 0
    ? Math.round((highValueDeals.filter((d) => d.stage === "closed_won").length / highValueDeals.length) * 100)
    : 0;

  const features = {
    leadConversionBySource: Object.fromEntries(
      Object.entries(leadsBySource).map(([src, v]) => [src, { conversionRate: v.total > 0 ? Math.round((v.qualified / v.total) * 100) : 0, count: v.total }])
    ),
    dealStageDistribution: dealsByStage,
    highValueDealCount: highValueDeals.length,
    highValueDealWinRate: highValueWinRate,
    avgLeadScore: allLeads.filter((l) => l.score !== null).length > 0
      ? Math.round(allLeads.filter((l) => l.score !== null).reduce((s, l) => s + (l.score ?? 0), 0) / allLeads.filter((l) => l.score !== null).length)
      : 0,
    totalContacts: allContacts.length,
  };

  const result = await completeText(
    "You are NEXUS AI operating as a machine learning scientist. Analyze these feature distributions and conversion signals. Identify the 2-3 strongest predictive patterns for lead qualification and deal win probability. Suggest what a production ML model should prioritize. Be specific with numbers. No markdown headers.",
    JSON.stringify(features),
  );

  return saveInsight({
    module: "analytics",
    kind: "ml_scientist",
    entityId: null,
    title: `ML Signal Report — Top lead source: ${Object.entries(features.leadConversionBySource).sort((a, b) => b[1].conversionRate - a[1].conversionRate)[0]?.[0] ?? "N/A"}`,
    content: result ?? `Avg lead score: ${features.avgLeadScore}. High-value deal win rate: ${highValueWinRate}%. ${Object.keys(leadsBySource).length} lead sources analyzed.`,
    metadata: features,
  });
}

export async function blockchainAnalyst() {
  const allInvoices = await db.select().from(invoicesTable);

  const statusCounts = allInvoices.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  const amounts = allInvoices.map((i) => Number(i.amount));
  const totalValue = amounts.reduce((s, v) => s + v, 0);
  const maxAmount = Math.max(...amounts, 0);
  const minAmount = Math.min(...amounts.filter((a) => a > 0), 0);

  const suspiciousPatterns = {
    zeroAmounts: allInvoices.filter((i) => Number(i.amount) === 0).length,
    overdueCount: statusCounts["overdue"] ?? 0,
    overdueValue: allInvoices.filter((i) => i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0),
    paidValue: allInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0),
    pendingValue: allInvoices.filter((i) => i.status === "pending").reduce((s, i) => s + Number(i.amount), 0),
    totalInvoices: allInvoices.length,
    totalValue,
    maxInvoice: maxAmount,
    minInvoice: minAmount,
    statusDistribution: statusCounts,
    collectionRate: totalValue > 0 ? Math.round((allInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0) / totalValue) * 100) : 0,
  };

  const result = await completeText(
    "You are NEXUS AI operating as a blockchain analyst specializing in financial transaction integrity. Audit these invoice patterns for anomalies: unusual amounts, collection failures, suspicious status distributions, or audit trail gaps. Flag any patterns that suggest fraud risk, accounting errors, or process failures. No markdown headers.",
    JSON.stringify(suspiciousPatterns),
  );

  return saveInsight({
    module: "finance",
    kind: "blockchain_analyst",
    entityId: null,
    title: `Transaction Audit — Collection rate ${suspiciousPatterns.collectionRate}% | ${suspiciousPatterns.overdueValue.toLocaleString()} overdue`,
    content: result ?? `Collection rate: ${suspiciousPatterns.collectionRate}%. Total invoiced: ${totalValue.toLocaleString()}. Overdue: ${suspiciousPatterns.overdueCount} invoices (${suspiciousPatterns.overdueValue.toLocaleString()}).`,
    metadata: suspiciousPatterns,
  });
}

export async function cybersecurityExpert() {
  const [allAutomations, allContacts, allLeads] = await Promise.all([
    db.select().from(automationsTable),
    db.select().from(contactsTable),
    db.select().from(leadsTable),
  ]);

  const failingAutomations = allAutomations.filter((a) => a.runsTotal > 3 && a.runsSuccess / a.runsTotal < 0.7);
  const highRunAutomations = allAutomations.filter((a) => a.runsTotal > 100);
  const neverRunButActive = allAutomations.filter((a) => a.status === "active" && a.runsTotal === 0);
  const recentlyActive = allAutomations.filter((a) => a.lastRunAt && (Date.now() - new Date(a.lastRunAt).getTime()) < 24 * 60 * 60 * 1000);

  const securitySnapshot = {
    totalAutomations: allAutomations.length,
    failingAutomations: failingAutomations.map((a) => ({ name: a.name, action: a.action, failRate: Math.round((1 - a.runsSuccess / a.runsTotal) * 100) })),
    highVolumeAutomations: highRunAutomations.map((a) => ({ name: a.name, runs: a.runsTotal })),
    activeButNeverRun: neverRunButActive.map((a) => a.name),
    activeInLast24h: recentlyActive.length,
    totalContacts: allContacts.length,
    contactsMissingEmail: allContacts.filter((c) => !c.email).length,
    totalLeads: allLeads.length,
    unqualifiedLeadRatio: allLeads.length > 0 ? Math.round((allLeads.filter((l) => l.status === "unqualified").length / allLeads.length) * 100) : 0,
  };

  const result = await completeText(
    "You are NEXUS AI operating as a cybersecurity expert. Review this system activity snapshot for security concerns: automation abuse patterns, data integrity risks, access anomalies, and process control failures. Prioritize findings by severity and give 2-3 concrete mitigations. No markdown headers.",
    JSON.stringify(securitySnapshot),
  );

  return saveInsight({
    module: "automations",
    kind: "cybersecurity_expert",
    entityId: null,
    title: `Security Audit — ${failingAutomations.length} high-failure automations, ${neverRunButActive.length} ghost agents`,
    content: result ?? `${failingAutomations.length} automations failing >30% of runs. ${neverRunButActive.length} active agents never triggered. ${allContacts.filter((c) => !c.email).length} contacts missing email.`,
    metadata: securitySnapshot,
  });
}

export async function uxDesigner() {
  const [allTickets, allArticles] = await Promise.all([
    db.select().from(ticketsTable),
    db.select().from(knowledgeArticlesTable),
  ]);

  const ticketsByChannel = allTickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.channel ?? "unknown"] = (acc[t.channel ?? "unknown"] ?? 0) + 1;
    return acc;
  }, {});

  const ticketsBySentiment = allTickets.reduce<Record<string, number>>((acc, t) => {
    const cat = t.priority === "urgent" ? "urgent" : t.priority === "high" ? "high" : "normal";
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});

  const topKeywords = allTickets
    .flatMap((t) => (t.subject ?? "").toLowerCase().split(/\s+/))
    .filter((w) => w.length > 4)
    .reduce<Record<string, number>>((acc, w) => { acc[w] = (acc[w] ?? 0) + 1; return acc; }, {});
  const topPainPoints = Object.entries(topKeywords).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);

  const uxSnapshot = {
    totalTickets: allTickets.length,
    openTickets: allTickets.filter((t) => t.status === "open").length,
    ticketsByChannel,
    ticketsByPriority: ticketsBySentiment,
    urgentRate: allTickets.length > 0 ? Math.round((allTickets.filter((t) => t.priority === "urgent").length / allTickets.length) * 100) : 0,
    topPainPointKeywords: topPainPoints,
    knowledgeArticles: allArticles.length,
    publishedArticles: allArticles.filter((a) => a.status === "published").length,
    helpfulArticles: allArticles.filter((a) => (a.helpful ?? 0) > 0).length,
  };

  const result = await completeText(
    "You are NEXUS AI operating as a UI/UX motion designer and experience strategist. Analyze these support signals and knowledge base metrics to identify the top 3 user experience friction points. For each, suggest a specific design or content intervention that would reduce ticket volume or improve self-service. Think in terms of information architecture, onboarding flows, and micro-interaction clarity. No markdown headers.",
    JSON.stringify(uxSnapshot),
  );

  return saveInsight({
    module: "support",
    kind: "ux_designer",
    entityId: null,
    title: `UX Friction Report — ${uxSnapshot.urgentRate}% urgent tickets | ${topPainPoints[0] ?? "N/A"} top keyword`,
    content: result ?? `${allTickets.filter((t) => t.status === "open").length} open tickets across ${Object.keys(ticketsByChannel).length} channels. Top pain keywords: ${topPainPoints.slice(0, 5).join(", ")}.`,
    metadata: uxSnapshot,
  });
}

export async function cloudArchitect() {
  const [allAutomations, allProjects, allContacts, allDeals] = await Promise.all([
    db.select().from(automationsTable),
    db.select().from(projectsTable),
    db.select().from(contactsTable),
    db.select().from(dealsTable),
  ]);

  const totalRuns = allAutomations.reduce((s, a) => s + a.runsTotal, 0);
  const activeAutomations = allAutomations.filter((a) => a.status === "active").length;
  const scheduledAutomations = allAutomations.filter((a) => a.trigger.startsWith("schedule.")).length;
  const eventDrivenAutomations = allAutomations.filter((a) => !a.trigger.startsWith("schedule.")).length;
  const avgRunsPerAgent = allAutomations.length > 0 ? Math.round(totalRuns / allAutomations.length) : 0;

  const infraSnapshot = {
    totalAutomations: allAutomations.length,
    activeAutomations,
    scheduledAgents: scheduledAutomations,
    eventDrivenAgents: eventDrivenAutomations,
    totalAutomationRuns: totalRuns,
    avgRunsPerAgent,
    activeProjects: allProjects.filter((p) => p.status === "active").length,
    totalContacts: allContacts.length,
    totalDeals: allDeals.length,
    dataVolume: allContacts.length + allDeals.length + allProjects.length,
    highFailureAgents: allAutomations.filter((a) => a.runsTotal > 5 && a.runsSuccess / a.runsTotal < 0.8).length,
    agentConcurrencyRisk: scheduledAutomations > 5 ? "high" : scheduledAutomations > 3 ? "medium" : "low",
  };

  const result = await completeText(
    "You are NEXUS AI operating as a cloud infrastructure architect. Review this system load and automation topology. Assess scalability risks, concurrency bottlenecks (especially for scheduled agents that all fire at once), data growth projections, and resilience gaps. Give 2-3 concrete infrastructure recommendations for the next 90 days. No markdown headers.",
    JSON.stringify(infraSnapshot),
  );

  return saveInsight({
    module: "analytics",
    kind: "cloud_architect",
    entityId: null,
    title: `Infra Report — ${activeAutomations} active agents, ${totalRuns} total runs, concurrency risk: ${infraSnapshot.agentConcurrencyRisk}`,
    content: result ?? `${activeAutomations} active automations, ${totalRuns} total runs, ${avgRunsPerAgent} avg runs/agent. Concurrency risk: ${infraSnapshot.agentConcurrencyRisk}.`,
    metadata: infraSnapshot,
  });
}

export async function generateNoteInsight(noteId: number) {
  const [note] = await db.select().from(notesTable).where(eq(notesTable.id, noteId));
  if (!note) return null;

  const result = await completeJson<{ actionItems: string[]; relatedModule: string; urgency: "low" | "medium" | "high" }>(
    "You are NEXUS AI. Extract action items from this collaboration note and identify which business module it relates to. Respond only with JSON: { actionItems: string[] (up to 3 specific next steps), relatedModule: string ('crm'|'sales'|'support'|'finance'|'projects'|'marketing'), urgency: 'low'|'medium'|'high' }.",
    `Title: ${note.title}\n\nContent: ${note.content}`,
  );

  if (!result) return null;

  return saveInsight({
    module: result.relatedModule,
    kind: "note_insight",
    entityId: noteId,
    title: `Actions from: ${note.title}`,
    content: result.actionItems.join("; "),
    metadata: result,
  });
}
