import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blogCategoriesTable = pgTable("blog_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull().default(""),
  coverImageUrl: text("cover_image_url"),
  status: text("status").notNull().default("draft"),
  categoryId: integer("category_id"),
  author: text("author").notNull().default("Admin"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords"),
  targetQuestion: text("target_question"),
  readingTime: integer("reading_time"),
  wordCount: integer("word_count"),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPostsTable.$inferSelect;
