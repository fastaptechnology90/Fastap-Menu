import { Router, type IRouter } from "express";
import { eq, and, count, sum, desc, gte, lte } from "drizzle-orm";
import { db, restaurantsTable, usersTable, ordersTable, customersTable, inventoryItemsTable, reservationsTable, waiterCallsTable, qrCodesTable, menuViewsTable, platformSettlementsTable, feedbackTable, spaBookingsTable, banquetEventsTable, financeTransactionsTable } from "@workspace/db";
import { CreateRestaurantBody, UpdateRestaurantBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { createRestaurantRateLimit } from "../middlewares/rate-limit.js";
import { getAccessibleRestaurant } from "../lib/restaurant-access.js";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings.js";
import { getPlatformSettingsRaw } from "../lib/platform-admin.js";
import { getPublicIntegrationsConfig } from "../lib/platform-integrations.js";
import {
  resolveAnalyticsAccess,
  sendAnalyticsNotFound,
  emptyDashboardStats,
  isRestaurantPublished,
  getPublicationStatus,
} from "../lib/restaurant-publication.js";
import { isPaidOrder, orderGrossTotal, parseMoney } from "../lib/payment-calculations.js";
import { getSpaRevenue, getSpaRevenueBuckets, getBanquetRevenue, getBanquetRevenueBuckets, getRoomRevenue, getRoomRevenueBuckets } from "../lib/ancillary-revenue.js";
import { getCommissionRate } from "../lib/platform-admin.js";
import {
  deriveOpenCloseFromSchedule,
  extractScheduleHours,
  normalizeClock,
  resolveVenueTimezone,
  type DayHoursRow,
} from "../lib/venue-hours.js";

const router: IRouter = Router();

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await db.select({ id: restaurantsTable.id }).from(restaurantsTable).where(eq(restaurantsTable.slug, slug));
    if (existing.length === 0) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

router.get("/restaurants", requireAuth, async (req, res): Promise<void> => {
  const restaurants = await db.select().from(restaurantsTable).where(eq(restaurantsTable.userId, req.session.userId!));
  res.json(restaurants);
});

router.post("/restaurants", requireAuth, createRestaurantRateLimit, async (req, res): Promise<void> => {
  const parsed = CreateRestaurantBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const slug = await uniqueSlug(slugify(parsed.data.name));
  const [restaurant] = await db.insert(restaurantsTable).values({ ...parsed.data, userId: req.session.userId!, slug }).returning();
  res.status(201).json(restaurant);
});

router.get("/restaurants/:restaurantId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const whiteLabelSettings = await getSettingsSection(id, "whiteLabel", {});
  res.json({
    ...restaurant,
    whiteLabelSettings,
    isPublished: isRestaurantPublished(restaurant),
    publicationStatus: getPublicationStatus(restaurant),
  });
});

router.put("/restaurants/:restaurantId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

  // Staff sessions may only patch JSON settings, not core restaurant fields —
  // EXCEPT owners/managers/franchise, who may also edit the restaurant profile.
  if (req.session.staffSession && !req.session.userId) {
    const body = req.body as Record<string, any>;
    const { whiteLabelSettings, settings } = body;
    if (whiteLabelSettings) await setSettingsSection(id, "whiteLabel", whiteLabelSettings);
    if (settings && typeof settings === "object") {
      await setSettingsSection(id, "appSettings", settings);
    }
    const role = req.session.staffSession.staffRole;
    if (["owner", "manager", "franchise"].includes(role)) {
      // Persist the core profile columns that actually exist on the table. (Not via
      // UpdateRestaurantBody — that requires currency/primaryColor the profile form
      // doesn't send, so validation would fail and drop everything.)
      const core: Record<string, any> = {};
      for (const k of ["name", "address", "phone", "email", "description", "website"]) {
        if (body[k] !== undefined && body[k] !== null) core[k] = body[k];
      }
      if (Object.keys(core).length) {
        await db.update(restaurantsTable).set(core).where(eq(restaurantsTable.id, id));
      }
      // Extra profile fields that aren't restaurant columns → keep them in settings.
      const extras: Record<string, any> = {};
      for (const k of ["branch", "gstNumber", "fssaiNumber", "cuisineType", "totalTables", "totalSeats"]) {
        if (body[k] !== undefined) extras[k] = body[k];
      }
      if (Object.keys(extras).length) {
        const cur = await getSettingsSection(id, "profileExtras", {} as Record<string, unknown>);
        await setSettingsSection(id, "profileExtras", { ...cur, ...extras });
      }
    }
    const updated = await getAccessibleRestaurant(req, id);
    const whiteLabel = await getSettingsSection(id, "whiteLabel", {});
    res.json({ ...updated, whiteLabelSettings: whiteLabel });
    return;
  }

  const parsed = UpdateRestaurantBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [updated] = await db.update(restaurantsTable).set(parsed.data).where(eq(restaurantsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Restaurant not found" }); return; }
  res.json(updated);
});

/**
 * Which alerts a venue wants, and on which channels.
 *
 * The Notification Hub carried twelve toggles and two thresholds that lived only in
 * React state: nothing saved them, nothing read them, and a refresh put them all back.
 * They are now stored against the venue, and the response also says which channels the
 * platform can actually deliver on — a venue turning on SMS when no provider is
 * configured is being sold a switch that does nothing.
 */
const NOTIFICATION_DEFAULTS = {
  orderAlerts: true, stockAlerts: true, paymentAlerts: true, staffAlerts: true,
  reservationAlerts: true, reviewAlerts: true, financeAlerts: false, systemAlerts: false,
  soundEnabled: true, pushEnabled: true, emailEnabled: false, smsEnabled: false,
  orderThreshold: 3, stockThreshold: 20,
};

async function deliverableChannels() {
  try {
    const platform = await getPlatformSettingsRaw();
    const messaging = getPublicIntegrationsConfig(platform.integrations).messaging;
    // Sound and browser push need nothing from the platform; email and SMS need a
    // provider somebody has actually configured.
    return { sound: true, push: true, email: messaging.email, sms: messaging.sms };
  } catch {
    return { sound: true, push: true, email: false, sms: false };
  }
}

router.get("/restaurants/:restaurantId/settings/notifications", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const saved = await getSettingsSection(id, "notificationPrefs", {});
  res.json({
    preferences: { ...NOTIFICATION_DEFAULTS, ...(saved as object) },
    channelsAvailable: await deliverableChannels(),
  });
});

