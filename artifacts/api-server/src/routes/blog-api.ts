import { Router } from "express";
import { db, blogPostsTable, blogCategoriesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import * as ai from "../lib/ai";

const router = Router();

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
const readTime = (s: string) => Math.max(1, Math.round(wordCount(s) / 200));

// GET /blog/posts
router.get("/blog/posts", async (req, res) => {
  try {
    const rows = await db.select().from(blogPostsTable).orderBy(desc(blogPostsTable.updatedAt));
    const { status } = req.query;
    res.json(status ? rows.filter(r => r.status === status) : rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /blog/posts/:id
router.get("/blog/posts/:id", async (req, res) => {
  try {
    const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, Number(req.params.id)));
    if (!post) return res.status(404).json({ error: "Not found" });
    res.json(post);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /blog/posts
router.post("/blog/posts", async (req, res) => {
  try {
    const { title, content = "", excerpt, status, categoryId, author, seoTitle, seoDescription, seoKeywords, targetQuestion, coverImageUrl, aiGenerated } = req.body;
    const slug = `${slugify(title)}-${Date.now().toString(36)}`;
    const wc = wordCount(content);
    const [row] = await db.insert(blogPostsTable).values({
      title, slug, content, excerpt, status: status || "draft",
      categoryId: categoryId || null, author: author || "Admin",
      seoTitle: seoTitle || title, seoDescription, seoKeywords, targetQuestion,
      coverImageUrl, wordCount: wc, readingTime: readTime(content),
      aiGenerated: Boolean(aiGenerated),
      publishedAt: status === "published" ? new Date() : null,
    }).returning();
    res.status(201).json(row);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed to create" }); }
});

// PATCH /blog/posts/:id
router.patch("/blog/posts/:id", async (req, res) => {
  try {
    const body: any = { ...req.body, updatedAt: new Date() };
    if (body.content) { body.wordCount = wordCount(body.content); body.readingTime = readTime(body.content); }
    if (body.status === "published" && !body.publishedAt) body.publishedAt = new Date();
    const [row] = await db.update(blogPostsTable).set(body).where(eq(blogPostsTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// DELETE /blog/posts/:id
router.delete("/blog/posts/:id", async (req, res) => {
  try {
    await db.delete(blogPostsTable).where(eq(blogPostsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /blog/ai-generate — generate full SEO blog post
router.post("/blog/ai-generate", async (req, res) => {
  try {
    const { topic, targetQuestion, keywords, tone = "professional", targetWordCount = 1200 } = req.body;
    if (!topic && !targetQuestion) return res.status(400).json({ error: "topic or targetQuestion required" });

    const fallback = {
      title: topic || targetQuestion,
      content: `# ${topic || targetQuestion}\n\n## Introduction\n\nWrite your introduction here.\n\n## Main Content\n\nWrite your main content here.\n\n## Key Points\n\n- Point 1\n- Point 2\n- Point 3\n\n## Conclusion\n\nWrite your conclusion here.`,
      excerpt: `Learn about ${topic || targetQuestion} in this comprehensive guide.`,
      seoTitle: (topic || targetQuestion || "").slice(0, 60),
      seoDescription: `Comprehensive guide on ${topic || targetQuestion}.`.slice(0, 155),
      seoKeywords: keywords || topic || "",
    };

    if (!ai.aiEnabled()) return res.json(fallback);

    const prompt = `You are an expert SEO content writer. Write a comprehensive, engaging blog post in Markdown.

Topic: ${topic || ""}
Target Question to Answer: ${targetQuestion || ""}
Primary Keywords: ${keywords || topic}
Tone: ${tone}
Target word count: ~${targetWordCount} words

Requirements:
- Answer the target question directly and comprehensively in the introduction
- Use proper Markdown formatting (## for H2, ### for H3, **bold**, bullet lists)
- Follow E-E-A-T (Experience, Expertise, Authority, Trustworthiness) principles
- Include practical examples and actionable steps
- Naturally weave keywords throughout without stuffing
- Write a compelling H1 title (do NOT include "# " prefix in the title field)
- Add a strong CTA in the conclusion

Respond ONLY with this JSON (no extra text):
{
  "title": "SEO-optimized title without # prefix",
  "content": "full markdown post body starting from ## Introduction",
  "excerpt": "2-3 sentence compelling excerpt",
  "seoTitle": "SEO title under 60 chars",
  "seoDescription": "meta description under 155 chars",
  "seoKeywords": "keyword1, keyword2, keyword3, keyword4"
}`;

    const reply = await ai.chat(prompt, []);
    try {
      const m = (reply ?? "").match(/\{[\s\S]*\}/);
      if (m) return res.json(JSON.parse(m[0]));
    } catch {}
    res.json(fallback);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Generation failed" }); }
});

// POST /blog/research — discover trending topics/questions
router.post("/blog/research", async (req, res) => {
  try {
    const { niche, website = "cintexa.com", count: n = 10 } = req.body;

    const fallback = { topics: [
      { question: "What is an AI Business Operating System and how does it work?", difficulty: "medium", searchVolume: "high", intent: "informational", suggestedKeywords: "AI business OS, AI CRM, business automation" },
      { question: "How to automate CRM workflows to save time?", difficulty: "low", searchVolume: "high", intent: "informational", suggestedKeywords: "CRM automation, workflow automation, sales automation" },
      { question: "Best AI tools for small business in 2025", difficulty: "low", searchVolume: "high", intent: "commercial", suggestedKeywords: "AI tools small business, AI software, business AI" },
      { question: "How to improve sales conversion rates with AI?", difficulty: "medium", searchVolume: "medium", intent: "commercial", suggestedKeywords: "sales AI, conversion rate optimization, AI sales tools" },
      { question: "What is a unified inbox and why do businesses need one?", difficulty: "low", searchVolume: "medium", intent: "informational", suggestedKeywords: "unified inbox, omnichannel, customer communication" },
    ]};

    if (!ai.aiEnabled()) return res.json(fallback);

    const prompt = `You are an SEO research expert. Generate ${n} high-value blog topic ideas for ${website}${niche ? ` (niche: ${niche})` : ""}.

Focus on:
- Questions people actively search on Google, Reddit, Quora, and forums
- Mix of informational and commercial intent queries
- Topics where AI/automation/CRM adds real value
- Questions with clear, answerable intent

Return ONLY this JSON:
{"topics":[{"question":"...","difficulty":"low|medium|high","searchVolume":"low|medium|high","intent":"informational|commercial|transactional","suggestedKeywords":"keyword1, keyword2"}]}`;

    const reply = await ai.chat(prompt, []);
    try { const m = (reply ?? "").match(/\{[\s\S]*\}/); if (m) return res.json(JSON.parse(m[0])); } catch {}
    res.json(fallback);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Research failed" }); }
});

// GET /blog/categories
router.get("/blog/categories", async (req, res) => {
  try { res.json(await db.select().from(blogCategoriesTable).orderBy(blogCategoriesTable.name)); }
  catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /blog/categories
router.post("/blog/categories", async (req, res) => {
  try {
    const { name, description } = req.body;
    const [row] = await db.insert(blogCategoriesTable).values({ name, slug: slugify(name), description }).returning();
    res.status(201).json(row);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

export default router;
