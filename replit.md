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
- Changes pushed to the GitHub remote (`main`).
- Larger product roadmap (multi-agent marketing/sales/support automation, mobile companion app, billing/payments) proposed as separate follow-up project tasks rather than built here — see project tasks list.

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
