// NEXUS Campaign Intelligence — HubSpot-style funnel analytics merged with a
// GoHighLevel-style relative performance score. There's no cost/spend field
// in the schema, so "ROI" here is expressed as performance-vs-benchmark
// (open/click/conversion rates against the account's own historical average
// for that channel) rather than a dollar ROAS figure that would need to be
// invented.

export type CampaignForInsights = {
  id: number;
  name: string;
  type: string;
  status: string;
  audienceSize: number;
  sent: number | null;
  opened: number | null;
  clicked: number | null;
  converted: number | null;
};

export type CampaignRates = {
  openRate: number | null; // opened / sent
  clickRate: number | null; // clicked / opened (CTR)
  conversionRate: number | null; // converted / sent
};

export function computeRates(c: CampaignForInsights): CampaignRates {
  const sent = c.sent ?? 0;
  const opened = c.opened ?? 0;
  const clicked = c.clicked ?? 0;
  const converted = c.converted ?? 0;
  return {
    openRate: sent > 0 ? opened / sent : null,
    clickRate: opened > 0 ? clicked / opened : null,
    conversionRate: sent > 0 ? converted / sent : null,
  };
}

export type PerformanceBand = "top" | "average" | "underperforming" | "insufficient_data";

export type CampaignInsight = {
  id: number;
  rates: CampaignRates;
  performanceScore: number | null; // 0-100, relative to same-type benchmark
  band: PerformanceBand;
};

export type ChannelBenchmark = {
  type: string;
  campaignCount: number;
  avgOpenRate: number | null;
  avgClickRate: number | null;
  avgConversionRate: number | null;
};

function avg(values: number[]): number | null {
  const filtered = values.filter((v) => Number.isFinite(v));
  return filtered.length ? filtered.reduce((a, b) => a + b, 0) / filtered.length : null;
}

export function computeBenchmarks(campaigns: CampaignForInsights[]): ChannelBenchmark[] {
  const byType = new Map<string, CampaignForInsights[]>();
  for (const c of campaigns) {
    if (!byType.has(c.type)) byType.set(c.type, []);
    byType.get(c.type)!.push(c);
  }
  return Array.from(byType.entries()).map(([type, list]) => {
    const rates = list.map(computeRates);
    return {
      type,
      campaignCount: list.length,
      avgOpenRate: avg(rates.map((r) => r.openRate).filter((v): v is number => v != null)),
      avgClickRate: avg(rates.map((r) => r.clickRate).filter((v): v is number => v != null)),
      avgConversionRate: avg(rates.map((r) => r.conversionRate).filter((v): v is number => v != null)),
    };
  });
}

// Weighted relative score: conversion rate matters most, then CTR, then open rate.
export function computeCampaignInsight(c: CampaignForInsights, benchmarks: ChannelBenchmark[]): CampaignInsight {
  const rates = computeRates(c);
  const benchmark = benchmarks.find((b) => b.type === c.type);

  if (rates.conversionRate == null && rates.clickRate == null && rates.openRate == null) {
    return { id: c.id, rates, performanceScore: null, band: "insufficient_data" };
  }

  const ratio = (actual: number | null, bench: number | null) => {
    if (actual == null) return null;
    if (!bench || bench <= 0) return actual > 0 ? 1.5 : 1; // no benchmark yet — neutral-to-positive
    return actual / bench;
  };

  const weights = { conversion: 0.5, click: 0.3, open: 0.2 };
  const parts = [
    { r: ratio(rates.conversionRate, benchmark?.avgConversionRate ?? null), w: weights.conversion },
    { r: ratio(rates.clickRate, benchmark?.avgClickRate ?? null), w: weights.click },
    { r: ratio(rates.openRate, benchmark?.avgOpenRate ?? null), w: weights.open },
  ].filter((p) => p.r != null) as { r: number; w: number }[];

  const totalWeight = parts.reduce((a, p) => a + p.w, 0) || 1;
  const weightedRatio = parts.reduce((a, p) => a + p.r * p.w, 0) / totalWeight;

  // Map ratio-to-benchmark (1.0 = on par) onto a 0-100 score, capped.
  const score = Math.max(0, Math.min(100, Math.round(weightedRatio * 50)));

  const band: PerformanceBand = score >= 65 ? "top" : score >= 35 ? "average" : "underperforming";

  return { id: c.id, rates, performanceScore: score, band };
}

export type CampaignFunnelTotals = {
  totalAudience: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;
  overallOpenRate: number | null;
  overallClickRate: number | null;
  overallConversionRate: number | null;
};

export function computeFunnelTotals(campaigns: CampaignForInsights[]): CampaignFunnelTotals {
  const totalAudience = campaigns.reduce((a, c) => a + c.audienceSize, 0);
  const totalSent = campaigns.reduce((a, c) => a + (c.sent ?? 0), 0);
  const totalOpened = campaigns.reduce((a, c) => a + (c.opened ?? 0), 0);
  const totalClicked = campaigns.reduce((a, c) => a + (c.clicked ?? 0), 0);
  const totalConverted = campaigns.reduce((a, c) => a + (c.converted ?? 0), 0);
  return {
    totalAudience,
    totalSent,
    totalOpened,
    totalClicked,
    totalConverted,
    overallOpenRate: totalSent > 0 ? totalOpened / totalSent : null,
    overallClickRate: totalOpened > 0 ? totalClicked / totalOpened : null,
    overallConversionRate: totalSent > 0 ? totalConverted / totalSent : null,
  };
}

export type CampaignInsightsReport = {
  funnel: CampaignFunnelTotals;
  benchmarks: ChannelBenchmark[];
  topPerformer: { id: number; name: string; performanceScore: number } | null;
  needsAttention: { id: number; name: string; performanceScore: number }[];
};

export function buildInsightsReport(campaigns: CampaignForInsights[]): CampaignInsightsReport {
  const benchmarks = computeBenchmarks(campaigns);
  const insights = campaigns.map((c) => ({ c, insight: computeCampaignInsight(c, benchmarks) }));

  const scored = insights.filter((i) => i.insight.performanceScore != null) as {
    c: CampaignForInsights;
    insight: CampaignInsight & { performanceScore: number };
  }[];

  const topPerformer = scored.length
    ? scored.reduce((best, cur) => (cur.insight.performanceScore > best.insight.performanceScore ? cur : best))
    : null;

  const needsAttention = scored
    .filter((i) => i.insight.band === "underperforming")
    .sort((a, b) => a.insight.performanceScore - b.insight.performanceScore)
    .slice(0, 5)
    .map((i) => ({ id: i.c.id, name: i.c.name, performanceScore: i.insight.performanceScore }));

  return {
    funnel: computeFunnelTotals(campaigns),
    benchmarks,
    topPerformer: topPerformer ? { id: topPerformer.c.id, name: topPerformer.c.name, performanceScore: topPerformer.insight.performanceScore } : null,
    needsAttention,
  };
}
