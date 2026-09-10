import { Router, type IRouter, type Request } from "express";
import { eq, and, desc, or, sql, gte, ne, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { logger } from "../lib/logger.js";
import {
  db,
  restaurantsTable,
  branchesTable,
  tableAreasTable,
  tablesMapTable,
  ordersTable,
  customersTable,
  guestUsersTable,
  guestSessionsTable,
  walletTransactionsTable,
  promoCodesTable,
  supportTicketsTable,
  roomServiceRequestsTable,
  hotelRoomsTable,
  housekeepingTasksTable,
  maintenanceRequestsTable,
  loyaltyProgramsTable,
  loyaltyTransactionsTable,
  staffTable,
  waiterCallsTable,
  menuItemsTable,
} from "@workspace/db";
import {
  ACCESS_METHODS,
  detectAccessMethod,
  detectLanguage,
  detectServiceMode,
  detectTimezone,
  generateSessionToken,
  generateShareCode,
  getDeviceId,
  groupAreasByCategory,
  type EntryQuery,
} from "../lib/smart-entry.js";
import { buildTrackingSnapshot, type OrderTrackingMetadata } from "../lib/orderTracking.js";
import { addOrderSSEClient, broadcastEvent, broadcastOrderEvent } from "../lib/sse.js";
import {
  autoAssignHousekeepingTask,
  autoAssignMaintenanceRequest,
  autoAssignRoomServiceRequest,
} from "../lib/staff-auto-assignment.js";
import { normalizeBuckets, totalBalance } from "../lib/customerWalletLogic.js";
import { resolveVenueSlug, isDemoVenue } from "../lib/demo-venue.js";
import { tierFromPoints, normalizeRewardsMeta } from "../lib/loyaltyMembershipLogic.js";
import {
  parseDeviceInfo, recordDeviceLogin, removeDevice, trustDevice, markAlertsRead,
  socialEmailForProvider, GUEST_TYPES, type GuestType,
} from "../lib/guestAuthLogic.js";
import { getPlatformSettingsRaw } from "../lib/platform-admin.js";
import { otpSendRateLimit, otpVerifyRateLimit } from "../middlewares/rate-limit.js";
import { getPublicIntegrationsConfig } from "../lib/platform-integrations.js";
import { canAccessGuestVenue, getPublicationStatus, guestVenueAccessError } from "../lib/restaurant-publication.js";
import { priceMenuItem, taxRateFor } from "../lib/order-pricing.js";
import { venueHours, closedResponse, ordersAllowed, publicHoursPayload } from "../lib/venue-hours.js";
import { loadOwnedOrder } from "../lib/guest-order-access.js";
import { callerIsInRoom } from "../lib/guest-room-access.js";
import { generateOtp } from "../lib/mobile-kitchen/staff-tokens.js";
import { sendOtpSms, smsCredentialsPresent } from "../lib/sms-delivery.js";

const router: IRouter = Router();

const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function parseNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? fallback));
  return Number.isNaN(n) ? fallback : n;
}

function tierFromSpend(spend: number, points: number): string {
  return tierFromPoints(points, spend);
}

async function getGuestUser(req: Request) {
  const guestUserId = req.session.guestUserId;
  if (!guestUserId) return null;
  const [user] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId));
  return user ?? null;
}

async function profileForGuest(guest: typeof guestUsersTable.$inferSelect, restaurantId?: number) {
  let customerSpend = 0;
  let customerOrders = 0;
  let loyaltyPoints = parseInt(guest.loyaltyPoints || "0", 10);
  let isVip = false;
  let segment = "new";
  if (restaurantId && (guest.phone || guest.email)) {
    const [customer] = await db.select().from(customersTable).where(
      and(eq(customersTable.restaurantId, restaurantId), or(
        guest.phone ? eq(customersTable.phone, guest.phone) : sql`false`,
        guest.email ? eq(customersTable.email, guest.email) : sql`false`,
      )),
    );
    if (customer) {
      customerSpend = parseNum(customer.totalSpend);
      customerOrders = customer.totalOrders;
      loyaltyPoints = Math.max(loyaltyPoints, customer.loyaltyPoints);
      isVip = customer.isVip;
      segment = customer.segment ?? "new";
    }
  }
  const balances = normalizeBuckets(guest);
  const rewardsMeta = normalizeRewardsMeta(guest.rewardsMeta);
  const deviceInfo = parseDeviceInfo(guest.deviceInfo);
  const guestType = deviceInfo.guestType ?? (isVip ? "vip" : guest.isGuest ? "regular" : "membership");
  return {
    id: String(guest.id),
    name: guest.name || "Guest",
    mobile: guest.phone || "",
    email: guest.email || undefined,
    avatar: guest.avatar || undefined,
    tier: tierFromSpend(customerSpend, loyaltyPoints) as "silver" | "gold" | "platinum" | "diamond" | "vip-elite",
    points: loyaltyPoints,
    walletBalance: parseNum(balances.main),
    cashbackBalance: parseNum(balances.cashback),
    walletBalances: balances,
    walletTotal: totalBalance(balances),
    diningCredits: rewardsMeta.diningCredits,
    birthday: guest.birthday ?? undefined,
    anniversary: guest.anniversary ?? undefined,
    totalOrders: customerOrders,
    isGuest: guest.isGuest,
    language: guest.language,
    loginProvider: guest.loginProvider,
    guestType,
    guestTypeLabel: GUEST_TYPES.find(g => g.id === guestType)?.label ?? "Guest",
    segment,
    deviceCount: deviceInfo.devices?.length ?? 0,
    unreadAlerts: (deviceInfo.loginAlerts ?? []).filter(a => !a.read).length,
    security: deviceInfo.security ?? { sessionTimeoutMinutes: 30, fraudProtection: true, loginAlertsEnabled: true },
  };
}

async function trackGuestDevice(req: Request, guestId: number) {
  const deviceId = getDeviceId(req.headers as Record<string, string | string[] | undefined>);
  const ua = String(req.headers["user-agent"] ?? "unknown");
  const ip = req.ip;
  const [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestId));
  if (!guest) return;
  const { deviceInfo } = recordDeviceLogin(guest.deviceInfo, deviceId, ua, ip);
  await db.update(guestUsersTable).set({ deviceInfo, lastLoginAt: new Date() }).where(eq(guestUsersTable.id, guestId));
}

// ─── Venue context & smart entry ───────────────────────────────────
router.get("/public/venues", async (_req, res): Promise<void> => {
  // Guests must never see a list of every restaurant on the platform — that would leak
  // each onboarded venue's name to anyone (a privacy breach the client flagged). A guest
  // always reaches THEIR venue directly by QR slug (/public/scan/:slug, /public/venue/:slug).
  // This endpoint therefore returns only the single public demo venue.
  const demoSlug = process.env.DEMO_VENUE_SLUG ?? "spice-garden";
  const rows = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, demoSlug));
  const venues = rows
    .filter(canAccessGuestVenue)
    .map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      businessType: r.businessType,
      publicationStatus: getPublicationStatus(r),
    }));
  res.json({ venues });
});

/**
 * Just the open/closed state, nothing else.
 *
 * `GET /public/venue/:slug` already returns `hours`, but it is a heavy call — it reads
 * branches, areas and tables and opens a guest session row — so the guest web fetches it
 * once, when the screen mounts. That made the venue's own opening hours a snapshot taken
 * at load: an owner could change the times in Settings → Operating Hours and the phone
 * sitting on the table would keep saying "Open until 23:00" until somebody reloaded it,
 * and a menu left open past closing time never noticed it had closed.
 *
 * This is the endpoint the guest screens poll instead. Same payload as the `hours` key on
 * the full venue response, so nothing has to learn a second shape.
 */
