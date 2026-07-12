import { pgTable, serial, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customObjectDefsTable = pgTable("custom_object_defs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pluralName: text("plural_name").notNull(),
  icon: text("icon").notNull().default("Box"),
  color: text("color").notNull().default("#6366f1"),
  fields: jsonb("fields").notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customObjectRecordsTable = pgTable("custom_object_records", {
  id: serial("id").primaryKey(),
  objectDefId: integer("object_def_id").notNull(),
  data: jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCustomObjectDefSchema = createInsertSchema(customObjectDefsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomObjectDef = z.infer<typeof insertCustomObjectDefSchema>;
export type CustomObjectDef = typeof customObjectDefsTable.$inferSelect;

export const insertCustomObjectRecordSchema = createInsertSchema(customObjectRecordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomObjectRecord = z.infer<typeof insertCustomObjectRecordSchema>;
export type CustomObjectRecord = typeof customObjectRecordsTable.$inferSelect;
