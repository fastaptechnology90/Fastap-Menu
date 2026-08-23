import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, hotelRoomsTable, DEFAULT_ROOM_CONTROLS } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";
import { getOfflineCatalog } from "../lib/offlineModeLogic.js";
import { getLocaleCatalog } from "../lib/localeAccessibilityLogic.js";
import { parseMoney } from "../lib/payment-calculations.js";
import { mergeRoomBilling } from "../lib/hotel-folio.js";
import crypto from "crypto";

const router: IRouter = Router();

const DEFAULT_AGGREGATORS = [
  { id: "swiggy", name: "Swiggy", enabled: false, syncMode: "orders_menu", lastSync: null, status: "disconnected" },
  { id: "zomato", name: "Zomato", enabled: false, syncMode: "orders_menu", lastSync: null, status: "disconnected" },
  { id: "ondc", name: "ONDC", enabled: false, syncMode: "catalog_only", lastSync: null, status: "disconnected" },
];

const DEFAULT_OFFLINE = {
  offlinePosEnabled: true,
  offlineOrderingEnabled: true,
  autoSyncEnabled: true,
  syncIntervalMinutes: 5,
  pendingOrders: 0,
  lastSyncAt: null as string | null,
  lowBandwidthMode: false,
};

const DEFAULT_SANDBOX = {
  enabled: false,
  demoPayments: true,
  testUpi: true,
  testCard: true,
  trialRestaurantSlug: "spice-garden",
  environment: "production" as "production" | "sandbox",
};

const DEFAULT_ACCESSIBILITY = {
  defaultLanguage: "en",
  enabledLanguages: ["en", "hi"],
  largeTextDefault: false,
  highContrastDefault: false,
  voiceMenuDefault: false,
  screenReaderHints: true,
};

const DEFAULT_COMMUNICATIONS: { id: string; type: string; subject: string; message: string; channel: string; target: string; status: string; sentAt: string; recipients: number }[] = [];

function apiKeyForRestaurant(rid: number) {
  const hash = crypto.createHash("sha256").update(`fastap-${rid}-platform`).digest("hex");
  return `fm_live_${hash.slice(0, 24)}`;
}

router.get("/restaurants/:restaurantId/platform/offline", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const stored = await getSettingsSection(rid, "offlineAdmin", DEFAULT_OFFLINE);
  res.json({ ...DEFAULT_OFFLINE, ...stored, catalog: getOfflineCatalog() });
});

router.put("/restaurants/:restaurantId/platform/offline", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const current = await getSettingsSection(rid, "offlineAdmin", DEFAULT_OFFLINE);
  const merged = { ...current, ...req.body, catalog: undefined };
  await setSettingsSection(rid, "offlineAdmin", merged);
  res.json(merged);
});

router.post("/restaurants/:restaurantId/platform/offline/sync", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const current = await getSettingsSection(rid, "offlineAdmin", DEFAULT_OFFLINE);
  const merged = { ...current, lastSyncAt: new Date().toISOString(), pendingOrders: 0 };
  await setSettingsSection(rid, "offlineAdmin", merged);
  res.json({ success: true, synced: true, ...merged });
});

router.get("/restaurants/:restaurantId/platform/communications", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const history = await getSettingsSection(rid, "communications", DEFAULT_COMMUNICATIONS);
  res.json({ history, channels: ["push", "email", "sms", "whatsapp", "internal"] });
});

router.post("/restaurants/:restaurantId/platform/communications/broadcast", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const { title, message, channel, target } = req.body;
  if (!title || !message) { res.status(400).json({ error: "title and message required" }); return; }
  const history = await getSettingsSection(rid, "communications", DEFAULT_COMMUNICATIONS);
  const entry = {
    id: `BC${Date.now()}`,
    type: "broadcast",
    subject: title,
    message,
    channel: channel || "internal",
    target: target || "all-staff",
    status: "sent",
    sentAt: new Date().toISOString(),
    recipients: target === "all-staff" ? 12 : 4,
  };
  history.unshift(entry);
  await setSettingsSection(rid, "communications", history.slice(0, 50));
  res.status(201).json(entry);
});

router.get("/restaurants/:restaurantId/platform/aggregators", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const stored = await getSettingsSection<Record<string, unknown>>(rid, "aggregators", {});
  const list = DEFAULT_AGGREGATORS.map(a => ({
    ...a,
    ...(typeof stored[a.id] === "object" && stored[a.id] !== null ? stored[a.id] as object : {}),
  }));
  res.json(list);
});

