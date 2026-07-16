import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vouchersTable = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  code: text("code").unique().notNull(),
  description: text("description"),
  discountType: text("discount_type").notNull().default("percentage"),
  discountValue: real("discount_value").notNull(),
  minOrderAmount: real("min_order_amount"),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  applicableTo: text("applicable_to").notNull().default("all"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const voucherUsagesTable = pgTable("voucher_usages", {
  id: serial("id").primaryKey(),
  voucherId: integer("voucher_id").notNull(),
  customerEmail: text("customer_email"),
  orderAmount: real("order_amount"),
  discountApplied: real("discount_applied"),
  usedAt: timestamp("used_at").notNull().defaultNow(),
});

export const insertVoucherSchema = createInsertSchema(vouchersTable).omit({ id: true, createdAt: true, usedCount: true });
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchersTable.$inferSelect;
