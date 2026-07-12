import { Router } from "express";
import { db, contactsTable } from "@workspace/db";
import { eq, like, or, desc } from "drizzle-orm";
import { activityTable } from "@workspace/db";

const router = Router();

function toResponse(c: typeof contactsTable.$inferSelect) {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone ?? null,
    company: c.company ?? null,
    jobTitle: c.jobTitle ?? null,
    status: c.status,
    score: c.score ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/contacts", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);

    let query = db.select().from(contactsTable);
    if (search) {
      query = query.where(
        or(
          like(contactsTable.firstName, `%${search}%`),
          like(contactsTable.lastName, `%${search}%`),
          like(contactsTable.email, `%${search}%`),
          like(contactsTable.company, `%${search}%`)
        )
      ) as typeof query;
    }
    const rows = await query
      .orderBy(desc(contactsTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const [row] = await db.insert(contactsTable).values(req.body).returning();
    await db.insert(activityTable).values({
      type: "contact",
      title: "New contact created",
      description: `${row.firstName} ${row.lastName} added to CRM`,
    });
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

router.get("/contacts/:id", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch contact" });
  }
});

router.patch("/contacts/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(contactsTable)
      .set(req.body)
      .where(eq(contactsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    await db
      .delete(contactsTable)
      .where(eq(contactsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

export default router;
