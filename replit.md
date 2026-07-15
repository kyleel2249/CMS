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

## Setup Status (as of 2026-07-15)

- Re-imported from GitHub; artifacts (API Server, CINTEXA NEXUS, Canvas) were re-registered from the committed `.replit-artifact/artifact.toml` files and their managed workflows are running again.
- Dependencies installed, dev DB schema pushed (`pnpm --filter @workspace/db run push`), demo data seeded (`pnpm --filter @workspace/scripts run seed`).
- `OPENROUTER_API_KEY` is set as a permanent Replit Secret (powers AI Copilot, deal scoring, anomaly detection). Note: the key's OpenRouter account currently has no credit balance, so AI calls return a 402 error until credits are added at https://openrouter.ai/settings/credits — this is an account funding issue, not a bug.
- AI agent automation is live: 6 agents (Lead Qualifier, Support Triage, Marketing Copy, Sales Pipeline Forecast, Anomaly Watchdog, OKR Intelligence) run automatically — some on event triggers (new lead/ticket), some on a daily schedule via an in-process sweep in `artifacts/api-server/src/lib/automations.ts`. Manage on/off + view run history on the Automations page.
- Invoice payment collection (Stripe) was proposed but the user chose to skip it for now — not built. Revisit if the user asks again.
- Changes pushed to the GitHub remote (`main`).
- Mobile companion app remains deferred/not requested again.
- If a future re-import lands with workflows missing again but `artifacts/*/.replit-artifact/artifact.toml` still present on disk, re-registering is a no-op fix: read each `artifact.toml`, write it unchanged to a sibling temp file, and call `verifyAndReplaceArtifactToml` — this re-syncs the artifact and its workflow without touching any code.

## Windows / npm Standalone Package

`cintexa-nexus-standalone/` (zipped as `cintexa-nexus-standalone.zip`) is a self-contained copy of the app that runs on Windows with plain `npm` — no pnpm, no workspaces. One process serves both the API and the built React frontend. See `cintexa-nexus-standalone/README.md` for setup (`npm install`, `npm run setup`, `npm start`).

- **Keeping it in sync:** run `pnpm --filter @workspace/scripts run build-standalone` any time the DB schema, seed data, server code, or frontend changes. It regenerates every derived file in `cintexa-nexus-standalone/` from the real source — DB migrations copied from `lib/db/drizzle/`, `scripts/seed.mjs` esbuild-bundled straight from `scripts/src/seed.ts` (no more hand-copied SQL), the server bundle via `artifacts/api-server/build-standalone.mjs`, and the frontend via `vite.config.standalone.ts`. Never hand-edit files under `cintexa-nexus-standalone/scripts/` or `cintexa-nexus-standalone/server/` — the next build overwrites them. Re-zip `cintexa-nexus-standalone.zip` after running it if you need to hand out an updated copy.
- `scripts/db-push.mjs` applies every `.sql` file in `scripts/migrations/` in filename order (tracked in a `__cintexa_migrations` table), so it stays correct as new Drizzle migrations are added — it no longer assumes a single hardcoded migration file.
- Fixed a packaging bug (2026-07-14): `server-standalone.mjs` always looks for the static frontend in a `public/` folder next to itself. The package originally shipped `public/` at the package root, so `npm start` returned 404s for `/`. Moved the frontend into `cintexa-nexus-standalone/server/public/` and updated `firebase/firebase.json` and `cloudflare/wrangler.toml` to match.

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