router.put("/restaurants/:restaurantId/settings/notifications", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const current = await getSettingsSection(id, "notificationPrefs", {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...NOTIFICATION_DEFAULTS, ...current };

  // Only the keys this screen owns, and only in the shape they are declared — a
  // settings blob that accepts anything is how a stray field ends up disabling a venue.
  for (const [key, fallback] of Object.entries(NOTIFICATION_DEFAULTS)) {
    if (!(key in body)) continue;
    if (typeof fallback === "boolean") merged[key] = Boolean(body[key]);
    else {
      const n = Number(body[key]);
      if (Number.isFinite(n) && n >= 0 && n <= 10000) merged[key] = Math.round(n);
    }
  }

  await setSettingsSection(id, "notificationPrefs", merged);
  res.json({ preferences: merged, channelsAvailable: await deliverableChannels() });
});

/**
 * How the kitchen display is set up: target times per station, sound, auto-accept.
 *
 * These belonged to the browser tab. A kitchen that set its grill target to 25 minutes
 * lost it on the next refresh, and a venue running two KDS screens had two different
 * sets of targets — so the same ticket went red on one screen and green on the other.
 * They belong to the venue.
 */
const KDS_DEFAULTS = {
  targetTimes: { hot: 18, grill: 22, cold: 8, bar: 5, desserts: 10, expo: 25, all: 20 } as Record<string, number>,
  soundOn: true,
  autoAccept: false,
  priorityMode: false,
};

router.get("/restaurants/:restaurantId/settings/kitchen-display", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const saved = await getSettingsSection(id, "kitchenDisplay", {}) as Record<string, unknown>;
  res.json({
    ...KDS_DEFAULTS,
    ...saved,
    targetTimes: { ...KDS_DEFAULTS.targetTimes, ...((saved.targetTimes ?? {}) as Record<string, number>) },
  });
});

router.put("/restaurants/:restaurantId/settings/kitchen-display", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const saved = await getSettingsSection(id, "kitchenDisplay", {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    ...KDS_DEFAULTS,
    ...saved,
    targetTimes: { ...KDS_DEFAULTS.targetTimes, ...((saved.targetTimes ?? {}) as Record<string, number>) },
  };

  for (const key of ["soundOn", "autoAccept", "priorityMode"]) {
    if (key in body) merged[key] = Boolean(body[key]);
  }
  if (body.targetTimes && typeof body.targetTimes === "object") {
    const times = { ...(merged.targetTimes as Record<string, number>) };
    for (const [station, value] of Object.entries(body.targetTimes as Record<string, unknown>)) {
      const n = Number(value);
      // A target of zero would paint every ticket red the moment it arrived, and one of
      // several hours would never warn at all.
      if (Number.isFinite(n) && n >= 1 && n <= 240) times[station] = Math.round(n);
    }
    merged.targetTimes = times;
  }

  await setSettingsSection(id, "kitchenDisplay", merged);
  res.json(merged);
});

router.get("/restaurants/:restaurantId/settings/white-label", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const whiteLabelSettings = await getSettingsSection(id, "whiteLabel", {});
  res.json({
    restaurant_name: restaurant.name,
    logo_url: restaurant.logoUrl ?? "",
    custom_domain: restaurant.customDomain ?? "",
    ...whiteLabelSettings,
  });
});

/**
 * Operating hours live in appSettings.hours (what the Settings UI edits) AND must stay
 * mirrored onto restaurants.open_time / close_time / timezone — those columns are what
 * guest scan/order gates and day-end already read. Saving hours without syncing left
 * guests stuck on the seed default 11:00–23:00 forever.
 */
