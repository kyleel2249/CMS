import { Router } from "express";
import { db, invoicePaymentsTable, billingSchedulesTable, invoicesTable, activityTable } from "@workspace/db";
import { eq, desc, sum, and, gte } from "drizzle-orm";

const router = Router();

// ── Payments ──────────────────────────────────────────────────────────────────

router.get("/invoices/:id/payments", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(invoicePaymentsTable)
      .where(eq(invoicePaymentsTable.invoiceId, Number(req.params.id)))
      .orderBy(desc(invoicePaymentsTable.paidAt));
    res.json(rows.map((p) => ({ ...p, amount: Number(p.amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

router.post("/invoices/:id/payments", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const [payment] = await db.insert(invoicePaymentsTable).values({
      invoiceId,
      amount: String(req.body.amount),
      method: req.body.method ?? "bank_transfer",
      reference: req.body.reference,
      notes: req.body.notes,
      paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
    }).returning();

    // Auto-mark invoice paid if payment >= invoice amount
    const totalPaidRes = await db.select({ total: sum(invoicePaymentsTable.amount) }).from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, invoiceId));
    const totalPaid = Number(totalPaidRes[0]?.total ?? 0);
    if (totalPaid >= Number(invoice.amount)) {
      await db.update(invoicesTable).set({ status: "paid", paidAt: new Date().toISOString() }).where(eq(invoicesTable.id, invoiceId));
      await db.insert(activityTable).values({ type: "invoice", title: "Invoice paid", description: `${invoice.number} from ${invoice.clientName} — $${Number(invoice.amount).toLocaleString()}` });
    }

    res.status(201).json({ ...payment, amount: Number(payment.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// ── Billing Schedules ─────────────────────────────────────────────────────────

router.get("/billing/schedules", async (req, res) => {
  try {
    const rows = await db.select().from(billingSchedulesTable).orderBy(desc(billingSchedulesTable.createdAt));
    res.json(rows.map((s) => ({ ...s, amount: Number(s.amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch billing schedules" });
  }
});

router.post("/billing/schedules", async (req, res) => {
  try {
    const [row] = await db.insert(billingSchedulesTable).values({
      ...req.body,
      amount: String(req.body.amount),
      nextBillingAt: req.body.nextBillingAt ? new Date(req.body.nextBillingAt) : null,
    }).returning();
    res.status(201).json({ ...row, amount: Number(row.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create billing schedule" });
  }
});

router.patch("/billing/schedules/:id", async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.amount) body.amount = String(body.amount);
    if (body.nextBillingAt) body.nextBillingAt = new Date(body.nextBillingAt);
    const [row] = await db.update(billingSchedulesTable).set(body).where(eq(billingSchedulesTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ...row, amount: Number(row.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update billing schedule" });
  }
});

router.delete("/billing/schedules/:id", async (req, res) => {
  try {
    await db.delete(billingSchedulesTable).where(eq(billingSchedulesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete billing schedule" });
  }
});

// ── Revenue Metrics ───────────────────────────────────────────────────────────

router.get("/billing/metrics", async (req, res) => {
  try {
    const allInvoices = await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt));
    const schedules = await db.select().from(billingSchedulesTable).where(eq(billingSchedulesTable.status, "active"));

    const mrr = schedules
      .filter((s) => s.interval === "monthly")
      .reduce((acc, s) => acc + Number(s.amount) / (s.intervalCount || 1), 0);

    const arr = schedules.reduce((acc, s) => {
      const amount = Number(s.amount) / (s.intervalCount || 1);
      if (s.interval === "monthly") return acc + amount * 12;
      if (s.interval === "yearly") return acc + amount;
      if (s.interval === "quarterly") return acc + amount * 4;
      if (s.interval === "weekly") return acc + amount * 52;
      return acc;
    }, 0);

    const totalPaid = allInvoices.filter((i) => i.status === "paid").reduce((acc, i) => acc + Number(i.amount), 0);
    const totalOutstanding = allInvoices.filter((i) => i.status === "sent").reduce((acc, i) => acc + Number(i.amount), 0);
    const totalOverdue = allInvoices.filter((i) => i.status === "overdue").reduce((acc, i) => acc + Number(i.amount), 0);

    // Monthly revenue trend (last 6 months)
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = 0;
    }
    allInvoices
      .filter((i) => i.status === "paid")
      .forEach((inv) => {
        const d = inv.paidAt ? new Date(inv.paidAt) : inv.createdAt;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in months) months[key] += Number(inv.amount);
      });

    const trend = Object.entries(months).map(([month, revenue]) => ({ month, revenue }));

    res.json({ mrr, arr, totalPaid, totalOutstanding, totalOverdue, activeSubscriptions: schedules.length, trend });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to compute metrics" });
  }
});

export default router;
