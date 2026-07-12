# Cintexa Nexus

A full-stack CRM/ERP platform — pipeline, contacts, tickets, revenue, projects, email, AI copilot, and extensibility — with an Express API and a React frontend.

## Run & Operate

- The app runs as 3 Replit artifacts/workflows: `api-server` (port 8080), `cintexa-nexus` web app (port 20471, dev proxy forwards `/api` to the API server), and `mockup-sandbox` (canvas component previews, port 8081).
- `pnpm --filter @workspace/api-server run dev` — run the API server directly
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (Replit's built-in database; already provisioned)
- Optional env: `OPENAI_API_KEY` — enables all AI features (copilot, forecasting, triage, win probability)
- `pnpm --filter @workspace/scripts run seed` — populate the database with demo CRM data

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Feature Modules

### Operations
- **CRM Hub** (`/crm`) — contacts and company management
- **Sales** (`/sales`) — deal pipeline with stage tracking
- **Support** (`/support`) — ticket management
- **Marketing** (`/marketing`) — campaign management
- **Finance** (`/finance`) — invoice lifecycle, payment recording, billing schedules, MRR/ARR metrics, revenue trend chart
- **Projects** (`/projects`) — Kanban board, milestone timeline, project documents (Notion-style)
- **Email** (`/email`) — full email client with thread management, AI triage, AI draft compose, star/label/filter

### Intelligence
- **NEXUS AI** (`/ai`) — Copilot chat (cross-module), morning brief, revenue intelligence, deal win probability scoring
- **Analytics** (`/analytics`) — charts and KPIs
- **Anomalies** (`/anomalies`) — AI-detected data anomalies with explanations
- **Goals & OKRs** (`/goals`) — key results tracking
- **Activity** (`/activity`) — event stream

### Platform
- **Extensions** (`/extensions`) — 4 tabs:
  - **Marketplace** — 12 integrations (Slack, Gmail, Stripe, Zapier, etc.) with connect/disconnect
  - **Workflow Builder** — visual trigger → action workflows with run history
  - **Custom Objects** — define custom data models with typed fields
  - **Webhooks** — outbound webhook management with test delivery

## DB Schema

### Core (existing)
`contacts`, `companies`, `leads`, `deals`, `tickets`, `campaigns`, `invoices`, `projects`, `tasks`, `activity`, `events`, `knowledge_articles`, `automations`, `webhooks`, `goals`, `key_results`, `notes`

### New tables added
- `email_threads`, `email_messages` — Email module
- `custom_object_defs`, `custom_object_records` — Custom Objects
- `workflow_defs`, `workflow_runs` — Workflow Builder
- `integration_connections` — Marketplace
- `invoice_payments`, `billing_schedules` — Finance ERP
- `project_documents`, `project_milestones` — Projects PM

## New API Routes

- `GET/POST /email/threads`, `GET /email/threads/:id`, `POST /email/threads/:id/reply`, `POST /email/threads/:id/ai-triage`, `POST /email/threads/:id/ai-draft`
- `GET/POST /custom-objects/defs`, `PATCH/DELETE /custom-objects/defs/:id`, `GET/POST /custom-objects/defs/:defId/records`
- `GET/POST /workflows`, `PATCH/DELETE /workflows/:id`, `POST /workflows/:id/toggle`, `POST /workflows/:id/run`, `GET /workflows/:id/runs`
- `GET /marketplace/catalogue`, `GET/POST /marketplace/connections`, `DELETE /marketplace/connections/:id`
- `GET/POST /invoices/:id/payments`, `GET/POST /billing/schedules`, `GET /billing/metrics`
- `GET/POST /projects/:id/documents`, `PATCH/DELETE /projects/documents/:id`
- `GET/POST /projects/:id/milestones`, `PATCH/DELETE /projects/milestones/:id`
- `GET /ai/deals/win-probability`, `GET /ai/revenue-intelligence`, `POST /ai/copilot`, `POST /ai/anomalies/:id/explain`, `POST /ai/deals/:id/insights`

## Architecture Decisions

- All new DB tables added as separate schema files in `lib/db/src/schema/` and re-exported from `index.ts`
- AI features degrade gracefully: heuristic/static mode when `OPENAI_API_KEY` is absent
- Email threads support linking to `contactId`, `dealId`, `ticketId` for CRM cross-referencing
- Workflow Builder uses a simple JSON step model (`trigger` + `steps[]`) — extensible without migration
- Finance metrics (`/billing/metrics`) compute MRR/ARR from active billing schedules in real time

## Gotchas

- The frontend calls the API via relative `/api/...` fetches. In dev this only works because `vite.config.ts` has a `server.proxy` entry forwarding `/api` to `http://127.0.0.1:8080`.
- After importing/cloning, run `pnpm --filter @workspace/db run push` once to sync the schema.
- Full-height pages (Email, Projects) use `-m-6` to break out of AppShell's `p-6` padding — do not add `p-6` to those page roots.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
