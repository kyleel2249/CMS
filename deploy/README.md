# CINTEXA NEXUS — Deployment Guide

A production-ready AI Business Operating System. This folder contains the static frontend build.

---

## Running Locally (npm)

```bash
# Install the local dev server
npm install

# Start on http://localhost:3000
npm start
```

Or without installing anything:
```bash
npx serve -s . -l 3000
```

Then open **http://localhost:3000** in your browser.

> **Note:** The UI will load fully. API calls (data features) require the Express backend running separately on port 8080. Without it, the app shows the UI with empty/loading states.

---

## Deploy to Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Log in: `firebase login`
3. From the project root, init (or use the existing `firebase.json`):
   ```bash
   firebase deploy --only hosting
   ```
   Firebase is already configured to serve from `artifacts/cintexa-nexus/dist-standalone`.

4. **Custom project ID:** Edit `.firebaserc` → replace `"cintexa-nexus"` with your Firebase project ID.

---

## Deploy to Cloudflare Pages

### Option A — Cloudflare Dashboard (recommended)
1. Go to **Cloudflare Dashboard → Pages → Create a project**
2. Connect your GitHub repo (`kyleel2249/CMS`)
3. Set:
   - **Build command:** `pnpm --filter @workspace/cintexa-nexus exec vite build --config vite.config.standalone.ts`
   - **Output directory:** `artifacts/cintexa-nexus/dist-standalone`
4. Deploy. The `_redirects` file in the build output handles SPA routing automatically.

### Option B — Wrangler CLI
```bash
npm install -g wrangler
wrangler login
npx wrangler pages deploy . --project-name cintexa-nexus
```
(Run from inside this `deploy/` folder or the `dist-standalone/` directory.)

---

## Connecting the API Backend

The static frontend calls `/api/*` endpoints. For full functionality:
- **Locally:** Run the Express API on port 8080 and use a reverse proxy (Nginx, Caddy, or Vite's proxy)
- **Firebase:** Add Firebase Functions to proxy `/api/*` to your Node.js backend
- **Cloudflare:** Use a Cloudflare Worker route to forward `/api/*` to your backend host

Set `VITE_API_BASE_URL=https://your-api-host.com` at build time to hardcode a remote API URL into the bundle.

---

## Stack

- React 18 + Vite 7 + TypeScript 5
- Tailwind CSS + shadcn/ui
- TanStack Query
- Recharts for data visualizations
- Wouter for client-side routing
- Express 5 + Drizzle ORM + PostgreSQL (API server, separate)