function defaultHoursFromColumns(openTime: string | null | undefined, closeTime: string | null | undefined): DayHoursRow[] {
  const from = normalizeClock(openTime) ?? "11:00";
  const to = normalizeClock(closeTime) ?? "23:00";
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => ({
    day,
    open: true,
    from: day === "Sunday" && from === "11:00" ? "12:00" : from,
    to: day === "Sunday" && to === "23:00" ? "21:00" : to,
  }));
}

async function syncTradingHoursColumns(
  restaurantId: number,
  mergedApp: Record<string, unknown>,
  restaurantRow: { timezone?: string | null; settings?: unknown; openTime?: string | null; closeTime?: string | null },
): Promise<void> {
  const patch: { openTime?: string; closeTime?: string; timezone?: string; settings?: Record<string, unknown> } = {};
  const tzBody = typeof mergedApp.timezone === "string" ? mergedApp.timezone.trim() : "";
  if (tzBody) patch.timezone = tzBody;

  const schedule = extractScheduleHours({ appSettings: mergedApp });
  const tz = tzBody || resolveVenueTimezone({
    timezone: restaurantRow.timezone,
    settings: restaurantRow.settings,
  });
  if (schedule) {
    const derived = deriveOpenCloseFromSchedule(schedule, tz);
    if (derived.openTime) patch.openTime = derived.openTime;
    if (derived.closeTime) patch.closeTime = derived.closeTime;
  }

  // Always re-stamp settings.appSettings + timezone so guest readers and columns stay one truth.
  // (Do not require tzBody — hours-only saves must still sync.)
  const root = (restaurantRow.settings && typeof restaurantRow.settings === "object" && !Array.isArray(restaurantRow.settings)
    ? { ...(restaurantRow.settings as Record<string, unknown>) }
    : {}) as Record<string, unknown>;
  if (tzBody) root.timezone = tzBody;
  else if (typeof root.timezone !== "string" || !String(root.timezone).trim()) root.timezone = tz;
  root.appSettings = mergedApp;
  patch.settings = root;

  if (Object.keys(patch).length === 0) return;
  await db.update(restaurantsTable).set(patch).where(eq(restaurantsTable.id, restaurantId));
}

router.get("/restaurants/:restaurantId/settings/app", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const appSettings = await getSettingsSection(id, "appSettings", {}) as Record<string, unknown>;
  const hours = Array.isArray(appSettings.hours) && appSettings.hours.length
    ? appSettings.hours
    : defaultHoursFromColumns(restaurant.openTime, restaurant.closeTime);
  const timezone =
    (typeof appSettings.timezone === "string" && appSettings.timezone.trim())
    || restaurant.timezone
    || "Asia/Kolkata";
  res.json({ ...appSettings, hours, timezone });
});

router.put("/restaurants/:restaurantId/settings/app", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const current = await getSettingsSection(id, "appSettings", {}) as Record<string, unknown>;
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const merged = { ...current, ...body } as Record<string, unknown>;
  if (typeof body.timezone === "string" && body.timezone.trim()) {
    merged.timezone = body.timezone.trim();
  }
  await setSettingsSection(id, "appSettings", merged);
  // Re-read settings after section write (setSettingsSection merges into jsonb).
  const [fresh] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  await syncTradingHoursColumns(id, merged, fresh ?? restaurant);
  const [after] = await db.select({
    openTime: restaurantsTable.openTime,
    closeTime: restaurantsTable.closeTime,
    timezone: restaurantsTable.timezone,
  }).from(restaurantsTable).where(eq(restaurantsTable.id, id));
  res.json({
    ...merged,
    timezone: after?.timezone ?? merged.timezone,
    openTime: after?.openTime ?? null,
    closeTime: after?.closeTime ?? null,
  });
});

/**
 * The venue's tax settings.
 *
 * Its GST rate, GSTIN and legal name had no route at all — they could only be set with a
 * direct database edit — while every bill and every tax invoice is built from them. The
 * liquor rate is new: alcohol sits outside GST in India and carries state excise/VAT
 * instead, at a rate that differs by state, so there is no honest default. Until a venue
 * sets one, alcohol is billed at 0% rather than being swept into GST, because collecting
 * GST on a non-GST supply is what makes a tax invoice a false document.
 */
router.get("/restaurants/:restaurantId/settings/billing", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const billing = await getSettingsSection(id, "billing", {}) as Record<string, unknown>;
  const taxPercent = Number(billing.taxPercent);
  const liquorTaxPercent = Number(billing.liquorTaxPercent);
  res.json({
    gstin: (billing.gstin as string) ?? null,
    legalName: (billing.legalName as string) ?? null,
    address: (billing.address as string) ?? null,
    taxPercent: Number.isFinite(taxPercent) && taxPercent > 0 ? taxPercent : 5,
    taxPercentIsDefault: !(Number.isFinite(taxPercent) && taxPercent > 0),
    liquorTaxPercent: Number.isFinite(liquorTaxPercent) && liquorTaxPercent > 0 ? liquorTaxPercent : 0,
    /** False means alcohol on this menu is currently billed with no excise or VAT at all. */
    liquorTaxConfigured: Number.isFinite(liquorTaxPercent) && liquorTaxPercent > 0,
  });
});

