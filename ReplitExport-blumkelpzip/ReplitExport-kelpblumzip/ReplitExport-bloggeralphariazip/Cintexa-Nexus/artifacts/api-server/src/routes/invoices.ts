import { Router } from "express";
import { db, invoicesTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

let invoiceCounter = 1000;

function toResponse(i: typeof invoicesTable.$inferSelect) {
  return {
    id: i.id,
    number: i.number,
    clientName: i.clientName,
    amount: Number(i.amount),
    tax: i.tax != null ? Number(i.tax) : null,
    status: i.status,
    dueDate: i.dueDate,
    paidAt: i.paidAt ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

router.get("/invoices", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Number(req.query.limit ?? 50);
    let query = db.select().from(invoicesTable);
    if (status) {
      query = query.where(eq(invoicesTable.status, status)) as typeof query;
    }
    const rows = await query.orderBy(desc(invoicesTable.createdAt)).limit(limit);
    res.json(rows.map(toResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    invoiceCounter++;
    const body = {
      ...req.body,
      number: `INV-${invoiceCounter}`,
      amount: String(req.body.amount),
      tax: req.body.tax != null ? String(req.body.tax) : undefined,
    };
    const [row] = await db.insert(invoicesTable).values(body).returning();
    await db.insert(activityTable).values({
      type: "invoice",
      title: "Invoice issued",
      description: `${row.number} to ${row.clientName} — $${Number(row.amount).toLocaleString()}`,
    });
    res.status(201).json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.patch("/invoices/:id", async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.amount != null) body.amount = String(body.amount);
    if (body.tax != null) body.tax = String(body.tax);
    const [row] = await db
      .update(invoicesTable)
      .set(body)
      .where(eq(invoicesTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update invoice" });
  }
});

router.delete("/invoices/:id", async (req, res) => {
  try {
    await db.delete(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

export default router;
