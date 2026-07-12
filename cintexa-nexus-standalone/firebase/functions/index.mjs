/**
 * Firebase Cloud Functions entry point.
 *
 * This file imports the pre-built Express server bundle and exposes it
 * as a Firebase HTTPS function. Firebase Hosting rewrites /api/** here;
 * all other URLs are served as static files from Hosting.
 *
 * Setup:
 *   1. Copy ../../server/server-standalone.mjs  →  ./server-standalone.mjs
 *   2. Copy ../../server/pino-*.mjs             →  ./
 *   3. Set environment variables in the Firebase console or .env:
 *        DATABASE_URL, OPENROUTER_API_KEY, SESSION_SECRET
 *   4. firebase deploy --only functions,hosting
 */
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

// Configure function region and resources
setGlobalOptions({ region: "us-central1", memory: "512MiB", timeoutSeconds: 60 });

// Lazy-import the bundled Express app so cold starts are faster
let _app;
async function getApp() {
  if (!_app) {
    // The server-standalone bundle exports `default` as the Express app
    const mod = await import("./server-standalone.mjs");
    _app = mod.default ?? mod.app;
  }
  return _app;
}

export const api = onRequest(async (req, res) => {
  const app = await getApp();
  app(req, res);
});