router.get("/public/venue/:slug/hours", async (req, res): Promise<void> => {
  const slug = resolveVenueSlug(req.params.slug);
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slug));
  if (!restaurant) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }
  if (!canAccessGuestVenue(restaurant)) {
    res.status(403).json({ error: guestVenueAccessError(getPublicationStatus(restaurant)) });
    return;
  }
  res.json({ hours: publicHoursPayload(restaurant) });
});

router.get("/public/venue/:slug", async (req, res): Promise<void> => {
  const slug = resolveVenueSlug(req.params.slug);
  const q = req.query as EntryQuery;
  const tableParam = q.table;
  const roomParam = q.room;
  const sectionParam = q.section;
  const branchParam = q.branch;
  const langParam = detectLanguage(q, req.headers["accept-language"] as string | undefined);

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slug));
  if (!restaurant) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }
  if (!canAccessGuestVenue(restaurant)) {
    res.status(403).json({ error: guestVenueAccessError(getPublicationStatus(restaurant)) });
    return;
  }

  const [branches, areas, tables] = await Promise.all([
    db.select().from(branchesTable).where(eq(branchesTable.restaurantId, restaurant.id)),
    db.select().from(tableAreasTable).where(and(eq(tableAreasTable.restaurantId, restaurant.id), eq(tableAreasTable.isActive, true))),
    db.select().from(tablesMapTable).where(eq(tablesMapTable.restaurantId, restaurant.id)),
  ]);

  const accessMethod = detectAccessMethod(q, req.headers as Record<string, string | string[] | undefined>);
  const serviceMode = detectServiceMode(q, accessMethod);
  const timezone = detectTimezone((restaurant.settings as { timezone?: string } | null)?.timezone);

  let detectedBranch = branchParam
    ? branches.find(b => b.name === branchParam || String(b.id) === branchParam)
    : branches[0] ?? null;

  let detectedTable = tableParam ? tables.find(t => t.name === tableParam || String(t.id) === tableParam) : null;
  let detectedRoom = null;
  if (roomParam) {
    const [room] = await db.select().from(hotelRoomsTable).where(
      and(eq(hotelRoomsTable.restaurantId, restaurant.id), eq(hotelRoomsTable.number, roomParam)),
    );
    detectedRoom = room ?? null;
  }

  const detectedSection = sectionParam
    ? areas.find(a => a.name.toLowerCase().includes(sectionParam.toLowerCase()) || String(a.id) === sectionParam)
    : detectedTable?.zone
      ? areas.find(a => a.name === detectedTable!.zone)
      : q.zone
        ? areas.find(a => a.name.toLowerCase().includes(String(q.zone).replace(/_/g, " ")))
        : areas[0] ?? null;

  if (detectedTable?.zone && !detectedBranch) {
    detectedBranch = branches[0] ?? null;
  }

  const tableStatuses = ["free", "occupied", "reserved", "cleaning", "billing", "waiting_food", "maintenance", "vip_occupied", "blocked", "under_service"];
  const statusCounts = Object.fromEntries(tableStatuses.map(s => [s, tables.filter(t => t.status === s).length]));

  req.session.restaurantId = restaurant.id;

  const sessionToken = req.session.guestSessionToken ?? generateSessionToken();
  req.session.guestSessionToken = sessionToken;

  let guestSession: typeof guestSessionsTable.$inferSelect | null = null;
  try {
    const existingToken = q.session || req.session.guestSessionToken;
    if (existingToken) {
      const [found] = await db.select().from(guestSessionsTable).where(eq(guestSessionsTable.token, existingToken));
      if (found?.isActive) {
        guestSession = found;
        req.session.guestSessionId = found.id;
        await db.update(guestSessionsTable).set({ lastSeenAt: new Date() }).where(eq(guestSessionsTable.id, found.id));
      }
    }

    if (!guestSession) {
      const shareCode = generateShareCode();
      const deviceId = getDeviceId();
      const [created] = await db.insert(guestSessionsTable).values({
        token: sessionToken,
        shareCode,
        restaurantId: restaurant.id,
        sessionType: q.share ? "table_share" : detectedTable ? "shared_table" : "personal",
        tableId: detectedTable?.id ?? null,
        tableName: detectedTable?.name ?? tableParam ?? null,
        roomNumber: detectedRoom?.number ?? roomParam ?? null,
        sectionName: detectedSection?.name ?? null,
        entryMethod: accessMethod,
        serviceMode,
        language: langParam,
        timezone,
        branchId: detectedBranch?.id ?? null,
        deviceIds: [deviceId],
        memberCount: 1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }).returning();
      guestSession = created;
      req.session.guestSessionId = created.id;
    }
  } catch {
    guestSession = {
      token: sessionToken,
      shareCode: generateShareCode(),
      sessionType: detectedTable ? "shared_table" : "personal",
      memberCount: 1,
    } as typeof guestSessionsTable.$inferSelect;
  }

  const areaGroups = groupAreasByCategory(areas.map(a => ({
    ...a,
    layoutConfig: a.layoutConfig,
  })));

  res.json({
    restaurant,
    hours: publicHoursPayload(restaurant),
    // Said out loud rather than inferred. The guest web used to decide "is this the
    // demo?" by inspecting the slug in the URL and the saved scan context — so a
    // visitor who had scanned a real venue earlier in the same browser opened the
    // demo link with ordering switched on, against this venue's id.
    isDemo: isDemoVenue(restaurant),
    branch: detectedBranch,
    branches,
    areas: areas.map(a => ({
      ...a,
      areaCategory: a.areaType,
      tables: tables.filter(t => t.zone === a.name).length,
    })),
    areaGroups,
    table: detectedTable ? { id: detectedTable.id, name: detectedTable.name, status: detectedTable.status, zone: detectedTable.zone, capacity: detectedTable.capacity, isVip: detectedTable.isVip } : null,
    // The occupant's name used to travel with the room here, and ?room= is a free-text
    // query parameter — so any visitor could read who was checked into any room.
    room: detectedRoom ? { number: detectedRoom.number, type: detectedRoom.type, floor: detectedRoom.floor } : null,
    section: detectedSection ? { id: detectedSection.id, name: detectedSection.name, areaType: detectedSection.areaType } : null,
    detection: {
      entryMethod: accessMethod,
      serviceMode,
      language: langParam,
      timezone,
      branchId: detectedBranch?.id ?? null,
      branchName: detectedBranch?.name ?? null,
      tableDetected: !!detectedTable,
      roomDetected: !!detectedRoom,
      sectionDetected: !!detectedSection,
      autoDetection: {
        branch: !!detectedBranch,
        table: !!detectedTable,
        room: !!detectedRoom,
        section: !!detectedSection,
        language: !!langParam,
        timezone: !!timezone,
        serviceMode: !!serviceMode,
      },
    },
    session: guestSession ? {
      token: guestSession.token,
      shareCode: guestSession.shareCode,
      sessionType: guestSession.sessionType,
      memberCount: guestSession.memberCount,
      features: {
        autoReconnect: true,
        sessionRestore: true,
        multiDevice: guestSession.sessionType === "multi_device" || guestSession.sessionType === "family",
        familyShared: guestSession.sessionType === "family",
        sharedTable: guestSession.sessionType === "shared_table" || guestSession.sessionType === "table_share",
      },
    } : null,
    tableAvailability: {
      total: tables.length,
      free: statusCounts.free ?? 0,
      occupied: statusCounts.occupied ?? 0,
      byStatus: statusCounts,
    },
    accessMethods: ACCESS_METHODS,
  });
});

