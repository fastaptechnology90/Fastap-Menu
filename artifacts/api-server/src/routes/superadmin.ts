import { Router, type IRouter, type Response } from "express";
import { eq, desc, count, and, sql, inArray, gte, lte } from "drizzle-orm";
import {
  db, restaurantsTable, usersTable, ordersTable, documentsTable, supportTicketsTable, staffTable, branchesTable,
  platformAuditLogsTable, platformSettlementsTable, platformRefundsTable, platformChargebacksTable,
  platformFraudAlertsTable, platformCouponsTable, platformCommissionRulesTable, platformTaxesTable,
  platformApiKeysTable, platformNotificationsTable, platformCommunicationsTable, platformPenaltiesTable,
  platformTasksTable, platformAnnouncementsTable, platformExportsTable, platformAgreementsTable,
  platformCrmLogsTable, platformPlansTable, platformRolesTable, platformIpWhitelistTable,
  platformErrorLogsTable, qrCodesTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireSuperAdmin, type AdminRequest } from "../middlewares/superadmin-auth";
import {
  ensurePlatformDefaults, getEnhancedStats, getRevenueTimeSeries, getExtendedAnalytics, getTaxReports,
  listPayments, listSettlements, syncPendingSettlements, listKycRecords, updateKycStatus, detectFraudAlerts, listQrCodes,
  logPlatformAudit, getPlatformSettings, getPlatformSettingsRaw, setPlatformSettings, getCommissionRate, hashApiKey,
  getInfrastructureOverview, getSlaMonitoring, countExportRecords, generateExportCsv,
  getPaymentDetail, getLiveFeed, getWebhooks, saveWebhooks, getApiUsageAnalytics, masterSearch,
  listAdminSessions, revokeAdminSession,
  readPlatformControls, listSubscriptionInvoices, verifyWhiteLabelDomain, getSubscriptionMrr,
} from "../lib/platform-admin";
import { PLATFORM_CURRENCY } from "../lib/currency.js";
import { invalidateRestaurantAnalyticsCache } from "../lib/analytics-cache.js";
import { sumOrderTotals, isPaidOrder } from "../lib/payment-calculations.js";
import { getSpaRevenue, getSpaRevenueByRestaurant, getBanquetRevenue, getBanquetRevenueByRestaurant } from "../lib/ancillary-revenue.js";
import {
  listApprovals, createApproval, updateApproval, listPlatformReservations, updatePlatformReservation,
  getRolePermissions, setRolePermissions,
  listBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
  listVendorWallets, getBillingRules, saveBillingRules, getAIInsights, getAlertRules, saveAlertRules,
  getIncidents, saveIncident, updateIncident, getDRStatus, saveDRStatus, getLegalCenter, saveLegalHold,
  getSandboxConfig, saveSandboxConfig, getArchivalPolicies, runArchival, getFeatureReleases, saveFeatureReleases,
  getSettlementRules, saveSettlementRules, getDormantVendors, saveDormantRules, getRevenueLeakage,
  retryRefund, cancelRefund, partialRefund, uploadChargebackEvidence, bulkVendorAction,
  approveExport, rejectExport, mergeSupportTickets,
} from "../lib/platform-extensions.js";
import { registerSuperAdminFeatureRoutes } from "./feature-modules.js";
import { runtimeSnapshot } from "../lib/runtime-metrics.js";

const router: IRouter = Router();
const admin = [requireSuperAdmin] as const;

/**
 * The only roles a platform account may hold. These are the platform owner's own
 * staff — deliberately none of the restaurant-side roles (restaurant_owner, manager,
 * cashier, waiter…), which belong to a venue's own team and are issued per restaurant
 * by the restaurant panel, never from here. A restaurant is a customer of the
 * platform, not a member of its team, so the two sets must never mix.
 */
const PLATFORM_ADMIN_ROLES = [
  "super_admin", "finance_admin", "support_admin",
  "compliance_admin", "sales_admin", "operations_admin",
] as const;

router.post("/superadmin/setup", async (req, res): Promise<void> => {
  try {
    await ensurePlatformDefaults();
    const [existing] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "super_admin"));
    if ((existing?.count ?? 0) > 0) {
      res.status(403).json({ error: "Super admin already exists. Use the login form." });
      return;
    }
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
      res.status(400).json({ error: "Name, email, and password (min 8 chars) are required." });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({ name, email, passwordHash, role: "super_admin" }).returning();
    req.session.userId = user.id;
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Email already registered." }); return; }
    res.status(500).json({ error: "Setup failed." });
  }
});

router.get("/superadmin/stats", ...admin, async (req, res): Promise<void> => {
  try {
    await ensurePlatformDefaults();
    const stats = await getEnhancedStats();
    res.json(stats);
  } catch {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Custom-date revenue: the super-admin can see paid revenue for any day / date range,
// optionally for one restaurant. Uses the same paid-order rule as every other panel.
router.get("/superadmin/revenue", ...admin, async (req, res): Promise<void> => {
  // Parse YYYY-MM-DD as LOCAL midnight (not UTC) to avoid a timezone off-by-one day.
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
  const restaurantId = req.query.restaurantId ? parseInt(String(req.query.restaurantId), 10) : null;

  // Fetch and filter in JS so a bill COLLECTED in the range counts even if the order was
  // opened earlier (metadata.payment.collectedAt), matching the owner/POS "today" figure.
  const rows = await db.select({
    total: ordersTable.total, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status,
    createdAt: ordersTable.createdAt, metadata: ordersTable.metadata,
  }).from(ordersTable).where(restaurantId && !Number.isNaN(restaurantId) ? eq(ordersTable.restaurantId, restaurantId) : undefined);
  const inRange = (o: typeof rows[0]) => {
    const created = new Date(o.createdAt);
    const colRaw = (o.metadata as any)?.payment?.collectedAt;
    const collected = colRaw ? new Date(colRaw) : null;
    const okFrom = (d: Date | null) => d != null && !Number.isNaN(d.getTime()) && (!from || d >= from) && (!toEnd || d <= toEnd);
    return okFrom(created) || okFrom(collected);
  };
  const inRangeRows = rows.filter(inRange);
  const orderRevenue = sumOrderTotals(inRangeRows);
  const rid = restaurantId && !Number.isNaN(restaurantId) ? restaurantId : null;
  const spaRevenue = await getSpaRevenue(rid, from, toEnd);
  const banquetRevenue = await getBanquetRevenue(rid, from, toEnd);
  // These dates are parsed as LOCAL midnight, so toISOString() would shift them back
  // across the UTC offset and echo the previous day — the dashboard then labels the
  // "Today" range with yesterday's date. Format from the local fields instead.
  const asDay = (d: Date | null) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;
  res.json({
    from: asDay(from),
    to: asDay(toRaw),
    revenue: Math.round((orderRevenue + spaRevenue + banquetRevenue) * 100) / 100,
    orderRevenue,
    spaRevenue,
    banquetRevenue,
    totalOrders: inRangeRows.length,
  });
});

// All restaurants with their total revenue (orders + spa) — one row per restaurant so the
// super-admin can see "is restaurant se itna aaya", plus a platform grand total.
router.get("/superadmin/restaurant-revenues", ...admin, async (_req, res): Promise<void> => {
  const allRest = await db.select({ id: restaurantsTable.id, name: restaurantsTable.name, isActive: restaurantsTable.isActive, settings: restaurantsTable.settings }).from(restaurantsTable);
  // Skip soft-deleted restaurants (same rule the vendor/KYC lists use) so the list isn't
  // cluttered with removed test venues.
  const restaurants = allRest.filter(r => !readPlatformControls(r.settings).deletedAt);
  const allOrders = await db.select({ restaurantId: ordersTable.restaurantId, total: ordersTable.total, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status }).from(ordersTable);
  const byRest = new Map<number, typeof allOrders>();
  for (const o of allOrders) {
    const arr = byRest.get(o.restaurantId) ?? [];
    arr.push(o);
    byRest.set(o.restaurantId, arr);
  }
  const spaByRest = await getSpaRevenueByRestaurant();   // one query for all restaurants
  const banquetByRest = await getBanquetRevenueByRestaurant();
  const rows = restaurants.map(r => {
    const orders = byRest.get(r.id) ?? [];
    const orderRevenue = sumOrderTotals(orders);
    const spaRevenue = spaByRest.get(r.id) ?? 0;
    const banquetRevenue = banquetByRest.get(r.id) ?? 0;
    return {
      id: r.id, name: r.name, isActive: r.isActive,
      orderRevenue, spaRevenue, banquetRevenue,
      totalRevenue: Math.round((orderRevenue + spaRevenue + banquetRevenue) * 100) / 100,
      paidOrders: orders.filter(isPaidOrder).length,
    };
  });
  rows.sort((a, b) => b.totalRevenue - a.totalRevenue);
  const grandTotal = Math.round(rows.reduce((s, r) => s + r.totalRevenue, 0) * 100) / 100;
  res.json({ restaurants: rows, grandTotal, count: rows.length });
});

router.get("/superadmin/analytics/revenue-series", ...admin, async (_req, res): Promise<void> => {
  res.json(await getRevenueTimeSeries());
});

router.get("/superadmin/analytics/extended", ...admin, async (_req, res): Promise<void> => {
  res.json(await getExtendedAnalytics());
});

router.get("/superadmin/taxes/reports", ...admin, async (_req, res): Promise<void> => {
  res.json(await getTaxReports());
});

router.post("/superadmin/subscriptions/:vendorId/action", ...admin, async (req, res): Promise<void> => {
  const vendorId = parseInt(String(req.params.vendorId), 10);
  const { action, plan } = req.body as { action?: string; plan?: string };
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, vendorId));
  if (!r) { res.status(404).json({ error: "Vendor not found" }); return; }

  if (action === "pause" || action === "cancel") {
    await db.update(restaurantsTable).set({ isActive: false }).where(eq(restaurantsTable.id, vendorId));
  } else if (action === "resume" || action === "renew") {
    await db.update(restaurantsTable).set({ isActive: true }).where(eq(restaurantsTable.id, vendorId));
  }
  invalidateRestaurantAnalyticsCache(vendorId);
  if (plan) {
    // Validate against the plans that actually exist, not a hardcoded list — otherwise a
    // plan built in the Plan Builder could never be assigned: the call returned success
    // and the vendor silently stayed on the old plan.
    const [target] = await db.select().from(platformPlansTable).where(eq(platformPlansTable.id, plan));
    if (!target) { res.status(400).json({ error: `Unknown plan "${plan}"` }); return; }
    await db.update(restaurantsTable).set({ plan }).where(eq(restaurantsTable.id, vendorId));
  }
  await logPlatformAudit(req, `Subscription ${action}`, "Subscriptions", String(vendorId), { plan });
  const [updated] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, vendorId));
  res.json({ success: true, vendor: updated });
});

router.get("/superadmin/vendors", ...admin, async (req, res): Promise<void> => {
  const includeDeleted = req.query.includeDeleted === "true";
    const restaurants = await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt));
  const filtered = includeDeleted ? restaurants : restaurants.filter(r => !readPlatformControls(r.settings).deletedAt);
  // Real, order-driven revenue per vendor: the sum of their paid orders (same rule the
  // dashboard total uses). It grows as orders come in — no hard-coded plan amounts.
  // Owners fetched in ONE query (not one per vendor) to avoid an N+1 round-trip storm.
  const ownerIds = [...new Set(filtered.map(r => r.userId).filter((id): id is number => typeof id === "number"))];
  const [allOrders, owners] = await Promise.all([
    db.select().from(ordersTable),
    ownerIds.length
      ? db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable).where(inArray(usersTable.id, ownerIds))
      : Promise.resolve([]),
  ]);
  const ownerById = new Map(owners.map(o => [o.id, o]));
  const result = filtered.map((r) => {
    const owner = ownerById.get(r.userId as number);
    const vendorOrders = allOrders.filter(o => o.restaurantId === r.id);
    const settings = (r.settings ?? {}) as { kyc?: { status?: string }; wallet?: { frozen?: boolean } };
    const controls = readPlatformControls(r.settings);
    return {
      ...r, ownerName: owner?.name ?? "", ownerEmail: owner?.email ?? "",
      totalOrders: vendorOrders.length,
      revenue: sumOrderTotals(vendorOrders),
      kycStatus: settings.kyc?.status ?? "pending",
      payoutsFrozen: settings.wallet?.frozen ?? false,
      platformControls: controls,
    };
  });
  res.json(result);
});

router.get("/superadmin/restaurants", ...admin, async (_req, res) => {
    const restaurants = await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt));
  res.json(restaurants);
});

router.post("/superadmin/vendors", ...admin, async (req, res): Promise<void> => {
  try {
    const { name, ownerName, email, phone, businessType, plan, address, password } = req.body;
    if (!name || !email) { res.status(400).json({ error: "Name and email are required" }); return; }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + crypto.randomBytes(3).toString("hex");
    const passwordHash = await bcrypt.hash(password || crypto.randomBytes(12).toString("hex"), 12);
    const [newUser] = await db.insert(usersTable).values({
      name: ownerName || name, email, passwordHash, role: "restaurant_owner",
    }).returning();
    const [newRestaurant] = await db.insert(restaurantsTable).values({
      userId: newUser.id, name, slug, phone: phone || null, address: address || null,
      businessType: businessType || "Restaurant", plan: plan || "starter", isActive: true,
    }).returning();
    await logPlatformAudit(req, "Vendor Created", "Vendors", String(newRestaurant.id));
    res.status(201).json({ ...newRestaurant, ownerName: newUser.name, ownerEmail: newUser.email, totalOrders: 0 });
  } catch (err: any) {
    if (err?.code === "23505") res.status(409).json({ error: "A vendor with this email already exists" });
    else res.status(500).json({ error: "Failed to create vendor" });
  }
});

router.post("/superadmin/vendors/:vendorId/toggle", ...admin, async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.vendorId), 10);
    const [existing] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const nextActive = !existing.isActive;
    let [updated] = await db.update(restaurantsTable).set({ isActive: nextActive }).where(eq(restaurantsTable.id, id)).returning();
    // Owner login is gated on KYC being APPROVED (not just isActive). So activating a
    // vendor here also clears a stuck "pending" KYC, otherwise the owner still can't
    // sign in even though the panel shows "Active".
    if (nextActive) {
      const kyc = (existing.settings as { kyc?: { status?: string } } | null)?.kyc?.status;
      if (kyc !== "approved") {
        const re = await updateKycStatus(id, "approved");
        if (re) updated = re;
      }
    }
  invalidateRestaurantAnalyticsCache(id);
  await logPlatformAudit(req, updated.isActive ? "Vendor Activated" : "Vendor Suspended", "Vendors", String(id));
    res.json(updated);
});

