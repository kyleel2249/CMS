# CINTEXA NEXUS — AI Business Operating System

An enterprise-grade AI Business Operating System (AI-BOS) that unifies CRM, ERP, Sales, Finance, Marketing, Customer Support, Projects, Knowledge Management, and AI Copilot into one platform.

## Architecture

**Monorepo** managed with pnpm workspaces.

| Package | Role |
|---|---|
| `artifacts/cintexa-nexus` | React + Vite frontend (port 5000) |
| `artifacts/api-server` | Express API server (port 8080) |
| `lib/db` | Drizzle ORM + PostgreSQL schema |
| `lib/api-spec` | OpenAPI spec |
| `lib/api-client-react` | Generated React Query hooks |
| `lib/api-zod` | Generated Zod schemas |

## How to Run

Two workflows must both be running:

1. **API Server** — `PORT=8080 pnpm --filter @workspace/api-server run dev`
2. **CINTEXA NEXUS** — `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/cintexa-nexus run dev`

The frontend proxies `/api/*` requests to the API server at `http://127.0.0.1:8080`.

## Database

Uses Replit's built-in PostgreSQL. Schema is managed with Drizzle ORM.

To push schema changes:
```
pnpm --filter @workspace/db run push
```

## Environment Variables / Secrets

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Auto-provided by Replit PostgreSQL |
| `SESSION_SECRET` | Cookie signing secret (set as Replit Secret) |
| `OPENROUTER_API_KEY` | AI Copilot, deal scoring, anomaly detection (set as Replit Secret) — configured |

## Setup Status (as of 2026-07-14)

- Dependencies installed, dev DB schema pushed (`pnpm --filter @workspace/db run push`), demo data seeded (`pnpm --filter @workspace/scripts run seed`).
- Both artifacts (API Server, CINTEXA NEXUS) run via their managed artifact workflows — legacy duplicate workflows were removed.
- AI agent automation is live: 6 agents (Lead Qualifier, Support Triage, Marketing Copy, Sales Pipeline Forecast, Anomaly Watchdog, OKR Intelligence) run automatically — some on event triggers (new lead/ticket), some on a daily schedule via an in-process sweep in `artifacts/api-server/src/lib/automations.ts`. Manage on/off + view run history on the Automations page.
- Invoice payment collection (Stripe) was proposed but the user chose to skip it for now — not built. Revisit if the user asks again.
- Changes pushed to the GitHub remote (`main`).
- Mobile companion app remains deferred/not requested again.
- After re-importing the repo, this session did not set up the Replit-hosted workflows (user asked for a different change instead — see below). To get the app running on Replit: install deps (`pnpm install`), push the DB schema, seed demo data, and start the two artifact workflows described above; also set `OPENROUTER_API_KEY` as a secret.

## Windows / npm Standalone Package

`cintexa-nexus-standalone/` (zipped as `cintexa-nexus-standalone.zip`) is a self-contained copy of the app that runs on Windows with plain `npm` — no pnpm, no workspaces. One process serves both the API and the built React frontend. See `cintexa-nexus-standalone/README.md` for setup (`npm install`, `npm run setup`, `npm start`).

- Verified end-to-end on 2026-07-14: `npm install` → `npm run db:push` → `npm run seed` → `npm start` served the SPA, static assets, and `/api/*` all correctly.
- Fixed drift from the main schema: `scripts/seed.mjs` was inserting into `goals` (with a nonexistent `target_date` column instead of `quarter`/`year`), `knowledge_articles` (`helpful_count` → `helpful`), and `automations` (`trigger_type`/`actions`/`is_active` → `trigger`/`action`/`status` + matching config columns).
- Fixed a packaging bug: `server-standalone.mjs` (built from `artifacts/api-server/src/server-standalone.ts`) always looks for the static frontend in a `public/` folder next to itself. The package originally shipped `public/` at the package root, so `npm start` returned 404s for `/`. Moved the frontend into `cintexa-nexus-standalone/server/public/` and updated `firebase/firebase.json` and `cloudflare/wrangler.toml` to match.
- This package's server bundle and static frontend are built once (via `artifacts/api-server/build-standalone.mjs` and `vite.config.standalone.ts`) inside the Replit pnpm workspace and then copied in — running `npm run setup`/`npm start` on Windows never needs pnpm.

## Key Modules (Frontend Pages)

- **Dashboard** — Executive overview with KPIs and activity
- **CRM Hub** — Contacts, companies, leads
- **Sales Pipeline** — Deals and pipeline management
- **Marketing Campaigns** — Campaign creation and tracking
- **Finance & Invoices** — Invoicing and billing
- **Support Tickets** — Customer support ticketing
- **Projects** — Project and task management
- **AI Command Center** — AI Copilot powered by OpenRouter
- **Analytics** — Reporting and dashboards
- **Knowledge** — Wiki and document management
- **Automations** — Visual workflow automation builder
- **Email** — Unified email hub

## User Preferences

- Keep the existing monorepo structure and stack
- Use pnpm (not npm or yarn)
- AI features powered by OpenRouter (model-flexible)