router.post("/public/session/init", async (req, res): Promise<void> => {
  const { restaurantId, tableId, tableName, roomNumber, sessionType, entryMethod, serviceMode, language, timezone, branchId } = req.body;
  const token = generateSessionToken();
  const shareCode = generateShareCode();
  const deviceId = getDeviceId();
  // Room number must not be claimed from a free-form POST — that let anyone bind
  // session.roomNumber to 101 and then pass callerIsInRoom for that room's controls.
  // Room binding only happens when the guest opens a venue/scan URL with ?room=.
  const [session] = await db.insert(guestSessionsTable).values({
    token,
    shareCode,
    restaurantId: restaurantId ?? req.session.restaurantId ?? null,
    sessionType: sessionType ?? "personal",
    tableId: tableId ?? null,
    tableName: tableName ?? null,
    roomNumber: null,
    entryMethod: entryMethod ?? "browser",
    serviceMode: serviceMode ?? "browse",
    language: language ?? "en",
    timezone: timezone ?? "Asia/Kolkata",
    branchId: branchId ?? null,
    deviceIds: [deviceId],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).returning();
  req.session.guestSessionToken = session.token;
  req.session.guestSessionId = session.id;
  res.status(201).json({ session, notice: roomNumber ? "Room is set only by scanning the in-room QR." : undefined });
});

router.get("/public/session/restore", async (req, res): Promise<void> => {
  const token = (req.query.token as string) || req.session.guestSessionToken;
  // No token just means "this visitor has no saved guest session yet" — a normal case
  // (this runs on every page load). Return a clean empty result, not a 400, so it
  // doesn't spam the console with Bad Request errors app-wide.
  if (!token) { res.json({ session: null, cart: [], restored: false }); return; }
  const [session] = await db.select().from(guestSessionsTable).where(and(eq(guestSessionsTable.token, token), eq(guestSessionsTable.isActive, true)));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (session.expiresAt && session.expiresAt < new Date()) {
    res.status(410).json({ error: "Session expired" });
    return;
  }
  req.session.guestSessionToken = session.token;
  req.session.guestSessionId = session.id;
  await db.update(guestSessionsTable).set({ lastSeenAt: new Date() }).where(eq(guestSessionsTable.id, session.id));
  res.json({
    session,
    cart: session.cartSnapshot ?? [],
    features: {
      autoReconnect: true,
      sessionRestore: true,
      multiDevice: session.sessionType === "multi_device",
      familyShared: session.sessionType === "family",
      sharedTable: session.sessionType === "shared_table" || session.sessionType === "table_share",
    },
  });
});

router.post("/public/session/join", async (req, res): Promise<void> => {
  const { shareCode, deviceId } = req.body;
  if (!shareCode) { res.status(400).json({ error: "shareCode required" }); return; }
  const [session] = await db.select().from(guestSessionsTable).where(and(eq(guestSessionsTable.shareCode, shareCode.toUpperCase()), eq(guestSessionsTable.isActive, true)));
  if (!session) { res.status(404).json({ error: "Invalid share code" }); return; }
  const devices = Array.isArray(session.deviceIds) ? [...session.deviceIds as string[]] : [];
  const dev = deviceId || getDeviceId();
  if (!devices.includes(dev)) devices.push(dev);
  const sessionType = session.sessionType === "personal" ? "table_share" : session.sessionType;
  const [updated] = await db.update(guestSessionsTable).set({
    deviceIds: devices,
    memberCount: devices.length,
    sessionType,
    lastSeenAt: new Date(),
  }).where(eq(guestSessionsTable.id, session.id)).returning();
  req.session.guestSessionToken = updated.token;
  req.session.guestSessionId = updated.id;
  res.json({ session: updated, cart: updated.cartSnapshot ?? [] });
});

router.post("/public/session/family", async (req, res): Promise<void> => {
  const { restaurantId, tableName } = req.body;
  const token = req.session.guestSessionToken ?? generateSessionToken();
  let [session] = await db.select().from(guestSessionsTable).where(eq(guestSessionsTable.token, token));
  if (!session) {
    [session] = await db.insert(guestSessionsTable).values({
      token,
      shareCode: generateShareCode(),
      restaurantId: restaurantId ?? req.session.restaurantId ?? null,
      sessionType: "family",
      tableName: tableName ?? null,
      deviceIds: [getDeviceId()],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }).returning();
  } else {
    [session] = await db.update(guestSessionsTable).set({ sessionType: "family" }).where(eq(guestSessionsTable.id, session.id)).returning();
  }
  req.session.guestSessionToken = session.token;
  req.session.guestSessionId = session.id;
  res.json({ session, shareCode: session.shareCode });
});

router.patch("/public/session/sync", async (req, res): Promise<void> => {
  const token = req.session.guestSessionToken;
  if (!token) { res.status(401).json({ error: "No active session" }); return; }
  const { cart, deviceId } = req.body;
  const [session] = await db.select().from(guestSessionsTable).where(eq(guestSessionsTable.token, token));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  const devices = Array.isArray(session.deviceIds) ? [...session.deviceIds as string[]] : [];
  if (deviceId && !devices.includes(deviceId)) devices.push(deviceId);
  const [updated] = await db.update(guestSessionsTable).set({
    cartSnapshot: cart ?? session.cartSnapshot,
    deviceIds: devices,
    memberCount: Math.max(session.memberCount, devices.length),
    lastSeenAt: new Date(),
  }).where(eq(guestSessionsTable.id, session.id)).returning();
  res.json({ session: updated });
});

router.get("/public/session/info", async (req, res): Promise<void> => {
  const token = req.session.guestSessionToken;
  if (!token) { res.json({ session: null }); return; }
  const [session] = await db.select().from(guestSessionsTable).where(eq(guestSessionsTable.token, token));
  res.json({ session: session ?? null });
});

router.get("/public/tables/availability/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const tables = await db.select().from(tablesMapTable).where(eq(tablesMapTable.restaurantId, restaurantId));
  res.json(tables.map(t => ({
    id: t.id,
    name: t.name,
    status: t.status,
    zone: t.zone,
    capacity: t.capacity,
    isVip: t.isVip,
    available: t.status === "free",
  })));
});

function authDbError(res: import("express").Response, err: unknown, fallback: string): void {
  const pg = err as { code?: string; constraint?: string };
  if (pg?.code === "23505") {
    res.status(400).json({ error: "Account already exists with this email or phone" });
    return;
  }
  if (pg?.code === "42P01") {
    res.status(503).json({ error: "Auth service is initializing — please retry in a moment" });
    return;
  }
  console.error("[auth]", err);
  res.status(500).json({ error: fallback });
}

// ─── Customer authentication ─────────────────────────────────────────
router.post("/public/auth/guest", async (req, res): Promise<void> => {
  try {
    const { name, restaurantId } = req.body;
    const rid = restaurantId ? parseInt(String(restaurantId), 10) : undefined;
    const [guest] = await db.insert(guestUsersTable).values({
      name: name || "Guest",
      isGuest: true,
      loginProvider: "guest",
    }).returning();
    req.session.guestUserId = guest.id;
    if (rid) req.session.restaurantId = rid;
    res.status(201).json({ user: await profileForGuest(guest, rid) });
  } catch (err) {
    authDbError(res, err, "Guest login failed");
  }
});

const DEMO_GUEST_PHONE = "9876543210";
const DEMO_GUEST_OTP = "123456";

const IS_PRODUCTION = () => process.env.NODE_ENV === "production";

/**
 * The demo account, and only the demo account.
 *
 * The test used to be `phone === DEMO || phone.endsWith(DEMO)`, and `endsWith` is not a
 * narrower test than equality — it is a wider one. `+919876543210`, the ordinary
 * international form, matched. So did `99999876543210`, an unrelated number, which was
 * signed in with the fixed code and given a real guest account. Worse, the same flag then
 * bypassed the production check on both the generated code AND on returning it in the
 * response body, so the backdoor was live in production for anyone who noticed the
 * pattern. Exact match, and never in production.
 */
function isDemoPhone(phone: string): boolean {
  return phone === DEMO_GUEST_PHONE;
}

/**
 * Whether real one-time codes are in force (must be delivered by SMS, not echoed).
 *
 * Credentials (Twilio / MSG91 env or platform settings) mean we can try a real send.
 * NODE_ENV=production without credentials still fails closed — never forever-123456.
 */
async function smsProviderReady(): Promise<boolean> {
  try {
    const platform = await getPlatformSettingsRaw();
    return smsCredentialsPresent(platform.integrations);
  } catch {
    return smsCredentialsPresent();
  }
}

