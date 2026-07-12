import { pgTable, serial, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workflowDefsTable = pgTable("workflow_defs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(false),
  trigger: jsonb("trigger").notNull().default({}),
  steps: jsonb("steps").notNull().default([]),
  runsTotal: integer("runs_total").notNull().default(0),
  runsSuccess: integer("runs_success").notNull().default(0),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workflowRunsTable = pgTable("workflow_runs", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull(),
  status: text("status").notNull().default("running"),
  trigger: jsonb("trigger").notNull().default({}),
  stepLogs: jsonb("step_logs").notNull().default([]),
  error: text("error"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export const insertWorkflowDefSchema = createInsertSchema(workflowDefsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkflowDef = z.infer<typeof insertWorkflowDefSchema>;
export type WorkflowDef = typeof workflowDefsTable.$inferSelect;

export const insertWorkflowRunSchema = createInsertSchema(workflowRunsTable).omit({ id: true, startedAt: true });
export type InsertWorkflowRun = z.infer<typeof insertWorkflowRunSchema>;
export type WorkflowRun = typeof workflowRunsTable.$inferSelect;
