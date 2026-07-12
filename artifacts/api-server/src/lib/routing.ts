// NEXUS Support Auto-Routing — Freshworks/Zendesk-style load-balanced
// assignment. There is no separate "agents" table in this schema, so the
// agent roster is derived from the distinct set of people who have ever
// been assigned a ticket; the suggestion picks whoever currently carries
// the lightest open-ticket load, weighted by priority so urgent tickets
// count for more than low-priority ones.

import { db, ticketsTable } from "@workspace/db";
import { isNotNull } from "drizzle-orm";

const OPEN_STATUSES = new Set(["open", "in_progress", "waiting"]);
const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 2, medium: 1, low: 0.5 };

export type AgentLoad = {
  agent: string;
  openTickets: number;
  weightedLoad: number;
};

export async function computeAgentLoads(): Promise<AgentLoad[]> {
  const rows = await db.select().from(ticketsTable).where(isNotNull(ticketsTable.assignedTo));
  const roster = new Set(rows.map((r) => r.assignedTo).filter((a): a is string => !!a));

  const loads = new Map<string, AgentLoad>();
  for (const agent of roster) loads.set(agent, { agent, openTickets: 0, weightedLoad: 0 });

  for (const row of rows) {
    if (!row.assignedTo || !OPEN_STATUSES.has(row.status)) continue;
    const entry = loads.get(row.assignedTo);
    if (!entry) continue;
    entry.openTickets += 1;
    entry.weightedLoad += PRIORITY_WEIGHT[row.priority] ?? 1;
  }

  return Array.from(loads.values()).sort((a, b) => a.weightedLoad - b.weightedLoad);
}

export async function suggestAssignee(): Promise<{ suggestion: string | null; loads: AgentLoad[] }> {
  const loads = await computeAgentLoads();
  return { suggestion: loads[0]?.agent ?? null, loads };
}
