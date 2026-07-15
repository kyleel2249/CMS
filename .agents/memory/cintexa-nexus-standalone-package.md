---
name: CINTEXA NEXUS Windows/npm standalone package
description: Where the npm-only (no pnpm) build lives, and known drift/packaging traps to check before trusting it.
---

`cintexa-nexus-standalone/` is a copy of the app for running on Windows with plain `npm` — no pnpm, no workspaces. It used to be hand-assembled and silently drifted from the real Drizzle schema (seed script diverged from `scripts/src/seed.ts` twice). Fixed by adding `pnpm --filter @workspace/scripts run build-standalone` (source: `scripts/src/build-standalone.ts`), which regenerates every derived file from the real source: copies `lib/db/drizzle/*.sql` migrations, esbuild-bundles `scripts/src/seed.ts` straight into `scripts/seed.mjs`, and rebuilds the server + frontend bundles.

**Why this matters:** the seed/schema files under `cintexa-nexus-standalone/scripts/` and `cintexa-nexus-standalone/server/` are now generated output, not source — hand-editing them is pointless, the next build overwrites them. `db-push.mjs` now applies every `.sql` file in `scripts/migrations/` in filename order (tracked in `__cintexa_migrations`), so it no longer assumes one hardcoded migration filename.

**How to apply:** whenever the DB schema, seed data, server code, or frontend changes, run the build-standalone script before telling a user the standalone package is current (then re-zip `cintexa-nexus-standalone.zip` if handing out a copy). Don't commit a `package-lock.json` for it — this workspace's npm registry is Replit's internal package firewall, so a lockfile generated here has non-portable `resolved` URLs for external users; let Windows users generate their own lockfile locally.

Also: its bundled server entry resolves the static frontend as `<its own dir>/public` — the built frontend must live at `cintexa-nexus-standalone/server/public/` (not the package root), and any Firebase/Cloudflare hosting config pointing at "public" must match that path.