// ── Self-service registration approvals ────────────────────────────────────────
// Accounts created through the public POST /auth/register land as "pending" and
// cannot sign in until a super admin acts here. Existing and admin-created accounts
// default to "approved", so they never show up in this queue.

router.get("/superadmin/pending-owners", ...admin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, isEmailVerified: usersTable.isEmailVerified,
      approvalStatus: usersTable.approvalStatus, createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.approvalStatus, "pending"))
    .orderBy(desc(usersTable.createdAt));
  res.json(rows);
});

router.post("/superadmin/owners/:userId/approve", ...admin, async (req: any, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (!Number.isFinite(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Only self-service restaurant_owner sign-ups belong in this flow; an admin account
  // is never "pending" and should not be touched through the approvals queue.
  if (user.role.includes("admin")) {
    res.status(403).json({ error: "Admin accounts are not part of the registration approval flow." });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ approvalStatus: "approved", approvedAt: new Date(), approvedBy: String(req.session.userId ?? "") })
    .where(eq(usersTable.id, userId))
    .returning();
  await logPlatformAudit(req, "Owner Approved", "Registrations", String(userId), { email: user.email });
  res.json({ success: true, user: { id: updated.id, email: updated.email, approvalStatus: updated.approvalStatus } });
});

router.post("/superadmin/owners/:userId/reject", ...admin, async (req: any, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (!Number.isFinite(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // This queue is only ever for self-service restaurant_owner sign-ups. An admin
  // account is created deliberately and stays "approved" — rejecting one here would
  // set its status to "rejected" and lock that admin out of sign-in. Refuse it.
  if (user.role.includes("admin")) {
    res.status(403).json({ error: "Admin accounts are not part of the registration approval flow." });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ approvalStatus: "rejected", approvedAt: new Date(), approvedBy: String(req.session.userId ?? "") })
    .where(eq(usersTable.id, userId))
    .returning();
  await logPlatformAudit(req, "Owner Rejected", "Registrations", String(userId), { email: user.email });
  res.json({ success: true, user: { id: updated.id, email: updated.email, approvalStatus: updated.approvalStatus } });
});

router.put("/superadmin/vendors/:vendorId/plan", ...admin, async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.vendorId), 10);
    const { plan } = req.body;
    // Any string used to be accepted here. A plan id that is not in platform_plans has
    // no price, so the vendor's subscription silently falls to zero and drops out of
    // MRR while the change still reports success.
    const [planRow] = await db.select().from(platformPlansTable).where(eq(platformPlansTable.id, String(plan ?? "")));
    if (!planRow) { res.status(400).json({ error: "Unknown plan" }); return; }
    const [updated] = await db.update(restaurantsTable).set({ plan }).where(eq(restaurantsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const { syncPlanKitchenEntitlements } = await import("../lib/feature-modules/entitlements.js");
    await syncPlanKitchenEntitlements(id, plan);
  await logPlatformAudit(req, "Plan Updated", "Vendors", String(id), { plan });
    res.json(updated);
});

router.post("/superadmin/vendors/:vendorId/freeze-payouts", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.vendorId), 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const settings = { ...(r.settings as object ?? {}), wallet: { ...((r.settings as { wallet?: object })?.wallet ?? {}), frozen: true } };
  await db.update(restaurantsTable).set({ settings }).where(eq(restaurantsTable.id, id));
  await logPlatformAudit(req, "Payouts Frozen", "Vendors", String(id));
  res.json({ frozen: true });
});

router.post("/superadmin/vendors/:vendorId/reset-password", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.vendorId), 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const tempPassword = crypto.randomBytes(8).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, r.userId));
  await logPlatformAudit(req, "Password Reset", "Vendors", String(id));
  res.json({ message: "Password reset successfully", temporaryPassword: tempPassword });
});

router.get("/superadmin/vendors/:vendorId/settlements", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.vendorId), 10);
  const [r] = await db.select({ name: restaurantsTable.name }).from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const rows = await db.select().from(platformSettlementsTable)
    .where(eq(platformSettlementsTable.restaurantId, id))
    .orderBy(desc(platformSettlementsTable.createdAt));
  res.json(rows.map(s => ({
    id: `SET-${s.id}`, vendorName: r.name,
    grossSales: parseFloat(String(s.grossSales ?? 0)),
    commission: parseFloat(String(s.commission ?? 0)),
    refunds: parseFloat(String(s.refunds ?? 0)),
    finalPayout: parseFloat(String(s.finalPayout ?? 0)),
    status: s.status, cycle: s.cycle ?? "weekly",
    dueDate: s.dueDate?.toISOString() ?? s.createdAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  })));
});

router.get("/superadmin/vendors/:vendorId", ...admin, async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.vendorId), 10);
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
    if (!r) { res.status(404).json({ error: "Not found" }); return; }
    const [owner] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, r.userId));
    const [orderCnt] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.restaurantId, r.id));
  const settings = (r.settings ?? {}) as { wallet?: { frozen?: boolean }; kyc?: { status?: string } };
  const platformControls = readPlatformControls(r.settings);
  res.json({
    ...r, ownerName: owner?.name ?? "", ownerEmail: owner?.email ?? "",
    totalOrders: orderCnt?.count ?? 0,
    payoutsFrozen: settings.wallet?.frozen ?? false,
    kycStatus: settings.kyc?.status ?? "pending",
    platformControls,
  });
});

router.get("/superadmin/vendors/:vendorId/staff", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.vendorId), 10);
  const rows = await db.select().from(staffTable).where(eq(staffTable.restaurantId, id));
  res.json(rows.map(({ pinHash: _h, ...rest }) => ({
    id: `S${rest.id}`, name: rest.name, role: rest.role, branch: "Main",
    status: rest.isActive ? "Active" : "Inactive",
    lastLogin: rest.updatedAt?.toISOString() ?? rest.createdAt?.toISOString() ?? null,
    email: rest.email, phone: rest.phone,
  })));
});

router.get("/superadmin/vendors/:vendorId/branches", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.vendorId), 10);
  const rows = await db.select().from(branchesTable).where(eq(branchesTable.restaurantId, id));
  res.json(rows.map(b => ({
    id: `B${b.id}`, name: b.name, location: b.address || "—",
    tables: 0, rooms: 0, status: b.isActive ? "Active" : "Inactive",
  })));
});

router.get("/superadmin/vendors/:vendorId/documents", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.vendorId), 10);
  const rows = await db.select().from(documentsTable).where(eq(documentsTable.restaurantId, id)).orderBy(desc(documentsTable.createdAt));
  res.json(rows.map(d => ({
    type: d.name || d.category || "Document",
    docType: d.description || "",           // the real kind: gst_certificate / fssai_license / bank_proof …
    number: d.description || `DOC-${d.id}`,
    status: d.status === "active" ? "Verified" : d.status === "expired" ? "Expired" : d.status === "rejected" ? "Rejected" : "Pending",
    uploaded: d.createdAt ? new Date(d.createdAt).toISOString().split("T")[0] : "—",
    expires: d.expiryDate ? new Date(d.expiryDate).toISOString().split("T")[0] : null,
    fileUrl: d.fileUrl || null,             // so the admin can preview the document, not just download it
    fileType: d.fileType || null,
    id: d.id,
  })));
});

// Approve or reject a SINGLE KYC document (per-document review).
router.post("/superadmin/documents/:docId/verify", ...admin, async (req, res): Promise<void> => {
  const docId = parseInt(String(req.params.docId), 10);
  const action = String(req.body?.status ?? "").toLowerCase();
  const dbStatus = action === "verified" || action === "approve" || action === "approved" ? "active"
    : action === "rejected" || action === "reject" ? "rejected" : null;
  if (!dbStatus) { res.status(400).json({ error: "status must be 'verified' or 'rejected'" }); return; }
  const [doc] = await db.update(documentsTable)
    .set({ status: dbStatus })
    .where(eq(documentsTable.id, docId)).returning();
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }

  // Roll the per-document decisions up into the restaurant's overall KYC status so the
  // KYC page stops showing "Pending" once everything is approved — and the owner can
  // then sign in. Any rejected doc flags the whole application as "action required".
  let overallKyc: string | null = null;
  const allDocs = await db.select().from(documentsTable).where(eq(documentsTable.restaurantId, doc.restaurantId));
  if (allDocs.some(d => d.status === "rejected")) {
    await updateKycStatus(doc.restaurantId, "action_required");
    overallKyc = "action_required";
  } else if (allDocs.length > 0 && allDocs.every(d => d.status === "active")) {
    await updateKycStatus(doc.restaurantId, "approved");
    overallKyc = "approved";
  }
  invalidateRestaurantAnalyticsCache(doc.restaurantId);
  res.json({ ok: true, id: docId, status: dbStatus, overallKyc });
});

router.get("/superadmin/vendors/:vendorId/crm-logs", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.vendorId), 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const rows = await db.select().from(platformCrmLogsTable)
    .where(eq(platformCrmLogsTable.restaurantId, id))
    .orderBy(desc(platformCrmLogsTable.loggedAt));
  res.json(rows.map(l => ({
    id: `n${l.id}`, type: l.logType, content: l.notes, author: l.loggedBy || "Admin",
    date: l.loggedAt ? new Date(l.loggedAt).toISOString().split("T")[0] : "—",
  })));
});

router.post("/superadmin/vendors/:vendorId/branches", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.vendorId), 10);
  const { name, address, phone, isActive } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Branch name is required" }); return; }
  const [branch] = await db.insert(branchesTable).values({
    restaurantId: id, name: name.trim(), address: address || null, phone: phone || null, isActive: isActive ?? true,
  }).returning();
  await logPlatformAudit(req, "Branch Created", "Vendors", String(id));
  res.status(201).json({ id: `B${branch.id}`, name: branch.name, location: branch.address || "—", status: branch.isActive ? "Active" : "Inactive" });
});

router.put("/superadmin/vendors/:vendorId/branches/:branchId", ...admin, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.vendorId), 10);
  const branchId = parseInt(String(req.params.branchId).replace("B", ""), 10);
  const { name, address, phone, isActive } = req.body;
  const [branch] = await db.update(branchesTable).set({
    ...(name != null && { name }), ...(address != null && { address }),
    ...(phone != null && { phone }), ...(isActive != null && { isActive }),
  }).where(and(eq(branchesTable.id, branchId), eq(branchesTable.restaurantId, restaurantId))).returning();
  if (!branch) { res.status(404).json({ error: "Branch not found" }); return; }
  res.json({ id: `B${branch.id}`, name: branch.name, location: branch.address || "—", status: branch.isActive ? "Active" : "Inactive" });
});

router.delete("/superadmin/vendors/:vendorId/branches/:branchId", ...admin, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.vendorId), 10);
  const branchId = parseInt(String(req.params.branchId).replace("B", ""), 10);
  const [deleted] = await db.delete(branchesTable).where(and(eq(branchesTable.id, branchId), eq(branchesTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Branch not found" }); return; }
  await logPlatformAudit(req, "Branch Disabled", "Vendors", String(restaurantId));
  res.json({ deleted: true });
});

router.post("/superadmin/vendors/:vendorId/staff", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.vendorId), 10);
  const { name, email, role, phone, password } = req.body;
  if (!name?.trim() || !email?.trim() || !role) { res.status(400).json({ error: "name, email, and role are required" }); return; }
  const pinHash = await bcrypt.hash(password || crypto.randomBytes(6).toString("hex"), 10);
  const [member] = await db.insert(staffTable).values({
    restaurantId: id, name: name.trim(), email: email.trim().toLowerCase(),
    phone: phone ? String(phone).replace(/\D/g, "") : null, role, pinHash, isActive: true, joinDate: new Date(),
  }).returning();
  await logPlatformAudit(req, "Staff Added", "Vendors", String(id));
  res.status(201).json({ id: `S${member.id}`, name: member.name, role: member.role, status: "Active" });
});

router.delete("/superadmin/vendors/:vendorId/staff/:staffId", ...admin, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.vendorId), 10);
  const staffId = parseInt(String(req.params.staffId).replace("S", ""), 10);
  const [deleted] = await db.delete(staffTable).where(and(eq(staffTable.id, staffId), eq(staffTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Staff not found" }); return; }
  await logPlatformAudit(req, "Staff Removed", "Vendors", String(restaurantId));
  res.json({ deleted: true });
});

router.post("/superadmin/vendors/:vendorId/qrcodes", ...admin, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.vendorId), 10);
  const { label, type, tableId } = req.body;
  const [restaurant] = await db.select({ slug: restaurantsTable.slug }).from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant) { res.status(404).json({ error: "Vendor not found" }); return; }
  const baseUrl = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  const url = `${baseUrl}/menu/${restaurant.slug}${tableId ? `?table=${tableId}` : ""}`;
  const [code] = await db.insert(qrCodesTable).values({
    restaurantId, tableId: tableId ?? null, label: label || `Table ${tableId || "Menu"}`, type: type || "table", url,
  }).returning();
  res.status(201).json({ id: String(code.id), tableNo: code.label, type: code.type, url: code.url, scans: 0, status: "Active" });
});

router.delete("/superadmin/vendors/:vendorId/qrcodes/:qrId", ...admin, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.vendorId), 10);
  const qrId = parseInt(String(req.params.qrId), 10);
  const [deleted] = await db.delete(qrCodesTable).where(and(eq(qrCodesTable.id, qrId), eq(qrCodesTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "QR code not found" }); return; }
  res.json({ deleted: true });
});

router.get("/superadmin/users", ...admin, async (_req, res) => {
    // Admin Users lists the platform owner's own team. Restaurant accounts are
    // customers, not staff, and are managed from the restaurant side — returning them
    // here put a venue's owner in a list whose only control is "change platform role".
    const users = await db.select({
    id: usersTable.id, name: usersTable.name, email: usersTable.email,
    role: usersTable.role, createdAt: usersTable.createdAt,
    }).from(usersTable)
    .where(inArray(usersTable.role, [...PLATFORM_ADMIN_ROLES]))
    .orderBy(desc(usersTable.createdAt));
    res.json(users);
});

