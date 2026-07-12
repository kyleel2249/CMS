import { pgTable, serial, text, numeric, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicePaymentsTable = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  method: text("method").notNull().default("bank_transfer"),
  reference: text("reference"),
  notes: text("notes"),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const billingSchedulesTable = pgTable("billing_schedules", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  interval: text("interval").notNull().default("monthly"),
  intervalCount: integer("interval_count").notNull().default(1),
  status: text("status").notNull().default("active"),
  nextBillingAt: timestamp("next_billing_at"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInvoicePaymentSchema = createInsertSchema(invoicePaymentsTable).omit({ id: true, createdAt: true });
export type InsertInvoicePayment = z.infer<typeof insertInvoicePaymentSchema>;
export type InvoicePayment = typeof invoicePaymentsTable.$inferSelect;

export const insertBillingScheduleSchema = createInsertSchema(billingSchedulesTable).omit({ id: true, createdAt: true });
export type InsertBillingSchedule = z.infer<typeof insertBillingScheduleSchema>;
export type BillingSchedule = typeof billingSchedulesTable.$inferSelect;
