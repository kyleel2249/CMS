// NEXUS Support SLA Engine — Zendesk/Freshworks-style first-response and
// resolution SLA targets, computed from priority, with live breach/at-risk
// status for open tickets and actual-vs-target comparison for closed ones.

export type SlaBand = "met" | "on_track" | "at_risk" | "breached";

export type TicketForSla = {
  priority: string;
  status: string;
  createdAt: Date;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
};

export type SlaStatus = {
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstResponseBand: SlaBand;
  resolutionBand: SlaBand;
  minutesToResolutionBreach: number | null; // negative if already breached
};

const OPEN_STATUSES = new Set(["open", "in_progress", "waiting"]);
const CLOSED_STATUSES = new Set(["resolved", "closed"]);

// Target minutes: [firstResponse, resolution]
const SLA_POLICY_MINUTES: Record<string, [number, number]> = {
  urgent: [30, 4 * 60],
  high: [2 * 60, 24 * 60],
  medium: [8 * 60, 3 * 24 * 60],
  low: [24 * 60, 5 * 24 * 60],
};

function bandFor(dueAt: Date, actualAt: Date | null, isOpen: boolean): SlaBand {
  const now = new Date();
  if (actualAt) {
    return actualAt.getTime() <= dueAt.getTime() ? "met" : "breached";
  }
  if (!isOpen) return "met"; // closed with no timestamp recorded (legacy data) — don't flag
  const msRemaining = dueAt.getTime() - now.getTime();
  if (msRemaining < 0) return "breached";
  if (msRemaining < 60 * 60 * 1000) return "at_risk"; // < 1 hour left
  return "on_track";
}

export function computeSlaStatus(ticket: TicketForSla): SlaStatus {
  const [firstResponseMin, resolutionMin] = SLA_POLICY_MINUTES[ticket.priority] ?? SLA_POLICY_MINUTES.medium;
  const firstResponseDueAt = new Date(ticket.createdAt.getTime() + firstResponseMin * 60_000);
  const resolutionDueAt = new Date(ticket.createdAt.getTime() + resolutionMin * 60_000);
  const isOpen = OPEN_STATUSES.has(ticket.status);

  const firstResponseBand = bandFor(firstResponseDueAt, ticket.firstRespondedAt, isOpen);
  const resolutionBand = bandFor(resolutionDueAt, ticket.resolvedAt, isOpen);

  const minutesToResolutionBreach = isOpen
    ? Math.round((resolutionDueAt.getTime() - Date.now()) / 60_000)
    : null;

  return {
    firstResponseDueAt: firstResponseDueAt.toISOString(),
    resolutionDueAt: resolutionDueAt.toISOString(),
    firstResponseBand,
    resolutionBand,
    minutesToResolutionBreach,
  };
}

export type SlaSummary = {
  breached: number;
  atRisk: number;
  onTrack: number;
  met: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
};

export function summarizeSla(tickets: TicketForSla[]): SlaSummary {
  let breached = 0, atRisk = 0, onTrack = 0, met = 0;
  const frTimes: number[] = [];
  const resTimes: number[] = [];

  for (const t of tickets) {
    const s = computeSlaStatus(t);
    const worst = s.resolutionBand === "breached" || s.firstResponseBand === "breached"
      ? "breached"
      : s.resolutionBand === "at_risk" || s.firstResponseBand === "at_risk"
        ? "at_risk"
        : s.resolutionBand === "met"
          ? "met"
          : "on_track";
    if (worst === "breached") breached++;
    else if (worst === "at_risk") atRisk++;
    else if (worst === "met") met++;
    else onTrack++;

    if (t.firstRespondedAt) frTimes.push((t.firstRespondedAt.getTime() - t.createdAt.getTime()) / 60_000);
    if (t.resolvedAt) resTimes.push((t.resolvedAt.getTime() - t.createdAt.getTime()) / 60_000);
  }

  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

  return {
    breached,
    atRisk,
    onTrack,
    met,
    avgFirstResponseMinutes: avg(frTimes),
    avgResolutionMinutes: avg(resTimes),
  };
}