router.get("/superadmin/plans", ...admin, async (_req, res) => {
  await ensurePlatformDefaults();
  const plans = await db.select().from(platformPlansTable).orderBy(platformPlansTable.sortOrder);
  res.json(plans.map(p => ({
    id: p.id, name: p.name, price: parseFloat(String(p.price)), currency: PLATFORM_CURRENCY,
    features: p.features, maxBranches: p.maxBranches, maxItems: p.maxItems, maxStaff: p.maxStaff,
    maxTables: p.maxTables, maxOrdersPerMonth: p.maxOrdersPerMonth, trialDays: p.trialDays,
    featureToggles: p.featureToggles, isPublished: p.isPublished,
  })));
});

/**
 * A plan is a price list. Nothing validated it, so a plan could be published at a
 * negative price — a venue subscribing to it would be credited rather than billed —
 * or with a negative/zero allowance, which grants nothing and cannot be sold. Only the
 * fields actually present are checked, so this serves the partial PUT as well as POST.
 *
 * Zero is allowed where zero is a real offer (a free plan, a plan with no trial) and
 * refused where it is not (a plan that permits no branches, items, staff or tables).
 */
function validatePlanInput(body: Record<string, unknown>): string | null {
  if ("name" in body && String(body.name ?? "").trim() === "") {
    return "name cannot be blank";
  }
  if ("price" in body && body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price)) return "price must be a number";
    if (price < 0) return "price cannot be negative — a plan bills the vendor, it does not pay them";
  }
  const limits: [string, unknown][] = [
    ["maxBranches", body.maxBranches], ["maxItems", body.maxItems],
    ["maxStaff", body.maxStaff], ["maxTables", body.maxTables],
  ];
  for (const [field, raw] of limits) {
    if (raw === undefined || raw === null) continue;
    const n = Number(raw);
    if (!Number.isInteger(n)) return `${field} must be a whole number`;
    if (n < 1) return `${field} must be at least 1 — a plan that allows none of them cannot be sold`;
  }
  if (body.maxOrdersPerMonth !== undefined && body.maxOrdersPerMonth !== null) {
    const n = Number(body.maxOrdersPerMonth);
    if (!Number.isInteger(n) || n < 1) return "maxOrdersPerMonth must be at least 1, or empty for unlimited";
  }
  if (body.trialDays !== undefined && body.trialDays !== null) {
    const n = Number(body.trialDays);
    if (!Number.isInteger(n) || n < 0) return "trialDays must be a whole number of 0 or more";
  }
  return null;
}

router.post("/superadmin/plans", ...admin, async (req, res) => {
  const { id, name, price, features, maxBranches, maxItems, maxStaff, maxTables,
    maxOrdersPerMonth, trialDays, isPublished, featureToggles } = req.body;
  if (!String(name ?? "").trim()) { res.status(400).json({ error: "name is required" }); return; }
  const invalid = validatePlanInput(req.body ?? {});
  if (invalid) { res.status(400).json({ error: invalid }); return; }
  // Checked here rather than left to the unique constraint, so the message names the
  // plan instead of surfacing a generic "that value is already in use".
  const planId = String(id || `plan_${Date.now()}`);
  const [clash] = await db.select().from(platformPlansTable).where(eq(platformPlansTable.id, planId));
  if (clash) { res.status(409).json({ error: `A plan with the id "${planId}" already exists` }); return; }
  // Every field the plan builder sends has to be persisted here. Dropping maxTables /
  // trialDays / isPublished meant a plan created with a 14-day trial silently came back
  // with none, and the admin got a success toast either way.
  const [plan] = await db.insert(platformPlansTable).values({
    id: planId, name, price: String(price ?? 0), currency: PLATFORM_CURRENCY,
    features: features ?? [], maxBranches: maxBranches ?? 1, maxItems: maxItems ?? 50, maxStaff: maxStaff ?? 5,
    maxTables: maxTables ?? 20, maxOrdersPerMonth: maxOrdersPerMonth ?? null, trialDays: trialDays ?? 0,
    isPublished: isPublished !== false,
    featureToggles: featureToggles ?? {},
  }).returning();
  res.status(201).json(plan);
});

router.put("/superadmin/plans/:id", ...admin, async (req, res) => {
  const { name, price, features, maxBranches, maxItems, maxStaff, maxTables, maxOrdersPerMonth, trialDays, isPublished, featureToggles, currency } = req.body;
  // The edit path went unchecked entirely, so an existing published plan could be
  // repriced to a negative figure.
  const invalid = validatePlanInput(req.body ?? {});
  if (invalid) { res.status(400).json({ error: invalid }); return; }
  const [plan] = await db.update(platformPlansTable).set({
    name, price: price !== undefined ? String(price) : undefined, features, maxBranches, maxItems, maxStaff,
    maxTables, maxOrdersPerMonth, trialDays, isPublished, featureToggles, currency: PLATFORM_CURRENCY,
  }).where(eq(platformPlansTable.id, req.params.id)).returning();
  // This answered 200 with an error body, and the web client only throws on !res.ok —
  // so an edit that saved nothing came back to the operator as "Plan saved".
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(plan);
});

router.delete("/superadmin/plans/:id", ...admin, async (req, res) => {
  // Deleting a plan vendors are still on left them pointing at a row that no longer
  // exists: their invoice amount became 0 and that revenue vanished from MRR with no
  // warning. Move them to another plan first.
  const [{ inUse } = { inUse: 0 }] = await db.select({ inUse: count() })
    .from(restaurantsTable).where(eq(restaurantsTable.plan, String(req.params.id)));
  if (inUse > 0) {
    res.status(409).json({ error: `${inUse} vendor${inUse === 1 ? " is" : "s are"} still on this plan` });
    return;
  }
  const [deleted] = await db.delete(platformPlansTable).where(eq(platformPlansTable.id, req.params.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json({ deleted: true });
});

router.post("/superadmin/plans/:id/duplicate", ...admin, async (req, res) => {
  const [source] = await db.select().from(platformPlansTable).where(eq(platformPlansTable.id, req.params.id));
  if (!source) { res.status(404).json({ error: "Plan not found" }); return; }
  const newId = `${source.id}_copy_${Date.now()}`;
  const [plan] = await db.insert(platformPlansTable).values({
    id: newId, name: `${source.name} (Copy)`, price: source.price, currency: PLATFORM_CURRENCY,
    features: source.features, featureToggles: source.featureToggles,
    maxBranches: source.maxBranches, maxItems: source.maxItems, maxStaff: source.maxStaff,
    maxTables: source.maxTables, maxOrdersPerMonth: source.maxOrdersPerMonth, trialDays: source.trialDays,
    isPublished: false, sortOrder: (source.sortOrder ?? 0) + 1,
  }).returning();
  res.status(201).json(plan);
});

router.get("/superadmin/analytics/summary", ...admin, async (req, res) => {
  const stats = await getEnhancedStats(typeof req.query.period === "string" ? req.query.period : undefined);
  const mrr = await getSubscriptionMrr();
  res.json({
    totalVendors: stats.totalRestaurants,
    totalUsers: stats.totalUsers,
    totalOrders: stats.totalOrders,
    totalRevenue: stats.totalRevenue,
    platformCommission: stats.platformCommission,
    mrr,
    todayRevenue: stats.todayRevenue,
    refundAmount: stats.refundAmount,
  });
});

router.get("/superadmin/audit-logs", ...admin, async (_req, res) => {
  const logs = await db.select().from(platformAuditLogsTable).orderBy(desc(platformAuditLogsTable.createdAt)).limit(200);
  res.json(logs.map(l => ({
    id: `LOG-${l.id}`, user: l.userName, action: l.action, module: l.module,
    target: l.target ?? "", dateTime: l.createdAt.toISOString(),
    ipAddress: l.ipAddress ?? "", severity: l.severity,
  })));
});

router.get("/superadmin/payments", ...admin, async (req, res) => {
  const limit = parseInt(String(req.query.limit ?? 100), 10);
  const status = req.query.status ? String(req.query.status) : undefined;
  res.json(await listPayments(limit, status));
});

router.get("/superadmin/payments/:id", ...admin, async (req, res) => {
  const detail = await getPaymentDetail(req.params.id);
  if (!detail) { res.status(404).json({ error: "Payment not found" }); return; }
  res.json(detail);
});

router.post("/superadmin/payments/:id/hold", ...admin, async (req, res) => {
  const orderId = parseInt(String(req.params.id).replace(/^TXN-/, ""), 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  const meta = { ...(order.metadata as object ?? {}), held: true, holdReason: req.body.reason || "Manual hold" };
  await db.update(ordersTable).set({ metadata: meta }).where(eq(ordersTable.id, orderId));
  await logPlatformAudit(req, "Payment Held", "Payments", req.params.id, { reason: req.body.reason });
  res.json({ success: true, held: true });
});

router.post("/superadmin/payments/:id/retry", ...admin, async (req, res) => {
  const orderId = parseInt(String(req.params.id).replace(/^TXN-/, ""), 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  const meta = order.metadata as Record<string, unknown> ?? {};
  const retryCount = Number(meta.retryCount ?? 0) + 1;

  const settings = await getPlatformSettingsRaw();
  const { processGatewayPayment, isOnlinePaymentMethod } = await import("../lib/payment-gateway.js");
  const method = order.paymentMethod ?? "upi";
  const amount = parseFloat(String(order.total ?? 0));

  let gatewayMeta: Record<string, unknown> = {};
  let paymentStatus = "pending";

  if (isOnlinePaymentMethod(method)) {
    const result = await processGatewayPayment(settings.integrations, {
      orderId,
      amount,
      paymentMethod: method,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
    });
    if (result.success) {
      paymentStatus = "paid";
      gatewayMeta = {
        gatewayId: result.gatewayId,
        gatewayTxnId: result.gatewayTxnId,
        gatewayOrderId: result.gatewayOrderId,
        utr: result.utr,
        gatewayMode: result.mode,
      };
    }
  } else {
    paymentStatus = method === "cash" ? "pending" : "paid";
  }

  await db.update(ordersTable).set({
    paymentStatus,
    metadata: { ...meta, ...gatewayMeta, retryCount, lastRetryAt: new Date().toISOString() },
  }).where(eq(ordersTable.id, orderId));
  await logPlatformAudit(req, "Payment Retry", "Payments", req.params.id);
  res.json({ success: true, retryCount, paymentStatus });
});

router.post("/superadmin/payments/:id/refund", ...admin, async (req, res) => {
  const orderId = parseInt(String(req.params.id).replace(/^TXN-/, ""), 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  const amount = req.body.amount ? String(req.body.amount) : String(order.total);
  const [refund] = await db.insert(platformRefundsTable).values({
    orderId, restaurantId: order.restaurantId, customerName: order.customerName,
    amount, reason: req.body.reason || "Admin initiated refund", refundType: req.body.type || "full", status: "pending",
  }).returning();
  await db.update(ordersTable).set({
    paymentStatus: "refunded",
    metadata: {
      ...(order.metadata as object ?? {}),
      refundId: refund.id,
      refundedAt: new Date().toISOString(),
    },
  }).where(eq(ordersTable.id, orderId));
  await logPlatformAudit(req, "Refund Initiated", "Payments", req.params.id, { refundId: refund.id });
  res.status(201).json({ id: `REF-${refund.id}`, status: "pending" });
});

router.get("/superadmin/settlements", ...admin, async (_req, res) => {
  res.json(await listSettlements());
});

router.post("/superadmin/settlements/:id/release", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("STL-", ""), 10);
  // Stamp where this payout period ends, so the next one starts here rather than summing
  // the venue's whole history again and paying for these orders a second time.
  const releasedAt = new Date();
  const [updated] = await db.update(platformSettlementsTable).set({
    status: "released", releasedAt, periodEnd: releasedAt,
  }).where(eq(platformSettlementsTable.id, id)).returning();
  // No row matched: the payout was never released. This used to answer 200 with a
  // synthesised "released" body, so the screen reported a payout that never moved.
  if (!updated) { res.status(404).json({ error: "Settlement not found" }); return; }
  await logPlatformAudit(req, "Payout Released", "Settlements", req.params.id);
  res.json(updated);
});

router.post("/superadmin/settlements/:id/hold", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("STL-", ""), 10);
  const { reason } = req.body;
  const [updated] = await db.update(platformSettlementsTable).set({
    status: "held", holdReason: reason || "Manual hold",
  }).where(eq(platformSettlementsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Settlement not found" }); return; }
  await logPlatformAudit(req, "Payout Held", "Settlements", req.params.id, { reason });
  res.json(updated);
});

router.post("/superadmin/settlements/:id/retry", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace(/^(STL-|SET-)/, ""), 10);
  const [updated] = await db.update(platformSettlementsTable).set({ status: "pending", holdReason: null })
    .where(eq(platformSettlementsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Settlement not found" }); return; }
  await logPlatformAudit(req, "Settlement Retry", "Settlements", req.params.id);
  res.json(updated);
});

router.get("/superadmin/kyc", ...admin, async (_req, res) => {
  res.json(await listKycRecords());
});

router.post("/superadmin/kyc/:id/approve", ...admin, async (req, res) => {
  const restaurantId = parseInt(String(req.params.id).replace("kyc_", ""), 10);
  // updateKycStatus returns nothing when the vendor does not exist. Without this the
  // route answered "Approved" and wrote an audit row for a restaurant that is not there.
  const approved = await updateKycStatus(restaurantId, "approved");
  if (!approved) { res.status(404).json({ error: "Vendor not found" }); return; }
  await logPlatformAudit(req, "KYC Approved", "KYC", String(restaurantId));
  res.json({ id: req.params.id, status: "Approved" });
});

router.post("/superadmin/kyc/:id/reject", ...admin, async (req, res) => {
  const restaurantId = parseInt(String(req.params.id).replace("kyc_", ""), 10);
  const { reason } = req.body;
  const rejected = await updateKycStatus(restaurantId, "rejected", reason);
  if (!rejected) { res.status(404).json({ error: "Vendor not found" }); return; }
  await logPlatformAudit(req, "KYC Rejected", "KYC", String(restaurantId), { reason });
  res.json({ id: req.params.id, status: "Action Required", rejectionReason: reason });
});

router.post("/superadmin/kyc/:id/request-more", ...admin, async (req, res) => {
  const restaurantId = parseInt(String(req.params.id).replace("kyc_", ""), 10);
  const flagged = await updateKycStatus(restaurantId, "action_required");
  if (!flagged) { res.status(404).json({ error: "Vendor not found" }); return; }
  res.json({ id: req.params.id, status: "Action Required" });
});

router.get("/superadmin/refunds", ...admin, async (_req, res) => {
  const rows = await db.select({
    refund: platformRefundsTable,
    vendorName: restaurantsTable.name,
  }).from(platformRefundsTable)
    .innerJoin(restaurantsTable, eq(platformRefundsTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(platformRefundsTable.requestedAt));

  const fromOrders = await db.select({ order: ordersTable, vendorName: restaurantsTable.name })
    .from(ordersTable)
    .innerJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
    .where(eq(ordersTable.paymentStatus, "refunded"))
    .orderBy(desc(ordersTable.updatedAt)).limit(50);

  const dbRefunds = rows.map(({ refund, vendorName }) => ({
    id: `REF-${refund.id}`, orderId: refund.orderId ? `ORD-${refund.orderId}` : "—",
    vendorName, customerName: refund.customerName ?? "Guest",
    amount: parseFloat(String(refund.amount)), reason: refund.reason ?? "",
    status: refund.status, requestedAt: refund.requestedAt.toISOString(), type: refund.refundType,
  }));

  const orderRefunds = fromOrders.map(({ order, vendorName }) => ({
    id: `REF-ORD-${order.id}`, orderId: `ORD-${order.id}`, vendorName,
    customerName: order.customerName ?? "Guest", amount: parseFloat(String(order.total)),
    reason: order.cancelledReason ?? "Order refunded", status: "completed",
    requestedAt: order.updatedAt.toISOString(), type: "full",
  }));

  res.json([...dbRefunds, ...orderRefunds]);
});

router.post("/superadmin/refunds/:id/approve", ...admin, async (req, res) => {
  if (rejectOrderDerivedRefund(req.params.id, res)) return;
  const id = parseInt(String(req.params.id).replace("REF-", ""), 10);
  const [updated] = await db.update(platformRefundsTable).set({ status: "approved", processedAt: new Date() })
    .where(eq(platformRefundsTable.id, id)).returning();
  // Approving a refund that is not there is not an approval. Reporting it as one told
  // the operator money had been signed off when no row had changed.
  if (!updated) { res.status(404).json({ error: "Refund not found" }); return; }
  await logPlatformAudit(req, "Refund Approved", "Refunds", req.params.id);
  res.json(updated);
});

router.post("/superadmin/refunds/:id/reject", ...admin, async (req, res) => {
  if (rejectOrderDerivedRefund(req.params.id, res)) return;
  const id = parseInt(String(req.params.id).replace("REF-", ""), 10);
  const { reason } = req.body;
  const [updated] = await db.update(platformRefundsTable).set({ status: "rejected", rejectionReason: reason, processedAt: new Date() })
    .where(eq(platformRefundsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Refund not found" }); return; }
  res.json(updated);
});

router.get("/superadmin/support", ...admin, async (_req, res) => {
  const tickets = await db.select({
    ticket: supportTicketsTable,
    vendorName: restaurantsTable.name,
  }).from(supportTicketsTable)
    .leftJoin(restaurantsTable, eq(supportTicketsTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(supportTicketsTable.createdAt)).limit(100);

  res.json(tickets.map(({ ticket, vendorName }) => ({
    id: `TKT-${ticket.id}`,
    vendorName: vendorName ?? ticket.guestName ?? "Guest",
    subject: ticket.subject ?? ticket.message.slice(0, 80),
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    assignedTo: ticket.assignedTo,
    slaDeadline: ticket.slaDeadline?.toISOString() ?? new Date(Date.now() + 86400000).toISOString(),
  })));
});

router.post("/superadmin/support/:id/resolve", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("TKT-", ""), 10);
  const { resolution } = req.body;
  const [t] = await db.update(supportTicketsTable).set({ status: "resolved", resolution: resolution || "Resolved" }).where(eq(supportTicketsTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json({ id: req.params.id, status: "Resolved" });
});

router.post("/superadmin/support/:id/escalate", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("TKT-", ""), 10);
  const [t] = await db.update(supportTicketsTable).set({ status: "escalated", priority: "high" }).where(eq(supportTicketsTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json({ id: req.params.id, status: "Escalated" });
});

router.post("/superadmin/support/:id/close", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("TKT-", ""), 10);
  const [t] = await db.update(supportTicketsTable).set({ status: "closed" }).where(eq(supportTicketsTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json({ id: req.params.id, status: "Closed" });
});

router.get("/superadmin/coupons", ...admin, async (_req, res) => {
  const rows = await db.select().from(platformCouponsTable).orderBy(desc(platformCouponsTable.createdAt));
  res.json(rows.map(c => ({
    id: `cp_${c.id}`, code: c.code, type: c.couponType, discount: parseFloat(String(c.discount)),
    maxUses: c.maxUses, used: c.usedCount, expires: c.expiresAt?.toISOString().split("T")[0] ?? "",
    status: c.status === "active" ? "Active" : "Suspended", createdAt: c.createdAt.toISOString(),
  })));
});

router.post("/superadmin/coupons", ...admin, async (req, res) => {
  const { code, type, discount, maxUses, expires } = req.body;
  const [c] = await db.insert(platformCouponsTable).values({
    code: String(code).toUpperCase(), couponType: type || "percentage",
    discount: String(discount), maxUses: Number(maxUses) || 1000,
    expiresAt: expires ? new Date(expires) : null, status: "active",
  }).returning();
  res.status(201).json({ id: `cp_${c.id}`, code: c.code, type: c.couponType, discount: parseFloat(String(c.discount)), maxUses: c.maxUses, used: 0, expires, status: "Active", createdAt: c.createdAt.toISOString() });
});

router.patch("/superadmin/coupons/:id/toggle", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("cp_", ""), 10);
  const [c] = await db.select().from(platformCouponsTable).where(eq(platformCouponsTable.id, id));
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  const status = c.status === "active" ? "suspended" : "active";
  const [updated] = await db.update(platformCouponsTable).set({ status }).where(eq(platformCouponsTable.id, id)).returning();
  res.json({ id: req.params.id, status: updated?.status === "active" ? "Active" : "Suspended" });
});

router.delete("/superadmin/coupons/:id", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("cp_", ""), 10);
  const [gone] = await db.delete(platformCouponsTable).where(eq(platformCouponsTable.id, id)).returning();
  if (!gone) { res.status(404).json({ error: "Coupon not found" }); return; }
  res.json({ deleted: true });
});

router.get("/superadmin/fraud", ...admin, async (_req, res) => {
  await detectFraudAlerts();
  const rows = await db.select({
    alert: platformFraudAlertsTable,
    vendorName: restaurantsTable.name,
  }).from(platformFraudAlertsTable)
    .leftJoin(restaurantsTable, eq(platformFraudAlertsTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(platformFraudAlertsTable.detectedAt));

  res.json(rows.map(({ alert, vendorName }) => ({
    id: `FA-${alert.id}`, vendorName: vendorName ?? "Unknown",
    type: alert.alertType, riskScore: alert.riskScore,
    amount: parseFloat(String(alert.amount ?? 0)),
    status: alert.status === "active" ? "Active" : alert.status,
    detectedAt: alert.detectedAt.toISOString(), aiSignal: alert.aiSignal ?? "",
  })));
});

router.post("/superadmin/fraud/:id/resolve", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("FA-", ""), 10);
  const [resolved] = await db.update(platformFraudAlertsTable).set({ status: "resolved", resolvedAt: new Date() }).where(eq(platformFraudAlertsTable.id, id)).returning();
  if (!resolved) { res.status(404).json({ error: "Alert not found" }); return; }
  res.json({ id: req.params.id, status: "Resolved" });
});

router.post("/superadmin/fraud/:id/dismiss", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("FA-", ""), 10);
  const [dismissed] = await db.update(platformFraudAlertsTable).set({ status: "dismissed", resolvedAt: new Date() }).where(eq(platformFraudAlertsTable.id, id)).returning();
  if (!dismissed) { res.status(404).json({ error: "Alert not found" }); return; }
  res.json({ id: req.params.id, status: "Dismissed" });
});