router.put("/restaurants/:restaurantId/settings/billing", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

  const current = await getSettingsSection(id, "billing", {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...current };

  if (req.body.gstin !== undefined) {
    const gstin = String(req.body.gstin ?? "").trim().toUpperCase();
    // A malformed GSTIN on a tax invoice is worse than none: it names a registration that
    // does not exist. Empty clears it, and the invoice then says "not registered for GST".
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      res.status(400).json({ error: "That is not a valid GSTIN. It is 15 characters, e.g. 29AABCT1234M1Z5." });
      return;
    }
    merged.gstin = gstin || null;
  }
  if (req.body.legalName !== undefined) merged.legalName = String(req.body.legalName ?? "").trim() || null;
  if (req.body.address !== undefined) merged.address = String(req.body.address ?? "").trim() || null;

  if (req.body.taxPercent !== undefined) {
    const rate = parseFloat(String(req.body.taxPercent));
    if (!Number.isFinite(rate) || rate < 0 || rate > 40) {
      res.status(400).json({ error: "GST rate must be between 0 and 40 percent." });
      return;
    }
    merged.taxPercent = rate;
  }
  if (req.body.liquorTaxPercent !== undefined) {
    const rate = parseFloat(String(req.body.liquorTaxPercent));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      res.status(400).json({ error: "Liquor excise/VAT must be between 0 and 100 percent." });
      return;
    }
    merged.liquorTaxPercent = rate;
  }

  await setSettingsSection(id, "billing", merged);
  res.json(merged);
});

router.put("/restaurants/:restaurantId/settings/white-label", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  await setSettingsSection(id, "whiteLabel", req.body);
  res.json({ success: true, whiteLabelSettings: req.body });
});

router.delete("/restaurants/:restaurantId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const [deleted] = await db.delete(restaurantsTable).where(and(eq(restaurantsTable.id, id), eq(restaurantsTable.userId, req.session.userId!))).returning();
  if (!deleted) { res.status(404).json({ error: "Restaurant not found" }); return; }
  res.json({ message: "Restaurant deleted" });
});