router.put("/restaurants/:restaurantId/platform/aggregators/:aggregatorId", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const id = req.params.aggregatorId;
  const current = await getSettingsSection<Record<string, unknown>>(rid, "aggregators", {});
  current[id] = { ...(typeof current[id] === "object" ? current[id] as object : {}), ...req.body, id };
  if (req.body.enabled && !current[id].lastSync) {
    (current[id] as Record<string, unknown>).lastSync = new Date().toISOString();
    (current[id] as Record<string, unknown>).status = "syncing";
  }
  await setSettingsSection(rid, "aggregators", current);
  res.json(current[id]);
});

router.post("/restaurants/:restaurantId/platform/aggregators/:aggregatorId/sync", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const id = req.params.aggregatorId;
  const current = await getSettingsSection<Record<string, unknown>>(rid, "aggregators", {});
  const entry = {
    ...(typeof current[id] === "object" ? current[id] as object : { id }),
    lastSync: new Date().toISOString(),
    status: "connected",
  };
  current[id] = entry;
  await setSettingsSection(rid, "aggregators", current);
  res.json({ success: true, aggregator: entry, syncedAt: entry.lastSync });
});

// ── External order ingest (Swiggy / Zomato / ONDC) ───────────────────────────
// The real aggregator POS API POSTs an incoming order here; it becomes a normal
// order so the kitchen app, order management and finance all pick it up. Until the
// partner API keys are wired, the admin UI can call this to simulate an incoming order.
router.post("/restaurants/:restaurantId/platform/aggregators/:aggregatorId/ingest-order", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const source = req.params.aggregatorId; // swiggy | zomato | ondc
  const { customerName, customerPhone, items, total, notes } = req.body;
  const list = Array.isArray(items) ? items : [];
  const orderItems = list.map((i: any, idx: number) => {
    const qty = Number(i.qty ?? i.quantity ?? 1) || 1;
    const price = parseMoney(i.price);
    return { id: idx + 1, name: i.name ?? "Item", price, quantity: qty, subtotal: price * qty };
  });
  const computed = orderItems.reduce((s, i) => s + i.subtotal, 0);
  const totalNum = total != null && total !== "" ? parseMoney(total) : computed;
  const [order] = await db.insert(ordersTable).values({
    restaurantId: rid, tableName: `${source.toUpperCase()} Order`,
    customerName: customerName ?? `${source} customer`, customerPhone: customerPhone ?? null,
    type: "delivery", status: "pending",
    items: orderItems.length ? orderItems : [{ id: 1, name: notes || "Aggregator order", price: totalNum, quantity: 1, subtotal: totalNum }],
    subtotal: String(totalNum.toFixed(2)), tax: "0.00", total: String(totalNum.toFixed(2)),
    notes: notes ?? null, paymentMethod: "aggregator", paymentStatus: "paid",
    orderSource: source,
    metadata: { aggregator: source, external: true },
  }).returning();
  res.status(201).json({ ingested: true, source, order });
});

// ── OTA booking ingest (MakeMyTrip / Goibibo / OYO) ───────────────────────────
// The real channel-manager API POSTs an online booking here; a vacant room is
// auto-allotted and the guest checked in. The admin UI can call this to simulate one.
router.post("/restaurants/:restaurantId/platform/ota/:provider/ingest-booking", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const provider = req.params.provider; // makemytrip | goibibo | oyo | booking
  const { guestName, guestPhone, roomType, checkIn, checkOut, rate } = req.body;
  const rooms = await db.select().from(hotelRoomsTable).where(eq(hotelRoomsTable.restaurantId, rid));
  const vacant = rooms.find(r => r.status === "vacant" && (!roomType || r.type === roomType))
    || rooms.find(r => r.status === "vacant");
  if (!vacant) { res.status(409).json({ error: "No vacant room available for auto-allotment" }); return; }
  const [room] = await db.update(hotelRoomsTable).set({
    status: "occupied",
    guestName: guestName ?? `${provider} guest`,
    guestPhone: guestPhone ?? null,
    checkIn: checkIn ? new Date(checkIn) : new Date(),
    checkOut: checkOut ? new Date(checkOut) : null,
    roomControls: mergeRoomBilling(vacant.roomControls ?? DEFAULT_ROOM_CONTROLS, { rate: parseMoney(rate) }),
  }).where(eq(hotelRoomsTable.id, vacant.id)).returning();
  res.status(201).json({ ingested: true, provider, allottedRoom: room.number, room });
});

