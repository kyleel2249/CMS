# Cintexa Nexus

A CRM-style dashboard app ("Nexus") — pipeline, contacts, tickets, and revenue tracking — with an Express API and a React frontend.

## Run & Operate

- The app runs as 3 Replit artifacts/workflows: `api-server` (port 8080), `cintexa-nexus` web app (port 20471, dev proxy forwards `/api` to the API server), and `mockup-sandbox` (canvas component previews, port 8081).
- `pnpm --filter @workspace/api-server run dev` — run the API server directly
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (Replit's built-in database; already provisioned)
- `pnpm --filter @workspace/scripts run seed` — populate the database with demo CRM data (companies, contacts, leads, deals, tickets, campaigns, invoices, projects, tasks, activity)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The frontend calls the API via relative `/api/...` fetches with no base URL configured. In dev this only works because `artifacts/cintexa-nexus/vite.config.ts` has a `server.proxy` entry forwarding `/api` to `http://127.0.0.1:8080` — without it, `/api` calls resolve to the Vite dev server itself and return the SPA's `index.html`, causing confusing "not a function" errors on array data.
- After importing/cloning this project, run `pnpm --filter @workspace/db run push` once to sync the schema before starting the API server, or DB-backed endpoints will error.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
