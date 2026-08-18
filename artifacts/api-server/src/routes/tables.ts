import { Router, type IRouter } from "express";
import { eq, and, inArray, sql, or } from "drizzle-orm";
import { db, tablesMapTable, ordersTable, tableAreasTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const ACTIVE_ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "served", "billing"];

type OrderItem = { name?: string; quantity?: number };

function summarizeItems(items: unknown): { preview: string; count: number } {
  if (!Array.isArray(items) || items.length === 0) return { preview: "", count: 0 };
  const first = items[0] as OrderItem;
  const preview = first.name ?? "Order";
  return { preview, count: items.length };
}

async function enrichTables(restaurantId: number, tables: (typeof tablesMapTable.$inferSelect)[]) {
  if (tables.length === 0) return [];

  const tableIds = tables.map(t => t.id);
  const linkedOrderIds = tables.map(t => t.currentOrderId).filter((id): id is number => id != null);

  const activeOrders = await db.select().from(ordersTable).where(
    and(
      eq(ordersTable.restaurantId, restaurantId),
      or(
        linkedOrderIds.length > 0 ? inArray(ordersTable.id, linkedOrderIds) : sql`false`,
        and(
          inArray(ordersTable.tableId, tableIds),
          inArray(ordersTable.status, ACTIVE_ORDER_STATUSES),
        ),
      ),
    ),
  );

  const byId = new Map(activeOrders.map(o => [o.id, o]));
  const byTableId = new Map<number, typeof activeOrders[0]>();
  for (const o of activeOrders) {
    if (o.tableId != null && !byTableId.has(o.tableId)) byTableId.set(o.tableId, o);
  }

  return tables.map(table => {
    const order = (table.currentOrderId ? byId.get(table.currentOrderId) : null) ?? byTableId.get(table.id) ?? null;
    const items = summarizeItems(order?.items);
    return {
      ...table,
      activeOrder: order ? {
        id: order.id,
        customerName: order.customerName ?? table.currentCustomerName,
        total: order.total,
        subtotal: order.subtotal,
        status: order.status,
        guestCount: order.guestCount,
        waiterName: order.waiterName ?? table.currentWaiterName,
        itemsPreview: items.preview,
        itemCount: items.count,
        createdAt: order.createdAt,
      } : table.currentCustomerName ? {
        id: null,
        customerName: table.currentCustomerName,
        total: null,
        subtotal: null,
        status: table.status,
        guestCount: table.currentGuestCount,
        waiterName: table.currentWaiterName,
        itemsPreview: "",
        itemCount: 0,
        createdAt: table.occupiedSince,
      } : null,
    };
  });
}

router.get("/restaurants/:restaurantId/tables", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const tables = await db.select().from(tablesMapTable).where(eq(tablesMapTable.restaurantId, id));
  res.json(await enrichTables(id, tables));
});

router.get("/restaurants/:restaurantId/tables/summary", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const tables = await db.select().from(tablesMapTable).where(and(eq(tablesMapTable.restaurantId, id), eq(tablesMapTable.isActive, true)));
  const counts: Record<string, number> = {};
  for (const t of tables) counts[t.status] = (counts[t.status] ?? 0) + 1;
  res.json({ total: tables.length, counts });
});

router.get("/restaurants/:restaurantId/tables/zones", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const rows = await db.selectDistinct({ zone: tablesMapTable.zone }).from(tablesMapTable)
    .where(and(eq(tablesMapTable.restaurantId, id), sql`${tablesMapTable.zone} IS NOT NULL`));
  res.json(rows.map(r => r.zone).filter(Boolean));
});

router.get("/restaurants/:restaurantId/table-areas", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const areas = await db.select().from(tableAreasTable)
    .where(eq(tableAreasTable.restaurantId, id))
    .orderBy(tableAreasTable.sortOrder);
  res.json(areas);
});

router.post("/restaurants/:restaurantId/table-areas", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, areaType, description, colorCode, sortOrder, layoutConfig } = req.body;
  const [area] = await db.insert(tableAreasTable).values({
    restaurantId: id,
    name,
    areaType: areaType ?? "indoor",
    description: description ?? null,
    colorCode: colorCode ?? null,
    sortOrder: sortOrder ?? 0,
    layoutConfig: layoutConfig ?? {},
  }).returning();
  res.status(201).json(area);
});

router.post("/restaurants/:restaurantId/tables", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, branchId, zone, capacity, isActive, isVip, colorCode, areaId, positionX, positionY, notes, tableType, tableCategory } = req.body;
  // Building the QR menu URL below calls name.toLowerCase(). With no name that
  // threw before the database was ever reached — a 500 on the first thing every
  // new restaurant does. Say what is missing instead.
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Table name is required" });
    return;
  }
  const menuUrl = `${process.env.PUBLIC_URL || ""}/menu/table-${name.toLowerCase().replace(/\s+/g, "-")}`;
  const [table] = await db.insert(tablesMapTable).values({
    restaurantId: id, name, branchId, zone, capacity: capacity ?? 4,
    tableType: tableType ?? "4_seater",
    tableCategory: tableCategory ?? "restaurant",
    qrCodeUrl: menuUrl, isActive: isActive ?? true,
    isVip: isVip ?? false, colorCode: colorCode ?? null,
    areaId: areaId ?? null, positionX: positionX ?? null, positionY: positionY ?? null,
    notes: notes ?? null,
    status: "free",
  }).returning();
  res.status(201).json(table);
});