/**
 * In-memory / fixed demo OTPs are local-dev only.
 *
 * Fail closed unless NODE_ENV is explicitly development/test, or ALLOW_DEMO_OTP=1 is set.
 * An unset or weird NODE_ENV (common on half-configured hosts) must not unlock 123456.
 */
function demoOtpsAllowed(): boolean {
  if (IS_PRODUCTION()) return false;
  if (process.env.ALLOW_DEMO_OTP === "1") return true;
  const env = String(process.env.NODE_ENV ?? "").toLowerCase();
  return env === "development" || env === "test";
}

router.post("/public/auth/otp/send", otpSendRateLimit, async (req, res): Promise<void> => {
  const phone = String(req.body.phone ?? "").replace(/\D/g, "");
  if (phone.length < 8 || phone.length > 15) {
    res.status(400).json({ error: "Enter a valid mobile number." });
    return;
  }

  const platform = await getPlatformSettingsRaw().catch(() => null);
  const integrations = platform?.integrations;
  const canSms = smsCredentialsPresent(integrations);
  const allowDemo = !canSms && demoOtpsAllowed();
  const demo = allowDemo && isDemoPhone(phone);

  if (canSms) {
    const otp = generateOtp();
    otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
    const sent = await sendOtpSms(phone, otp, integrations);
    if (!sent.ok) {
      otpStore.delete(phone);
      res.status(503).json({
        error: "We could not send a verification text right now. Please try email sign-in, continue as guest, or ask staff.",
        code: "SMS_SEND_FAILED",
        detail: sent.error,
      });
      return;
    }
    res.json({
      success: true,
      message: "OTP sent to your mobile number.",
      provider: sent.provider,
    });
    return;
  }

  // No SMS credentials: production / non-dev must fail closed. Local/dev returns the
  // code in the response so smoke tests work without a vendor account.
  if (!allowDemo) {
    res.status(503).json({
      error: "Phone sign-in is not available yet — SMS is not configured. Continue as guest from a table QR, or use email.",
      code: "SMS_NOT_CONNECTED",
    });
    return;
  }

  const otp = demo ? DEMO_GUEST_OTP : generateOtp();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  res.json({
    success: true,
    message: demo
      ? "Demo login — use the code shown below (no SMS was sent)."
      : "Development mode — use the code shown below (no SMS was sent).",
    devOtp: otp,
    demoAccount: demo || undefined,
  });
});

router.post("/public/auth/otp/verify", otpVerifyRateLimit, async (req, res): Promise<void> => {
  try {
    const phone = String(req.body.phone ?? "").replace(/\D/g, "");
    const { otp, name, restaurantId } = req.body;
    const rid = restaurantId ? parseInt(String(restaurantId), 10) : undefined;
    if (!phone || !otp) { res.status(400).json({ error: "phone and otp required" }); return; }
    // Fixed demo OTP only when demo path is allowed and SMS is not live.
    const isDemoLogin = demoOtpsAllowed()
      && !(await smsProviderReady())
      && isDemoPhone(phone)
      && String(otp) === DEMO_GUEST_OTP;
    const stored = otpStore.get(phone);
    if (!isDemoLogin && (!stored || stored.otp !== String(otp) || stored.expiresAt < Date.now())) {
      res.status(401).json({ error: "Invalid or expired OTP" });
      return;
    }
    otpStore.delete(phone);

    let [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.phone, phone));
    if (!guest) {
      [guest] = await db.insert(guestUsersTable).values({
        phone,
        name: name || "Guest",
        loginProvider: "otp",
        lastLoginAt: new Date(),
      }).returning();
    } else {
      [guest] = await db.update(guestUsersTable).set({ lastLoginAt: new Date(), name: name || guest.name }).where(eq(guestUsersTable.id, guest.id)).returning();
    }

    if (rid) {
      const existing = await db.select().from(customersTable).where(and(eq(customersTable.restaurantId, rid), eq(customersTable.phone, phone)));
      if (existing.length === 0) {
        await db.insert(customersTable).values({ restaurantId: rid, name: guest.name, phone, segment: "new" });
      }
    }

    req.session.guestUserId = guest.id;
    if (rid) req.session.restaurantId = rid;
    await trackGuestDevice(req, guest.id);
    res.json({ user: await profileForGuest(guest, rid) });
  } catch (err) {
    authDbError(res, err, "OTP verification failed");
  }
});

router.post("/public/auth/email/login", async (req, res): Promise<void> => {
  try {
    const { email, password, restaurantId } = req.body;
    const rid = restaurantId ? parseInt(String(restaurantId), 10) : undefined;
    if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }
    const normalizedEmail = String(email).trim().toLowerCase();
    const [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.email, normalizedEmail));
    if (!guest?.passwordHash || !(await bcrypt.compare(password, guest.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    req.session.guestUserId = guest.id;
    if (rid) req.session.restaurantId = rid;
    await db.update(guestUsersTable).set({ lastLoginAt: new Date() }).where(eq(guestUsersTable.id, guest.id));
    await trackGuestDevice(req, guest.id);
    res.json({ user: await profileForGuest(guest, rid) });
  } catch (err) {
    authDbError(res, err, "Email login failed");
  }
});

router.post("/public/auth/register", async (req, res): Promise<void> => {
  try {
    const { email, password, name, phone, restaurantId } = req.body;
    const rid = restaurantId ? parseInt(String(restaurantId), 10) : undefined;
    if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }
    if (String(password).length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanPhone = phone ? String(phone).replace(/\D/g, "") : null;
    const existing = await db.select().from(guestUsersTable).where(eq(guestUsersTable.email, normalizedEmail));
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already registered — try signing in" });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const [guest] = await db.insert(guestUsersTable).values({
      email: normalizedEmail,
      phone: cleanPhone,
      name: name || "User",
      passwordHash: hash,
      loginProvider: "email",
    }).returning();
    req.session.guestUserId = guest.id;
    if (rid) req.session.restaurantId = rid;
    await trackGuestDevice(req, guest.id);
    res.status(201).json({ user: await profileForGuest(guest, rid) });
  } catch (err) {
    authDbError(res, err, "Registration failed");
  }
});

router.get("/public/auth/oauth-config", async (_req, res) => {
  const settings = await getPlatformSettingsRaw();
  const integrations = settings.integrations;
  const publicCfg = getPublicIntegrationsConfig(integrations);
  res.json({
    google: publicCfg.oauth.google || Boolean(process.env.GOOGLE_CLIENT_ID),
    apple: publicCfg.oauth.apple || Boolean(process.env.APPLE_CLIENT_ID),
    googleClientId: publicCfg.oauth.googleClientId || process.env.GOOGLE_CLIENT_ID || "",
    /** Guest phone OTP only when Twilio/MSG91 credentials can actually deliver. */
    smsOtp: publicCfg.messaging.sms,
    manualSocialFlow: true,
  });
});

router.get("/public/platform/integrations", async (_req, res) => {
  const settings = await getPlatformSettingsRaw();
  res.json(getPublicIntegrationsConfig(settings.integrations));
});

router.get("/public/auth/me", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.json(null); return; }
  res.json({ user: await profileForGuest(guest, req.session.restaurantId) });
});

router.post("/public/auth/logout", async (req, res): Promise<void> => {
  req.session.guestUserId = undefined;
  res.json({ success: true });
});

