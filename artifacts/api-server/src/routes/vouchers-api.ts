import { Router } from "express";
import { db, vouchersTable, voucherUsagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function genCode(prefix = ""): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return prefix ? `${prefix.toUpperCase()}-${rand}` : rand;
}

// GET /vouchers
router.get("/vouchers", async (req, res) => {
  try {
    const rows = await db.select().from(vouchersTable).orderBy(desc(vouchersTable.createdAt));
    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /vouchers
router.post("/vouchers", async (req, res) => {
  try {
    const { code, prefix, description, discountType, discountValue, minOrderAmount, maxUses, expiresAt, applicableTo } = req.body;
    const [row] = await db.insert(vouchersTable).values({
      code: (code || genCode(prefix)).toUpperCase(),
      description, discountType: discountType || "percentage",
      discountValue: Number(discountValue || 10),
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : null,
      maxUses: maxUses ? Number(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      applicableTo: applicableTo || "all",
    }).returning();
    res.status(201).json(row);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed to create voucher" }); }
});

// POST /vouchers/bulk
router.post("/vouchers/bulk", async (req, res) => {
  try {
    const { count = 5, prefix, discountType, discountValue, expiresAt, description, maxUses } = req.body;
    const n = Math.min(Number(count), 100);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const [row] = await db.insert(vouchersTable).values({
        code: genCode(prefix), description,
        discountType: discountType || "percentage",
        discountValue: Number(discountValue || 10),
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        applicableTo: "all",
      }).returning();
      rows.push(row);
    }
    res.status(201).json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed to bulk generate" }); }
});

// GET /vouchers/validate/:code
router.get("/vouchers/validate/:code", async (req, res) => {
  try {
    const [v] = await db.select().from(vouchersTable).where(eq(vouchersTable.code, req.params.code.toUpperCase()));
    if (!v) return res.status(404).json({ valid: false, error: "Not found" });
    if (!v.isActive) return res.json({ valid: false, error: "Voucher inactive" });
    if (v.expiresAt && v.expiresAt < new Date()) return res.json({ valid: false, error: "Expired" });
    if (v.maxUses && v.usedCount >= v.maxUses) return res.json({ valid: false, error: "Usage limit reached" });
    res.json({ valid: true, voucher: v });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /vouchers/:id/redeem
router.post("/vouchers/:id/redeem", async (req, res) => {
  try {
    const { customerEmail, orderAmount } = req.body;
    const [v] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, Number(req.params.id)));
    if (!v || !v.isActive) return res.status(400).json({ error: "Invalid voucher" });
    const discount = v.discountType === "percentage" ? (orderAmount * v.discountValue) / 100 : v.discountValue;
    await Promise.all([
      db.update(vouchersTable).set({ usedCount: v.usedCount + 1 }).where(eq(vouchersTable.id, v.id)),
      db.insert(voucherUsagesTable).values({ voucherId: v.id, customerEmail, orderAmount, discountApplied: discount }),
    ]);
    res.json({ ok: true, discountApplied: discount });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed to redeem" }); }
});

// PATCH /vouchers/:id
router.patch("/vouchers/:id", async (req, res) => {
  try {
    const [row] = await db.update(vouchersTable).set(req.body).where(eq(vouchersTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// DELETE /vouchers/:id
router.delete("/vouchers/:id", async (req, res) => {
  try {
    await db.delete(vouchersTable).where(eq(vouchersTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /vouchers/:id/usages
router.get("/vouchers/:id/usages", async (req, res) => {
  try {
    const rows = await db.select().from(voucherUsagesTable).where(eq(voucherUsagesTable.voucherId, Number(req.params.id))).orderBy(desc(voucherUsagesTable.usedAt));
    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

export default router;
