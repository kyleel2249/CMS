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
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function aiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

const MODEL = "gpt-4o-mini";

async function completeJson<T>(system: string, user: string): Promise<T | null> {
  const openai = getClient();
  if (!openai) return null;
  const resp = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });
  const raw = resp.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
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