// ── Custom module packages / rate cards (events, spa/bar, housekeeping …) ──────
// Lets a restaurant define its own named packages with a price (e.g. a "Birthday
// Party" event package, a spa combo, a housekeeping plan). Stored per module in the
// restaurant settings — no new table needed.
router.get("/restaurants/:restaurantId/module-packages/:module", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const store = await getSettingsSection<Record<string, any[]>>(rid, "modulePackages", {});
  res.json(Array.isArray(store[req.params.module]) ? store[req.params.module] : []);
});

router.post("/restaurants/:restaurantId/module-packages/:module", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const mod = req.params.module;
  const { name, price, description, duration } = req.body ?? {};
  if (!name || String(name).trim() === "") { res.status(400).json({ error: "name is required" }); return; }
  const store = await getSettingsSection<Record<string, any[]>>(rid, "modulePackages", {});
  const list = Array.isArray(store[mod]) ? store[mod] : [];
  const pkg = {
    id: `PKG-${Date.now()}`,
    name: String(name).trim(),
    price: Number(price) || 0,
    description: description ?? "",
    duration: duration ?? null,
    createdAt: new Date().toISOString(),
  };
  store[mod] = [pkg, ...list];
  await setSettingsSection(rid, "modulePackages", store);
  res.status(201).json(pkg);
});

router.delete("/restaurants/:restaurantId/module-packages/:module/:pkgId", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const mod = req.params.module;
  const store = await getSettingsSection<Record<string, any[]>>(rid, "modulePackages", {});
  store[mod] = (Array.isArray(store[mod]) ? store[mod] : []).filter((p: any) => p.id !== req.params.pkgId);
  await setSettingsSection(rid, "modulePackages", store);
  res.json({ ok: true });
});

router.get("/restaurants/:restaurantId/platform/sandbox", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const stored = await getSettingsSection(rid, "sandbox", DEFAULT_SANDBOX);
  res.json({ ...DEFAULT_SANDBOX, ...stored });
});

router.put("/restaurants/:restaurantId/platform/sandbox", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const current = await getSettingsSection(rid, "sandbox", DEFAULT_SANDBOX);
  const merged = { ...current, ...req.body };
  await setSettingsSection(rid, "sandbox", merged);
  res.json(merged);
});

router.get("/restaurants/:restaurantId/platform/accessibility", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const stored = await getSettingsSection(rid, "accessibilityAdmin", DEFAULT_ACCESSIBILITY);
  res.json({ ...DEFAULT_ACCESSIBILITY, ...stored, catalog: getLocaleCatalog() });
});

router.put("/restaurants/:restaurantId/platform/accessibility", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const current = await getSettingsSection(rid, "accessibilityAdmin", DEFAULT_ACCESSIBILITY);
  const merged = { ...current, ...req.body, catalog: undefined };
  await setSettingsSection(rid, "accessibilityAdmin", merged);
  res.json(merged);
});

router.get("/restaurants/:restaurantId/platform/api-keys", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const stored = await getSettingsSection(rid, "apiPlatform", { keyCreatedAt: null as string | null });
  res.json({
    endpoints: [
      { id: "pos", label: "POS API", path: "/api/orders", methods: ["GET", "POST", "PATCH"] },
      { id: "payments", label: "Payments API", path: "/api/public/payments", methods: ["POST"] },
      { id: "menu", label: "Menu API", path: "/api/public/menu/:slug", methods: ["GET"] },
      { id: "webhooks", label: "Webhooks", path: "/api/webhooks", methods: ["POST"] },
    ],
    apiKey: apiKeyForRestaurant(rid),
    keyCreatedAt: stored.keyCreatedAt || new Date().toISOString(),
    rateLimit: "1000 req/min",
  });
});

router.post("/restaurants/:restaurantId/platform/api-keys/regenerate", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const key = `fm_live_${crypto.randomBytes(16).toString("hex")}`;
  await setSettingsSection(rid, "apiPlatform", { apiKey: key, keyCreatedAt: new Date().toISOString() });
  res.json({ apiKey: key, keyCreatedAt: new Date().toISOString() });
});

export default router;