router.post("/superadmin/fraud/:id/block", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("FA-", ""), 10);
  const [alert] = await db.select().from(platformFraudAlertsTable).where(eq(platformFraudAlertsTable.id, id));
  if (!alert) { res.status(404).json({ error: "Alert not found" }); return; }
  if (alert.restaurantId) {
    await db.update(restaurantsTable).set({ isActive: false }).where(eq(restaurantsTable.id, alert.restaurantId));
  }
  await db.update(platformFraudAlertsTable).set({ status: "resolved", resolvedAt: new Date() }).where(eq(platformFraudAlertsTable.id, id));
  res.json({ id: req.params.id, status: "Resolved", blocked: true });
});

router.get("/superadmin/commissions", ...admin, async (_req, res) => {
  const rows = await db.select().from(platformCommissionRulesTable).orderBy(desc(platformCommissionRulesTable.createdAt));
  res.json(rows.map(r => ({
    id: `cr_${r.id}`, name: r.name, type: r.ruleType, value: parseFloat(String(r.value)),
    unit: r.unit, applyTo: r.applyTo, status: r.status === "active" ? "Active" : "Pending",
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/superadmin/commissions", ...admin, async (req, res) => {
  const { name, type, value, unit, applyTo } = req.body;
  const [r] = await db.insert(platformCommissionRulesTable).values({
    name, ruleType: type || "percentage", value: String(value), unit: unit || "%", applyTo: applyTo || "all",
  }).returning();
  res.status(201).json({ id: `cr_${r.id}`, name: r.name, type: r.ruleType, value: parseFloat(String(r.value)), unit: r.unit, applyTo: r.applyTo, status: "Active", createdAt: r.createdAt.toISOString() });
});

router.put("/superadmin/commissions/:id", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("cr_", ""), 10);
  const [r] = await db.update(platformCommissionRulesTable).set({
    name: req.body.name, ruleType: req.body.type, value: req.body.value !== undefined ? String(req.body.value) : undefined,
    unit: req.body.unit, applyTo: req.body.applyTo, status: req.body.status?.toLowerCase(),
  }).where(eq(platformCommissionRulesTable.id, id)).returning();
  if (!r) { res.status(404).json({ error: "Commission rule not found" }); return; }
  res.json(r);
});

router.delete("/superadmin/commissions/:id", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("cr_", ""), 10);
  const [gone] = await db.delete(platformCommissionRulesTable).where(eq(platformCommissionRulesTable.id, id)).returning();
  if (!gone) { res.status(404).json({ error: "Commission rule not found" }); return; }
  res.json({ deleted: true });
});

router.get("/superadmin/chargebacks", ...admin, async (_req, res) => {
  const rows = await db.select({ cb: platformChargebacksTable, vendorName: restaurantsTable.name })
    .from(platformChargebacksTable)
    .innerJoin(restaurantsTable, eq(platformChargebacksTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(platformChargebacksTable.filedAt));
  res.json(rows.map(({ cb, vendorName }) => ({
    id: `CB-${cb.id}`, vendorName, customerId: cb.customerId ?? "—",
    amount: parseFloat(String(cb.amount)), reason: cb.reason ?? "",
    deadline: cb.deadline?.toISOString().split("T")[0] ?? "",
    status: cb.status, filedAt: cb.filedAt.toISOString(),
  })));
});

router.post("/superadmin/chargebacks/:id/accept", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("CB-", ""), 10);
  const [accepted] = await db.update(platformChargebacksTable).set({ status: "accepted", resolvedAt: new Date() }).where(eq(platformChargebacksTable.id, id)).returning();
  if (!accepted) { res.status(404).json({ error: "Chargeback not found" }); return; }
  res.json({ id: req.params.id, status: "Accepted" });
});

router.post("/superadmin/chargebacks/:id/contest", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("CB-", ""), 10);
  const [contested] = await db.update(platformChargebacksTable).set({ status: "evidence_submitted" }).where(eq(platformChargebacksTable.id, id)).returning();
  if (!contested) { res.status(404).json({ error: "Chargeback not found" }); return; }
  res.json({ id: req.params.id, status: "Evidence Submitted" });
});

router.get("/superadmin/api-keys", ...admin, async (_req, res) => {
  const rows = await db.select().from(platformApiKeysTable).orderBy(desc(platformApiKeysTable.createdAt));
  res.json(rows.map(k => ({
    id: `key_${k.id}`, name: k.name, environment: k.environment,
    prefix: k.keyPrefix, lastUsed: k.lastUsedAt?.toISOString() ?? null,
    status: k.status === "active" ? "Active" : "Disabled", createdAt: k.createdAt.toISOString(),
  })));
});

router.post("/superadmin/api-keys", ...admin, async (req, res) => {
  const { name, environment } = req.body;
  const env = environment || "Production";
  const prefix = env === "Sandbox" ? "pk_test_" : "pk_live_";
  const fullKey = `${prefix}${crypto.randomBytes(16).toString("hex")}`;
  const [k] = await db.insert(platformApiKeysTable).values({
    name, environment: env, keyPrefix: `${prefix}${crypto.randomBytes(4).toString("hex")}`,
    keyHash: hashApiKey(fullKey), status: "active",
  }).returning();
  res.status(201).json({
    id: `key_${k.id}`, name: k.name, environment: k.environment, prefix: k.keyPrefix,
    lastUsed: null, status: "Active", createdAt: k.createdAt.toISOString(), fullKey,
  });
});

router.delete("/superadmin/api-keys/:id", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("key_", ""), 10);
  const [gone] = await db.delete(platformApiKeysTable).where(eq(platformApiKeysTable.id, id)).returning();
  if (!gone) { res.status(404).json({ error: "API key not found" }); return; }
  res.json({ deleted: true });
});

router.get("/superadmin/settings", ...admin, async (_req, res) => {
  res.json(await getPlatformSettings(true));
});

router.put("/superadmin/settings", ...admin, async (req, res) => {
  const updated = await setPlatformSettings(req.body);
  await logPlatformAudit(req, "Settings Updated", "Settings");
  res.json(updated);
});