router.post("/public/auth/social", async (req, res): Promise<void> => {
  try {
    // Email-only "social" used to mint a real guest session from any address typed in the
    // browser — no Google/Apple token check. Production must fail closed until real OAuth
    // is wired; local/dev may still use the convenience path.
    if (IS_PRODUCTION() && process.env.ALLOW_DEV_SOCIAL !== "1") {
      res.status(503).json({
        error: "Social sign-in is not available yet. Use email or ask staff for help.",
        code: "OAUTH_NOT_CONNECTED",
      });
      return;
    }

    const provider = String(req.body.provider ?? "");
    const name = String(req.body.name ?? `${provider} User`);
    const email = socialEmailForProvider(provider, req.body.email, req.body.providerId);
    const avatar = req.body.avatar ? String(req.body.avatar) : undefined;
    const restaurantId = req.body.restaurantId ? parseInt(String(req.body.restaurantId), 10) : undefined;
    const guestType = (req.body.guestType as GuestType) ?? "regular";
    if (!["google", "apple"].includes(provider)) {
      res.status(400).json({ error: "provider must be google or apple" });
      return;
    }
    if (!req.body.email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    let [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.email, email));
    if (!guest) {
      [guest] = await db.insert(guestUsersTable).values({
        email,
        name,
        avatar,
        loginProvider: provider,
        isGuest: false,
        deviceInfo: { guestType },
      }).returning();
    } else {
      const deviceInfo = { ...parseDeviceInfo(guest.deviceInfo), guestType };
      [guest] = await db.update(guestUsersTable).set({
        name: name || guest.name,
        avatar: avatar ?? guest.avatar,
        loginProvider: provider,
        deviceInfo,
        lastLoginAt: new Date(),
      }).where(eq(guestUsersTable.id, guest.id)).returning();
    }

    if (restaurantId) {
      const existing = await db.select().from(customersTable).where(
        and(eq(customersTable.restaurantId, restaurantId), eq(customersTable.email, email)),
      );
      if (existing.length === 0) {
        await db.insert(customersTable).values({ restaurantId, name: guest.name, email, segment: guestType === "corporate" ? "corporate" : "new" });
      }
    }

    req.session.guestUserId = guest.id;
    if (restaurantId) req.session.restaurantId = restaurantId;
    await trackGuestDevice(req, guest.id);
    res.json({ user: await profileForGuest(guest, restaurantId), provider });
  } catch (err) {
    authDbError(res, err, "Social login failed");
  }
});

router.post("/public/auth/one-tap", async (req, res): Promise<void> => {
  try {
    const phone = String(req.body.phone ?? "").replace(/\D/g, "");
    const deviceId = String(req.body.deviceId ?? getDeviceId(req.headers as Record<string, string | string[] | undefined>));
    const restaurantId = req.body.restaurantId ? parseInt(String(req.body.restaurantId), 10) : undefined;
    if (!phone) { res.status(400).json({ error: "phone required" }); return; }

    const [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.phone, phone));
    if (!guest) { res.status(404).json({ error: "No account for this number — use OTP first" }); return; }

    const deviceInfo = parseDeviceInfo(guest.deviceInfo);
    const device = deviceInfo.devices?.find(d => d.id === deviceId);
    if (!device?.trusted) {
      res.status(403).json({ error: "Device not trusted — verify with OTP", requiresOtp: true });
      return;
    }

    req.session.guestUserId = guest.id;
    if (restaurantId) req.session.restaurantId = restaurantId;
    await trackGuestDevice(req, guest.id);
    res.json({ user: await profileForGuest(guest, restaurantId), oneTap: true });
  } catch (err) {
    authDbError(res, err, "One-tap login failed");
  }
});

router.get("/public/auth/guest-types", (_req, res) => {
  res.json({ types: GUEST_TYPES });
});

router.patch("/public/auth/guest-type", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const guestType = req.body.guestType as GuestType;
  if (!GUEST_TYPES.some(g => g.id === guestType)) {
    res.status(400).json({ error: "Invalid guest type" });
    return;
  }
  const deviceInfo = { ...parseDeviceInfo(guest.deviceInfo), guestType };
  const [updated] = await db.update(guestUsersTable).set({ deviceInfo }).where(eq(guestUsersTable.id, guest.id)).returning();
  res.json({ user: await profileForGuest(updated, req.session.restaurantId) });
});

router.get("/public/auth/devices", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const deviceInfo = parseDeviceInfo(guest.deviceInfo);
  res.json({ devices: deviceInfo.devices ?? [], currentDeviceId: getDeviceId(req.headers as Record<string, string | string[] | undefined>) });
});

router.delete("/public/auth/devices/:deviceId", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const deviceInfo = removeDevice(guest.deviceInfo, req.params.deviceId);
  await db.update(guestUsersTable).set({ deviceInfo }).where(eq(guestUsersTable.id, guest.id));
  res.json({ success: true, devices: deviceInfo.devices ?? [] });
});

router.post("/public/auth/devices/:deviceId/trust", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const deviceInfo = trustDevice(guest.deviceInfo, req.params.deviceId);
  await db.update(guestUsersTable).set({ deviceInfo }).where(eq(guestUsersTable.id, guest.id));
  res.json({ success: true, devices: deviceInfo.devices ?? [] });
});

router.get("/public/auth/login-alerts", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const deviceInfo = parseDeviceInfo(guest.deviceInfo);
  res.json({ alerts: deviceInfo.loginAlerts ?? [] });
});

router.post("/public/auth/login-alerts/read", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const deviceInfo = markAlertsRead(guest.deviceInfo);
  await db.update(guestUsersTable).set({ deviceInfo }).where(eq(guestUsersTable.id, guest.id));
  res.json({ success: true });
});

router.get("/public/auth/security", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const deviceInfo = parseDeviceInfo(guest.deviceInfo);
  res.json({
    security: deviceInfo.security ?? { sessionTimeoutMinutes: 30, fraudProtection: true, loginAlertsEnabled: true },
    deviceCount: deviceInfo.devices?.length ?? 0,
    features: ["device_tracking", "login_alerts", "otp_verification", "suspicious_login_detection", "session_timeout", "device_management", "fraud_protection"],
  });
});

router.patch("/public/auth/security", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const deviceInfo = parseDeviceInfo(guest.deviceInfo);
  const security = {
    sessionTimeoutMinutes: parseInt(String(req.body.sessionTimeoutMinutes ?? deviceInfo.security?.sessionTimeoutMinutes ?? 30), 10),
    fraudProtection: req.body.fraudProtection ?? deviceInfo.security?.fraudProtection ?? true,
    loginAlertsEnabled: req.body.loginAlertsEnabled ?? deviceInfo.security?.loginAlertsEnabled ?? true,
  };
  await db.update(guestUsersTable).set({ deviceInfo: { ...deviceInfo, security } }).where(eq(guestUsersTable.id, guest.id));
  res.json({ security });
});

// Queue routes moved to public-queue.ts

// Reservation routes moved to public-reservations.ts

// ─── Coupons ─────────────────────────────────────────────────────────
router.post("/public/coupons/validate", async (req, res): Promise<void> => {
  const { restaurantId, code, subtotal } = req.body;
  if (!restaurantId || !code) { res.status(400).json({ error: "restaurantId and code required" }); return; }

  const [promo] = await db.select().from(promoCodesTable).where(
    and(eq(promoCodesTable.restaurantId, restaurantId), eq(promoCodesTable.code, code.toUpperCase()), eq(promoCodesTable.isActive, true)),
  );

  if (!promo) {
    res.status(404).json({ error: "Invalid coupon code" });
    return;
  }

  // The same three conditions the order route applies when it actually prices the
  // basket. Without them the cart happily showed "₹30 off applied" for a code that
  // expired years ago or was already spent, and then the order was placed at full
  // price with nothing on screen to explain the difference.
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    res.status(400).json({ error: "This coupon has expired" });
    return;
  }
  const usageLimit = Number(promo.usageLimit ?? 0);
  if (usageLimit > 0 && Number(promo.usedCount ?? 0) >= usageLimit) {
    res.status(400).json({ error: "This coupon has already been fully used" });
    return;
  }

  const sub = parseNum(subtotal);
  const minOrder = parseNum(promo.minOrderAmount);
  if (sub < minOrder) { res.status(400).json({ error: `Minimum order ₹${minOrder} required` }); return; }

  let discount = 0;
  if (promo.discountType === "percent") {
    discount = Math.round(sub * parseNum(promo.discountValue) / 100);
    if (promo.maxDiscount) discount = Math.min(discount, parseNum(promo.maxDiscount));
  } else {
    discount = parseNum(promo.discountValue);
  }
  discount = Math.min(discount, sub);

  // Checking a code is not spending it. This used to increment usedCount, so typing a
  // coupon into the cart — twice, or then abandoning the basket — burned a redemption
  // the guest never received.

  res.json({ code: code.toUpperCase(), discount, valid: true });
});

