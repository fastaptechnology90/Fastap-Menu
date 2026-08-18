import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/audit-logs", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { severity, category, limit: limitQ } = req.query;
  const limit = parseInt(String(limitQ ?? "200"));
  const logs = await db.select().from(auditLogsTable).where(eq(auditLogsTable.restaurantId, id)).orderBy(desc(auditLogsTable.createdAt)).limit(limit);
  const filtered = logs.filter(l => (!severity || l.severity === severity) && (!category || l.category === category));
  res.json(filtered.map(l => ({ ...l, details: typeof l.details === 'object' ? l.details : {} })));
});

router.post("/restaurants/:restaurantId/audit-logs", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { action, category, severity, performedBy, role, ipAddress, deviceInfo, details, resourceType, resourceId } = req.body;
  const [log] = await db.insert(auditLogsTable).values({ restaurantId: id, action, category, severity, performedBy, role, ipAddress, deviceInfo, details: details ?? {}, resourceType, resourceId }).returning();
  res.status(201).json(log);
});

export const logAuditEvent = async (restaurantId: number, action: string, performedBy: string, details: Record<string, any> = {}, options: { category?: string; severity?: string; role?: string } = {}) => {
  try {
    await db.insert(auditLogsTable).values({
      restaurantId, action, performedBy, details,
      category: options.category ?? "general",
      severity: options.severity ?? "info",
      role: options.role,
    });
  } catch {}
};

export default router;
