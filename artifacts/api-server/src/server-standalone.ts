/**
 * Standalone entry point — serves the React frontend (static) AND the Express
 * API from a single Node.js process. Used for local Windows/npm development
 * and as the Firebase Cloud Function handler.
 *
 * API routes:   /api/*   (handled by Express)
 * SPA fallback: everything else returns index.html
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import app from "./app";
import { logger } from "./lib/logger";
import { registerAutomations } from "./lib/automations";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Static frontend lives next to this file in ./public
const publicDir = path.join(__dirname, "public");

// Serve compiled assets before any API middleware runs
app.use(express.static(publicDir, { index: false }));

// SPA catch-all: every non-/api request gets index.html
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

registerAutomations();

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  logger.info({ port }, "CINTEXA NEXUS — server listening");
  logger.info(`Open http://localhost:${port}`);
});

export default app; // exported for Firebase Functions wrapper
