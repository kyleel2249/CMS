import { pgTable, serial, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailThreadsTable = pgTable("email_threads", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  participants: text("participants").array().notNull().default([]),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  labels: text("labels").array().notNull().default([]),
  contactId: integer("contact_id"),
  dealId: integer("deal_id"),
  ticketId: integer("ticket_id"),
  aiSummary: text("ai_summary"),
  aiTriage: text("ai_triage"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailMessagesTable = pgTable("email_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull(),
  from: text("from_address").notNull(),
  to: text("to_addresses").array().notNull().default([]),
  cc: text("cc_addresses").array().notNull().default([]),
  body: text("body").notNull(),
  bodyHtml: text("body_html"),
  isOutbound: boolean("is_outbound").notNull().default(false),
  isRead: boolean("is_read").notNull().default(false),
  aiDraft: text("ai_draft"),
  metadata: jsonb("metadata"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmailThreadSchema = createInsertSchema(emailThreadsTable).omit({ id: true, createdAt: true });
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;
export type EmailThread = typeof emailThreadsTable.$inferSelect;

export const insertEmailMessageSchema = createInsertSchema(emailMessagesTable).omit({ id: true, createdAt: true });
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailMessage = typeof emailMessagesTable.$inferSelect;
