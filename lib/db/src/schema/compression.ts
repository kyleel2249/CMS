import { pgTable, serial, text, integer, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";

export const compressionJobs = pgTable("compression_jobs", {
  id:              serial("id").primaryKey(),
  filename:        varchar("filename", { length: 512 }).notNull(),
  originalSize:    integer("original_size").notNull(),
  compressedSize:  integer("compressed_size"),
  algorithm:       varchar("algorithm", { length: 128 }),
  mode:            varchar("mode", { length: 64 }).notNull().default("balanced"),
  fileType:        varchar("file_type", { length: 64 }),
  mimeType:        varchar("mime_type", { length: 128 }),
  status:          varchar("status", { length: 32 }).notNull().default("queued"),
  quality:         integer("quality"),
  savingsPercent:  integer("savings_percent"),
  timeTakenMs:     integer("time_taken_ms"),
  analysis:        jsonb("analysis"),
  settings:        jsonb("settings"),
  errorMessage:    text("error_message"),
  outputPath:      text("output_path"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  completedAt:     timestamp("completed_at"),
});
