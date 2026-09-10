import { and, asc, eq } from "drizzle-orm";
import {
  db,
  menuItemsTable,
  ordersTable,
  tablesMapTable,
} from "@workspace/db";
import {
  computeBasketTax,
  priceMenuItem,
  round2,
  taxRatesFor,
} from "../order-pricing.js";
import { consumeStockForOrder } from "../stock-consumption.js";
import { initialTrackingMetadata } from "../orderTracking.js";
import { broadcastEvent, broadcastOrderEvent } from "../sse.js";
import type { MobileSession } from "./session.js";

const TAKE_ORDER_ROLES = new Set([
  "waiter",
  "headChef",
  "kitchenManager",
  "sousChef",
]);

export function canTakeOrder(role: string): boolean {
  return TAKE_ORDER_ROLES.has(role);
}

/** Floor tables the waiter can seat an order at. */
export async function listWaiterTables(restaurantId: number) {
  const rows = await db
    .select({
      id: tablesMapTable.id,
      name: tablesMapTable.name,
      zone: tablesMapTable.zone,
      capacity: tablesMapTable.capacity,
      status: tablesMapTable.status,
      tableCategory: tablesMapTable.tableCategory,
    })
    .from(tablesMapTable)
    .where(
      and(
        eq(tablesMapTable.restaurantId, restaurantId),
        eq(tablesMapTable.isActive, true),
      ),
    )
    .orderBy(asc(tablesMapTable.name));

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    zone: t.zone ?? "Floor",
    capacity: t.capacity,
    status: t.status,
    // Display-only hint; ordering still works on occupied tables (running tab).
    isRoom: String(t.tableCategory ?? "").toLowerCase().includes("room")
      || /^room\b/i.test(t.name),
  }));
}

/** Available menu lines for the take-order picker (display prices from DB). */
export async function listWaiterMenu(restaurantId: number) {
  const rows = await db
    .select({
      id: menuItemsTable.id,
      name: menuItemsTable.name,
      description: menuItemsTable.description,
      price: menuItemsTable.price,
      discountedPrice: menuItemsTable.discountedPrice,
      categoryId: menuItemsTable.categoryId,
      isAvailable: menuItemsTable.isAvailable,
      taxCategory: menuItemsTable.taxCategory,
      variants: menuItemsTable.variants,
      addons: menuItemsTable.addons,
    })
    .from(menuItemsTable)
    .where(eq(menuItemsTable.restaurantId, restaurantId))
    .orderBy(asc(menuItemsTable.sortOrder), asc(menuItemsTable.name));

  return rows
    .filter((m) => m.isAvailable)
    .map((m) => {
      const unit = parseFloat(String(m.discountedPrice ?? m.price)) || 0;
      const rawVariants = Array.isArray(m.variants) ? m.variants : [];
      const variants = rawVariants
        .map((v) => {
          if (typeof v === "string") {
            const name = v.trim();
            return name ? { name, displayPrice: null as number | null } : null;
          }
          if (v && typeof v === "object") {
            const name = String((v as { name?: unknown }).name ?? "").trim();
            if (!name) return null;
            const p = parseFloat(String((v as { price?: unknown }).price ?? ""));
            return {
              name,
              displayPrice: Number.isFinite(p) && p > 0 ? round2(p) : null,
            };
          }
          return null;
        })
        .filter((v): v is { name: string; displayPrice: number | null } => v != null);

      const rawAddons = Array.isArray(m.addons) ? m.addons : [];
      const addons = rawAddons
        .map((a) => {
          if (!a || typeof a !== "object") return null;
          const name = String((a as { name?: unknown }).name ?? "").trim();
          if (!name) return null;
          const p = parseFloat(String((a as { price?: unknown }).price ?? "0")) || 0;
          return { name, displayPrice: round2(p) };
        })
        .filter((a): a is { name: string; displayPrice: number } => a != null);

      return {
        id: m.id,
        name: m.name,
        description: m.description ?? "",
        // Display only — placeWaiterOrder never trusts client unit prices.
        displayPrice: round2(unit),
        categoryId: m.categoryId,
        taxCategory: m.taxCategory ?? "food",
        variants,
        addons,
      };
    });
}

type LineInput = {
  menuItemId: number;
  quantity: number;
  notes?: string;
  /** Size / variant name from the menu — priced on the server. */
  variant?: string;
  /** Addon names from the menu — priced on the server (client prices ignored). */
  addons?: { name: string }[] | string[];
};

/**
 * Staff take-order: same money rules as guest POST /public/orders.
 * Client may only send menuItemId + quantity (+ optional notes).
 */