router.get("/restaurants/:restaurantId/dashboard", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const access = await resolveAnalyticsAccess(req, id);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") {
    res.json(emptyDashboardStats(access.status));
    return;
  }

  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 7);
  const fortnightStart = new Date(today); fortnightStart.setDate(fortnightStart.getDate() - 15);
  const monthStart = new Date(today); monthStart.setDate(1);

  const allOrders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, id)).orderBy(desc(ordersTable.createdAt));
  const orderAt = (o: typeof allOrders[0]) => new Date(o.createdAt);
  // When a bill is COLLECTED we stamp metadata.payment.collectedAt. A bill collected today
  // must count toward today's revenue even if the order was opened on an earlier day — so a
  // period includes anything created OR collected within it.
  const collectedAt = (o: typeof allOrders[0]): Date | null => {
    const c = (o.metadata as any)?.payment?.collectedAt;
    if (!c) return null;
    const d = new Date(c);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const inPeriod = (o: typeof allOrders[0], since: Date) => {
    const col = collectedAt(o);
    return orderAt(o) >= since || (col != null && col >= since);
  };
  const todayOrders = allOrders.filter(o => inPeriod(o, today));
  const weekOrders = allOrders.filter(o => inPeriod(o, weekStart));
  const fortnightOrders = allOrders.filter(o => inPeriod(o, fortnightStart));
  const monthOrders = allOrders.filter(o => inPeriod(o, monthStart));
  // Revenue counts only PAID / in-flight orders (excludes cancelled/refunded/failed) — the
  // same rule the super-admin panel uses, so one restaurant shows one consistent number.
  const sumTotal = (list: typeof allOrders) => Math.round(list.filter(isPaidOrder).reduce((s, o) => s + orderGrossTotal(o), 0) * 100) / 100;

  const activeOrders = allOrders.filter(o => ["pending", "confirmed", "preparing", "ready"].includes(o.status));
  const paidToday = todayOrders.filter(isPaidOrder);
  const cancelledOrders = allOrders.filter(o => o.status === "cancelled");
  const byType = (type: string) => allOrders.filter(o => o.type === type).length;

  const customers = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.restaurantId, id));
  const vipCustomers = await db.select({ count: count() }).from(customersTable).where(and(eq(customersTable.restaurantId, id), eq(customersTable.segment, "vip")));
  const loyaltyCustomers = await db.select({ count: count() }).from(customersTable).where(and(eq(customersTable.restaurantId, id), gte(customersTable.loyaltyPoints, 500)));

  const inventory = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.restaurantId, id));
  const lowStockItems = inventory.filter(i => parseFloat(String(i.currentStock || 0)) <= parseFloat(String(i.minStock || 0))).length;

  const pendingReservations = await db.select({ count: count() }).from(reservationsTable).where(
    and(eq(reservationsTable.restaurantId, id), eq(reservationsTable.status, "confirmed")),
  );
  const activeWaiterCalls = await db.select({ count: count() }).from(waiterCallsTable).where(
    and(eq(waiterCallsTable.restaurantId, id), eq(waiterCallsTable.isResolved, false)),
  );
  const [totalScansRow] = await db.select({ total: sum(qrCodesTable.scans) }).from(qrCodesTable).where(eq(qrCodesTable.restaurantId, id));
  // The QR counter on the code row is a lifetime tally with no dates on it, so it can
  // never answer "today". Menu views carry a timestamp, which can.
  const [scansTodayRow] = await db.select({ count: count() }).from(menuViewsTable)
    .where(and(eq(menuViewsTable.restaurantId, id), gte(menuViewsTable.viewedAt, today)));

  const feedbackRows = await db.select({ rating: feedbackTable.rating }).from(feedbackTable).where(eq(feedbackTable.restaurantId, id));
  const avgRating = feedbackRows.length ? feedbackRows.reduce((s, f) => s + f.rating, 0) / feedbackRows.length : 0;

  const ONLINE_METHODS = new Set(["upi", "card", "netbanking", "wallet", "online", "razorpay", "gateway"]);
  let totalOnlineSales = 0;
  let refundAmount = 0;
  for (const o of allOrders) {
    if (o.paymentStatus === "refunded") refundAmount += parseFloat(String(o.total || 0));
    // Kitchen "completed" is not revenue — only paymentStatus paid (isPaidOrder).
    else if (isPaidOrder(o)) {
      const method = (o.paymentMethod || "cash").toLowerCase();
      if (ONLINE_METHODS.has(method)) totalOnlineSales += parseFloat(String(o.total || 0));
    }
  }
  // The owner's wallet used to net off a 2% fee while the platform charged whatever the
  // commission rule said, and then held back 15% of the result as "pending settlement" —
  // a fraction with nothing behind it. The fee is now the rate the platform actually
  // applies, refunds come off in full rather than at half, and what is pending is the
  // sum of this venue's unreleased settlements.
  const commissionRate = (await getCommissionRate()) / 100;
  const onlineBalance = Math.round(totalOnlineSales * (1 - commissionRate) - refundAmount);
  const settlementRows = await db.select({ finalPayout: platformSettlementsTable.finalPayout, status: platformSettlementsTable.status })
    .from(platformSettlementsTable).where(eq(platformSettlementsTable.restaurantId, id));
  const pendingSettlement = Math.round(settlementRows
    .filter(r => String(r.status ?? "").toLowerCase() !== "released")
    .reduce((t, r) => t + (parseFloat(String(r.finalPayout ?? 0)) || 0), 0));

  // Fold every other revenue stream into the same buckets so the owner's total is
  // the whole business, not just restaurant orders: spa, hotel rooms (rent + bar /
  // minibar / room-service billed to the folio) and banquet advances. Rooms and
  // banquet were missing entirely — a hotel could take ₹4,000 at checkout and the
  // dashboard would still read ₹0.
  const buckets = [today, weekStart, fortnightStart, monthStart];
  const [spaB, roomB, banquetB] = await Promise.all([
    getSpaRevenueBuckets(id, buckets),
    getRoomRevenueBuckets(id, buckets),
    getBanquetRevenueBuckets(id, buckets),
  ]);
  const [spaToday, spaWeek, spaFortnight, spaMonth] = spaB;
  const extra = (i: number) => roomB[i] + banquetB[i];
  const r2 = (n: number) => Math.round(n * 100) / 100;

  res.json({
    isPublished: true,
    publicationStatus: "Published",
    todayOrders: todayOrders.length,
    weekOrders: weekOrders.length,
    fortnightOrders: fortnightOrders.length,
    monthOrders: monthOrders.length,
    todayRevenue: r2(sumTotal(todayOrders) + spaToday + extra(0)),
    weekRevenue: r2(sumTotal(weekOrders) + spaWeek + extra(1)),
    fortnightRevenue: r2(sumTotal(fortnightOrders) + spaFortnight + extra(2)),
    monthRevenue: r2(sumTotal(monthOrders) + spaMonth + extra(3)),
    netRevenue: r2(sumTotal(monthOrders) + spaMonth + extra(3)),
    grossRevenue: r2(sumTotal(monthOrders) + spaMonth + extra(3)),
    spaRevenueMonth: spaMonth,
    roomRevenueMonth: roomB[3],
    banquetRevenueMonth: banquetB[3],
    activeOrders: activeOrders.length,
    cancelledOrders: cancelledOrders.length,
    totalCustomers: customers[0]?.count ?? 0,
    vipCustomers: vipCustomers[0]?.count ?? 0,
    loyaltyCustomers: loyaltyCustomers[0]?.count ?? 0,
    // Average order value divided PAID revenue by EVERY order raised today, unpaid ones
    // included — so an open table dragged the average down as if it were a free meal.
    avgOrderValue: paidToday.length ? r2(sumTotal(todayOrders) / paidToday.length) : 0,
    avgRating: parseFloat(avgRating.toFixed(1)),
    qrScansToday: scansTodayRow?.count ?? 0,
    qrScansTotal: parseInt(String(totalScansRow?.total ?? 0)),
    pendingReservations: pendingReservations[0]?.count ?? 0,
    lowStockItems,
    activeWaiterCalls: activeWaiterCalls[0]?.count ?? 0,
    walletBalance: onlineBalance,
    pendingSettlements: pendingSettlement,
    ordersByType: {
      dine_in: byType("dine_in"),
      takeaway: byType("takeaway"),
      delivery: byType("delivery"),
      room_service: byType("room_service"),
    },
    recentOrders: allOrders.slice(0, 10).map(o => ({
      ...o,
      items: Array.isArray(o.items) ? o.items : [],
    })),
  });
});