// ─── Wallet (wallet routes in public-wallet.ts) ─────────────────────
// ─── Loyalty (loyalty routes in public-loyalty.ts) ──────────────────

router.get("/public/me/favorites", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  const restaurantId = req.session.restaurantId ?? parseInt(String(req.query.restaurantId || "0"), 10);
  if (!guest) { res.json({ favorites: [] }); return; }
  const existing = restaurantId
    ? await db.select().from(customersTable).where(and(eq(customersTable.restaurantId, restaurantId), or(
      guest.phone ? eq(customersTable.phone, guest.phone) : sql`false`,
      guest.email ? eq(customersTable.email, guest.email) : sql`false`,
    )))
    : [];
  const fav = existing[0]?.favoriteItems;
  res.json({ favorites: Array.isArray(fav) ? fav : [] });
});

router.patch("/public/me/favorites", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const restaurantId = req.session.restaurantId ?? req.body.restaurantId;
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }
  const favorites = Array.isArray(req.body.favorites) ? req.body.favorites : [];
  const existing = await db.select().from(customersTable).where(and(eq(customersTable.restaurantId, restaurantId), or(
    guest.phone ? eq(customersTable.phone, guest.phone) : sql`false`,
    guest.email ? eq(customersTable.email, guest.email) : sql`false`,
  )));
  if (existing[0]) {
    await db.update(customersTable).set({ favoriteItems: favorites }).where(eq(customersTable.id, existing[0].id));
  } else {
    await db.insert(customersTable).values({
      restaurantId,
      name: guest.name,
      phone: guest.phone,
      email: guest.email,
      favoriteItems: favorites,
      totalOrders: 0,
      totalSpend: "0",
      segment: "new",
    });
  }
  res.json({ favorites });
});

router.get("/public/me/orders", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const restaurantId = req.session.restaurantId;

  // Identify the guest by phone OR email — either may be missing — but always AND that
  // with the restaurant. Joining all three with or() meant the restaurant clause alone
  // matched, so every guest was handed every order in the venue: names, phone numbers,
  // email addresses and totals belonging to other diners.
  const identity = [];
  if (guest.phone) identity.push(eq(ordersTable.customerPhone, guest.phone));
  if (guest.email) identity.push(eq(ordersTable.customerEmail, guest.email));
  if (identity.length === 0) { res.json([]); return; }

  const scoped = restaurantId
    ? and(eq(ordersTable.restaurantId, restaurantId), or(...identity))
    : or(...identity);

  const list = await db.select().from(ordersTable).where(scoped).orderBy(desc(ordersTable.createdAt)).limit(50);
  res.json(list.map(o => ({
    ...o,
    subtotal: parseNum(o.subtotal),
    tax: parseNum(o.tax),
    total: parseNum(o.total),
    items: Array.isArray(o.items) ? o.items : [],
  })));
});

// Spa routes moved to public-spa.ts

// ─── Hotel guest services ────────────────────────────────────────────
router.post("/public/room-service", async (req, res): Promise<void> => {
  const { restaurantId, roomNumber, guestName, guestPhone, type, items, notes, total, paymentMethod } = req.body;
  if (!restaurantId || !roomNumber) { res.status(400).json({ error: "restaurantId and roomNumber required" }); return; }

  const rid = parseInt(String(restaurantId), 10);
  const room = String(roomNumber);
  // Same as hotel controls: a room number is a location, not a credential. Without the
  // in-room QR session anyone could charge laundry or food to room 501.
  if (!(await callerIsInRoom(req, rid, room))) {
    res.status(403).json({ error: "Scan the QR code in your room to place a room request." });
    return;
  }

  const requestType = type || "food";

  // `open_time`/`close_time` sat unread in the restaurants table, so nothing anywhere
  // knew whether the venue was open. For a hotel those columns are the front-of-house
  // restaurant's hours, not room service — a hotel takes room orders through the night —
  // so an out-of-hours room order is flagged rather than refused, and the guest is told
  // the kitchen is shut instead of being left to wonder why nothing arrives.
  let afterHours: ReturnType<typeof venueHours> | null = null;
  if (requestType === "food" || requestType === "bar") {
    const [venue] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
    const gate = ordersAllowed(venue);
    if (!gate.allowed) {
      if (venue?.businessType === "hotel") {
        afterHours = gate.hours;
      } else {
        res.status(409).json(closedResponse(gate.hours));
        return;
      }
    } else if (!gate.hours.isOpen && venue?.businessType === "hotel") {
      // Hotel room service still flags after-hours for staff even when a demo bypass
      // would allow the write — the kitchen may be shut while the desk takes the ticket.
      afterHours = gate.hours;
    }
  }

  // Food and drink are priced from the menu, exactly as a table order is. The price and
  // total the room page posted used to be written straight to the folio, so a ₹275 club
  // sandwich could be charged to the room at ₹1 — and the kitchen still sent it up.
  // Non-food requests (laundry, amenities) have no menu row and keep the amount they
  // were sent, which is how the staff-side route treats them too.
  const requestedLines = Array.isArray(items) ? items as Record<string, unknown>[] : [];
  let pricedLines = requestedLines;
  let lineSubtotal = parseNum(total);
  if ((requestType === "food" || requestType === "bar") && requestedLines.length) {
    const menuRows = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurantId));
    const menuMap = new Map(menuRows.map(m => [m.id, m]));
    const resolved: Record<string, unknown>[] = [];
    let sum = 0;
    for (const line of requestedLines) {
      const mi = menuMap.get(Number(line.menuItemId));
      if (!mi) {
        // "Menu item undefined not found" told a guest nothing. Food and drink have to
        // name a menu row because that is where the price comes from; anything else
        // belongs under a non-food request type.
        res.status(400).json({
          error: line.menuItemId == null
            ? `"${String(line.name ?? "That item")}" is not on the room-service menu. Choose a dish from the menu to order it.`
            : `That dish is no longer on this hotel's menu.`,
        });
        return;
      }
      if (!mi.isAvailable) { res.status(409).json({ error: `${mi.name} is not available right now` }); return; }
      const quantity = Math.floor(Number(line.qty ?? line.quantity ?? 1));
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        res.status(400).json({ error: `Invalid quantity for ${mi.name}` });
        return;
      }
      const { unitPrice, addons, variant } = priceMenuItem(mi, line);
      sum += unitPrice * quantity;
      resolved.push({ menuItemId: mi.id, name: mi.name, price: unitPrice, quantity, variant, addons, notes: line.notes });
    }
    pricedLines = resolved;
    lineSubtotal = Math.round(sum * 100) / 100;
  }
  const taxRate = await taxRateFor(restaurantId);
  const roomTax = Math.round(lineSubtotal * taxRate * 100) / 100;
  const roomTotal = Math.round((lineSubtotal + roomTax) * 100) / 100;

  // Use the session-bound restaurant/room ids from here on, not the raw body values —
  // the ownership check already proved they match.
  const [request] = await db.insert(roomServiceRequestsTable).values({
    restaurantId: rid,
    roomNumber: room,
    guestName,
    guestPhone,
    type: requestType,
    items: pricedLines,
    notes,
    total: roomTotal.toFixed(2),
    paymentMethod: paymentMethod || "room_bill",
    status: "pending",
  }).returning();

  // A guest ordering food from their room has to reach the kitchen. Only the staff-side
  // route mirrored the request into `orders`; this one stopped at the request table, so
  // room food never appeared on the kitchen display, in Orders, or in revenue — the
  // guest waited for a meal nobody was cooking.
  //
  // Mirrors the staff route exactly (routes/room-service.ts), including the metadata that
  // links the two rows so the folio and the kitchen read the same charge without
  // counting it twice.
  if (requestType === "food" || requestType === "bar") {
    try {
      const orderItems = pricedLines.map((i: any, idx: number) => {
        const qty = Number(i.qty ?? i.quantity ?? 1) || 1;
        const price = parseNum(i.price);
        return { id: i.menuItemId ?? idx + 1, menuItemId: i.menuItemId, name: i.name ?? i.description ?? "Item", price, quantity: qty, variant: i.variant ?? null, addons: i.addons ?? [], subtotal: Math.round(price * qty * 100) / 100 };
      });
      await db.insert(ordersTable).values({
        restaurantId,
        tableName: `Room ${roomNumber}`,
        customerName: guestName ?? "Room Guest",
        customerPhone: guestPhone ?? null,
        type: "room_service",
        status: "pending",
        items: orderItems.length
          ? orderItems
          : [{ id: 1, name: notes || "Room service", price: lineSubtotal, quantity: 1, subtotal: lineSubtotal }],
        subtotal: lineSubtotal.toFixed(2),
        // Room food is taxed at the venue's own rate, like every other order. It used to
        // post 0.00 tax, so the folio and the GST returns were short on every room meal.
        tax: roomTax.toFixed(2),
        total: roomTotal.toFixed(2),
        notes: notes ?? null,
        paymentMethod: paymentMethod ?? "room_bill",
        paymentStatus: "pending",
        orderSource: "room_service",
        metadata: { roomNumber, roomServiceRequestId: request.id, folioMirror: true, source: requestType },
      }).returning().then(([order]) => {
        if (!order) return;
        // Without this the kitchen board and Orders list only catch up on the 15s poll —
        // a room meal sat invisible until someone refreshed.
        broadcastEvent("new_order", {
          id: order.id,
          restaurantId,
          tableName: order.tableName,
          total: order.total,
          status: "pending",
          type: "room_service",
        });
        broadcastOrderEvent(order.id, "order_status", {
          id: order.id,
          status: "pending",
          tableName: order.tableName,
        });
      });
    } catch (err) {
      logger.error({ err, requestId: request.id }, "could not mirror guest room-service order to the kitchen");
    }
  }

  const assigned = await autoAssignRoomServiceRequest(restaurantId, request.id);
  res.status(201).json({
    ...(assigned ?? request),
    // Non-null only when the order was placed outside the venue's published hours, so
    // the room page can say "the kitchen is closed — this will be picked up at 06:30"
    // rather than implying a meal is on its way.
    afterHours: afterHours ? { ...afterHours, warning: afterHours.message } : null,
  });
});