router.get("/superadmin/integrations/schema", ...admin, async (_req, res) => {
  const { INTEGRATION_SERVICES } = await import("../lib/platform-integrations.js");
  res.json({ services: INTEGRATION_SERVICES });
});

router.get("/superadmin/taxes", ...admin, async (_req, res) => {
  const rows = await db.select().from(platformTaxesTable);
  res.json(rows.map(t => ({
    id: `t${t.id}`, name: t.name, rate: parseFloat(String(t.rate)),
    type: t.taxType, region: t.region, status: t.isActive,
  })));
});

router.patch("/superadmin/taxes/:id/toggle", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("t", ""), 10);
  const [t] = await db.select().from(platformTaxesTable).where(eq(platformTaxesTable.id, id));
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(platformTaxesTable).set({ isActive: !t.isActive }).where(eq(platformTaxesTable.id, id)).returning();
  res.json({ id: req.params.id, name: updated?.name, rate: parseFloat(String(updated?.rate)), status: updated?.isActive });
});

router.post("/superadmin/taxes", ...admin, async (req, res) => {
  const { name, rate, type, region } = req.body;
  const [t] = await db.insert(platformTaxesTable).values({
    name, rate: String(rate), taxType: type || "sales_tax", region: region || "India",
  }).returning();
  res.status(201).json({ id: `t${t.id}`, name: t.name, rate: parseFloat(String(t.rate)), type: t.taxType, region: t.region, status: true });
});

router.get("/superadmin/subscriptions", ...admin, async (_req, res) => {
  await ensurePlatformDefaults();
  const plans = await db.select().from(platformPlansTable);
  const planPrices = Object.fromEntries(plans.map(p => [p.id, parseFloat(String(p.price))]));
  const restaurants = await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt));
  res.json(restaurants.map(r => ({
    id: `sub_${r.id}`, vendorId: r.id, vendorName: r.name, plan: r.plan || "free",
    amount: planPrices[r.plan || "free"] ?? 0,
    status: r.isActive ? "Active" : "Canceled",
    renewal: new Date(r.createdAt.getTime() + 30 * 86400000).toISOString().split("T")[0],
    autoRenew: r.isActive,
  })));
});

router.get("/superadmin/invoices", ...admin, async (_req, res) => {
  res.json(await listSubscriptionInvoices());
});

/**
 * Invoice ids are `INV-<YYYYMM>-<vendorId>`, so stripping only the "INV-" prefix parsed
 * the period as the vendor id and every Download / Email click answered 404.
 */
function invoiceVendorId(rawId: string): number {
  const parts = String(rawId).split("-");
  return parseInt(parts[parts.length - 1], 10);
}

router.post("/superadmin/white-label/verify-dns", ...admin, async (req, res) => {
  const domain = String(req.body?.domain ?? "");
  const result = await verifyWhiteLabelDomain(domain);
  if (result.verified) await logPlatformAudit(req, "White Label DNS Verified", "Platform", domain);
  res.json(result);
});

router.get("/superadmin/invoices/export", ...admin, async (_req, res) => {
  // This used to rebuild its own list from the restaurant table, so the file held one
  // row per vendor under a different id scheme and left out every commission invoice —
  // 10 rows exported against 15 on screen. Export what the screen actually lists.
  const invoices = await listSubscriptionInvoices();
  const header = "invoiceId,vendorId,vendorName,type,amount,status,date,dueDate,period\n";
  const csv = header + invoices.map(i => [
    i.id, i.vendorId, `"${i.vendorName}"`, i.type, i.amount, i.status, i.date, i.dueDate, i.period,
  ].join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=invoices.csv");
  res.send(csv);
});

router.get("/superadmin/invoices/:id/download", ...admin, async (req, res) => {
  // The id was parsed for a trailing number and that number treated as a vendor id.
  // Commission invoices are keyed INV-COM-<settlementId>, so downloading one produced
  // an unrelated vendor's subscription bill — wrong venue, wrong amount, wrong type.
  // Resolve the invoice the operator actually clicked instead.
  const invoice = (await listSubscriptionInvoices()).find(i => i.id === req.params.id);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  const csv = "invoiceId,vendorId,vendorName,type,amount,status,date,dueDate,period\n"
    + [invoice.id, invoice.vendorId, `"${invoice.vendorName}"`, invoice.type, invoice.amount,
      invoice.status, invoice.date, invoice.dueDate, invoice.period].join(",") + "\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=${invoice.id}.csv`);
  res.send(csv);
});

router.post("/superadmin/invoices/:id/email", ...admin, async (req, res) => {
  // Same id-parsing fault as the download route: a commission invoice was emailed to
  // whichever vendor happened to share the settlement's number.
  const invoice = (await listSubscriptionInvoices()).find(i => i.id === req.params.id);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, invoice.vendorId));
  if (!r) { res.status(404).json({ error: "Vendor not found" }); return; }
  const [owner] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, r.userId));
  await db.insert(platformCommunicationsTable).values({
    commType: "Invoice", subject: `Invoice ${invoice.id}`,
    message: `Your ${invoice.type.toLowerCase()} invoice ${invoice.id} for ${PLATFORM_CURRENCY} ${invoice.amount} is ready.`,
    channel: "email", target: owner?.email || r.name, recipients: 1, deliveryRate: "100", status: "queued",
  });
  await logPlatformAudit(req, "Invoice Emailed", "Invoices", invoice.id);
  res.json({ sent: true, to: owner?.email });
});

router.get("/superadmin/escrow", ...admin, async (_req, res) => {
  // Refresh settlements from current orders first so Escrow always matches the
  // Settlements and Vendor Wallets pages (all order-driven, single source of truth).
  await syncPendingSettlements();
  const settlements = await db.select().from(platformSettlementsTable).orderBy(desc(platformSettlementsTable.createdAt)).limit(30);
  const restaurants = await db.select().from(restaurantsTable);
  const nameMap = Object.fromEntries(restaurants.map(r => [r.id, r.name]));
  const ledger = await Promise.all(settlements.map(async s => ({
    id: `ESC-${s.id}`, vendorName: nameMap[s.restaurantId] ?? "Vendor",
    type: s.status === "held" ? "Dispute Lock" : s.status === "released" ? "Release" : "Deposit",
    amount: parseFloat(String(s.finalPayout)),
    balance: parseFloat(String(s.grossSales)),
    status: s.status === "released" ? "Completed" : s.status === "held" ? "Locked" : "Pending",
    date: s.createdAt.toISOString().split("T")[0],
  })));
  const pending = settlements.filter(s => s.status === "pending").reduce((a, s) => a + parseFloat(String(s.finalPayout)), 0);
  const held = settlements.filter(s => s.status === "held").reduce((a, s) => a + parseFloat(String(s.finalPayout)), 0);
  // The reserve the admin tops up via "Add Reserve" is part of the money the platform is
  // holding. It was written to settings and then shown nowhere, so the button looked dead.
  const platformSettings = await getPlatformSettings();
  const reserveBalance = Number((platformSettings as { reserveBalance?: number }).reserveBalance ?? 0);
  res.json({
    metrics: {
      totalEscrow: pending + held + reserveBalance, activeHolds: held,
      pendingReleases: pending, lockedDisputes: held, reserveBalance,
    },
    ledger,
  });
});

router.post("/superadmin/escrow/freeze/:vendorId", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.vendorId), 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const settings = { ...(r.settings as object ?? {}), wallet: { ...((r.settings as { wallet?: object })?.wallet ?? {}), frozen: true } };
  await db.update(restaurantsTable).set({ settings }).where(eq(restaurantsTable.id, id));
  res.json({ vendorId: req.params.vendorId, frozen: true });
});

router.post("/superadmin/escrow/add-reserve", ...admin, async (req, res) => {
  const settings = await getPlatformSettings();
  const reserve = ((settings as { reserveBalance?: number }).reserveBalance ?? 0) + Number(req.body.amount || 0);
  await setPlatformSettings({ reserveBalance: reserve });
  res.json({ added: true, amount: Number(req.body.amount), reserveBalance: reserve });
});

router.get("/superadmin/notifications", ...admin, async (_req, res) => {
  const rows = await db.select().from(platformNotificationsTable).orderBy(desc(platformNotificationsTable.sentAt));
  res.json(rows.map(n => ({
    id: `notif_${n.id}`, title: n.title, message: n.message, type: n.notificationType,
    channel: n.channel, priority: n.priority, status: n.status, sentAt: n.sentAt.toISOString(),
  })));
});

router.post("/superadmin/notifications", ...admin, async (req, res) => {
  const { title, message, type, channel, priority } = req.body;
  const [n] = await db.insert(platformNotificationsTable).values({
    title, message, notificationType: type || "General", channel: channel || "email", priority: priority || "medium",
  }).returning();
  res.status(201).json({ id: `notif_${n.id}`, title: n.title, message: n.message, type: n.notificationType, channel: n.channel, priority: n.priority, status: "Sent", sentAt: n.sentAt.toISOString() });
});

router.delete("/superadmin/notifications/:id", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("notif_", ""), 10);
  const [gone] = await db.delete(platformNotificationsTable).where(eq(platformNotificationsTable.id, id)).returning();
  if (!gone) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json({ deleted: true });
});

router.get("/superadmin/communications", ...admin, async (_req, res) => {
  const rows = await db.select().from(platformCommunicationsTable).orderBy(desc(platformCommunicationsTable.sentAt));
  res.json(rows.map(c => ({
    id: `comm_${c.id}`, type: c.commType, subject: c.subject, message: c.message,
    channel: c.channel, target: c.target, recipients: c.recipients,
    deliveryRate: parseFloat(String(c.deliveryRate ?? 95)), status: c.status, sentAt: c.sentAt.toISOString(),
  })));
});

router.post("/superadmin/communications/send", ...admin, async (req, res) => {
  const { type, channel, subject, message, target } = req.body;
  const [activeCount] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
  const recipients = target === "all" ? (activeCount?.count ?? 0) : Math.max(1, Math.floor((activeCount?.count ?? 0) / 3));
  const [c] = await db.insert(platformCommunicationsTable).values({
    commType: type || "Broadcast", subject, message, channel: channel || "email",
    target: target || "all", recipients, deliveryRate: "96.5", status: "delivered",
  }).returning();
  res.status(201).json({
    id: `comm_${c.id}`, type: c.commType, subject: c.subject, message: c.message,
    channel: c.channel, target: c.target, recipients: c.recipients,
    deliveryRate: 96.5, status: "Delivered", sentAt: c.sentAt.toISOString(),
  });
});

router.get("/superadmin/security", ...admin, async (_req, res) => {
  const settings = await getPlatformSettings();
  const securitySettings = (settings as { securitySettings?: Record<string, boolean> }).securitySettings ?? {};
  const sessions = await listAdminSessions();
  const ipWhitelist = await db.select().from(platformIpWhitelistTable);
  const loginAttempts = await db.select().from(platformAuditLogsTable)
    .where(eq(platformAuditLogsTable.module, "Auth"))
    .orderBy(desc(platformAuditLogsTable.createdAt)).limit(20);
  res.json({
    securitySettings,
    sessions,
    devices: [],
    ipWhitelist: ipWhitelist.map(ip => ({ id: `ip_${ip.id}`, address: ip.address, label: ip.label ?? "", addedAt: ip.createdAt.toISOString() })),
    loginAttempts: loginAttempts.map(l => ({
      id: `la_${l.id}`, email: l.userName, ipAddress: l.ipAddress ?? "—",
      location: "—", device: l.deviceInfo ?? "—", timestamp: l.createdAt.toISOString(),
      success: l.severity !== "critical", failReason: l.severity === "critical" ? l.action : null,
    })),
  });
});

router.put("/superadmin/security/settings", ...admin, async (req, res) => {
  const current = await getPlatformSettings();
  const updated = await setPlatformSettings({
    ...current,
    securitySettings: { ...(current as { securitySettings?: object }).securitySettings, ...req.body },
  });
  await logPlatformAudit(req, "Security Settings Updated", "Security");
  res.json((updated as { securitySettings?: object }).securitySettings ?? req.body);
});

router.delete("/superadmin/security/sessions/:id", ...admin, async (req, res) => {
  const revoked = await revokeAdminSession(req.params.id);
  if (!revoked) { res.status(404).json({ error: "Session not found" }); return; }
  await logPlatformAudit(req, "Session Revoked", "Security", req.params.id);
  res.json({ id: req.params.id, revoked: true });
});

router.post("/superadmin/security/ip-whitelist", ...admin, async (req, res) => {
  const { ip } = req.body;
  const [row] = await db.insert(platformIpWhitelistTable).values({ address: ip, label: "Manually Added" }).returning();
  res.status(201).json({ id: `ip_${row.id}`, address: row.address, label: row.label, addedAt: row.createdAt.toISOString() });
});

router.delete("/superadmin/security/ip-whitelist/:id", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("ip_", ""), 10);
  const [gone] = await db.delete(platformIpWhitelistTable).where(eq(platformIpWhitelistTable.id, id)).returning();
  if (!gone) { res.status(404).json({ error: "Address not on the list" }); return; }
  res.json({ id: req.params.id, removed: true });
});

