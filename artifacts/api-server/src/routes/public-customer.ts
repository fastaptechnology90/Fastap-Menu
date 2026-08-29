import { Router, type IRouter, type Request } from "express";
import { eq, and, desc, or, sql, gte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
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
import { addOrderSSEClient, broadcastOrderEvent } from "../lib/sse.js";
import {
  autoAssignHousekeepingTask,
  autoAssignMaintenanceRequest,
  autoAssignRoomServiceRequest,
} from "../lib/staff-auto-assignment.js";
import { normalizeBuckets, totalBalance } from "../lib/customerWalletLogic.js";
import { resolveVenueSlug } from "../lib/demo-venue.js";
import { tierFromPoints, normalizeRewardsMeta } from "../lib/loyaltyMembershipLogic.js";
import {
  parseDeviceInfo, recordDeviceLogin, removeDevice, trustDevice, markAlertsRead,
  socialEmailForProvider, GUEST_TYPES, type GuestType,
} from "../lib/guestAuthLogic.js";
import { getPlatformSettingsRaw } from "../lib/platform-admin.js";
import { getPublicIntegrationsConfig } from "../lib/platform-integrations.js";
import { canAccessGuestVenue, getPublicationStatus, guestVenueAccessError } from "../lib/restaurant-publication.js";

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
    branch: detectedBranch,
    branches,
    areas: areas.map(a => ({
      ...a,
      areaCategory: a.areaType,
      tables: tables.filter(t => t.zone === a.name).length,
    })),
    areaGroups,
    table: detectedTable ? { id: detectedTable.id, name: detectedTable.name, status: detectedTable.status, zone: detectedTable.zone, capacity: detectedTable.capacity, isVip: detectedTable.isVip } : null,
    room: detectedRoom ? { number: detectedRoom.number, type: detectedRoom.type, floor: detectedRoom.floor, guestName: detectedRoom.guestName } : null,
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
  const [session] = await db.insert(guestSessionsTable).values({
    token,
    shareCode,
    restaurantId: restaurantId ?? req.session.restaurantId ?? null,
    sessionType: sessionType ?? "personal",
    tableId: tableId ?? null,
    tableName: tableName ?? null,
    roomNumber: roomNumber ?? null,
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
  res.status(201).json({ session });
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
  const restaurantId = parseInt(req.params.restaurantId, 10);
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

router.post("/public/auth/otp/send", async (req, res): Promise<void> => {
  const phone = String(req.body.phone ?? "").replace(/\D/g, "");
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }
  const isDemoPhone = phone === DEMO_GUEST_PHONE || phone.endsWith(DEMO_GUEST_PHONE);
  const otp = isDemoPhone ? DEMO_GUEST_OTP
    : process.env.NODE_ENV === "production" ? String(Math.floor(100000 + Math.random() * 900000)) : DEMO_GUEST_OTP;
  otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  res.json({
    success: true,
    message: "OTP sent",
    devOtp: process.env.NODE_ENV !== "production" || isDemoPhone ? otp : undefined,
  });
});

router.post("/public/auth/otp/verify", async (req, res): Promise<void> => {
  try {
    const phone = String(req.body.phone ?? "").replace(/\D/g, "");
    const { otp, name, restaurantId } = req.body;
    const rid = restaurantId ? parseInt(String(restaurantId), 10) : undefined;
    if (!phone || !otp) { res.status(400).json({ error: "phone and otp required" }); return; }
    const isDemoLogin = (phone === DEMO_GUEST_PHONE || phone.endsWith(DEMO_GUEST_PHONE)) && String(otp) === DEMO_GUEST_OTP;
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

  let discount = 0;
  if (promo) {
    const sub = parseNum(subtotal);
    const minOrder = parseNum(promo.minOrderAmount);
    if (sub < minOrder) { res.status(400).json({ error: `Minimum order ₹${minOrder} required` }); return; }
    if (promo.discountType === "percent") {
      discount = Math.round(sub * parseNum(promo.discountValue) / 100);
      if (promo.maxDiscount) discount = Math.min(discount, parseNum(promo.maxDiscount));
    } else {
      discount = parseNum(promo.discountValue);
    }
    await db.update(promoCodesTable).set({ usedCount: promo.usedCount + 1 }).where(eq(promoCodesTable.id, promo.id));
  } else {
    res.status(404).json({ error: "Invalid coupon code" });
    return;
  }

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
  const conditions = [];
  if (restaurantId) conditions.push(eq(ordersTable.restaurantId, restaurantId));
  if (guest.phone) conditions.push(eq(ordersTable.customerPhone, guest.phone));
  if (guest.email) conditions.push(eq(ordersTable.customerEmail, guest.email));
  if (conditions.length === 0) { res.json([]); return; }

  const list = await db.select().from(ordersTable).where(or(...conditions)).orderBy(desc(ordersTable.createdAt)).limit(50);
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
  const [request] = await db.insert(roomServiceRequestsTable).values({
    restaurantId,
    roomNumber,
    guestName,
    guestPhone,
    type: type || "food",
    items: items || [],
    notes,
    total: String(parseNum(total).toFixed(2)),
    paymentMethod: paymentMethod || "room_bill",
    status: "pending",
  }).returning();
  const assigned = await autoAssignRoomServiceRequest(restaurantId, request.id);
  res.status(201).json(assigned ?? request);
});

router.post("/public/housekeeping", async (req, res): Promise<void> => {
  const { restaurantId, roomNumber, type, title, description, priority } = req.body;
  if (!restaurantId || !roomNumber) { res.status(400).json({ error: "restaurantId and roomNumber required" }); return; }
  const [task] = await db.insert(housekeepingTasksTable).values({
    restaurantId,
    type: type || "cleaning",
    title: title || "Guest request",
    description,
    location: `Room ${roomNumber}`,
    roomNumber,
    priority: priority || "normal",
    status: "pending",
  }).returning();
  const assigned = await autoAssignHousekeepingTask(restaurantId, task.id);
  res.status(201).json(assigned ?? task);
});

router.post("/public/maintenance", async (req, res): Promise<void> => {
  const { restaurantId, roomNumber, title, description, category, priority } = req.body;
  if (!restaurantId || !roomNumber) { res.status(400).json({ error: "restaurantId and roomNumber required" }); return; }
  const [request] = await db.insert(maintenanceRequestsTable).values({
    restaurantId,
    title: title || "Maintenance request",
    description,
    location: `Room ${roomNumber}`,
    category: category || "general",
    priority: priority || "normal",
    reportedBy: `Room ${roomNumber}`,
    status: "open",
  }).returning();
  const assigned = await autoAssignMaintenanceRequest(restaurantId, request.id);
  res.status(201).json(assigned ?? request);
});

router.get("/public/room/:restaurantId/:roomNumber", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [room] = await db.select().from(hotelRoomsTable).where(
    and(eq(hotelRoomsTable.restaurantId, restaurantId), eq(hotelRoomsTable.number, req.params.roomNumber)),
  );
  if (!room) { res.status(404).json({ error: "Room not found" }); return; }
  res.json(room);
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
  const orderId = parseInt(req.params.orderId, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
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
    ...tracking,
  });
});

router.post("/public/orders/:orderId/message", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const text = String(req.body?.message ?? "").trim();
  if (!text) { res.status(400).json({ error: "message required" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
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

router.get("/public/orders/:orderId/live", (req, res): void => {
  const orderId = parseInt(req.params.orderId, 10);
  if (Number.isNaN(orderId)) { res.status(400).json({ error: "Invalid order id" }); return; }
  const cleanup = addOrderSSEClient(res, orderId);
  req.on("close", cleanup);
});

export default router;
