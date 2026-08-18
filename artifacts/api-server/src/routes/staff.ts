import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/staff", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const rows = await db.select().from(staffTable).where(eq(staffTable.restaurantId, id));
  res.json(rows.map(({ pinHash: _pinHash, ...rest }) => rest));
});

router.post("/restaurants/:restaurantId/staff", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, email, role, phone, password, isActive } = req.body;
  if (!name?.trim() || !email?.trim() || !role) {
    res.status(400).json({ error: "name, email, and role are required" });
    return;
  }
  if (!password || String(password).length < 6) {
    res.status(400).json({ error: "password (6+ characters) is required for staff login" });
    return;
  }
  const pinHash = await bcrypt.hash(String(password), 10);
  const [member] = await db
    .insert(staffTable)
    .values({
      restaurantId: id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? String(phone).replace(/\D/g, "") : null,
      role,
      pinHash,
      isActive: isActive ?? true,
      joinDate: new Date(),
    })
    .returning();
  const { pinHash: _h, ...safe } = member;
  res.status(201).json(safe);
});

router.put("/restaurants/:restaurantId/staff/:staffId", requireAuth, async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.staffId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, email, role, phone, password, isActive } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = String(email).trim().toLowerCase();
  if (role !== undefined) updates.role = role;
  if (phone !== undefined) updates.phone = phone ? String(phone).replace(/\D/g, "") : null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (password) {
    if (String(password).length < 6) {
      res.status(400).json({ error: "password must be at least 6 characters" });
      return;
    }
    updates.pinHash = await bcrypt.hash(String(password), 10);
  }
  const [member] = await db
    .update(staffTable)
    .set(updates)
    .where(and(eq(staffTable.id, staffId), eq(staffTable.restaurantId, restaurantId)))
    .returning();
  if (!member) {
    res.status(404).json({ error: "Staff not found" });
    return;
  }
  const { pinHash: _h, ...safe } = member;
  res.json(safe);
});

router.delete("/restaurants/:restaurantId/staff/:staffId", requireAuth, async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.staffId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [deleted] = await db
    .delete(staffTable)
    .where(and(eq(staffTable.id, staffId), eq(staffTable.restaurantId, restaurantId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Staff not found" });
    return;
  }
  res.json({ message: "Staff removed" });
});

export default router;
