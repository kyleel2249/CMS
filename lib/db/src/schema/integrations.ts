import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const integrationConnectionsTable = pgTable("integration_connections", {
  id: serial("id").primaryKey(),
  integrationKey: text("integration_key").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("disconnected"),
  config: jsonb("config").notNull().default({}),
  scopes: text("scopes").array().notNull().default([]),
  connectedAt: timestamp("connected_at"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIntegrationConnectionSchema = createInsertSchema(integrationConnectionsTable).omit({ id: true, createdAt: true });
export type InsertIntegrationConnection = z.infer<typeof insertIntegrationConnectionSchema>;
export type IntegrationConnection = typeof integrationConnectionsTable.$inferSelect;