export async function placeWaiterOrder(
  session: MobileSession,
  body: {
    tableId?: number;
    tableName?: string;
    items?: LineInput[];
    notes?: string;
    guestCount?: number;
  },
) {
  if (!canTakeOrder(session.user.role)) {
    throw new Error("FORBIDDEN: Your role cannot place table orders");
  }

  const restaurantId = session.restaurantId;
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    throw new Error("MISSING_FIELDS: Add at least one menu item");
  }

  let tableId =
    typeof body.tableId === "number" && Number.isFinite(body.tableId)
      ? body.tableId
      : null;
  let tableName =
    typeof body.tableName === "string" && body.tableName.trim()
      ? body.tableName.trim()
      : null;

  if (tableId != null) {
    const [table] = await db
      .select()
      .from(tablesMapTable)
      .where(
        and(
          eq(tablesMapTable.id, tableId),
          eq(tablesMapTable.restaurantId, restaurantId),
          eq(tablesMapTable.isActive, true),
        ),
      )
      .limit(1);
    if (!table) throw new Error("TABLE_NOT_FOUND");
    tableName = table.name;
  } else if (tableName) {
    const [table] = await db
      .select()
      .from(tablesMapTable)
      .where(
        and(
          eq(tablesMapTable.restaurantId, restaurantId),
          eq(tablesMapTable.name, tableName),
          eq(tablesMapTable.isActive, true),
        ),
      )
      .limit(1);
    if (!table) throw new Error("TABLE_NOT_FOUND");
    tableId = table.id;
  } else {
    throw new Error("MISSING_FIELDS: Pick a table");
  }

  const menuItems = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.restaurantId, restaurantId));
  const menuMap = new Map(menuItems.map((m) => [m.id, m]));

  let subtotal = 0;
  const orderItems: Record<string, unknown>[] = [];
  for (const line of rawItems) {
    const menuItemId = Number(line.menuItemId);
    const mi = menuMap.get(menuItemId);
    if (!mi) throw new Error(`MENU_ITEM_NOT_FOUND: ${menuItemId}`);
    if (!mi.isAvailable) {
      throw new Error(`UNAVAILABLE: ${mi.name} is not available right now`);
    }
    const quantity = Math.floor(Number(line.quantity));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error(`INVALID_QUANTITY: Invalid quantity for ${mi.name}`);
    }
    // Server prices only — ignore any client unitPrice/total fields.
    // Variant + addon *names* are choices; money still comes from priceMenuItem.
    const addonNames = Array.isArray(line.addons)
      ? line.addons
          .map((a) => (typeof a === "string" ? a : String(a?.name ?? "")).trim())
          .filter(Boolean)
          .map((name) => ({ name }))
      : [];
    const requested = {
      variant: typeof line.variant === "string" ? line.variant.trim() : "",
      addons: addonNames,
    };
    const { unitPrice, addons, variant } = priceMenuItem(mi, requested);
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
      notes: typeof line.notes === "string" ? line.notes : undefined,
      taxCategory: mi.taxCategory ?? "food",
      subtotal: lineTotal,
    });
  }
  subtotal = round2(subtotal);

  const taxBreakdown = computeBasketTax(
    orderItems.map((i) => ({
      amount: Number(i.subtotal) || 0,
      taxCategory: String(i.taxCategory ?? "food"),
    })),
    await taxRatesFor(restaurantId),
    0,
  );
  const tax = taxBreakdown.tax;
  const total = round2(subtotal + tax);
  const guestCount = Math.max(1, Math.min(50, Math.floor(Number(body.guestCount) || 1)));
  const prepMinutes = Math.min(
    45,
    Math.max(15, orderItems.reduce((s, i) => s + (Number(i.quantity) || 1) * 5, 10)),
  );
  const trackingMeta = initialTrackingMetadata(prepMinutes);
  const waiterName = session.user.name;

  const [placed] = await db
    .insert(ordersTable)
    .values({
      restaurantId,
      tableId,
      tableName,
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      type: "dine_in",
      status: "pending",
      items: orderItems,
      subtotal: String(subtotal.toFixed(2)),
      tax: String(tax),
      total: String(total.toFixed(2)),
      notes: typeof body.notes === "string" ? body.notes : null,
      deliveryAddress: null,
      paymentMethod: null,
      paymentStatus: "pending",
      tipAmount: "0.00",
      discountAmount: "0.00",
      guestCount,
      waiterName,
      orderSource: "waiter_app",
      metadata: {
        ...trackingMeta,
        placedByStaffId: session.staffId,
        placedByStaffName: waiterName,
        billing: { tax: taxBreakdown },
      },
    })
    .returning();

  for (const line of orderItems) {
    const id = Number(line.menuItemId);
    const qty = Number(line.quantity) || 0;
    const mi = menuMap.get(id);
    if (mi && qty > 0) {
      await db
        .update(menuItemsTable)
        .set({ orderCount: mi.orderCount + qty })
        .where(eq(menuItemsTable.id, id));
    }
  }

  await consumeStockForOrder(
    restaurantId,
    placed.id,
    orderItems.map((i) => ({
      name: String(i.name),
      quantity: Number(i.quantity) || 1,
    })),
  );

  if (tableId != null) {
    await db
      .update(tablesMapTable)
      .set({
        status: "occupied",
        currentOrderId: placed.id,
        currentWaiterName: waiterName,
        currentGuestCount: guestCount,
        occupiedSince: new Date(),
      })
      .where(
        and(
          eq(tablesMapTable.id, tableId),
          eq(tablesMapTable.restaurantId, restaurantId),
        ),
      );
  }

  broadcastEvent("new_order", {
    id: placed.id,
    restaurantId,
    tableName,
    total,
    status: "pending",
    type: "dine_in",
    source: "waiter_app",
  });
  broadcastOrderEvent(placed.id, "order_status", {
    id: placed.id,
    status: "pending",
    tableName,
  });

  return {
    id: `ORD-${placed.id}`,
    orderId: placed.id,
    tableName: placed.tableName,
    status: placed.status,
    subtotal,
    tax,
    total,
    itemCount: orderItems.length,
    waiterName,
    message: `Order placed for ${tableName}`,
  };
}