router.post("/public/housekeeping", async (req, res): Promise<void> => {
  const { restaurantId, roomNumber, type, title, description, priority } = req.body;
  if (!restaurantId || !roomNumber) { res.status(400).json({ error: "restaurantId and roomNumber required" }); return; }
  const rid = parseInt(String(restaurantId), 10);
  const room = String(roomNumber);
  // Counting upward through room numbers used to create cleaning tickets for every
  // occupied room. Only the browser that scanned that room's QR may ask.
  if (!(await callerIsInRoom(req, rid, room))) {
    res.status(403).json({ error: "Scan the QR code in your room to request housekeeping." });
    return;
  }
  const [task] = await db.insert(housekeepingTasksTable).values({
    restaurantId: rid,
    type: type || "cleaning",
    title: title || "Guest request",
    description,
    location: `Room ${room}`,
    roomNumber: room,
    priority: priority || "normal",
    status: "pending",
  }).returning();
  const assigned = await autoAssignHousekeepingTask(rid, task.id);
  res.status(201).json(assigned ?? task);
});

router.post("/public/maintenance", async (req, res): Promise<void> => {
  const { restaurantId, roomNumber, title, description, category, priority } = req.body;
  if (!restaurantId || !roomNumber) { res.status(400).json({ error: "restaurantId and roomNumber required" }); return; }
  const rid = parseInt(String(restaurantId), 10);
  const room = String(roomNumber);
  if (!(await callerIsInRoom(req, rid, room))) {
    res.status(403).json({ error: "Scan the QR code in your room to report a maintenance issue." });
    return;
  }
  const [request] = await db.insert(maintenanceRequestsTable).values({
    restaurantId: rid,
    title: title || "Maintenance request",
    description,
    location: `Room ${room}`,
    category: category || "general",
    priority: priority || "normal",
    reportedBy: `Room ${room}`,
    status: "open",
  }).returning();
  const assigned = await autoAssignMaintenanceRequest(rid, request.id);
  res.status(201).json(assigned ?? request);
});

router.get("/public/room/:restaurantId/:roomNumber", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const roomNumber = String(req.params.roomNumber);
  // Same gate as /public/hotel/room — bare room numbers must not enumerate status.
  if (!(await callerIsInRoom(req, restaurantId, roomNumber))) {
    res.status(403).json({ error: "Scan the QR code in your room to see this room." });
    return;
  }
  const [room] = await db.select().from(hotelRoomsTable).where(
    and(eq(hotelRoomsTable.restaurantId, restaurantId), eq(hotelRoomsTable.number, roomNumber)),
  );
  if (!room) { res.status(404).json({ error: "Room not found" }); return; }
  // This returned the entire row to anyone who asked: the occupant's name, their phone
  // number, and their check-in and check-out dates, with no session and no credential.
  // Room numbers are sequential, so counting from 101 printed the hotel's guest list.
  const { guestName: _n, guestPhone: _p, checkIn: _ci, checkOut: _co, notes: _notes, ...safe } = room;
  res.json(safe);
});

// Event routes moved to public-events.ts

// ─── Support ─────────────────────────────────────────────────────────
router.post("/public/support/tickets", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  const { restaurantId, channel, subject, message, guestName, guestPhone, priority } = req.body;
  if (!message) { res.status(400).json({ error: "message required" }); return; }
  const [ticket] = await db.insert(supportTicketsTable).values({
    restaurantId: restaurantId ?? req.session.restaurantId ?? null,
    guestUserId: guest?.id ?? null,
    guestName: guestName || guest?.name,
    guestPhone: guestPhone || guest?.phone,
    channel: channel || "chat",
    subject,
    message,
    priority: priority || "normal",
    status: "open",
  }).returning();
  res.status(201).json(ticket);
});

// ─── Order live tracking ─────────────────────────────────────────────
router.get("/public/orders/:orderId/status", async (req, res): Promise<void> => {
  const orderId = parseInt(String(req.params.orderId), 10);
  // Same as GET /public/orders/:id — sequential ids must not expose waiter phones,
  // table names or payment state for every ticket in the venue.
  const order = await loadOwnedOrder(req, orderId);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [[restaurant], waiterStaff] = await Promise.all([
    db.select().from(restaurantsTable).where(eq(restaurantsTable.id, order.restaurantId)),
    order.waiterId
      ? db.select().from(staffTable).where(eq(staffTable.id, order.waiterId))
      : Promise.resolve([]),
  ]);

  const tracking = buildTrackingSnapshot(order);
  res.json({
    id: order.id,
    status: order.status,
    updatedAt: order.updatedAt,
    restaurantId: order.restaurantId,
    tableName: order.tableName,
    restaurantPhone: restaurant?.phone ?? undefined,
    waiterPhone: waiterStaff[0]?.phone ?? undefined,
    waiterName: order.waiterName,
    // The guest page polls this, so payment state has to travel with it —
    // without these the "your bill is ready" prompt and the paid/closed state
    // only appeared after a full page reload, and a table the waiter had
    // already cleared still showed a live order to the guest.
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod ?? null,
    billRequested: Boolean((order.metadata as Record<string, unknown> | null)?.billRequested),
    tableCleared: Boolean((order.metadata as Record<string, unknown> | null)?.tableCleared),
    ...tracking,
  });
});

