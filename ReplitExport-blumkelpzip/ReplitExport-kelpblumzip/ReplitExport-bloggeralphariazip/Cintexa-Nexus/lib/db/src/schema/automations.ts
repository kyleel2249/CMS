import { pgTable, serial, text, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const automationsTable = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull(),
  triggerConfig: jsonb("trigger_config").notNull().default({}),
  action: text("action").notNull(),
  actionConfig: jsonb("action_config").notNull().default({}),
  status: text("status").notNull().default("active"),
  runsTotal: integer("runs_total").notNull().default(0),
  runsSuccess: integer("runs_success").notNull().default(0),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAutomationSchema = createInsertSchema(automationsTable).omit({ id: true, createdAt: true, runsTotal: true, runsSuccess: true, lastRunAt: true });
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automationsTable.$inferSelect;
