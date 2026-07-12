/**
 * First-time setup wizard.
 * 1. Creates .env from .env.example if missing
 * 2. Checks DATABASE_URL is set
 * 3. Pushes the database schema
 * 4. Optionally seeds demo data
 *
 * Usage:  node scripts/setup.mjs
 */
import { readFileSync, existsSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root      = path.join(__dirname, "..");
const envPath   = path.join(root, ".env");
const envExPath = path.join(root, ".env.example");

// ── Step 1: bootstrap .env ────────────────────────────────────────────────
if (!existsSync(envPath)) {
  copyFileSync(envExPath, envPath);
  console.log("✅  Created .env from .env.example");
  console.log("    ➡  Open .env and fill in DATABASE_URL, then re-run: node scripts/setup.mjs");
  process.exit(0);
}

// Load .env into process.env
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("user:password")) {
  console.error("❌  DATABASE_URL is not configured. Edit .env and re-run: node scripts/setup.mjs");
  process.exit(1);
}

// ── Step 2: install pg dependency if missing ──────────────────────────────
try {
  await import("pg");
} catch {
  console.log("⏳  Installing runtime dependency (pg)…");
  execSync("npm install pg", { stdio: "inherit", cwd: root });
}

// ── Step 3: push schema ───────────────────────────────────────────────────
console.log("⏳  Pushing database schema…");
try {
  execSync("node scripts/db-push.mjs", { stdio: "inherit", cwd: root });
} catch {
  console.error("❌  Schema push failed. Check DATABASE_URL and ensure PostgreSQL is reachable.");
  process.exit(1);
}

// ── Step 4: offer demo seed ───────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("\n📦  Seed demo data (contacts, deals, emails, etc.)? [y/N] ", async (answer) => {
  rl.close();
  if (answer.trim().toLowerCase() === "y") {
    console.log("⏳  Seeding demo data…");
    execSync("node scripts/seed.mjs", { stdio: "inherit", cwd: root });
  }
  console.log("\n🚀  Setup complete!  Run:  npm start");
  console.log("    Then open:  http://localhost:3000");
});