/**
 * Cancel an order the guest has only just placed.
 *
 * There was no way for a diner to undo a mis-tap: no endpoint and no button. The only
 * cancel path in the product belonged to staff, so a guest who ordered the wrong dish
 * had to find a waiter before the kitchen started it. The window is deliberately short
 * and closes the moment the kitchen accepts the ticket — after that it is the venue's
 * food, and only staff may write it off.
 */
const GUEST_CANCEL_WINDOW_SECONDS = 120;
const GUEST_CANCELLABLE_STATUSES = new Set(["pending", "new", "confirmed"]);

router.post("/public/orders/:orderId/cancel", async (req, res): Promise<void> => {
  const orderId = parseInt(String(req.params.orderId), 10);
  const order = await loadOwnedOrder(req, orderId);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (order.status === "cancelled") {
    res.json({ cancelled: true, alreadyCancelled: true, order });
    return;
  }

  if (!GUEST_CANCELLABLE_STATUSES.has(order.status)) {
    res.status(409).json({
      error: "The kitchen has already started this order. Please ask a team member to cancel it.",
      status: order.status,
    });
    return;
  }

  if (order.paymentStatus === "paid") {
    res.status(409).json({ error: "This order has been paid for. Please ask a team member for a refund." });
    return;
  }

  const placedAt = order.createdAt instanceof Date ? order.createdAt.getTime() : Date.parse(String(order.createdAt));
  const elapsedSeconds = Number.isFinite(placedAt) ? Math.floor((Date.now() - placedAt) / 1000) : Number.POSITIVE_INFINITY;
  if (elapsedSeconds > GUEST_CANCEL_WINDOW_SECONDS) {
    res.status(409).json({
      error: `Orders can only be cancelled within ${GUEST_CANCEL_WINDOW_SECONDS} seconds of placing them. Please ask a team member.`,
      elapsedSeconds,
      windowSeconds: GUEST_CANCEL_WINDOW_SECONDS,
    });
    return;
  }

  const reason = String(req.body?.reason ?? "").trim().slice(0, 200) || "Cancelled by guest";
  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as OrderTrackingMetadata & Record<string, unknown>;
  const updates = Array.isArray(meta.tracking?.kitchenUpdates) ? meta.tracking!.kitchenUpdates! : [];

  const [updated] = await db.update(ordersTable).set({
    status: "cancelled",
    cancelledReason: reason,
    metadata: {
      ...meta,
      cancelledBy: "guest",
      cancelledAt: new Date().toISOString(),
      tracking: {
        ...(meta.tracking ?? {}),
        kitchenUpdates: [...updates, { at: new Date().toISOString(), type: "warning", message: `Cancelled by the guest — ${reason}` }],
      },
    },
  }).where(eq(ordersTable.id, orderId)).returning();

  // Staff panels listen on the restaurant SSE feed (`order_status`); guests listen on
  // the per-order stream. The old event name was `"status"`, which neither client
  // subscribed to — so a guest cancel left the KDS ticket sitting until reload.
  const restaurantId = order.restaurantId;
  broadcastEvent("order_status", {
    id: orderId,
    restaurantId,
    tableName: order.tableName,
    status: "cancelled",
    cancelledReason: reason,
  });
  broadcastOrderEvent(orderId, "order_status", {
    id: orderId,
    status: "cancelled",
    tableName: order.tableName,
    cancelledReason: reason,
  });

  // If this was the open cover on a table and nothing else is still active, free it so
  // the floor map matches the cancelled ticket.
  if (order.tableId) {
    const OPEN = ["pending", "new", "confirmed", "accepted", "preparing", "ready", "serving", "served", "billing"];
    const siblings = await db.select({ id: ordersTable.id }).from(ordersTable).where(and(
      eq(ordersTable.restaurantId, restaurantId),
      eq(ordersTable.tableId, order.tableId),
      ne(ordersTable.id, orderId),
      inArray(ordersTable.status, OPEN),
    )).limit(1);
    if (siblings.length === 0) {
      await db.update(tablesMapTable).set({
        status: "free",
        currentOrderId: null,
        currentCustomerName: null,
        currentGuestCount: 0,
        occupiedSince: null,
      }).where(and(eq(tablesMapTable.id, order.tableId), eq(tablesMapTable.restaurantId, restaurantId)));
      broadcastEvent("table_cleared", { restaurantId, tableName: order.tableName, orderId });
    }
  }

  res.json({ cancelled: true, order: updated, windowSeconds: GUEST_CANCEL_WINDOW_SECONDS });
});

/**
 * Has anybody picked up the waiter call?
 *
 * `POST /public/waiter-call` wrote a row and returned it, and that was the end of it —
 * the guest pressed the button and then stared at a screen that never changed, with no
 * way to tell a call that a waiter had answered from one nobody had seen. The staff
 * panel already resolves these rows; this simply lets the table read that back.
 */
router.get("/public/waiter-calls", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.query.restaurantId ?? "0"), 10);
  const tableName = String(req.query.table ?? req.query.tableName ?? "").trim();
  if (!restaurantId || !tableName) {
    res.status(400).json({ error: "restaurantId and table are required" });
    return;
  }

  // Scoped to one table: without the table filter this would hand every diner the whole
  // venue's call list.
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const calls = await db.select().from(waiterCallsTable).where(
    and(
      eq(waiterCallsTable.restaurantId, restaurantId),
      eq(waiterCallsTable.tableName, tableName),
      gte(waiterCallsTable.createdAt, since),
    ),
  ).orderBy(desc(waiterCallsTable.createdAt)).limit(20);

  res.json(calls.map(c => ({
    id: c.id,
    type: c.type,
    message: c.message,
    createdAt: c.createdAt,
    acknowledged: c.isResolved,
    acknowledgedAt: c.isResolved ? c.updatedAt : null,
    statusLabel: c.isResolved ? "A team member has attended this" : "Waiting for a team member",
  })));
});

router.post("/public/orders/:orderId/message", async (req, res): Promise<void> => {
  const orderId = parseInt(String(req.params.orderId), 10);
  const text = String(req.body?.message ?? "").trim();
  if (!text) { res.status(400).json({ error: "message required" }); return; }

  // Same ownership gate as cancel/pay — messaging a stranger's ticket by id is not ok.
  const order = await loadOwnedOrder(req, orderId);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const message = text.slice(0, 500);
  const [call] = await db.insert(waiterCallsTable).values({
    restaurantId: order.restaurantId,
    tableId: order.tableId,
    tableName: order.tableName,
    type: "guest_message",
    message: `Order #${orderId}: ${message}`,
    isResolved: false,
  }).returning();

  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as OrderTrackingMetadata;
  const tracking = { ...(meta.tracking ?? {}) };
  const updates = Array.isArray(tracking.kitchenUpdates) ? [...tracking.kitchenUpdates] : [];
  const now = new Date().toISOString();
  updates.unshift({ at: now, message: `You: ${message}`, type: "info" });
  tracking.kitchenUpdates = updates;

  await db.update(ordersTable).set({
    metadata: { ...meta, tracking },
  }).where(eq(ordersTable.id, orderId));

  broadcastOrderEvent(orderId, "order_status", { id: orderId, guestMessage: message });
  res.status(201).json({ success: true, callId: call.id });
});

router.get("/public/orders/:orderId/live", async (req, res): Promise<void> => {
  const orderId = parseInt(String(req.params.orderId), 10);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }
  // EventSource used to open for any sequential id, so a stranger could subscribe to
  // kitchen/payment events for every ticket. Same ownership as status/cancel/pay —
  // the guest session cookie travels with same-origin EventSource.
  const order = await loadOwnedOrder(req, orderId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const cleanup = addOrderSSEClient(res, orderId);
  req.on("close", cleanup);
});

export default router;
