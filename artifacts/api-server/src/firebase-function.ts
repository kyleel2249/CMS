/**
 * Firebase Cloud Functions entry point.
 * Wraps the Express app so Firebase can invoke it as an HTTPS function.
 *
 * The `api` export handles all /api/* traffic.
 * Firebase Hosting rewrites non-/api routes to serve index.html from Hosting.
 */
import * as functions from "firebase-functions/v2/https";
import app from "./app";
import { registerAutomations } from "./lib/automations";

registerAutomations();

export const api = functions.onRequest({ memory: "512MiB", timeoutSeconds: 60 }, app);