router.get("/superadmin/reconciliation", ...admin, async (_req, res) => {
  const payments = await listPayments(500);
  const failedOrders = await db.select({
    order: ordersTable, vendorName: restaurantsTable.name,
  }).from(ordersTable)
    .innerJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
    .where(eq(ordersTable.paymentStatus, "failed"))
    .orderBy(desc(ordersTable.createdAt)).limit(50);

  const discrepancies = failedOrders
    .filter(({ order }) => !(order.metadata as { reconciledAt?: string } ?? {}).reconciledAt)
    .map(({ order, vendorName }) => ({
    id: `TXN-DISC-${order.id}`, vendorName,
    gatewayAmount: parseFloat(String(order.total ?? 0)),
    bankAmount: 0,
    difference: -parseFloat(String(order.total ?? 0)),
    discrepancyType: "Payment Failed",
    date: order.createdAt.toISOString().split("T")[0],
  }));

  const pendingRefunds = await db.select().from(platformRefundsTable).where(eq(platformRefundsTable.status, "pending"));
  const refundDisc = pendingRefunds.map(r => ({
    id: `REF-DISC-${r.id}`, vendorName: "—",
    gatewayAmount: parseFloat(String(r.amount ?? 0)),
    bankAmount: 0,
    difference: parseFloat(String(r.amount ?? 0)),
    discrepancyType: "Pending Refund",
    date: r.requestedAt.toISOString().split("T")[0],
  }));

  const allDisc = [...discrepancies, ...refundDisc];
  // A transaction is "matched" (gateway == bank) when it is genuinely PAID. Use the same
  // isPaid rule the dashboard / payments / settlements use — NOT the raw status string —
  // so an order that is paid but still shows paymentStatus "pending" (e.g. cash confirmed)
  // is counted here too, and every page agrees on what "paid" means.
  // Strictly the isPaid rule. The old `|| status === "paid"` fallback defeated the very
  // thing this comment promises: a cancelled order keeps paymentStatus "paid", so it was
  // counted as reconciled here while Payments/Settlements/Dashboard all valued it at zero.
  const isMatchedTxn = (p: typeof payments[number]) => (p as { isPaid?: boolean }).isPaid === true;
  // Matched transactions — shown so the admin can see the ones that reconciled, with
  // vendor name and HOW it was paid (UPI / card / gateway / cash).
  const matchedList = payments
    .filter(isMatchedTxn)
    .map(p => ({
      id: p.id,
      vendorName: p.vendorName,
      paymentMode: p.paymentMode || "—",
      gatewayAmount: p.grossAmount,
      bankAmount: p.grossAmount,
      amount: p.grossAmount,
      gatewayTxnId: p.gatewayTxnId,
      utr: p.utr,
      status: "Matched",
      date: (p.dateTime || "").split("T")[0],
    }));
  res.json({
    summary: {
      matched: payments.filter(isMatchedTxn).length,
      mismatched: allDisc.length,
      missing: discrepancies.length,
      duplicates: 0,
      totalAmount: payments.reduce((s, p) => s + p.grossAmount, 0),
    },
    matched: matchedList,
    discrepancies: allDisc,
    history: (await db.select().from(platformAuditLogsTable)
      .where(eq(platformAuditLogsTable.module, "Reconciliation"))
      .orderBy(desc(platformAuditLogsTable.createdAt)).limit(10))
      .map(l => ({ id: `RUN-${l.id}`, runAt: l.createdAt.toISOString(), matched: payments.length, issues: allDisc.length, by: l.userName })),
    leakageAlerts: failedOrders.slice(0, 5).map(({ order, vendorName }) => ({
      id: `LEAK-${order.id}`, vendorName, amount: parseFloat(String(order.total ?? 0)),
      message: `Failed payment for order ORD-${order.id}`,
    })),
  });
});

router.post("/superadmin/reconciliation/run", ...admin, async (req, res) => {
  const payments = await listPayments(500);
  await logPlatformAudit(req, "Reconciliation Run", "Reconciliation");
  res.json({ runId: `RECON-${Date.now()}`, status: "Completed", matched: payments.length, issues: 0, runAt: new Date().toISOString() });
});

router.post("/superadmin/reconciliation/adjust/:id", ...admin, async (req, res) => {
  // This used to answer `{ adjusted: true }` without touching anything, so the row was
  // still there after the "Manual adjustment applied" toast. Writing the write-off onto
  // the order is what makes the discrepancy actually clear.
  const raw = String(req.params.id);
  const txnMatch = /^TXN-DISC-(\d+)$/.exec(raw);
  if (txnMatch) {
    const orderId = parseInt(txnMatch[1], 10);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "Transaction not found" }); return; }
    await db.update(ordersTable).set({
      metadata: {
        ...(order.metadata as object ?? {}),
        reconciledAt: new Date().toISOString(),
        reconciliationNote: req.body?.note || "Manually written off during reconciliation",
      },
    }).where(eq(ordersTable.id, orderId));
    await logPlatformAudit(req, "Reconciliation Adjustment", "Reconciliation", raw);
    res.json({ id: raw, adjusted: true });
    return;
  }
  if (/^REF-DISC-\d+$/.test(raw)) {
    res.status(400).json({
      error: "A pending refund clears when the refund is processed — action it on the Refunds screen.",
    });
    return;
  }
  res.status(404).json({ error: "Unknown discrepancy" });
});

router.get("/superadmin/penalties", ...admin, async (_req, res) => {
  const rows = await db.select({ p: platformPenaltiesTable, vendorName: restaurantsTable.name })
    .from(platformPenaltiesTable)
    .innerJoin(restaurantsTable, eq(platformPenaltiesTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(platformPenaltiesTable.appliedAt));
  res.json(rows.map(({ p, vendorName }) => ({
    id: `PEN-${p.id}`, vendorName, reason: p.reason, amount: parseFloat(String(p.amount)),
    deductFrom: p.deductFrom, notes: p.notes, appliedBy: p.appliedBy,
    appliedAt: p.appliedAt.toISOString(),
    // The column stores lowercase; the rest of the admin API hands the UI Title Case, and
    // the page compares against "Applied" / "Reversed" — so normalise it here.
    status: p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : "Applied",
  })));
});

router.post("/superadmin/penalties", ...admin, async (req, res) => {
  const { vendorName, reason, amount, deductFrom, notes, vendorId } = req.body;
  let restaurantId = Number(vendorId);
  let resolvedName = vendorName;
  if (!restaurantId && vendorName) {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.name, vendorName));
    restaurantId = r?.id ?? 0;
  }
  // Falling back to restaurant 1 meant a mistyped vendor name quietly fined a completely
  // different (and always the same) vendor, while the caller got a success response.
  if (!restaurantId) { res.status(400).json({ error: `No vendor matches "${vendorName ?? ""}"` }); return; }
  const [target] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!target) { res.status(404).json({ error: "Vendor not found" }); return; }
  resolvedName = target.name;
  const [p] = await db.insert(platformPenaltiesTable).values({
    restaurantId, reason, amount: String(amount),
    deductFrom: deductFrom || "wallet", notes, appliedBy: (req as any).adminUser?.email ?? "admin",
  }).returning();
  await logPlatformAudit(req, "Penalty Applied", "Penalties", String(p.id), { vendorId: restaurantId, amount });
  res.status(201).json({ id: `PEN-${p.id}`, vendorName: resolvedName, reason, amount: parseFloat(String(p.amount)), status: "Applied" });
});

router.post("/superadmin/penalties/:id/reverse", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("PEN-", ""), 10);
  const [p] = await db.select().from(platformPenaltiesTable).where(eq(platformPenaltiesTable.id, id));
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(platformPenaltiesTable).set({ status: "reversed" }).where(eq(platformPenaltiesTable.id, id)).returning();
  await logPlatformAudit(req, "Penalty Reversed", "Penalties", String(id));
  res.json({ id: `PEN-${updated.id}`, status: "Reversed" });
});

router.get("/superadmin/tasks", ...admin, async (_req, res) => {
  const rows = await db.select().from(platformTasksTable).orderBy(desc(platformTasksTable.createdAt));
  res.json(rows.map(t => ({
    id: `TASK-${t.id}`, title: t.title, type: t.taskType, priority: t.priority,
    assignedTo: t.assignedTo, dueDate: t.dueDate?.toISOString().split("T")[0] ?? "",
    description: t.description, status: t.status, createdAt: t.createdAt.toISOString(),
  })));
});

router.post("/superadmin/tasks", ...admin, async (req, res) => {
  const { title, type, priority, assignedTo, dueDate, description } = req.body;
  const [t] = await db.insert(platformTasksTable).values({
    title, taskType: type || "General", priority: priority || "medium",
    assignedTo, dueDate: dueDate ? new Date(dueDate) : null, description,
  }).returning();
  res.status(201).json({ id: `TASK-${t.id}`, title: t.title, type: t.taskType, status: "Pending" });
});

router.put("/superadmin/tasks/:id/status", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("TASK-", ""), 10);
  const [t] = await db.update(platformTasksTable).set({ status: req.body.status }).where(eq(platformTasksTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(t);
});

router.get("/superadmin/announcements", ...admin, async (_req, res) => {
  const rows = await db.select().from(platformAnnouncementsTable).orderBy(desc(platformAnnouncementsTable.createdAt));
  res.json(rows.map(a => ({
    id: `ANN-${a.id}`, title: a.title, message: a.message, type: a.announcementType,
    severity: a.severity, targetAudience: a.targetAudience, active: a.isActive,
    scheduledAt: a.scheduledAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(),
  })));
});

router.post("/superadmin/announcements", ...admin, async (req, res) => {
  const { title, message, type, severity, targetAudience, scheduledAt, active } = req.body;
  const [a] = await db.insert(platformAnnouncementsTable).values({
    title, message, announcementType: type || "Maintenance Alert",
    severity: severity || "info", targetAudience: targetAudience || "all",
    isActive: active !== false, scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
  }).returning();
  res.status(201).json({ id: `ANN-${a.id}`, title: a.title, active: a.isActive });
});

router.delete("/superadmin/announcements/:id", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("ANN-", ""), 10);
  const [gone] = await db.delete(platformAnnouncementsTable).where(eq(platformAnnouncementsTable.id, id)).returning();
  if (!gone) { res.status(404).json({ error: "Announcement not found" }); return; }
  res.json({ deleted: true });
});

router.patch("/superadmin/announcements/:id/toggle", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("ANN-", ""), 10);
  const [existing] = await db.select().from(platformAnnouncementsTable).where(eq(platformAnnouncementsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(platformAnnouncementsTable)
    .set({ isActive: !existing.isActive })
    .where(eq(platformAnnouncementsTable.id, id))
    .returning();
  res.json({ id: `ANN-${updated.id}`, active: updated.isActive });
});

router.get("/superadmin/error-logs", ...admin, async (_req, res) => {
  const rows = await db.select({
    log: platformErrorLogsTable,
    vendorName: restaurantsTable.name,
  }).from(platformErrorLogsTable)
    .leftJoin(restaurantsTable, eq(platformErrorLogsTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(platformErrorLogsTable.createdAt)).limit(100);

  if (!rows.length) {
    const failedOrders = await db.select({ order: ordersTable, vendorName: restaurantsTable.name })
      .from(ordersTable)
      .innerJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
      .where(eq(ordersTable.paymentStatus, "failed"))
      .orderBy(desc(ordersTable.createdAt)).limit(30);
    res.json(failedOrders.map(({ order, vendorName }, i) => ({
      id: `ERR-${order.id}`, errorType: "Payment Failure",
      message: `Payment failed for order ORD-${order.id}`,
      source: "payment-gateway", vendorName,
      retryCount: 0, severity: "error", timestamp: order.updatedAt.toISOString(),
    })));
    return;
  }
  res.json(rows.map(({ log, vendorName }) => ({
    id: `ERR-${log.id}`, errorType: log.errorType, message: log.message,
    source: log.source, vendorName, retryCount: log.retryCount,
    severity: log.severity, timestamp: log.createdAt.toISOString(),
  })));
});

router.get("/superadmin/export/history", ...admin, async (_req, res) => {
  const rows = await db.select().from(platformExportsTable).orderBy(desc(platformExportsTable.requestedAt));
  res.json(rows.map(e => ({
    id: `EXP-${e.id}`, module: e.module, format: e.format, requestedBy: e.requestedBy,
    records: e.recordCount, sizeMb: parseFloat(String(e.sizeMb ?? 0)),
    requestedAt: e.requestedAt.toISOString(), status: e.status,
  })));
});

router.post("/superadmin/export", ...admin, async (req, res) => {
  const { module, format } = req.body;
  const recordCount = await countExportRecords(module);
  const csv = await generateExportCsv(module);
  const sizeMb = (Buffer.byteLength(csv, "utf8") / (1024 * 1024)).toFixed(2);
  const [e] = await db.insert(platformExportsTable).values({
    module, format: format || "csv",
    requestedBy: (req as any).adminUser?.email ?? "admin",
    recordCount, sizeMb, status: "completed",
  }).returning();
  await logPlatformAudit(req, "Export Created", "Export", `EXP-${e.id}`, { module, records: recordCount });
  res.status(201).json({
    id: `EXP-${e.id}`, module: e.module, format: e.format, records: e.recordCount,
    status: "Completed", requestedAt: e.requestedAt.toISOString(),
  });
});

router.get("/superadmin/export/:id/download", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("EXP-", ""), 10);
  const [e] = await db.select().from(platformExportsTable).where(eq(platformExportsTable.id, id));
  if (!e) { res.status(404).json({ error: "Export not found" }); return; }
  const csv = await generateExportCsv(e.module);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${e.module}-${e.id}.csv"`);
  res.send(csv);
});

router.patch("/superadmin/export/:id/status", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("EXP-", ""), 10);
  const { status } = req.body;
  const [updated] = await db.update(platformExportsTable).set({ status }).where(eq(platformExportsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  await logPlatformAudit(req, `Export ${status}`, "Export", `EXP-${id}`);
  res.json({ id: `EXP-${updated.id}`, status: updated.status });
});

router.get("/superadmin/sla", ...admin, async (_req, res) => {
  res.json(await getSlaMonitoring());
});

router.get("/superadmin/infrastructure/overview", ...admin, async (_req, res) => {
  res.json(await getInfrastructureOverview());
});

router.post("/superadmin/infrastructure/backup", ...admin, async (req, res) => {
  const recordCount = await countExportRecords("platform_backup");
  const csv = await generateExportCsv("vendors");
  const sizeMb = (Buffer.byteLength(csv, "utf8") / (1024 * 1024)).toFixed(2);
  const [e] = await db.insert(platformExportsTable).values({
    module: "platform_backup", format: "csv",
    requestedBy: (req as any).adminUser?.email ?? "admin",
    recordCount, sizeMb, status: "completed",
  }).returning();
  await logPlatformAudit(req, "Manual Backup", "Infrastructure", `BKP-${e.id}`);
  res.status(201).json({ id: `BKP-${e.id}`, exportId: `EXP-${e.id}`, status: "Completed", sizeMb });
});

router.post("/superadmin/infrastructure/retry-tasks", ...admin, async (req, res) => {
  const failed = await db.select().from(platformTasksTable).where(eq(platformTasksTable.status, "cancelled"));
  for (const t of failed) {
    await db.update(platformTasksTable).set({ status: "pending" }).where(eq(platformTasksTable.id, t.id));
  }
  await logPlatformAudit(req, "Retry Failed Tasks", "Infrastructure");
  res.json({ retried: failed.length });
});

