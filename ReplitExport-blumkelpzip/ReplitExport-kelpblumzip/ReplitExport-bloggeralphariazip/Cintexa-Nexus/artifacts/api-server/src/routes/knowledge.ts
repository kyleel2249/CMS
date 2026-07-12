import { Router } from "express";
import { db, knowledgeArticlesTable } from "@workspace/db";
import { eq, like, or, desc, sql } from "drizzle-orm";
import * as ai from "../lib/ai";

const router = Router();

function toResponse(a: typeof knowledgeArticlesTable.$inferSelect) {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    content: a.content,
    category: a.category,
    tags: a.tags ?? null,
    author: a.author,
    status: a.status,
    views: a.views,
    helpful: a.helpful,
    notHelpful: a.notHelpful,
    isPinned: a.isPinned,
    aiSummary: a.aiSummary ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

router.get("/knowledge", async (req, res) => {
  try {
    const { search, category, status, limit, offset } = req.query;
    let query = db.select().from(knowledgeArticlesTable);

    const conditions: ReturnType<typeof eq>[] = [];
    if (category) conditions.push(eq(knowledgeArticlesTable.category, String(category)));
    if (status) conditions.push(eq(knowledgeArticlesTable.status, String(status)));
    if (search) {
      const s = `%${search}%`;
      conditions.push(
        or(
          like(knowledgeArticlesTable.title, s),
          like(knowledgeArticlesTable.content, s),
          like(knowledgeArticlesTable.tags, s)
        ) as ReturnType<typeof eq>
      );
    }
    if (conditions.length) query = query.where(conditions.length === 1 ? conditions[0] : conditions.reduce((a, b) => sql`${a} AND ${b}` as unknown as ReturnType<typeof eq>, conditions[0])) as typeof query;

    const rows = await query
      .orderBy(desc(knowledgeArticlesTable.isPinned), desc(knowledgeArticlesTable.updatedAt))
      .limit(Number(limit ?? 50))
      .offset(Number(offset ?? 0));
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

router.post("/knowledge", async (req, res) => {
  try {
    const slug = req.body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const [row] = await db.insert(knowledgeArticlesTable).values({ ...req.body, slug }).returning();
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create article" });
  }
});

router.get("/knowledge/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(knowledgeArticlesTable).where(eq(knowledgeArticlesTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    await db.update(knowledgeArticlesTable).set({ views: row.views + 1 }).where(eq(knowledgeArticlesTable.id, row.id));
    res.json(toResponse({ ...row, views: row.views + 1 }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

router.patch("/knowledge/:id", async (req, res) => {
  try {
    const [row] = await db.update(knowledgeArticlesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(knowledgeArticlesTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update article" });
  }
});

router.delete("/knowledge/:id", async (req, res) => {
  try {
    await db.delete(knowledgeArticlesTable).where(eq(knowledgeArticlesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

router.post("/knowledge/:id/helpful", async (req, res) => {
  try {
    const { vote } = req.body;
    const [row] = await db.select().from(knowledgeArticlesTable).where(eq(knowledgeArticlesTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    const [updated] = await db.update(knowledgeArticlesTable)
      .set(vote === "yes" ? { helpful: row.helpful + 1 } : { notHelpful: row.notHelpful + 1 })
      .where(eq(knowledgeArticlesTable.id, row.id))
      .returning();
    res.json(toResponse(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to record vote" });
  }
});

router.post("/ai/knowledge/:id/summarize", async (req, res) => {
  try {
    if (!ai.aiEnabled()) return res.status(400).json({ error: "AI is not configured." });
    const insight = await ai.summarizeKnowledgeArticle(Number(req.params.id));
    if (!insight) return res.status(404).json({ error: "Article not found or AI unavailable" });
    return res.json(insight);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to summarize article" });
  }
});

export default router;
