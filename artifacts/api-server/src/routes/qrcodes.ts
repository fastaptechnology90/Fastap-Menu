import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, qrCodesTable, restaurantsTable, tablesMapTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { buildScanUrl } from "../lib/scan-urls.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/qrcodes", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const codes = await db.select().from(qrCodesTable).where(eq(qrCodesTable.restaurantId, restaurantId));
  res.json(codes);
});

router.post("/restaurants/:restaurantId/qrcodes", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { label, type, tableId, roomNumber } = req.body;
  const normalizedType = String(type ?? "").trim();
  const normalizedRoom = String(roomNumber ?? (normalizedType === "room" ? label ?? "" : "")).trim();
  const [restaurant] = await db.select({ slug: restaurantsTable.slug }).from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant?.slug) { res.status(404).json({ error: "Restaurant not found" }); return; }

  let tableName: string | undefined;
  if (tableId) {
    const [table] = await db.select({ name: tablesMapTable.name }).from(tablesMapTable).where(
      and(eq(tablesMapTable.id, parseInt(String(tableId), 10)), eq(tablesMapTable.restaurantId, restaurantId)),
    );
    tableName = table?.name;
  }

  if (normalizedType === "room" && !normalizedRoom) {
    res.status(400).json({ error: "roomNumber is required for room QR codes" });
    return;
  }

  const url = normalizedRoom
    ? buildScanUrl(restaurant.slug, { room: normalizedRoom, entry: "room_qr" })
    : tableName
      ? buildScanUrl(restaurant.slug, { table: tableName, entry: "qr" })
      : buildScanUrl(restaurant.slug, { entry: "qr" });

  const [code] = await db.insert(qrCodesTable).values({
    restaurantId,
    tableId: tableId ?? null,
    label: label ?? tableName ?? normalizedRoom ?? "QR",
    type: normalizedType || (normalizedRoom ? "room" : "table"),
    url,
  }).returning();
  res.status(201).json(code);
});

router.delete("/restaurants/:restaurantId/qrcodes/:qrCodeId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const qrCodeId = parseInt(req.params.qrCodeId, 10);
  const [deleted] = await db.delete(qrCodesTable).where(and(eq(qrCodesTable.id, qrCodeId), eq(qrCodesTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "QR code not found" }); return; }
  res.json({ message: "QR code deleted" });
});

export default router;
