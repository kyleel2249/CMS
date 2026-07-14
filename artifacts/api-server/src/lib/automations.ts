import { on } from "./events";
import {
  qualifyLead,
  triageTicket,
  generateMarketingCopy,
  financeForecast,
  detectAnomalies,
  mapMetricsToOKRs,
  aiEnabled,
} from "./ai";
import { logger } from "./logger";
import {
  db,
  automationsTable,
  leadsTable,
  ticketsTable,
  campaignsTable,
  aiInsightsTable,
} from "@workspace/db";
import { eq, and, isNull, or, notInArray, inArray } from "drizzle-orm";

// The AI layer subscribes to domain events here. This is what makes NEXUS AI
// act like an employee instead of a chatbot: it reacts to what happens across
// every module without anyone asking it to.
export function registerAutomations() {
  on("lead.created", async (_payload, entityId) => {
    if (!aiEnabled() || entityId === null) return;
    logger.info({ entityId }, "AI auto-qualifying new lead");
    await qualifyLead(entityId);
    await bumpAutomation("lead.created", "ai.qualify_lead");
  });

  on("ticket.created", async (_payload, entityId) => {
    if (!aiEnabled() || entityId === null) return;
    logger.info({ entityId }, "AI auto-triaging new ticket");
    await triageTicket(entityId);
    await bumpAutomation("ticket.created", "ai.triage_ticket");
  });

  seedDefaultAutomations().catch((err) => logger.error({ err }, "failed to seed default automations"));
  startScheduler();
}

// ── Default agents ───────────────────────────────────────────────────────────
// These rows are the on/off switches + run log the Automations UI reads.
// If the table is empty (fresh install), seed the six always-on AI agents.
const DEFAULT_AUTOMATIONS = [
  {
    name: "Lead Qualifier Agent",
    description: "Scores and qualifies every new inbound lead the moment it's created, and sweeps for any unscored leads daily.",
    trigger: "lead.created",
    action: "ai.qualify_lead",
    triggerConfig: {},
    actionConfig: {},
  },
  {
    name: "Support Triage Agent",
    description: "Prioritizes new tickets and drafts a first reply automatically, and sweeps open tickets missing triage daily.",
    trigger: "ticket.created",
    action: "ai.triage_ticket",
    triggerConfig: {},
    actionConfig: {},
  },
  {
    name: "Marketing Copy Agent",
    description: "Drafts subject lines and body copy for any draft or scheduled campaign that doesn't have copy yet.",
    trigger: "schedule.daily",
    action: "ai.generate_copy",
    triggerConfig: {},
    actionConfig: {},
  },
  {
    name: "Sales Pipeline Agent",
    description: "Runs a daily revenue and pipeline forecast so the finance and sales teams start the day with a live number.",
    trigger: "schedule.daily",
    action: "ai.finance_forecast",
    triggerConfig: {},
    actionConfig: {},
  },
  {
    name: "Anomaly Watchdog Agent",
    description: "Scans every module daily for metrics that have drifted outside healthy ranges and flags what needs attention.",
    trigger: "schedule.daily",
    action: "ai.detect_anomalies",
    triggerConfig: {},
    actionConfig: {},
  },
  {
    name: "OKR Intelligence Agent",
    description: "Refreshes key result progress from live data and writes an AI forecast narrative for each company goal, daily.",
    trigger: "schedule.daily",
    action: "ai.map_okrs",
    triggerConfig: {},
    actionConfig: {},
  },
] as const;

async function seedDefaultAutomations() {
  const existing = await db.select({ action: automationsTable.action }).from(automationsTable);
  const existingActions = new Set(existing.map((a: { action: string }) => a.action));
  const toInsert = DEFAULT_AUTOMATIONS.filter((a) => !existingActions.has(a.action));
  if (toInsert.length === 0) return;
  await db.insert(automationsTable).values(toInsert.map((a) => ({ ...a, status: "active" })));
  logger.info({ count: toInsert.length }, "seeded default AI agents into automations table");
}

async function bumpAutomation(trigger: string, action: string, success = true) {
  try {
    const [row] = await db
      .select()
      .from(automationsTable)
      .where(and(eq(automationsTable.trigger, trigger), eq(automationsTable.action, action)));
    if (!row) return;
    await db
      .update(automationsTable)
      .set({
        runsTotal: row.runsTotal + 1,
        runsSuccess: row.runsSuccess + (success ? 1 : 0),
        lastRunAt: new Date(),
      })
      .where(eq(automationsTable.id, row.id));
  } catch (err) {
    logger.error({ err, trigger, action }, "failed to bump automation counters");
  }
}

// ── Real work behind each scheduled/on-demand agent action ─────────────────
// Every function is idempotent-ish: it only processes records that don't
// already have an AI work product, so re-running (or the scheduler firing
// again) never spams duplicate insights.

const BATCH_LIMIT = 10;

