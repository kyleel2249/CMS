---
name: CINTEXA NEXUS agent scheduling
description: How scheduled AI agents (marketing/sales/support/finance/anomaly/OKR) are driven without a cron dependency, and how to add a new one.
---

CINTEXA NEXUS has no cron/queue library installed. Scheduled AI agents run via a plain
`setInterval` sweep inside the long-running API server process (`artifacts/api-server/src/lib/automations.ts`),
checked every 5 minutes against `automationsTable` rows with `trigger = "schedule.daily"` or
`"schedule.weekly"` and `status = "active"`. Due jobs are ones whose `lastRunAt` is null or older
than the interval.

**Why:** The user asked for "AI agents running in the background" without wanting new infra
(no Redis/queue, no external scheduler). The existing `automationsTable` schema already had
`trigger`/`action`/`status`/`runsTotal`/`runsSuccess`/`lastRunAt` columns and a frontend
Automations page built to display exactly this — it just wasn't wired to real work. Reusing it
avoided a parallel "agent runs" concept and gave on/off toggles + history for free.

**How to apply:** To add a new scheduled or event-driven agent:
1. Add a row to `DEFAULT_AUTOMATIONS` in `automations.ts` (seeded once at boot if the `action` doesn't already exist).
2. Add a case to `runAutomationAction()` that does the real work and returns `{ processed, success }`. Keep it idempotent — check `aiInsightsTable` (or another marker) for already-processed entities so re-sweeps don't duplicate work.
3. For event-driven agents (not schedule.daily/weekly), subscribe via `on(eventType, handler)` from `./events` and call `bumpAutomation(trigger, action)` after the real work so the UI's run counts stay accurate.
4. Manual "Run" button in the UI hits `POST /automations/:id/run`, which now calls `runAutomationAction` for real (previously it just faked incrementing counters — don't regress that).
