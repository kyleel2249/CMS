import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";

export const websiteSessionsTable = pgTable("website_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").unique().notNull(),
  firstSeen: timestamp("first_seen").notNull().defaultNow(),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
  pageviews: integer("pageviews").notNull().default(0),
  duration: integer("duration").notNull().default(0),
  bounced: boolean("bounced").notNull().default(true),
  country: text("country"),
  countryCode: text("country_code"),
  city: text("city"),
  region: text("region"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  source: text("source"),
  medium: text("medium"),
  campaign: text("campaign"),
  device: text("device"),
  browser: text("browser"),
  os: text("os"),
  ipAddress: text("ip_address"),
  language: text("language"),
});

export const websitePageviewsTable = pgTable("website_pageviews", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  url: text("url").notNull(),
  path: text("path").notNull(),
  title: text("title"),
  referrer: text("referrer"),
  source: text("source"),
  medium: text("medium"),
  campaign: text("campaign"),
  userAgent: text("user_agent"),
  screenWidth: integer("screen_width"),
  screenHeight: integer("screen_height"),
  language: text("language"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const websiteClicksTable = pgTable("website_clicks", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  path: text("path").notNull(),
  element: text("element"),
  elementText: text("element_text"),
  href: text("href"),
  x: integer("x"),
  y: integer("y"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const websiteErrorsTable = pgTable("website_errors", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id"),
  url: text("url").notNull(),
  path: text("path").notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  errorType: text("error_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
