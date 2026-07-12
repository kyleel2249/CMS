import { Router } from "express";
import { db, companiesTable } from "@workspace/db";
import { eq, like, desc } from "drizzle-orm";

const router = Router();

function toResponse(c: typeof companiesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    industry: c.industry ?? null,
    website: c.website ?? null,
    size: c.size ?? null,
    revenue: c.revenue != null ? Number(c.revenue) : null,
    country: c.country ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/companies", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const limit = Number(req.query.limit ?? 50);
    let query = db.select().from(companiesTable);
    if (search) {
      query = query.where(like(companiesTable.name, `%${search}%`)) as typeof query;
    }
    const rows = await query.orderBy(desc(companiesTable.createdAt)).limit(limit);
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch companies" });
  }
});

router.post("/companies", async (req, res) => {
  try {
    const [row] = await db.insert(companiesTable).values(req.body).returning();
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create company" });
  }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch company" });
  }
});

router.patch("/companies/:id", async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.revenue != null) body.revenue = String(body.revenue);
    const [row] = await db
      .update(companiesTable)
      .set(body)
      .where(eq(companiesTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update company" });
  }
});

router.delete("/companies/:id", async (req, res) => {
  try {
    await db.delete(companiesTable).where(eq(companiesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete company" });
  }
});

export default router;
