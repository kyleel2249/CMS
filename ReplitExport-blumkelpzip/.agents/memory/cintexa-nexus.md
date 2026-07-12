---
name: Cintexa Nexus (NEXUS) project
description: Imported CRM/ERP dashboard app — layout, stack, and design decisions for the ongoing multi-platform-parity build.
---

## Project layout
- Real app root is nested 3 levels deep from workspace root inside leftover zip-export folders: `ReplitExport-kelpblumzip/ReplitExport-bloggeralphariazip/Cintexa-Nexus/`. Always check this path first when the top-level workspace root looks empty of app code.
- Stack: pnpm workspaces, Node 24, Express 5 API (`artifacts/api-server`), React/Vite frontend (`artifacts/cintexa-nexus`), Postgres + Drizzle (`lib/db`), Zod, OpenAPI spec at `lib/api-spec/openapi.yaml` with Orval codegen producing `lib/api-client-react` (React Query hooks) and `lib/api-zod`.
- After any `openapi.yaml` change, must rerun `pnpm --filter @workspace/api-spec run codegen` before frontend can use new endpoints/types.
- The whole-workspace `pnpm run typecheck` already fails on pre-existing files unrelated to any given change (many `TS7030: Not all code paths return a value` in routes, several stale `Contact`/`Lead`/`Deal` shape mismatches in `CommandPalette.tsx` and `ContactSheet.tsx`, missing `buttonVariants` export). Confirmed via `git stash` that these predate any of my edits — don't treat them as regressions to fix unless asked; just avoid introducing new ones in the files you touch.

## Product scope (multi-platform CRM/ERP/PM parity)
User wants broad enterprise feature parity merged from Salesforce/HubSpot/Zoho/Dynamics/SAP/Oracle/Monday/ClickUp/Notion/Zendesk/Freshworks/Pipedrive/Intercom/GoHighLevel, prioritized: Sales & CRM, Support & Helpdesk, Marketing Automation, then Platform & Extensibility, cross-module AI layer, Finance & ERP-lite, Projects & Work Management, plus a new Email module with AI agents. Building sequentially, starting with Sales & CRM.

## Sales & CRM design decisions
- Revenue forecast (`GET /deals/forecast`, `artifacts/api-server/src/lib/forecast.ts`): categories are Pipeline/Weighted Pipeline/Best Case (prob>=40)/Commit (prob>=70)/Closed Won, plus quota attainment and month-bucketed trend and stalled-deal detection (open >=14 days in prospecting/qualification).
  - **Why:** merges Salesforce forecast categories + Pipedrive deal-rot visibility into one originally-named feature rather than cloning one vendor.
  - Quota target auto-resolves to a `keyResultsTable` row with `linkedMetric: "revenue"` and `autoTracked: true` if one exists, else falls back to a $1.5M default. This ties Sales forecasting to the existing Goals & OKRs feature.
- Lead scoring (`artifacts/api-server/src/lib/scoring.ts`, `computeLeadScore`): deliberately a transparent rule-based point system (source/company/domain/phone/notes/status/age factors), not an LLM call — kept separate from the existing AI-based `qualifyLead` in `lib/ai.ts`.
  - **Why:** needed to run everywhere instantly without depending on `OPENAI_API_KEY`; AI qualification remains available as a richer opt-in layer.
  - Score is NOT auto-updated on every read — `score` column only changes via `POST /leads/:id/recalculate-score` or bulk `POST /leads/recalculate-scores`. Every lead response also includes a live-computed `liveScore`/`scoreBreakdown`/`scoreBand` so the UI can show "stale vs. live" and offer a recalculate action.
  - **How to apply:** any future change to lead fields that affect scoring factors should keep this same live-vs-persisted split so existing recalculate UI stays meaningful.

## Support & Helpdesk design decisions
- SLA engine (`artifacts/api-server/src/lib/sla.ts`): unlike lead scoring, this DID require two new nullable timestamp columns on `tickets` (`firstRespondedAt`, `resolvedAt`) because SLA/resolution-time analytics need to know *when* an event happened, not just current state — that's not derivable after the fact the way lead scoring is.
  - **Why:** deliberately chose to add the minimal schema change here rather than fake an approximation, since a fabricated "resolution time" would be worse than no analytics at all.
  - PATCH `/tickets/:id` auto-stamps these timestamps on status transitions (never overwrites an existing one) — routing/UI code should keep relying on this auto-stamp rather than setting the fields directly.
- SLA due dates (`firstResponseDueAt`/`resolutionDueAt`) are computed on the fly from `createdAt` + priority-based policy minutes — never persisted, since they're always deterministically derivable.
- Auto-routing (`artifacts/api-server/src/lib/routing.ts`): agent roster is derived from distinct historical `assignedTo` values on tickets (no separate agents table exists) — suggestion picks lowest priority-weighted open load. If an `agents` table is ever added, this should be swapped to read from it instead of inferring the roster from ticket history.

## Marketing Automation design decisions
- Campaign performance score (`artifacts/api-server/src/lib/campaignInsights.ts`): expressed as relative-to-benchmark (this account's own historical avg open/click/conversion rate for that channel type), NOT a dollar ROAS — the `campaigns` table has no cost/spend field, so a fabricated ROI figure was avoided in favor of an honest same-channel comparison.
  - **How to apply:** if a spend/budget field is ever added to campaigns, this is the place to introduce real ROAS instead of the benchmark-ratio score.