router.put("/restaurants/:restaurantId/tables/:tableId", requireAuth, async (req, res): Promise<void> => {
  const tableId = parseInt(req.params.tableId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, branchId, zone, capacity, isActive, isVip, colorCode, areaId, positionX, positionY, notes } = req.body;
  const [table] = await db.update(tablesMapTable)
    .set({ name, branchId, zone, capacity, isActive, isVip, colorCode, areaId, positionX, positionY, notes })
    .where(and(eq(tablesMapTable.id, tableId), eq(tablesMapTable.restaurantId, restaurantId)))
    .returning();
  if (!table) { res.status(404).json({ error: "Table not found" }); return; }
  const [enriched] = await enrichTables(restaurantId, [table]);
  res.json(enriched);
});

router.patch("/restaurants/:restaurantId/tables/:tableId/status", requireAuth, async (req, res): Promise<void> => {
  const tableId = parseInt(req.params.tableId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, currentGuestCount, currentWaiterName, currentCustomerName, isVip, notes, reservedUntil, reservationId } = req.body;

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (currentGuestCount !== undefined) updateData.currentGuestCount = currentGuestCount;
  if (currentWaiterName !== undefined) updateData.currentWaiterName = currentWaiterName;
  if (currentCustomerName !== undefined) updateData.currentCustomerName = currentCustomerName;
  if (isVip !== undefined) updateData.isVip = isVip;
  if (notes !== undefined) updateData.notes = notes;
  if (reservedUntil !== undefined) updateData.reservedUntil = reservedUntil ? new Date(reservedUntil) : null;
  if (reservationId !== undefined) updateData.reservationId = reservationId;

  if (status === "occupied" && !updateData.occupiedSince) {
    updateData.occupiedSince = new Date();
  } else if (status === "free" || status === "cleaning") {
    updateData.occupiedSince = null;
    updateData.currentGuestCount = 0;
    updateData.currentWaiterName = null;
    updateData.currentCustomerName = null;
    updateData.currentOrderId = null;
  } else if (status === "reserved") {
    updateData.occupiedSince = null;
  }

  const [table] = await db.update(tablesMapTable)
    .set(updateData)
    .where(and(eq(tablesMapTable.id, tableId), eq(tablesMapTable.restaurantId, restaurantId)))
    .returning();
  if (!table) { res.status(404).json({ error: "Table not found" }); return; }
  const [enriched] = await enrichTables(restaurantId, [table]);
  res.json(enriched);
});

router.post("/restaurants/:restaurantId/tables/merge", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { primaryId, secondaryIds } = req.body as { primaryId: number; secondaryIds: number[] };
  if (!primaryId || !Array.isArray(secondaryIds) || secondaryIds.length === 0) {
    res.status(400).json({ error: "primaryId and secondaryIds[] required" }); return;
  }
  const [primary] = await db.select().from(tablesMapTable)
    .where(and(eq(tablesMapTable.id, primaryId), eq(tablesMapTable.restaurantId, restaurantId)));
  if (!primary) { res.status(404).json({ error: "Primary table not found" }); return; }

  const secondaries = await db.select().from(tablesMapTable)
    .where(and(inArray(tablesMapTable.id, secondaryIds), eq(tablesMapTable.restaurantId, restaurantId)));

  const totalCapacity = primary.capacity + secondaries.reduce((s, t) => s + t.capacity, 0);
  const mergedName = [primary.name, ...secondaries.map(t => t.name)].join("+");

  await db.update(tablesMapTable).set({ mergedInto: primaryId, status: "blocked", isActive: false })
    .where(inArray(tablesMapTable.id, secondaryIds));
  const [updated] = await db.update(tablesMapTable)
    .set({ name: mergedName, capacity: totalCapacity })
    .where(eq(tablesMapTable.id, primaryId))
    .returning();
  res.json({ merged: updated, hidden: secondaryIds });
});

router.post("/restaurants/:restaurantId/tables/:tableId/unmerge", requireAuth, async (req, res): Promise<void> => {
  const tableId = parseInt(req.params.tableId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  await db.update(tablesMapTable)
    .set({ mergedInto: null, status: "free", isActive: true })
    .where(and(eq(tablesMapTable.mergedInto, tableId), eq(tablesMapTable.restaurantId, restaurantId)));
  const original = await db.select().from(tablesMapTable).where(eq(tablesMapTable.id, tableId));
  if (original[0]) {
    const originalName = original[0].name.split("+")[0];
    await db.update(tablesMapTable).set({ name: originalName }).where(eq(tablesMapTable.id, tableId));
  }
  res.json({ success: true });
});

router.delete("/restaurants/:restaurantId/tables/:tableId", requireAuth, async (req, res): Promise<void> => {
  const tableId = parseInt(req.params.tableId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [deleted] = await db.delete(tablesMapTable)
    .where(and(eq(tablesMapTable.id, tableId), eq(tablesMapTable.restaurantId, restaurantId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Table not found" }); return; }
  res.json({ message: "Table deleted" });
});

export default router;