// Custom-date revenue for a restaurant panel — same PAID rule as everywhere else, so any
// panel (owner / cashier / finance / cash-counter) can show revenue for any day or range.
router.get("/restaurants/:restaurantId/revenue", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const access = await resolveAnalyticsAccess(req, id);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json({ from: null, to: null, revenue: 0, totalOrders: 0 }); return; }

  // Parse YYYY-MM-DD as a LOCAL midnight (not UTC) so day boundaries line up with the
  // server's clock and with collectedAt comparisons — avoids a timezone off-by-one.
  const parseDay = (v: unknown): Date | null => {
    if (typeof v !== "string" || !v) return null;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const from = parseDay(req.query.from);
  const toRaw = parseDay(req.query.to);
  const toEnd = toRaw ? new Date(toRaw.getFullYear(), toRaw.getMonth(), toRaw.getDate(), 23, 59, 59, 999) : null;

  // Fetch all of the restaurant's orders and filter in JS so a bill COLLECTED in the range
  // counts even if the order was opened earlier (metadata.payment.collectedAt). This is what
  // makes "today's collection" reflect money actually taken today.
  const rows = await db.select({ total: ordersTable.total, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status, createdAt: ordersTable.createdAt, metadata: ordersTable.metadata })
    .from(ordersTable).where(eq(ordersTable.restaurantId, id));
  const inRange = (o: typeof rows[0]) => {
    const created = new Date(o.createdAt);
    const colRaw = (o.metadata as any)?.payment?.collectedAt;
    const collected = colRaw ? new Date(colRaw) : null;
    const okFrom = (d: Date | null) => d != null && (!from || d >= from) && (!toEnd || d <= toEnd);
    return okFrom(created) || (collected != null && !Number.isNaN(collected.getTime()) && okFrom(collected));
  };
  const paid = rows.filter(o => isPaidOrder(o) && inRange(o));
  const orderRevenue = Math.round(paid.reduce((s, o) => s + orderGrossTotal(o), 0) * 100) / 100;
  const spaRevenue = await getSpaRevenue(id, from, toEnd);   // spa folded into the total
  const banquetRevenue = await getBanquetRevenue(id, from, toEnd); // events & banquet advance
  // Hotel rooms (rent + bar / minibar / room-service billed to the folio) belong in
  // the same total — leaving them out made this widget disagree with the dashboard.
  const roomRevenue = await getRoomRevenue(id, from, toEnd);
  res.json({
    from: from ? from.toISOString().slice(0, 10) : null,
    to: toRaw ? toRaw.toISOString().slice(0, 10) : null,
    revenue: Math.round((orderRevenue + spaRevenue + banquetRevenue + roomRevenue) * 100) / 100,
    orderRevenue,
    spaRevenue,
    banquetRevenue,
    roomRevenue,
    totalOrders: paid.length,
  });
});

