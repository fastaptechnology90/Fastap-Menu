import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, restaurantsTable, menuItemsTable } from "@workspace/db";
import {
  getOfflineCatalog, buildSyncSummary, validateOrderPayload, type SyncOrderResult,
} from "../lib/offlineModeLogic.js";
import { priceMenuItem, resolveDiscount, clampTip, round2, taxForOrderItems } from "../lib/order-pricing.js";
import { initialTrackingMetadata } from "../lib/orderTracking.js";
import { broadcastEvent, broadcastOrderEvent } from "../lib/sse.js";

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

/**
 * Offline queue flush. Must not trust the phone's unitPrice / add-on prices — those were
 * previously written straight onto the order row, so a guest who edited a cached cart
 * could sync a ₹1 biryani. Same menu-table pricing as POST /public/orders.
 */
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
      const restaurantId = parseInt(String(body.restaurantId), 10);
      if (!Number.isFinite(restaurantId) || restaurantId <= 0) {
        results.push({ clientId, success: false, error: "Invalid restaurantId" });
        continue;
      }

      const rawItems = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : [];
      const menuItems = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurantId));
      const menuMap = new Map(menuItems.map(m => [m.id, m]));

      let subtotal = 0;
      const orderItems: Record<string, unknown>[] = [];
      let priceError: string | null = null;
      for (const item of rawItems) {
        const menuItemId = Number(item.menuItemId);
        const mi = menuMap.get(menuItemId);
        if (!mi) {
          priceError = `Menu item ${menuItemId} not found`;
          break;
        }
        if (!mi.isAvailable) {
          priceError = `${mi.name} is not available right now`;
          break;
        }
        const quantity = Math.floor(Number(item.quantity ?? 1));
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
          priceError = `Invalid quantity for ${mi.name}`;
          break;
        }
        const { unitPrice, addons, variant } = priceMenuItem(mi, item);
        const lineTotal = round2(unitPrice * quantity);
        subtotal += lineTotal;
        orderItems.push({
          id: mi.id,
          menuItemId: mi.id,
          name: mi.name,
          price: unitPrice,
          quantity,
          variant,
          addons,
          notes: item.notes,
          customizations: item.customizations,
          taxCategory: mi.taxCategory ?? "food",
          course: item.course,
          subtotal: lineTotal,
        });
      }
      if (priceError) {
        results.push({ clientId, success: false, error: priceError });
        continue;
      }
      if (!orderItems.length) {
        results.push({ clientId, success: false, error: "No valid menu items" });
        continue;
      }
      subtotal = round2(subtotal);

      const { discount, appliedCoupon } = await resolveDiscount(restaurantId, body.couponCode, subtotal);
      const taxable = Math.max(0, round2(subtotal - discount));
      const tax = (await taxForOrderItems(restaurantId, orderItems, discount)).tax;
      const tip = clampTip(body.tipAmount, taxable);
      const total = round2(taxable + tax + tip);
      const prepMinutes = Math.min(45, Math.max(15, orderItems.reduce((s, i) => s + (Number(i.quantity) ?? 1) * 5, 10)));

      const [order] = await db.insert(ordersTable).values({
        restaurantId,
        tableId: body.tableId ? parseInt(String(body.tableId), 10) : null,
        tableName: body.tableName ? String(body.tableName) : null,
        customerName: body.customerName ? String(body.customerName) : null,
        customerPhone: body.customerPhone ? String(body.customerPhone) : null,
        customerEmail: body.customerEmail ? String(body.customerEmail) : null,
        type: String(body.type ?? "dine_in"),
        status: "pending",
        items: orderItems,
        notes: body.notes ? String(body.notes) : null,
        metadata: {
          ...(typeof body.metadata === "object" && body.metadata !== null ? body.metadata as object : {}),
          ...initialTrackingMetadata(prepMinutes),
          offlineSync: true,
          clientId,
          appliedCoupon: appliedCoupon ?? undefined,
        },
        subtotal: String(subtotal),
        tax: String(tax),
        total: String(total),
        tipAmount: String(tip),
        discountAmount: String(discount),
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : "cash",
        paymentStatus: "pending",
        scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : null,
        orderSource: "user_web_offline",
      }).returning();

      broadcastEvent("new_order", {
        id: order.id, restaurantId, tableName: order.tableName, total, status: "pending",
      });
      broadcastOrderEvent(order.id, "order_status", {
        id: order.id, status: "pending", tableName: order.tableName,
      });

      results.push({ clientId, success: true, orderId: order.id });
    } catch (e: unknown) {
      results.push({ clientId, success: false, error: e instanceof Error ? e.message : "Sync failed" });
    }
  }

  res.json({ ...buildSyncSummary(results), results, syncedAt: new Date().toISOString() });
});

export default router;
