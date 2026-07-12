/**
 * Drizzle Kit config for the standalone package.
 * Points to the bundled schema SQL migrations instead of TypeScript source.
 *
 * We ship a pre-generated SQL migration so users don't need TypeScript tooling.
 */
import { defineConfig } from "drizzle-kit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Use the pre-generated migration directory
  migrations: {
    table: "__cintexa_migrations",
    schema: "public",
  },
  out: path.join(__dirname, "migrations"),
});
