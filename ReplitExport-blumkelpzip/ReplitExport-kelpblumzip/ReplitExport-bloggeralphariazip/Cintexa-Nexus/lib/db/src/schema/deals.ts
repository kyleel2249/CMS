import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealsTable = pgTable("deals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  value: numeric("value", { precision: 15, scale: 2 }).notNull(),
  stage: text("stage").notNull().default("prospecting"),
  probability: integer("probability").notNull().default(10),
  contactName: text("contact_name").notNull(),
  companyName: text("company_name"),
  expectedCloseDate: text("expected_close_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({ id: true, createdAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
