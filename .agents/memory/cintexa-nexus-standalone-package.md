---
name: CINTEXA NEXUS Windows/npm standalone package
description: Where the npm-only (no pnpm) build lives, and known drift/packaging traps to check before trusting it.
---

`cintexa-nexus-standalone/` is a hand-assembled copy of the app for running on Windows with plain `npm` — no pnpm, no workspaces. Its server bundle and frontend are built once inside the pnpm workspace and copied in; it is not regenerated automatically, so it silently drifts from the real Drizzle schema over time.

**Why this matters:** don't trust this package by inspection alone — schema column renames in the main app's Drizzle schema won't propagate here automatically and will break `npm run setup` for a first-time user.

**How to apply:** before telling a user the standalone package works, actually run it end to end (install → db push → seed → start, then hit `/`, a static asset, and an `/api/*` route) rather than assuming it's current. Don't commit a `package-lock.json` for it — this workspace's npm registry is Replit's internal package firewall, so a lockfile generated here has non-portable `resolved` URLs for external users; let Windows users generate their own lockfile locally.

Also: its bundled server entry resolves the static frontend as `<its own dir>/public` — the built frontend must live at `cintexa-nexus-standalone/server/public/` (not the package root), and any Firebase/Cloudflare hosting config pointing at "public" must match that path.