async function processedEntityIds(kind: string): Promise<number[]> {
  const rows = await db
    .select({ entityId: aiInsightsTable.entityId })
    .from(aiInsightsTable)
    .where(eq(aiInsightsTable.kind, kind));
  return rows.map((r: { entityId: number | null }) => r.entityId).filter((id): id is number => id !== null);
}

async function backfillLeadQualification() {
  const done = await processedEntityIds("lead_qualification");
  const rows = await db
    .select({ id: leadsTable.id })
    .from(leadsTable)
    .where(
      done.length > 0
        ? and(isNull(leadsTable.score), notInArray(leadsTable.id, done))
        : isNull(leadsTable.score),
    )
    .limit(BATCH_LIMIT);
  let success = 0;
  for (const { id } of rows) {
    const result = await qualifyLead(id);
    if (result) success++;
  }
  return { processed: rows.length, success };
}

async function backfillTicketTriage() {
  const done = await processedEntityIds("ticket_triage");
  const rows = await db
    .select({ id: ticketsTable.id })
    .from(ticketsTable)
    .where(
      done.length > 0
        ? and(eq(ticketsTable.status, "open"), notInArray(ticketsTable.id, done))
        : eq(ticketsTable.status, "open"),
    )
    .limit(BATCH_LIMIT);
  let success = 0;
  for (const { id } of rows) {
    const result = await triageTicket(id);
    if (result) success++;
  }
  return { processed: rows.length, success };
}

async function draftCampaignCopy() {
  const done = await processedEntityIds("marketing_copy");
  const rows = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(
      done.length > 0
        ? and(inArray(campaignsTable.status, ["draft", "scheduled"]), notInArray(campaignsTable.id, done))
        : inArray(campaignsTable.status, ["draft", "scheduled"]),
    )
    .limit(5);
  let success = 0;
  for (const { id } of rows) {
    const result = await generateMarketingCopy(id);
    if (result) success++;
  }
  return { processed: rows.length, success };
}

async function runFinanceForecast() {
  const result = await financeForecast();
  return { processed: 1, success: result ? 1 : 0 };
}

async function runAnomalyDetection() {
  const anomalies = await detectAnomalies();
  return { processed: anomalies.length, success: 1 };
}

async function runOkrIntelligence() {
  const result = await mapMetricsToOKRs();
  return { processed: result.goals.length, success: 1 };
}

/** Executes the real work for an automation's `action`, returns an outcome summary. */
export async function runAutomationAction(action: string): Promise<{ processed: number; success: number }> {
  if (!aiEnabled()) return { processed: 0, success: 0 };
  switch (action) {
    case "ai.qualify_lead":
      return backfillLeadQualification();
    case "ai.triage_ticket":
      return backfillTicketTriage();
    case "ai.generate_copy":
      return draftCampaignCopy();
    case "ai.finance_forecast":
      return runFinanceForecast();
    case "ai.detect_anomalies":
      return runAnomalyDetection();
    case "ai.map_okrs":
      return runOkrIntelligence();
    default:
      // Unknown/manual action types (email, crm, slack, webhook, report) — no-op for now.
      return { processed: 0, success: 0 };
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────
// No external cron dependency: the API server is a single long-running
// process, so a simple interval sweep is enough to drive "daily"/"weekly"
// agents without anyone having to open the app.

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // sweep every 5 minutes
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function isDue(lastRunAt: Date | null, trigger: string) {
  if (!lastRunAt) return true;
  const elapsed = Date.now() - lastRunAt.getTime();
  if (trigger === "schedule.daily") return elapsed >= DAY_MS;
  if (trigger === "schedule.weekly") return elapsed >= WEEK_MS;
  return false;
}

async function sweepScheduledAutomations() {
  if (!aiEnabled()) return;
  try {
    const rows = await db
      .select()
      .from(automationsTable)
      .where(
        and(
          eq(automationsTable.status, "active"),
          or(eq(automationsTable.trigger, "schedule.daily"), eq(automationsTable.trigger, "schedule.weekly")),
        ),
      );
    for (const row of rows) {
      if (!isDue(row.lastRunAt, row.trigger)) continue;
      logger.info({ automation: row.name, action: row.action }, "AI agent: running scheduled job");
      const outcome = await runAutomationAction(row.action);
      await db
        .update(automationsTable)
        .set({
          runsTotal: row.runsTotal + 1,
          runsSuccess: row.runsSuccess + (outcome.success > 0 || outcome.processed === 0 ? 1 : 0),
          lastRunAt: new Date(),
        })
        .where(eq(automationsTable.id, row.id));
    }
  } catch (err) {
    logger.error({ err }, "scheduled automation sweep failed");
  }
}

let schedulerStarted = false;
function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  // Run once shortly after boot, then on a fixed interval.
  setTimeout(() => void sweepScheduledAutomations(), 15_000);
  setInterval(() => void sweepScheduledAutomations(), CHECK_INTERVAL_MS);
}
