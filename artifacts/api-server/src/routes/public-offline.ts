import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, restaurantsTable } from "@workspace/db";
import {
  getOfflineCatalog, buildSyncSummary, validateOrderPayload, type SyncOrderResult,
} from "../lib/offlineModeLogic.js";

const router: IRouter = Router();

router.get("/public/offline/catalog", (_req, res) => {
  res.json(getOfflineCatalog());
});

router.get("/public/offline/status", async (req, res) => {
  const slug = String(req.query.slug ?? "");
  let restaurantId: number | null = null;
  if (slug) {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slug));
    restaurantId = r?.id ?? null;
  }
  res.json({
    serverOnline: true,
    restaurantId,
    timestamp: new Date().toISOString(),
    syncSupported: true,
  });
});

router.post("/public/offline/sync-orders", async (req, res): Promise<void> => {
  const orders = Array.isArray(req.body.orders) ? req.body.orders : [];
  if (orders.length === 0) {
    res.status(400).json({ error: "orders array required" });
    return;
  }

  const results: SyncOrderResult[] = [];

  for (const entry of orders) {
    const clientId = String(entry.clientId ?? entry.id ?? "");
    const body = entry.body as Record<string, unknown>;
    const err = validateOrderPayload(body);
    if (err) {
      results.push({ clientId, success: false, error: err });
      continue;
    }

    try {
      const items = body.items as { menuItemId?: number; quantity?: number; unitPrice?: number; addons?: unknown[]; customizations?: unknown[]; notes?: string; course?: string }[];
      const subtotal = items.reduce((s, i) => s + (parseFloat(String(i.unitPrice ?? 0)) * (i.quantity ?? 1)), 0);
      const tip = parseFloat(String(body.tipAmount ?? 0));
      const discount = parseFloat(String(body.discountAmount ?? 0));
      const total = Math.max(0, subtotal - discount + tip);

      const [order] = await db.insert(ordersTable).values({
        restaurantId: parseInt(String(body.restaurantId), 10),
        tableId: body.tableId ? parseInt(String(body.tableId), 10) : null,
        tableName: body.tableName ? String(body.tableName) : null,
        customerName: body.customerName ? String(body.customerName) : null,
        customerPhone: body.customerPhone ? String(body.customerPhone) : null,
        customerEmail: body.customerEmail ? String(body.customerEmail) : null,
        type: String(body.type ?? "dine_in"),
        status: "pending",
        items,
        notes: body.notes ? String(body.notes) : null,
        metadata: body.metadata ?? {},
        subtotal: String(subtotal),
        total: String(total),
        tipAmount: String(tip),
        discountAmount: String(discount),
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : "upi",
        scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : null,
      }).returning();

      results.push({ clientId, success: true, orderId: order.id });
    } catch (e: unknown) {
      results.push({ clientId, success: false, error: e instanceof Error ? e.message : "Sync failed" });
    }
  }

  res.json({ ...buildSyncSummary(results), results, syncedAt: new Date().toISOString() });
});

export default router;
