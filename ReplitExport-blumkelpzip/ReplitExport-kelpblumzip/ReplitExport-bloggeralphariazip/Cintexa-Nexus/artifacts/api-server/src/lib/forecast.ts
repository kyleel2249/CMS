// NEXUS Revenue Forecast Engine — merges the deal-category forecasting
// familiar from Salesforce (Pipeline / Best Case / Commit / Closed) with
// Pipedrive-style "deal rot" visibility into one coherent forecast model
// for the sales pipeline.

import { db, dealsTable, goalsTable, keyResultsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const OPEN_STAGES = ["prospecting", "qualification", "proposal", "negotiation"];
const STALL_STAGES = ["prospecting", "qualification"];
const STALL_THRESHOLD_DAYS = 14;
const DEFAULT_QUARTER_TARGET = 1_500_000;

export type ForecastDeal = {
  id: number;
  title: string;
  value: number;
  stage: string;
  probability: number;
  companyName: string | null;
  ageDays: number;
};

export type Forecast = {
  category: {
    pipeline: number; // all open deal value, unweighted
    weightedPipeline: number; // open deal value * probability
    bestCase: number; // open deals with probability >= 40
    commit: number; // open deals with probability >= 70 (high confidence)
    closedWon: number; // won this quarter
  };
  quota: {
    target: number;
    attained: number;
    attainmentPct: number;
    source: "linked_okr" | "default";
  };
  monthlyTrend: Array<{ month: string; closedValue: number; dealsClosed: number }>;
  stalledDeals: ForecastDeal[];
  dealCount: {
    open: number;
    stalled: number;
    closedWon: number;
    closedLost: number;
  };
};

function ageInDays(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
}

async function resolveQuotaTarget(): Promise<{ target: number; source: "linked_okr" | "default" }> {
  const krs = await db.select().from(keyResultsTable).where(eq(keyResultsTable.linkedMetric, "revenue"));
  const revenueKR = krs.find((k) => k.autoTracked);
  if (revenueKR) return { target: revenueKR.targetValue, source: "linked_okr" };
  return { target: DEFAULT_QUARTER_TARGET, source: "default" };
}

export async function computeForecast(): Promise<Forecast> {
  const allDeals = await db.select().from(dealsTable);

  const open = allDeals.filter((d) => OPEN_STAGES.includes(d.stage));
  const won = allDeals.filter((d) => d.stage === "closed_won");
  const lost = allDeals.filter((d) => d.stage === "closed_lost");

  const pipeline = open.reduce((s, d) => s + Number(d.value), 0);
  const weightedPipeline = open.reduce((s, d) => s + (Number(d.value) * d.probability) / 100, 0);
  const bestCase = open.filter((d) => d.probability >= 40).reduce((s, d) => s + Number(d.value), 0);
  const commit = open.filter((d) => d.probability >= 70).reduce((s, d) => s + Number(d.value), 0);
  const closedWon = won.reduce((s, d) => s + Number(d.value), 0);

  const { target, source } = await resolveQuotaTarget();
  const attainmentPct = target > 0 ? Math.round((closedWon / target) * 100) : 0;

  const stalledDeals: ForecastDeal[] = open
    .filter((d) => STALL_STAGES.includes(d.stage) && ageInDays(d.createdAt) >= STALL_THRESHOLD_DAYS)
    .map((d) => ({
      id: d.id,
      title: d.title,
      value: Number(d.value),
      stage: d.stage,
      probability: d.probability,
      companyName: d.companyName ?? null,
      ageDays: ageInDays(d.createdAt),
    }))
    .sort((a, b) => b.ageDays - a.ageDays);

  // Monthly trend for closed-won deals over the last 6 months, bucketed by
  // expectedCloseDate when present, otherwise createdAt.
  const monthBuckets = new Map<string, { closedValue: number; dealsClosed: number }>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    monthBuckets.set(key, { closedValue: 0, dealsClosed: 0 });
  }
  for (const deal of won) {
    const dateStr = deal.expectedCloseDate ?? deal.createdAt.toISOString();
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = parsed.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const bucket = monthBuckets.get(key);
    if (!bucket) continue;
    bucket.closedValue += Number(deal.value);
    bucket.dealsClosed += 1;
  }

  return {
    category: {
      pipeline: Math.round(pipeline),
      weightedPipeline: Math.round(weightedPipeline),
      bestCase: Math.round(bestCase),
      commit: Math.round(commit),
      closedWon: Math.round(closedWon),
    },
    quota: {
      target,
      attained: Math.round(closedWon),
      attainmentPct,
      source,
    },
    monthlyTrend: Array.from(monthBuckets.entries()).map(([month, v]) => ({ month, ...v })),
    stalledDeals,
    dealCount: {
      open: open.length,
      stalled: stalledDeals.length,
      closedWon: won.length,
      closedLost: lost.length,
    },
  };
}
