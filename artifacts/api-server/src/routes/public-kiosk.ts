import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db, restaurantsTable, categoriesTable, menuItemsTable, ordersTable,
} from "@workspace/db";
import {
  getKioskCatalog, getKioskConfig, generateTokenNumber, buildKioskBill,
  buildQrPaymentPayload, processNfcTap, tokenStatusLabel,
  type KioskCartItem,
} from "../lib/smartKioskLogic.js";

const router: IRouter = Router();

const kioskSettings: Record<number, Record<string, unknown>> = {};

function kioskStatusFromOrder(status: string): string {
  if (status === "ready" || status === "completed" || status === "delivered") return "ready";
  if (status === "preparing" || status === "accepted" || status === "pending") return "preparing";
  if (status === "cancelled") return "collected";
  return "queued";
}

async function findKioskOrderByToken(tokenNumber: string, restaurantId?: number) {
  const rows = await db.select().from(ordersTable)
    .where(sql`${ordersTable.metadata}->>'tokenNumber' = ${tokenNumber}`)
    .orderBy(desc(ordersTable.createdAt))
    .limit(1);
  const order = rows[0];
  if (!order) return null;
  if (restaurantId && order.restaurantId !== restaurantId) return null;
  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const items = Array.isArray(order.items) ? order.items as KioskCartItem[] : [];
  return {
    tokenNumber: String(meta.tokenNumber ?? tokenNumber),
    orderId: order.id,
    status: kioskStatusFromOrder(order.status),
    items,
    total: parseFloat(String(order.total ?? 0)),
    paymentMethod: order.paymentMethod ?? "upi",
    createdAt: order.createdAt.toISOString(),
    estimatedMinutes: 12,
  };
}

async function loadRestaurant(slugOrId: string) {
  const id = parseInt(slugOrId, 10);
  if (!Number.isNaN(id)) {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
    return r ?? null;
  }
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slugOrId));
  return r ?? null;
}

function getSettings(rid: number) {
  return getKioskConfig(kioskSettings[rid]);
}

router.get("/public/kiosk/catalog", (_req, res) => {
  res.json(getKioskCatalog());
});

router.get("/public/kiosk/config/:slug", async (req, res): Promise<void> => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  res.json({ ...getSettings(restaurant.id), restaurantId: restaurant.id, restaurantName: restaurant.name });
});

router.get("/public/kiosk/menu/:slug", async (req, res): Promise<void> => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const categories = await db.select().from(categoriesTable).where(
    and(eq(categoriesTable.restaurantId, restaurant.id), eq(categoriesTable.isAvailable, true)),
  );
  const items = await db.select().from(menuItemsTable).where(
    and(eq(menuItemsTable.restaurantId, restaurant.id), eq(menuItemsTable.isAvailable, true)),
  );
  const menu = items.map(i => ({
    id: i.id,
    name: i.name,
    price: parseFloat(String(i.discountedPrice ?? i.price ?? 0)),
    category: categories.find(c => c.id === i.categoryId)?.name ?? "Menu",
    description: i.description,
    dietaryTags: i.dietaryTags,
  }));
  res.json({
    restaurant: { id: restaurant.id, name: restaurant.name },
    menu,
    config: getSettings(restaurant.id),
  });
});

router.post("/public/kiosk/nfc-tap", (req, res) => {
  const tagId = String(req.body.tagId ?? "");
  const cart = Array.isArray(req.body.cart) ? req.body.cart as KioskCartItem[] : [];
  const result = processNfcTap(tagId, cart);
  res.json(result);
});

router.post("/public/kiosk/qr-payment", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  const amount = parseFloat(String(req.body.amount ?? 0));
  let upiId = "spicegarden@upi";
  let merchantName = "Restaurant";
  if (restaurantId) {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
    if (r) {
      merchantName = r.name;
      const settings = (typeof r.settings === "object" && r.settings !== null ? r.settings : {}) as Record<string, unknown>;
      upiId = String(settings.upiId ?? upiId);
    }
  }
  res.json(buildQrPaymentPayload(upiId, merchantName, amount));
});

router.post("/public/kiosk/checkout", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  const items = Array.isArray(req.body.items) ? req.body.items as KioskCartItem[] : [];
  const paymentMethod = String(req.body.paymentMethod ?? "upi");
  const tip = parseFloat(String(req.body.tip ?? 0));
  if (!restaurantId || items.length === 0) {
    res.status(400).json({ error: "restaurantId and items required" });
    return;
  }

  const bill = buildKioskBill(items, tip);
  const config = getSettings(restaurantId);
  const tokenNumber = generateTokenNumber(String(config.tokenPrefix ?? "K"));

  const orderItems = items.map(i => ({
    menuItemId: i.menuItemId,
    name: i.name,
    quantity: i.quantity,
    price: i.price,
    unitPrice: i.price,
    course: "main",
  }));

  const [order] = await db.insert(ordersTable).values({
    restaurantId,
    type: "kiosk",
    status: "pending",
    items: orderItems,
    subtotal: String(bill.subtotal),
    total: String(bill.grandTotal),
    tipAmount: String(tip),
    paymentMethod,
    notes: `Kiosk self-checkout · Token ${tokenNumber}`,
    metadata: { kiosk: true, tokenNumber, selfCheckout: true },
  }).returning();

  const token = {
    tokenNumber,
    orderId: order.id,
    status: "queued",
    items,
    total: bill.grandTotal,
    paymentMethod,
    createdAt: new Date().toISOString(),
    estimatedMinutes: 12,
  };

  res.status(201).json({
    ...token,
    bill,
    statusLabel: tokenStatusLabel("queued"),
    message: "Self checkout complete — collect your token",
  });
});

router.get("/public/kiosk/token/:tokenNumber", async (req, res): Promise<void> => {
  const restaurantId = req.query.restaurantId ? parseInt(String(req.query.restaurantId), 10) : undefined;
  const token = await findKioskOrderByToken(req.params.tokenNumber, restaurantId);
  if (!token) {
    res.status(404).json({ error: "Token not found", tokenNumber: req.params.tokenNumber });
    return;
  }
  res.json({ ...token, statusLabel: tokenStatusLabel(token.status) });
});

router.get("/public/kiosk/token-board/:slug", async (req, res): Promise<void> => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

  const orders = await db.select().from(ordersTable)
    .where(and(
      eq(ordersTable.restaurantId, restaurant.id),
      sql`${ordersTable.metadata}->>'kiosk' = 'true'`,
    ))
    .orderBy(desc(ordersTable.createdAt))
    .limit(10);

  const tokens = orders.map(o => {
    const meta = (typeof o.metadata === "object" && o.metadata !== null ? o.metadata : {}) as Record<string, unknown>;
    const items = Array.isArray(o.items) ? o.items as { name?: string; quantity?: number }[] : [];
    const status = kioskStatusFromOrder(o.status);
    return {
      tokenNumber: String(meta.tokenNumber ?? `K-${o.id}`),
      status,
      statusLabel: tokenStatusLabel(status),
      orderSummary: items.map(i => `${i.name}${(i.quantity ?? 1) > 1 ? ` x${i.quantity}` : ""}`).join(", "),
    };
  });

  res.json({ tokens, restaurantName: restaurant.name });
});

export default router;