router.get("/superadmin/documents", ...admin, async (_req, res) => {
  const docs = await db.select({
    doc: documentsTable,
    vendorName: restaurantsTable.name,
    vendorId: restaurantsTable.id,
  }).from(documentsTable)
    .innerJoin(restaurantsTable, eq(documentsTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(documentsTable.createdAt));
  res.json(docs.map(({ doc, vendorName, vendorId }) => ({
    id: `DOC-${doc.id}`, vendorId, vendorName, docType: doc.category,
    docNumber: doc.name, uploadedAt: doc.createdAt.toISOString(),
    expiryDate: doc.expiryDate?.toISOString().split("T")[0] ?? null,
    status: doc.status === "active" ? "Verified" : doc.status,
    fileUrl: doc.fileUrl,
  })));
});

router.get("/superadmin/documents/:id/download", ...admin, async (req, res) => {
  const docId = parseInt(String(req.params.id).replace("DOC-", ""), 10);
  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, docId));
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
  if (doc.fileUrl?.startsWith("http")) { res.redirect(doc.fileUrl); return; }
  const csv = `id,name,category,description,status,expiryDate,fileUrl\n${doc.id},"${doc.name}",${doc.category},"${doc.description || ""}",${doc.status},${doc.expiryDate?.toISOString() || ""},${doc.fileUrl || ""}\n`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=DOC-${doc.id}.csv`);
  res.send(csv);
});

router.post("/superadmin/documents/:id/remind", ...admin, async (req, res) => {
  const docId = parseInt(String(req.params.id).replace("DOC-", ""), 10);
  const [row] = await db.select({ doc: documentsTable, vendorName: restaurantsTable.name })
    .from(documentsTable)
    .innerJoin(restaurantsTable, eq(documentsTable.restaurantId, restaurantsTable.id))
    .where(eq(documentsTable.id, docId));
  if (!row) { res.status(404).json({ error: "Document not found" }); return; }
  await db.insert(platformCommunicationsTable).values({
    commType: "Document Renewal", subject: `${row.doc.name} expiring soon`,
    message: `Your ${row.doc.category} document (${row.doc.name}) requires renewal.`,
    channel: "email", target: row.vendorName, recipients: 1, deliveryRate: "100", status: "queued",
  });
  res.json({ sent: true });
});

router.get("/superadmin/agreements", ...admin, async (_req, res) => {
  const rows = await db.select().from(platformAgreementsTable).orderBy(desc(platformAgreementsTable.createdAt));
  res.json(rows.map(a => ({
    id: `AGR-${a.id}`, vendorName: a.vendorName, agreementType: a.agreementType,
    signedDate: a.signedDate?.toISOString().split("T")[0] ?? null,
    expiryDate: a.expiryDate?.toISOString().split("T")[0] ?? null,
    status: a.status, createdAt: a.createdAt.toISOString(),
  })));
});

router.post("/superadmin/agreements", ...admin, async (req, res) => {
  const { vendorName, agreementType, signedDate, expiryDate, status, vendorId } = req.body;
  const [a] = await db.insert(platformAgreementsTable).values({
    restaurantId: vendorId ? Number(vendorId) : null, vendorName, agreementType,
    signedDate: signedDate ? new Date(signedDate) : null,
    expiryDate: expiryDate ? new Date(expiryDate) : null, status: status || "active",
  }).returning();
  res.status(201).json({ id: `AGR-${a.id}`, vendorName: a.vendorName, status: a.status });
});

router.post("/superadmin/agreements/:id/renew", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("AGR-", ""), 10);
  const [a] = await db.select().from(platformAgreementsTable).where(eq(platformAgreementsTable.id, id));
  if (!a) { res.status(404).json({ error: "Agreement not found" }); return; }
  // An agreement with no expiry date has nothing to roll forward, so reporting it as
  // renewed would be as untrue as reporting it for one that is not there at all.
  if (!a.expiryDate) { res.status(400).json({ error: "Agreement has no expiry date to renew" }); return; }
  const next = new Date(a.expiryDate); next.setFullYear(next.getFullYear() + 1);
  await db.update(platformAgreementsTable).set({ expiryDate: next, status: "active" }).where(eq(platformAgreementsTable.id, id));
  res.json({ id: req.params.id, renewed: true, expiryDate: next.toISOString() });
});

router.get("/superadmin/vendor-crm", ...admin, async (_req, res) => {
  const logs = await db.select().from(platformCrmLogsTable).orderBy(desc(platformCrmLogsTable.loggedAt));
  const restaurants = await db.select().from(restaurantsTable);
  const planPrices: Record<string, number> = { free: 0, starter: 2499, pro: 6999, enterprise: 19999 };
  const upsellOpportunities = restaurants.filter(r => r.plan !== "enterprise" && r.isActive).slice(0, 8).map(r => ({
    id: `UP-${r.id}`, vendorName: r.name, currentPlan: r.plan,
    targetPlan: r.plan === "free" ? "starter" : r.plan === "starter" ? "pro" : "enterprise",
    mrrUplift: 1000, probability: 60,
  }));
  const dormant = restaurants.filter(r => !r.isActive).length;
  const growth = restaurants.filter(r => r.isActive && (r.plan === "starter" || r.plan === "pro")).length;
  const churnRisk = restaurants.filter(r => !r.isActive || r.plan === "free").length;
  const renewalAlerts = restaurants.filter(r => r.isActive && r.plan !== "free").slice(0, 15).map(r => {
    const renewal = new Date(r.createdAt);
    renewal.setFullYear(renewal.getFullYear() + 1);
    const daysLeft = Math.ceil((renewal.getTime() - Date.now()) / 86400000);
    return {
      vendorId: r.id, vendorName: r.name, plan: r.plan,
    mrr: planPrices[r.plan] ?? 0,
      renewalDate: renewal.toISOString().split("T")[0],
      daysLeft: Math.max(0, daysLeft),
    };
  }).filter(r => r.daysLeft <= 60);

  res.json({
    logs: logs.map(l => ({
      id: `CRM-${l.id}`, vendorName: l.vendorName, type: l.logType, notes: l.notes,
      outcome: l.outcome, followUpDate: l.followUpDate?.toISOString().split("T")[0] ?? null,
      loggedBy: l.loggedBy, loggedAt: l.loggedAt.toISOString(),
    })),
    followUps: logs.filter(l => l.followUpDate && l.outcome !== "completed"),
    upsellOpportunities, renewalAlerts,
    lifecycle: {
      trial: restaurants.filter(r => r.plan === "free").length,
      active: restaurants.filter(r => r.isActive).length,
      growth, dormant, enterprise: restaurants.filter(r => r.plan === "enterprise").length,
      churnRisk,
    },
  });
});

router.post("/superadmin/vendor-crm/logs", ...admin, async (req, res) => {
  const { vendorName, type, notes, outcome, followUpDate, vendorId, upsellPlan } = req.body;
  const [l] = await db.insert(platformCrmLogsTable).values({
    restaurantId: vendorId ? Number(vendorId) : null, vendorName, logType: type || "Note",
    notes, outcome, followUpDate: followUpDate ? new Date(followUpDate) : null,
    // The CRM form has always offered an upsell target and the column has always
    // existed; the field was simply never read off the request body, so every pitch
    // was recorded without the plan it was pitching.
    upsellPlan: upsellPlan ? String(upsellPlan) : null,
    loggedBy: (req as any).adminUser?.email ?? "admin",
  }).returning();
  res.status(201).json({ id: `CRM-${l.id}`, vendorName: l.vendorName, upsellPlan: l.upsellPlan });
});

router.patch("/superadmin/vendor-crm/logs/:id/complete", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("CRM-", ""), 10);
  const [updated] = await db.update(platformCrmLogsTable)
    .set({ outcome: "completed", followUpDate: null })
    .where(eq(platformCrmLogsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: `CRM-${updated.id}`, outcome: "completed" });
});

router.post("/superadmin/vendor-crm/remind", ...admin, async (req, res) => {
  const { vendorId, vendorName, subject, message } = req.body;
  await db.insert(platformCommunicationsTable).values({
    commType: "Renewal Reminder", subject: subject || "Subscription renewal reminder",
    message: message || "Your subscription is due for renewal. Please contact support.",
    channel: "email", target: vendorName || String(vendorId), recipients: 1,
    deliveryRate: "100", status: "queued",
  });
  await logPlatformAudit(req, "Renewal Reminder Sent", "CRM", vendorName || String(vendorId));
  res.json({ sent: true });
});

router.post("/superadmin/vendor-crm/renew", ...admin, async (req, res) => {
  const vendorId = Number(req.body.vendorId);
  if (!vendorId) { res.status(400).json({ error: "vendorId required" }); return; }
  await db.update(restaurantsTable).set({ isActive: true }).where(eq(restaurantsTable.id, vendorId));
  await logPlatformAudit(req, "Manual Renewal", "CRM", String(vendorId));
  res.json({ renewed: true });
});

router.get("/superadmin/metrics", ...admin, async (_req, res) => {
  const [orderCount] = await db.select({ count: count() }).from(ordersTable);
  const [restCount] = await db.select({ count: count() }).from(restaurantsTable);
  const [pendingTasks] = await db.select({ count: count() }).from(platformTasksTable).where(eq(platformTasksTable.status, "pending"));
  const [failedTasks] = await db.select({ count: count() }).from(platformTasksTable).where(eq(platformTasksTable.status, "failed"));
  const [pendingExports] = await db.select({ count: count() }).from(platformExportsTable).where(eq(platformExportsTable.status, "pending"));
  const queueDepth = (pendingTasks?.count ?? 0) + (pendingExports?.count ?? 0);
  const orders = orderCount?.count ?? 0;
  // These were arithmetic on the queue depth and the order count: CPU rose because tasks
  // were queued, memory was 30 plus three times the queue, disk was the constant 55, and
  // "requests per minute" was the lifetime order count. The server can read its own CPU,
  // memory and traffic, so it does. Disk and cache hit rate are not instrumented here, so
  // they come back null rather than as numbers an operator would act on.
  const snap = runtimeSnapshot();
  const uptimeMinutes = Math.max(1, snap.uptimeSeconds / 60);
  res.json({
    cpu: snap.cpuPercent,
    memory: snap.memoryPercent,
    memoryRssBytes: snap.memoryRssBytes,
    disk: null,
    network: null,
    uptime: null,
    uptimeSeconds: snap.uptimeSeconds,
    dbConnections: null,
    queueDepth,
    failedTasks: failedTasks?.count ?? 0,
    activeWebhooks: (await getWebhooks()).filter((w: { status?: string }) => w.status === "active").length,
    totalOrders: orders,
    totalVendors: restCount?.count ?? 0,
    apiRpm: Math.round(snap.requestsToday / uptimeMinutes),
    avgResponseMs: snap.avgResponseMs,
    errorsToday: snap.errorsToday,
    cacheHitRate: null,
    estimated: false,
  });
});

router.get("/superadmin/qr-codes", ...admin, async (_req, res) => {
  res.json(await listQrCodes());
});

router.get("/superadmin/roles", ...admin, async (_req, res) => {
  await ensurePlatformDefaults();
  const rows = await db.select().from(platformRolesTable);
  res.json(rows.map(r => ({
    id: String(r.id), name: r.name, description: r.description,
    permissions: r.permissions, isSystem: r.isSystem,
  })));
});

router.put("/superadmin/roles/:id", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const [r] = await db.update(platformRolesTable).set({
    name: req.body.name, description: req.body.description, permissions: req.body.permissions,
  }).where(eq(platformRolesTable.id, id)).returning();
  if (!r) { res.status(404).json({ error: "Role not found" }); return; }
  res.json(r);
});

router.post("/superadmin/restaurants/:restaurantId/toggle", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const [existing] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(restaurantsTable).set({ isActive: !existing.isActive }).where(eq(restaurantsTable.id, id)).returning();
  res.json(updated);
});

router.put("/superadmin/restaurants/:restaurantId/plan", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const planId = String(req.body.plan ?? "");
  const [planRow] = await db.select().from(platformPlansTable).where(eq(platformPlansTable.id, planId));
  if (!planRow) { res.status(400).json({ error: "Unknown plan" }); return; }
  const [updated] = await db.update(restaurantsTable).set({ plan: planId }).where(eq(restaurantsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.put("/superadmin/vendors/:vendorId", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.vendorId), 10);
  const { name, phone, address, businessType, email, website, gstNumber, fssaiNumber } = req.body;
  const [updated] = await db.update(restaurantsTable).set({
    name, phone, address, businessType, email, website, gstNumber, fssaiNumber,
  }).where(eq(restaurantsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  await logPlatformAudit(req, "Vendor Updated", "Vendors", String(id));
  res.json(updated);
});

router.post("/superadmin/vendors/:vendorId/controls", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.vendorId), 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const settings = { ...(r.settings as object ?? {}) };
  const current = readPlatformControls(settings);
  const platformControls = { ...current, ...req.body };
  await db.update(restaurantsTable).set({ settings: { ...settings, platformControls } }).where(eq(restaurantsTable.id, id));
  await logPlatformAudit(req, "Vendor Controls Updated", "Vendors", String(id), platformControls);
  res.json({ platformControls });
});

router.post("/superadmin/vendors/:vendorId/force-logout", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.vendorId), 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const settings = { ...(r.settings as object ?? {}), security: { forceLogoutAt: new Date().toISOString() } };
  await db.update(restaurantsTable).set({ settings }).where(eq(restaurantsTable.id, id));
  await logPlatformAudit(req, "Force Logout", "Vendors", String(id));
  res.json({ success: true });
});

router.delete("/superadmin/vendors/:vendorId", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.vendorId), 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const settings = { ...(r.settings as object ?? {}) };
  const platformControls = { ...readPlatformControls(settings), deletedAt: new Date().toISOString() };
  await db.update(restaurantsTable).set({ isActive: false, settings: { ...settings, platformControls } }).where(eq(restaurantsTable.id, id));
  await logPlatformAudit(req, "Vendor Soft Deleted", "Vendors", String(id));
  res.json({ deleted: true });
});

router.post("/superadmin/vendors/:vendorId/restore", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.vendorId), 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const settings = { ...(r.settings as object ?? {}) };
  const platformControls = { ...readPlatformControls(settings), deletedAt: null };
  await db.update(restaurantsTable).set({ isActive: true, settings: { ...settings, platformControls } }).where(eq(restaurantsTable.id, id));
  await logPlatformAudit(req, "Vendor Restored", "Vendors", String(id));
  res.json({ restored: true });
});

router.post("/superadmin/users", ...admin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 8) {
    res.status(400).json({ error: "Name, email, and password (min 8 chars) required" });
    return;
  }
  if (!PLATFORM_ADMIN_ROLES.includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash, role }).returning();
  await logPlatformAudit(req, "Admin User Created", "Users", String(user.id));
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
});

router.patch("/superadmin/users/:id", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "Not found" }); return; }
  const patch: Record<string, unknown> = {};
  if (req.body.name) patch.name = req.body.name;
  if (req.body.role) {
    // This route edits the platform owner's own team. A restaurant account reaching it
    // was a way across the boundary in the dangerous direction: one PATCH turned a
    // venue's owner into finance_admin, which requireSuperAdmin accepts, handing a
    // customer the platform's finance module. Who may RECEIVE a platform role has to
    // be checked as well as which role is being handed out.
    if (!PLATFORM_ADMIN_ROLES.includes(target.role)) {
      res.status(400).json({ error: "This account is not a platform admin" });
      return;
    }
    // The create path has always checked this list; the edit path did not, so a role
    // could be changed to anything at all — including a restaurant-side role, which
    // would hand a venue's role to a platform account, and including free-text that
    // resolves to no permissions and quietly bricks the account.
    if (!PLATFORM_ADMIN_ROLES.includes(req.body.role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    // Editing a user must not be a way around the role you hold yourself: only a
    // super admin may mint another super admin.
    const actor = (req as AdminRequest).adminUser;
    if (req.body.role === "super_admin" && actor?.role !== "super_admin") {
      res.status(403).json({ error: "Only a super admin can grant the super admin role" });
      return;
    }
    patch.role = req.body.role;
  }
  if (req.body.password && req.body.password.length >= 8) {
    patch.passwordHash = await bcrypt.hash(req.body.password, 12);
  }
  const [user] = await db.update(usersTable).set(patch).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  await logPlatformAudit(req, "Admin User Updated", "Users", String(id));
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
});

router.get("/superadmin/live-feed", ...admin, async (_req, res) => {
  res.json(await getLiveFeed());
});

router.get("/superadmin/webhooks", ...admin, async (_req, res) => {
  res.json(await getWebhooks());
});

router.post("/superadmin/webhooks", ...admin, async (req, res) => {
  const { url, events } = req.body;
  if (!url) { res.status(400).json({ error: "URL required" }); return; }
  const items = await getWebhooks() as Record<string, unknown>[];
  const webhook = {
    id: `WH-${Date.now()}`, url, events: events || ["payment.success", "order.created"],
    status: "active", failures: 0, lastDelivery: null, createdAt: new Date().toISOString(),
  };
  await saveWebhooks([webhook, ...items]);
  res.status(201).json(webhook);
});

router.delete("/superadmin/webhooks/:id", ...admin, async (req, res) => {
  const all = await getWebhooks() as { id: string }[];
  const items = all.filter(w => w.id !== req.params.id);
  if (items.length === all.length) { res.status(404).json({ error: "Webhook not found" }); return; }
  await saveWebhooks(items);
  res.json({ deleted: true });
});

router.post("/superadmin/webhooks/:id/retry", ...admin, async (req, res) => {
  const items = await getWebhooks() as { id: string; failures?: number; lastDelivery?: string }[];
  if (!items.some(w => w.id === req.params.id)) { res.status(404).json({ error: "Webhook not found" }); return; }
  const next = items.map(w => w.id === req.params.id
    ? { ...w, failures: 0, lastDelivery: new Date().toISOString(), status: "active" }
    : w);
  await saveWebhooks(next);
  res.json({ retried: true });
});

router.get("/superadmin/api-usage", ...admin, async (_req, res) => {
  res.json(await getApiUsageAnalytics());
});

router.get("/superadmin/search", ...admin, async (req, res) => {
  res.json(await masterSearch(String(req.query.q ?? "")));
});

router.post("/superadmin/qr-codes/bulk", ...admin, async (req, res) => {
  const { vendorId, count: qty, prefix, type } = req.body;
  const restaurantId = Number(vendorId);
  if (!restaurantId || !qty || qty < 1 || qty > 50) {
    res.status(400).json({ error: "vendorId and count (1-50) required" });
    return;
  }
  const [restaurant] = await db.select({ slug: restaurantsTable.slug }).from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant) { res.status(404).json({ error: "Vendor not found" }); return; }
  const baseUrl = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  const created = [];
  for (let i = 1; i <= qty; i++) {
    const label = `${prefix || "Table"} ${i}`;
    const url = `${baseUrl}/menu/${restaurant.slug}?table=${encodeURIComponent(label)}`;
    const [code] = await db.insert(qrCodesTable).values({
      restaurantId, label, type: type || "table", url,
    }).returning();
    created.push({ id: String(code.id), label, url, scans: 0, status: "active" });
  }
  await logPlatformAudit(req, "Bulk QR Generated", "QR/NFC", String(restaurantId), { count: qty });
  res.status(201).json({ created, count: created.length });
});

router.post("/superadmin/support/:id/assign", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace(/^TKT-/, ""), 10);
  const { agent } = req.body;
  const [updated] = await db.update(supportTicketsTable).set({
    assignedTo: agent || "Support Agent",
    status: "in_progress",
  }).where(eq(supportTicketsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json({ id: `TKT-${updated.id}`, assignedTo: updated.assignedTo, status: updated.status });
});

router.post("/superadmin/support/merge", ...admin, async (req, res) => {
  const { primaryId, secondaryId } = req.body;
  if (!primaryId || !secondaryId) { res.status(400).json({ error: "primaryId and secondaryId required" }); return; }
  const updated = await mergeSupportTickets(primaryId, secondaryId);
  if (!updated) { res.status(404).json({ error: "Ticket not found" }); return; }
  await logPlatformAudit(req, "Tickets Merged", "Support", `${primaryId}+${secondaryId}`);
  res.json({ id: `TKT-${updated.id}`, merged: true });
});

router.get("/superadmin/role-permissions", ...admin, async (_req, res) => {
  res.json(await getRolePermissions());
});
router.put("/superadmin/role-permissions", ...admin, async (req, res) => {
  const saved = await setRolePermissions({
    roles: (req.body?.roles ?? {}) as Record<string, string[]>,
    teams: Array.isArray(req.body?.teams) ? req.body.teams : [],
    pages: Array.isArray(req.body?.pages) ? req.body.pages : [],
  });
  await logPlatformAudit(req, "Role permissions updated", "Platform", "roles");
  res.json(saved);
});

// ── Blog (Digital Marketing) ──────────────────────────────────
router.get("/superadmin/blogs", ...admin, async (_req, res) => {
  res.json({ posts: await listBlogPosts() });
});
router.post("/superadmin/blogs", ...admin, async (req: any, res) => {
  const author = req.adminUser?.name ?? req.adminUser?.email ?? "Admin";
  const post = await createBlogPost(req.body ?? {}, author);
  await logPlatformAudit(req, `Blog created: ${post.title}`, "Blog", post.id);
  res.status(201).json(post);
});
router.put("/superadmin/blogs/:id", ...admin, async (req, res) => {
  const post = await updateBlogPost(req.params.id, req.body ?? {});
  if (!post) { res.status(404).json({ error: "Blog post not found" }); return; }
  await logPlatformAudit(req, `Blog updated: ${post.title}`, "Blog", post.id);
  res.json(post);
});
router.delete("/superadmin/blogs/:id", ...admin, async (req, res) => {
  const ok = await deleteBlogPost(req.params.id);
  if (!ok) { res.status(404).json({ error: "Blog post not found" }); return; }
  await logPlatformAudit(req, `Blog deleted`, "Blog", req.params.id);
  res.json({ success: true });
});

router.get("/superadmin/approvals", ...admin, async (_req, res) => { res.json(await listApprovals()); });
router.post("/superadmin/approvals", ...admin, async (req, res) => {
  const item = await createApproval(req.body);
  res.status(201).json(item);
});
router.patch("/superadmin/approvals/:id", ...admin, async (req, res) => {
  const item = await updateApproval(req.params.id, req.body);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});

router.get("/superadmin/reservations", ...admin, async (_req, res) => { res.json(await listPlatformReservations()); });
router.patch("/superadmin/reservations/:id", ...admin, async (req, res) => {
  const updated = await updatePlatformReservation(req.params.id, req.body.status);
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.get("/superadmin/vendor-wallets", ...admin, async (_req, res) => { res.json(await listVendorWallets()); });

router.get("/superadmin/billing-rules", ...admin, async (_req, res) => { res.json(await getBillingRules()); });
router.put("/superadmin/billing-rules", ...admin, async (req, res) => { res.json(await saveBillingRules(req.body)); });

router.get("/superadmin/ai-insights", ...admin, async (_req, res) => { res.json(await getAIInsights()); });

router.get("/superadmin/alert-rules", ...admin, async (_req, res) => { res.json(await getAlertRules()); });
router.put("/superadmin/alert-rules", ...admin, async (req, res) => { res.json(await saveAlertRules(req.body)); });

router.get("/superadmin/incidents", ...admin, async (_req, res) => { res.json(await getIncidents()); });
router.post("/superadmin/incidents", ...admin, async (req, res) => { res.status(201).json(await saveIncident(req.body)); });
router.patch("/superadmin/incidents/:id", ...admin, async (req, res) => {
  const item = await updateIncident(req.params.id, req.body);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});

router.get("/superadmin/dr-status", ...admin, async (_req, res) => { res.json(await getDRStatus()); });
router.put("/superadmin/dr-status", ...admin, async (req, res) => { res.json(await saveDRStatus(req.body)); });

router.get("/superadmin/legal", ...admin, async (_req, res) => { res.json(await getLegalCenter()); });
router.post("/superadmin/legal/hold", ...admin, async (req, res) => {
  const hold = await saveLegalHold(req.body);
  await logPlatformAudit(req, "Legal Hold", "Legal", String(req.body.vendorId));
  res.status(201).json(hold);
});

router.get("/superadmin/sandbox", ...admin, async (_req, res) => { res.json(await getSandboxConfig()); });
router.put("/superadmin/sandbox", ...admin, async (req, res) => { res.json(await saveSandboxConfig(req.body)); });

router.get("/superadmin/archival", ...admin, async (_req, res) => { res.json(await getArchivalPolicies()); });
router.post("/superadmin/archival/:policyId/run", ...admin, async (req, res) => {
  const archive = await runArchival(String(req.params.policyId));
  if (!archive) { res.status(404).json({ error: "Archival policy not found" }); return; }
  res.json(archive);
});

router.get("/superadmin/feature-releases", ...admin, async (_req, res) => { res.json(await getFeatureReleases()); });
router.put("/superadmin/feature-releases", ...admin, async (req, res) => { res.json(await saveFeatureReleases(req.body)); });

router.get("/superadmin/settlement-rules", ...admin, async (_req, res) => { res.json(await getSettlementRules()); });
router.put("/superadmin/settlement-rules", ...admin, async (req, res) => { res.json(await saveSettlementRules(req.body)); });

router.get("/superadmin/dormant-vendors", ...admin, async (_req, res) => { res.json(await getDormantVendors()); });
router.put("/superadmin/dormant-vendors/rules", ...admin, async (req, res) => { res.json(await saveDormantRules(req.body)); });

router.get("/superadmin/revenue-leakage", ...admin, async (_req, res) => { res.json(await getRevenueLeakage()); });

/**
 * The refund list also returns read-only rows synthesised from already-refunded
 * orders, keyed `REF-ORD-<orderId>`. The action helpers strip the `REF-` prefix and
 * treat what is left as a refunds-table id, so `REF-ORD-12` silently rewrites refund
 * #12 — a different vendor's record. Reject those ids before any write happens.
 */
function rejectOrderDerivedRefund(id: string, res: Response): boolean {
  if (!/^REF-ORD-/i.test(id)) return false;
  res.status(400).json({ error: "This row is order history, not an editable refund request" });
  return true;
}

router.post("/superadmin/refunds/:id/retry", ...admin, async (req, res) => {
  if (rejectOrderDerivedRefund(req.params.id, res)) return;
  const updated = await retryRefund(req.params.id);
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});
router.post("/superadmin/refunds/:id/cancel", ...admin, async (req, res) => {
  if (rejectOrderDerivedRefund(req.params.id, res)) return;
  const updated = await cancelRefund(req.params.id);
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});
router.post("/superadmin/refunds/:id/partial", ...admin, async (req, res) => {
  if (rejectOrderDerivedRefund(req.params.id, res)) return;
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "A positive numeric amount is required" });
    return;
  }
  const updated = await partialRefund(req.params.id, amount);
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});
router.post("/superadmin/refunds/:id/escalate", ...admin, async (req, res) => {
  if (rejectOrderDerivedRefund(req.params.id, res)) return;
  const item = await createApproval({ type: "refund", refundId: req.params.id, reason: req.body.reason, amount: req.body.amount });
  res.status(201).json(item);
});

router.post("/superadmin/chargebacks/:id/evidence", ...admin, async (req, res) => {
  const updated = await uploadChargebackEvidence(req.params.id, req.body.evidence || "");
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.post("/superadmin/vendors/bulk-action", ...admin, async (req, res) => {
  const { vendorIds, action } = req.body;
  if (!Array.isArray(vendorIds) || !action) { res.status(400).json({ error: "vendorIds and action required" }); return; }
  const result = await bulkVendorAction(vendorIds.map(Number), action);
  await logPlatformAudit(req, `Bulk ${action}`, "Vendors", vendorIds.join(","));
  res.json(result);
});

router.post("/superadmin/export/:id/approve", ...admin, async (req, res) => {
  const updated = await approveExport(req.params.id);
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});
router.post("/superadmin/export/:id/reject", ...admin, async (req, res) => {
  const updated = await rejectExport(req.params.id, req.body.reason || "");
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

registerSuperAdminFeatureRoutes(router, admin);

export default router;