// Full revenue breakdown for the owner — how much came from which panel/source, which
// order type, and which payment method. Uses the SAME paid-order rule + spa fold as
// /revenue, so every section sums to the same grand total (no mismatch).
router.get("/restaurants/:restaurantId/revenue-breakdown", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const access = await resolveAnalyticsAccess(req, id);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json({ from: null, to: null, total: 0, orderRevenue: 0, spaRevenue: 0, totalOrders: 0, bySource: [], byType: [], byMethod: [] }); return; }

  const parseDay = (v: unknown): Date | null => {
    if (typeof v !== "string" || !v) return null;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const from = parseDay(req.query.from);
  const toRaw = parseDay(req.query.to);
  const toEnd = toRaw ? new Date(toRaw.getFullYear(), toRaw.getMonth(), toRaw.getDate(), 23, 59, 59, 999) : null;

  const rows = await db.select({ id: ordersTable.id, invoiceNumber: ordersTable.invoiceNumber, tableName: ordersTable.tableName, customerName: ordersTable.customerName, total: ordersTable.total, subtotal: ordersTable.subtotal, tax: ordersTable.tax, tipAmount: ordersTable.tipAmount, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status, type: ordersTable.type, paymentMethod: ordersTable.paymentMethod, createdAt: ordersTable.createdAt, metadata: ordersTable.metadata })
    .from(ordersTable).where(eq(ordersTable.restaurantId, id));
  const inRange = (o: typeof rows[0]) => {
    const created = new Date(o.createdAt);
    const colRaw = (o.metadata as any)?.payment?.collectedAt;
    const collected = colRaw ? new Date(colRaw) : null;
    const okFrom = (d: Date | null) => d != null && (!from || d >= from) && (!toEnd || d <= toEnd);
    return okFrom(created) || (collected != null && !Number.isNaN(collected.getTime()) && okFrom(collected));
  };
  const paid = rows.filter(o => isPaidOrder(o) && inRange(o));

  const round = (n: number) => Math.round(n * 100) / 100;
  const orderRevenue = round(paid.reduce((s, o) => s + orderGrossTotal(o), 0));
  const spaRevenue = await getSpaRevenue(id, from, toEnd);
  const banquetRevenue = await getBanquetRevenue(id, from, toEnd);
  const roomRevenue = await getRoomRevenue(id, from, toEnd);

  // Which panel a given order type belongs to
  const sourceOf = (t: string | null | undefined): string => {
    const x = String(t || "").toLowerCase();
    if (x.includes("room")) return "Room Service";
    if (x.includes("bar")) return "Bar";
    if (x.includes("take") || x.includes("pickup")) return "Takeaway";
    if (x.includes("deliver")) return "Delivery";
    if (x.includes("banquet") || x.includes("event")) return "Events & Banquet";
    return "Restaurant / POS";
  };
  const methodOf = (o: typeof rows[0]): string => {
    const m = String((o.metadata as any)?.payment?.method || o.paymentMethod || "cash").toLowerCase();
    if (m.includes("upi")) return "UPI";
    if (m.includes("card")) return "Card";
    if (m.includes("cash")) return "Cash";
    if (m.includes("wallet")) return "Wallet";
    if (m.includes("room") || m.includes("bill")) return "Room bill";
    return m ? m.charAt(0).toUpperCase() + m.slice(1) : "Other";
  };

  const accumulate = (keyFn: (o: typeof rows[0]) => string) => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const o of paid) {
      const k = keyFn(o);
      const cur = map.get(k) || { amount: 0, count: 0 };
      cur.amount += orderGrossTotal(o); cur.count += 1;
      map.set(k, cur);
    }
    return map;
  };

  // Who collected a payment. If no staff is recorded, an online method (UPI/Card/Wallet)
  // means the guest paid directly → "Online / Guest"; otherwise it's genuinely unrecorded.
  const collectorLabel = (collectedBy: unknown, method: string): string => {
    const c = String(collectedBy || "").trim();
    if (c) return c;
    return (method === "UPI" || method === "Card" || method === "Wallet") ? "Online / Guest" : "Not recorded";
  };
  const collectorOf = (o: typeof rows[0]): string => collectorLabel((o.metadata as any)?.payment?.collectedBy, methodOf(o));

  const sourceMap = accumulate(o => sourceOf(o.type));
  const typeMap = accumulate(o => String(o.type || "dine_in"));
  const bySource = [...sourceMap.entries()].map(([label, v]) => ({ label, amount: round(v.amount), count: v.count }));
  if (spaRevenue > 0) bySource.push({ label: "Spa", amount: round(spaRevenue), count: 0 });
  if (banquetRevenue > 0) bySource.push({ label: "Events & Banquet", amount: round(banquetRevenue), count: 0 });
  if (roomRevenue > 0) bySource.push({ label: "Hotel / Rooms", amount: round(roomRevenue), count: 0 });
  bySource.sort((a, b) => b.amount - a.amount);

  const byType = [...typeMap.entries()].map(([type, v]) => ({ type, amount: round(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount);

  // Individual payments for drill-down — orders + spa + banquet, so EVERY panel's sales
  // (cashier/POS, room service, spa, bar, events) are visible with who collected each.
  const inDateRange = (raw: unknown) => { const d = new Date(String(raw)); return !Number.isNaN(d.getTime()) && (!from || d >= from) && (!toEnd || d <= toEnd); };
  const orderPayments = paid.map(o => ({
    id: `o-${o.id}`, orderNumber: o.invoiceNumber || `#${o.id}`,
    source: sourceOf(o.type), type: String(o.type || "dine_in"),
    method: methodOf(o), collector: collectorOf(o),
    amount: round(orderGrossTotal(o)),
    tableName: o.tableName || null, customerName: o.customerName || null,
    upiId: (o.metadata as any)?.payment?.upiId || null, utr: (o.metadata as any)?.payment?.utr || null,
    at: String((o.metadata as any)?.payment?.collectedAt || o.createdAt),
  }));

  // Same rule as spa revenue: only what the guest actually paid for.
  const spaPaid = (r: { status?: string | null; paymentStatus?: string | null }) =>
    String(r.status ?? "").toLowerCase() !== "cancelled"
    && ["paid", "success"].includes(String(r.paymentStatus ?? "").toLowerCase());
  const spaRows = await db.select({ id: spaBookingsTable.id, serviceName: spaBookingsTable.serviceName, guestName: spaBookingsTable.guestName, price: spaBookingsTable.price, status: spaBookingsTable.status, paymentStatus: spaBookingsTable.paymentStatus, createdAt: spaBookingsTable.createdAt, metadata: spaBookingsTable.metadata })
    .from(spaBookingsTable).where(eq(spaBookingsTable.restaurantId, id));
  const spaPayments = spaRows.filter(s => spaPaid(s) && inDateRange(s.createdAt)).map(s => {
    const pay = (s.metadata as any)?.payment ?? {};
    return {
      id: `s-${s.id}`, orderNumber: `SPA-${s.id}`, source: "Spa", type: "spa",
      method: pay.method ? String(pay.method).toUpperCase() : "—",
      collector: collectorLabel(pay.collectedBy, pay.method ? String(pay.method).toUpperCase() : "—"),
      amount: round(parseMoney(s.price)),
      tableName: null, customerName: s.guestName || s.serviceName || null,
      upiId: pay.upiId || null, utr: pay.utr || null, at: String(pay.collectedAt || s.createdAt),
    };
  });

  const banquetRows = await db.select({ id: banquetEventsTable.id, name: banquetEventsTable.name, advancePaid: banquetEventsTable.advancePaid, status: banquetEventsTable.status, createdAt: banquetEventsTable.createdAt })
    .from(banquetEventsTable).where(eq(banquetEventsTable.restaurantId, id));
  const banquetPayments = banquetRows.filter(b => String(b.status ?? "").toLowerCase() !== "cancelled" && parseMoney(b.advancePaid) > 0 && inDateRange(b.createdAt)).map(b => ({
    id: `b-${b.id}`, orderNumber: `EVT-${b.id}`, source: "Events & Banquet", type: "banquet",
    method: "Advance", collector: "Events desk",
    amount: round(parseMoney(b.advancePaid)),
    tableName: null, customerName: b.name || null, upiId: null, utr: null, at: String(b.createdAt),
  }));

  // Hotel room collections come from the finance ledger, where every folio payment
  // (room rent + bar / minibar / room service billed to the room) is booked.
  const roomRows = await db.select({ id: financeTransactionsTable.id, amount: financeTransactionsTable.amount, description: financeTransactionsTable.description, paymentMethod: financeTransactionsTable.paymentMethod, performedBy: financeTransactionsTable.performedBy, createdAt: financeTransactionsTable.createdAt })
    .from(financeTransactionsTable)
    .where(and(
      eq(financeTransactionsTable.restaurantId, id),
      eq(financeTransactionsTable.type, "income"),
      eq(financeTransactionsTable.category, "room_folio_payment"),
    ));
  const roomPayments = roomRows.filter(r => inDateRange(r.createdAt)).map(r => ({
    id: `r-${r.id}`, orderNumber: `ROOM-${r.id}`, source: "Hotel / Rooms", type: "room",
    method: (r.paymentMethod || "cash").replace(/^./, c => c.toUpperCase()),
    collector: r.performedBy || "Reception",
    amount: round(parseMoney(r.amount)),
    tableName: null, customerName: r.description || null, upiId: null, utr: null,
    at: String(r.createdAt),
  }));

  const payments = [...orderPayments, ...spaPayments, ...banquetPayments, ...roomPayments].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // Collected-by + payment-method from ALL payments (orders + spa + banquet), so every
  // method and every collector used anywhere in the restaurant is shown.
  const collAll = new Map<string, { amount: number; count: number }>();
  const methAll = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    const c = collAll.get(p.collector) || { amount: 0, count: 0 }; c.amount += p.amount; c.count += 1; collAll.set(p.collector, c);
    const m = methAll.get(p.method) || { amount: 0, count: 0 }; m.amount += p.amount; m.count += 1; methAll.set(p.method, m);
  }
  const byCollector = [...collAll.entries()].map(([collector, v]) => ({ collector, amount: round(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount);
  const byMethod = [...methAll.entries()].map(([method, v]) => ({ method, amount: round(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount);

  res.json({
    from: from ? from.toISOString().slice(0, 10) : null,
    to: toRaw ? toRaw.toISOString().slice(0, 10) : null,
    total: round(orderRevenue + spaRevenue + banquetRevenue + roomRevenue),
    orderRevenue,
    spaRevenue,
    banquetRevenue,
    roomRevenue,
    totalOrders: paid.length,
    bySource,
    byType,
    byMethod,
    byCollector,
    payments,
  });
});

export default router;
