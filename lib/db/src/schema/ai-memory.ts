import { pgTable, serial, text, jsonb, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const aiMemoryTable = pgTable("ai_memory", {
  id:          serial("id").primaryKey(),
  sessionId:   text("session_id"),
  memoryType:  text("memory_type").notNull().default("fact"),   // fact | preference | pattern | insight | learning
  key:         text("key").notNull(),
  value:       text("value").notNull(),
  confidence:  integer("confidence").default(80),               // 0-100
  source:      text("source"),                                  // 'user' | 'observed' | 'inferred'
  tags:        text("tags").array(),
  expiresAt:   timestamp("expires_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export const aiGeneratedFilesTable = pgTable("ai_generated_files", {
  id:          serial("id").primaryKey(),
  title:       text("title").notNull(),
  fileType:    text("file_type").notNull(),                     // image | document | csv | html | markdown | json | video_script
  mimeType:    text("mime_type").notNull(),
  content:     text("content"),                                 // for text types
  url:         text("url"),                                     // for externally hosted (images via Pollinations)
  prompt:      text("prompt"),                                  // original generation prompt
  metadata:    jsonb("metadata").$type<Record<string,unknown>>().default({}),
  sizeBytes:   integer("size_bytes"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const aiConversationsTable = pgTable("ai_conversations", {
  id:          serial("id").primaryKey(),
  sessionId:   text("session_id").notNull(),
  role:        text("role").notNull(),                          // user | assistant | expert
  expertName:  text("expert_name"),
  content:     text("content").notNull(),
  metadata:    jsonb("metadata").$type<Record<string,unknown>>().default({}),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});
