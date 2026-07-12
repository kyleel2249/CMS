import { pgTable, serial, text, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// The shared event bus backbone: every module publishes domain events here
// (lead.created, ticket.created, deal.stage_changed, invoice.overdue, ...).
// The AI/automation layer subscribes to these to act across modules without
// each module needing to know about the others.
export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  module: text("module").notNull(), // crm | support | marketing | finance | projects | sales
  type: text("type").notNull(), // e.g. "lead.created", "ticket.created"
  entityId: integer("entity_id"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true, processed: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type PlatformEvent = typeof eventsTable.$inferSelect;

// AI-generated work products, attributable and auditable across every module —
// the "AI employee's" output log (qualifications, drafts, forecasts, briefs).
export const aiInsightsTable = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  module: text("module").notNull(),
  kind: text("kind").notNull(), // lead_qualification | ticket_triage | marketing_copy | finance_forecast | morning_brief
  entityId: integer("entity_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAiInsightSchema = createInsertSchema(aiInsightsTable).omit({ id: true, createdAt: true });
export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;
export type AiInsight = typeof aiInsightsTable.$inferSelect;
