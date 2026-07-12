/**
 * Applies the bundled SQL schema to the database.
 * Uses plain pg (no drizzle-kit, no TypeScript tooling) so it works on
 * any machine with Node.js 20+ and npm.
 *
 * Usage:  node scripts/db-push.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Load .env
const envPath = path.join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Edit .env first.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Track which migrations have already been applied
await pool.query(`
  CREATE TABLE IF NOT EXISTS __cintexa_migrations (
    id      serial PRIMARY KEY,
    name    text UNIQUE NOT NULL,
    applied timestamptz DEFAULT now()
  )`);

const migrationFile = path.join(__dirname, "migrations", "0000_schema.sql");
const migrationName = "0000_schema.sql";

const { rows } = await pool.query(
  "SELECT 1 FROM __cintexa_migrations WHERE name = $1", [migrationName]
);

if (rows.length > 0) {
  console.log("✅  Schema already applied — nothing to do.");
} else {
  console.log("⏳  Applying schema...");
  const sql = readFileSync(migrationFile, "utf8");

  // Execute statements split on drizzle's separator
  const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    if (stmt) await pool.query(stmt);
  }

  await pool.query(
    "INSERT INTO __cintexa_migrations (name) VALUES ($1)", [migrationName]
  );
  console.log("✅  Schema applied successfully.");
}

await pool.end();
