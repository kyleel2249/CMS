import { pgTable, serial, text, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  owner: text("owner").notNull(),
  quarter: text("quarter").notNull(),
  year: integer("year").notNull(),
  status: text("status").notNull().default("on_track"),
  progress: integer("progress").notNull().default(0),
  aiNarrative: text("ai_narrative"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const keyResultsTable = pgTable("key_results", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull(),
  title: text("title").notNull(),
  targetValue: real("target_value").notNull(),
  currentValue: real("current_value").notNull().default(0),
  unit: text("unit").notNull().default("number"),
  status: text("status").notNull().default("on_track"),
  linkedMetric: text("linked_metric"),
  autoTracked: boolean("auto_tracked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true, createdAt: true, updatedAt: true, progress: true, aiNarrative: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;

export const insertKeyResultSchema = createInsertSchema(keyResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKeyResult = z.infer<typeof insertKeyResultSchema>;
export type KeyResult = typeof keyResultsTable.$inferSelect;
