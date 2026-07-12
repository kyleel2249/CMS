# CINTEXA NEXUS — Standalone Package

**AI Business Operating System** — CRM, ERP, Sales, Finance, Projects, Email, and an AI Copilot in one unified platform.

This package runs **locally on Windows using npm** (no pnpm, no workspaces) and deploys to **Firebase** or **Cloudflare**.

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | ≥ 20 LTS | https://nodejs.org |
| PostgreSQL | ≥ 14 | https://www.postgresql.org/download/windows/ |

> **No pnpm needed.** This package uses npm only.

---

## Quick Start (Windows)

### 1 — Install dependencies
```cmd
npm install
```

### 2 — Configure environment
```cmd
copy .env.example .env
notepad .env
```
Set `DATABASE_URL` to your PostgreSQL connection string, e.g.:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/cintexa_nexus
```

### 3 — Create the database
In pgAdmin or psql, create a database named `cintexa_nexus` (or any name — match it in `DATABASE_URL`).

### 4 — Push schema + seed demo data
```cmd
npm run setup
```
The setup wizard pushes the schema and offers to load 6 companies, 8 contacts, 8 deals, 6 email threads, and more.

### 5 — Start the server
```cmd
npm start
```
Open **http://localhost:3000** — the full app is served from a single process.

---

## How It Works

```
npm start
    │
    └─► server/server-standalone.mjs  (Node.js, port 3000)
            ├── GET /api/*     → Express route handlers (CRM, AI, Finance…)
            └── GET /*         → public/index.html  (React SPA)
```

No separate frontend dev server. No proxy. One process, one port.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection URL |
| `OPENROUTER_API_KEY` | Recommended | Enables AI Copilot, deal scoring, anomaly detection |
| `PORT` | No | Server port (default: `3000`) |
| `SESSION_SECRET` | No | Cookie signing secret (generate a random 32-char string) |

---

## Deploy to Firebase Hosting + Functions

Firebase serves the static frontend from **Hosting** and the API from a **Cloud Function**.

### Setup
```cmd
npm install -g firebase-tools
firebase login
```

### Configure
1. Edit `firebase/.firebaserc` → replace `your-firebase-project-id` with your project ID
2. Copy server files into the functions directory:
   ```cmd
   copy server\server-standalone.mjs firebase\functions\
   copy server\pino-*.mjs firebase\functions\
   copy server\thread-stream-worker.mjs firebase\functions\
   ```
3. Set environment variables in Firebase:
   ```cmd
   firebase functions:secrets:set DATABASE_URL
   firebase functions:secrets:set OPENROUTER_API_KEY
   firebase functions:secrets:set SESSION_SECRET
   ```

### Deploy
```cmd
cd firebase
firebase deploy --only hosting,functions
```

Your app is live at `https://your-project-id.web.app`.

---

## Deploy to Cloudflare Pages (static frontend only)

Cloudflare Pages hosts the React app. The API needs a separate Node.js host.

### Option A — API on Railway/Render (recommended)
1. Deploy this package to [Railway](https://railway.app) or [Render](https://render.com)
2. Note the API URL (e.g. `https://cintexa-api.railway.app`)
3. Update `cloudflare/_redirects`:
   ```
   /api/*  https://cintexa-api.railway.app/api/:splat  200
   /*      /index.html                                 200
   ```

### Option B — Deploy Pages via Wrangler CLI
```cmd
npm install -g wrangler
wrangler login
wrangler pages deploy public --project-name cintexa-nexus
```

---

## Project Structure

```
cintexa-nexus-standalone/
├── public/                  # Built React frontend (index.html + assets)
│   ├── index.html
│   └── assets/
├── server/                  # Bundled Express API (no node_modules needed)
│   ├── server-standalone.mjs
│   ├── pino-worker.mjs
│   ├── pino-file.mjs
│   ├── pino-pretty.mjs
│   └── thread-stream-worker.mjs
├── scripts/
│   ├── setup.mjs            # First-time setup wizard
│   ├── db-push.mjs          # Push DB schema (run via setup)
│   └── seed.mjs             # Load demo data
├── firebase/                # Firebase deployment config
│   ├── firebase.json
│   ├── .firebaserc
│   └── functions/
│       ├── index.mjs        # Firebase Function entry point
│       └── package.json
├── cloudflare/              # Cloudflare Pages deployment config
│   ├── wrangler.toml
│   └── _redirects
├── .env.example             # Copy to .env and fill in values
├── package.json
└── README.md
```

---

## Troubleshooting

**`Error: DATABASE_URL` not set**
→ Create a `.env` file from `.env.example` and fill in your connection string.

**`ECONNREFUSED` or `connection refused`**
→ Make sure PostgreSQL is running. On Windows: check Services → "postgresql-x64-XX".

**Port 3000 already in use**
→ Set a different port: `PORT=4000 npm start` (Windows: `set PORT=4000 && npm start`)

**AI features not working (copilot, deal scoring)**
→ Add `OPENROUTER_API_KEY=sk-or-...` to your `.env` file.

**Blank page after `npm start`**
→ Open DevTools (F12) → Console. If you see fetch errors, the API may not be running.
   Verify `DATABASE_URL` is correct and the DB server is reachable.
