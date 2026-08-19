import { Router, type IRouter } from "express";
import { eq, desc, count, and, sql } from "drizzle-orm";
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
import { requireSuperAdmin } from "../middlewares/superadmin-auth";
import {
  ensurePlatformDefaults, getEnhancedStats, getRevenueTimeSeries, getExtendedAnalytics, getTaxReports,
  listPayments, listSettlements, listKycRecords, updateKycStatus, detectFraudAlerts, listQrCodes,
  logPlatformAudit, getPlatformSettings, getPlatformSettingsRaw, setPlatformSettings, getCommissionRate, hashApiKey,
  getInfrastructureOverview, getSlaMonitoring, countExportRecords, generateExportCsv,
  getPaymentDetail, getLiveFeed, getWebhooks, saveWebhooks, getApiUsageAnalytics, masterSearch,
  listAdminSessions, revokeAdminSession,
  readPlatformControls, listSubscriptionInvoices, verifyWhiteLabelDomain, getSubscriptionMrr,
} from "../lib/platform-admin";
import { PLATFORM_CURRENCY } from "../lib/currency.js";
import { invalidateRestaurantAnalyticsCache } from "../lib/analytics-cache.js";
import { sumOrderTotals } from "../lib/payment-calculations.js";
import {
  listApprovals, createApproval, updateApproval, listPlatformReservations, updatePlatformReservation,
  listVendorWallets, getBillingRules, saveBillingRules, getAIInsights, getAlertRules, saveAlertRules,
  getIncidents, saveIncident, updateIncident, getDRStatus, saveDRStatus, getLegalCenter, saveLegalHold,
  getSandboxConfig, saveSandboxConfig, getArchivalPolicies, runArchival, getFeatureReleases, saveFeatureReleases,
  getSettlementRules, saveSettlementRules, getDormantVendors, saveDormantRules, getRevenueLeakage,
  retryRefund, cancelRefund, partialRefund, uploadChargebackEvidence, bulkVendorAction,
  approveExport, rejectExport, mergeSupportTickets,
} from "../lib/platform-extensions.js";
import { registerSuperAdminFeatureRoutes } from "./feature-modules.js";

const router: IRouter = Router();
const admin = [requireSuperAdmin] as const;

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
  const vendorId = parseInt(req.params.vendorId, 10);
  const { action, plan } = req.body as { action?: string; plan?: string };
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, vendorId));
  if (!r) { res.status(404).json({ error: "Vendor not found" }); return; }

  if (action === "pause" || action === "cancel") {
    await db.update(restaurantsTable).set({ isActive: false }).where(eq(restaurantsTable.id, vendorId));
  } else if (action === "resume" || action === "renew") {
    await db.update(restaurantsTable).set({ isActive: true }).where(eq(restaurantsTable.id, vendorId));
  }
  invalidateRestaurantAnalyticsCache(vendorId);
  if (plan && ["free", "starter", "pro", "enterprise"].includes(plan)) {
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
  const allOrders = await db.select().from(ordersTable);
  const result = await Promise.all(filtered.map(async (r) => {
      const [owner] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, r.userId));
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
    }));
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
    const id = parseInt(req.params.vendorId, 10);
    const [existing] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const [updated] = await db.update(restaurantsTable).set({ isActive: !existing.isActive }).where(eq(restaurantsTable.id, id)).returning();
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
  const userId = parseInt(req.params.userId, 10);
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
  const userId = parseInt(req.params.userId, 10);
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
    const id = parseInt(req.params.vendorId, 10);
    const { plan } = req.body;
    const [updated] = await db.update(restaurantsTable).set({ plan }).where(eq(restaurantsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const { syncPlanKitchenEntitlements } = await import("../lib/feature-modules/entitlements.js");
    await syncPlanKitchenEntitlements(id, plan);
  await logPlatformAudit(req, "Plan Updated", "Vendors", String(id), { plan });
    res.json(updated);
});

router.post("/superadmin/vendors/:vendorId/freeze-payouts", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.vendorId, 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const settings = { ...(r.settings as object ?? {}), wallet: { ...((r.settings as { wallet?: object })?.wallet ?? {}), frozen: true } };
  await db.update(restaurantsTable).set({ settings }).where(eq(restaurantsTable.id, id));
  await logPlatformAudit(req, "Payouts Frozen", "Vendors", String(id));
  res.json({ frozen: true });
});

router.post("/superadmin/vendors/:vendorId/reset-password", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.vendorId, 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const tempPassword = crypto.randomBytes(8).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, r.userId));
  await logPlatformAudit(req, "Password Reset", "Vendors", String(id));
  res.json({ message: "Password reset successfully", temporaryPassword: tempPassword });
});

router.get("/superadmin/vendors/:vendorId/settlements", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.vendorId, 10);
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
    const id = parseInt(req.params.vendorId, 10);
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
  const id = parseInt(req.params.vendorId, 10);
  const rows = await db.select().from(staffTable).where(eq(staffTable.restaurantId, id));
  res.json(rows.map(({ pinHash: _h, ...rest }) => ({
    id: `S${rest.id}`, name: rest.name, role: rest.role, branch: "Main",
    status: rest.isActive ? "Active" : "Inactive",
    lastLogin: rest.updatedAt?.toISOString() ?? rest.createdAt?.toISOString() ?? null,
    email: rest.email, phone: rest.phone,
  })));
});

router.get("/superadmin/vendors/:vendorId/branches", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.vendorId, 10);
  const rows = await db.select().from(branchesTable).where(eq(branchesTable.restaurantId, id));
  res.json(rows.map(b => ({
    id: `B${b.id}`, name: b.name, location: b.address || "—",
    tables: 0, rooms: 0, status: b.isActive ? "Active" : "Inactive",
  })));
});

router.get("/superadmin/vendors/:vendorId/documents", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.vendorId, 10);
  const rows = await db.select().from(documentsTable).where(eq(documentsTable.restaurantId, id)).orderBy(desc(documentsTable.createdAt));
  res.json(rows.map(d => ({
    type: d.name || d.category || "Document",
    number: d.description || `DOC-${d.id}`,
    status: d.status === "active" ? "Verified" : d.status === "expired" ? "Expired" : "Pending",
    uploaded: d.createdAt ? new Date(d.createdAt).toISOString().split("T")[0] : "—",
    expires: d.expiryDate ? new Date(d.expiryDate).toISOString().split("T")[0] : null,
    id: d.id,
  })));
});

router.get("/superadmin/vendors/:vendorId/crm-logs", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.vendorId, 10);
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
  const id = parseInt(req.params.vendorId, 10);
  const { name, address, phone, isActive } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Branch name is required" }); return; }
  const [branch] = await db.insert(branchesTable).values({
    restaurantId: id, name: name.trim(), address: address || null, phone: phone || null, isActive: isActive ?? true,
  }).returning();
  await logPlatformAudit(req, "Branch Created", "Vendors", String(id));
  res.status(201).json({ id: `B${branch.id}`, name: branch.name, location: branch.address || "—", status: branch.isActive ? "Active" : "Inactive" });
});

router.put("/superadmin/vendors/:vendorId/branches/:branchId", ...admin, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.vendorId, 10);
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
  const restaurantId = parseInt(req.params.vendorId, 10);
  const branchId = parseInt(String(req.params.branchId).replace("B", ""), 10);
  const [deleted] = await db.delete(branchesTable).where(and(eq(branchesTable.id, branchId), eq(branchesTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Branch not found" }); return; }
  await logPlatformAudit(req, "Branch Disabled", "Vendors", String(restaurantId));
  res.json({ deleted: true });
});

router.post("/superadmin/vendors/:vendorId/staff", ...admin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.vendorId, 10);
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
  const restaurantId = parseInt(req.params.vendorId, 10);
  const staffId = parseInt(String(req.params.staffId).replace("S", ""), 10);
  const [deleted] = await db.delete(staffTable).where(and(eq(staffTable.id, staffId), eq(staffTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Staff not found" }); return; }
  await logPlatformAudit(req, "Staff Removed", "Vendors", String(restaurantId));
  res.json({ deleted: true });
});

router.post("/superadmin/vendors/:vendorId/qrcodes", ...admin, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.vendorId, 10);
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
  const restaurantId = parseInt(req.params.vendorId, 10);
  const qrId = parseInt(req.params.qrId, 10);
  const [deleted] = await db.delete(qrCodesTable).where(and(eq(qrCodesTable.id, qrId), eq(qrCodesTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "QR code not found" }); return; }
  res.json({ deleted: true });
});

router.get("/superadmin/users", ...admin, async (_req, res) => {
    const users = await db.select({
    id: usersTable.id, name: usersTable.name, email: usersTable.email,
    role: usersTable.role, createdAt: usersTable.createdAt,
    }).from(usersTable).orderBy(desc(usersTable.createdAt));
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

router.post("/superadmin/plans", ...admin, async (req, res) => {
  const { id, name, price, currency, features, maxBranches, maxItems, maxStaff, featureToggles } = req.body;
  const [plan] = await db.insert(platformPlansTable).values({
    id: id || `plan_${Date.now()}`, name, price: String(price ?? 0), currency: PLATFORM_CURRENCY,
    features: features ?? [], maxBranches: maxBranches ?? 1, maxItems: maxItems ?? 50, maxStaff: maxStaff ?? 5,
    featureToggles: featureToggles ?? {},
  }).returning();
  res.status(201).json(plan);
});

router.put("/superadmin/plans/:id", ...admin, async (req, res) => {
  const { name, price, features, maxBranches, maxItems, maxStaff, maxTables, maxOrdersPerMonth, trialDays, isPublished, featureToggles, currency } = req.body;
  const [plan] = await db.update(platformPlansTable).set({
    name, price: price !== undefined ? String(price) : undefined, features, maxBranches, maxItems, maxStaff,
    maxTables, maxOrdersPerMonth, trialDays, isPublished, featureToggles, currency: PLATFORM_CURRENCY,
  }).where(eq(platformPlansTable.id, req.params.id)).returning();
  res.json(plan ?? { error: "Not found" });
});

router.delete("/superadmin/plans/:id", ...admin, async (req, res) => {
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

router.get("/superadmin/analytics/summary", ...admin, async (_req, res) => {
  const stats = await getEnhancedStats();
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
  const [updated] = await db.update(platformSettlementsTable).set({
    status: "released", releasedAt: new Date(),
  }).where(eq(platformSettlementsTable.id, id)).returning();
  await logPlatformAudit(req, "Payout Released", "Settlements", req.params.id);
  res.json(updated ?? { id: req.params.id, status: "released" });
});

router.post("/superadmin/settlements/:id/hold", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("STL-", ""), 10);
  const { reason } = req.body;
  const [updated] = await db.update(platformSettlementsTable).set({
    status: "held", holdReason: reason || "Manual hold",
  }).where(eq(platformSettlementsTable.id, id)).returning();
  await logPlatformAudit(req, "Payout Held", "Settlements", req.params.id, { reason });
  res.json(updated ?? { id: req.params.id, status: "held" });
});

router.post("/superadmin/settlements/:id/retry", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace(/^(STL-|SET-)/, ""), 10);
  const [updated] = await db.update(platformSettlementsTable).set({ status: "pending", holdReason: null })
    .where(eq(platformSettlementsTable.id, id)).returning();
  await logPlatformAudit(req, "Settlement Retry", "Settlements", req.params.id);
  res.json(updated ?? { id: req.params.id, status: "pending" });
});

router.get("/superadmin/kyc", ...admin, async (_req, res) => {
  res.json(await listKycRecords());
});

router.post("/superadmin/kyc/:id/approve", ...admin, async (req, res) => {
  const restaurantId = parseInt(String(req.params.id).replace("kyc_", ""), 10);
  await updateKycStatus(restaurantId, "approved");
  await logPlatformAudit(req, "KYC Approved", "KYC", String(restaurantId));
  res.json({ id: req.params.id, status: "Approved" });
});

router.post("/superadmin/kyc/:id/reject", ...admin, async (req, res) => {
  const restaurantId = parseInt(String(req.params.id).replace("kyc_", ""), 10);
  const { reason } = req.body;
  await updateKycStatus(restaurantId, "rejected", reason);
  await logPlatformAudit(req, "KYC Rejected", "KYC", String(restaurantId), { reason });
  res.json({ id: req.params.id, status: "Action Required", rejectionReason: reason });
});

router.post("/superadmin/kyc/:id/request-more", ...admin, async (req, res) => {
  const restaurantId = parseInt(String(req.params.id).replace("kyc_", ""), 10);
  await updateKycStatus(restaurantId, "action_required");
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
  const id = parseInt(String(req.params.id).replace("REF-", ""), 10);
  const [updated] = await db.update(platformRefundsTable).set({ status: "approved", processedAt: new Date() })
    .where(eq(platformRefundsTable.id, id)).returning();
  await logPlatformAudit(req, "Refund Approved", "Refunds", req.params.id);
  res.json(updated ?? { id: req.params.id, status: "Approved" });
});

router.post("/superadmin/refunds/:id/reject", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("REF-", ""), 10);
  const { reason } = req.body;
  const [updated] = await db.update(platformRefundsTable).set({ status: "rejected", rejectionReason: reason, processedAt: new Date() })
    .where(eq(platformRefundsTable.id, id)).returning();
  res.json(updated ?? { id: req.params.id, status: "Rejected", reason });
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
  await db.update(supportTicketsTable).set({ status: "resolved", resolution: resolution || "Resolved" }).where(eq(supportTicketsTable.id, id));
  res.json({ id: req.params.id, status: "Resolved" });
});

router.post("/superadmin/support/:id/escalate", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("TKT-", ""), 10);
  await db.update(supportTicketsTable).set({ status: "escalated", priority: "high" }).where(eq(supportTicketsTable.id, id));
  res.json({ id: req.params.id, status: "Escalated" });
});

router.post("/superadmin/support/:id/close", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("TKT-", ""), 10);
  await db.update(supportTicketsTable).set({ status: "closed" }).where(eq(supportTicketsTable.id, id));
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
  await db.delete(platformCouponsTable).where(eq(platformCouponsTable.id, id));
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
  await db.update(platformFraudAlertsTable).set({ status: "resolved", resolvedAt: new Date() }).where(eq(platformFraudAlertsTable.id, id));
  res.json({ id: req.params.id, status: "Resolved" });
});

router.post("/superadmin/fraud/:id/dismiss", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("FA-", ""), 10);
  await db.update(platformFraudAlertsTable).set({ status: "dismissed", resolvedAt: new Date() }).where(eq(platformFraudAlertsTable.id, id));
  res.json({ id: req.params.id, status: "Dismissed" });
});

router.post("/superadmin/fraud/:id/block", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("FA-", ""), 10);
  const [alert] = await db.select().from(platformFraudAlertsTable).where(eq(platformFraudAlertsTable.id, id));
  if (alert?.restaurantId) {
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
  res.json(r);
});

router.delete("/superadmin/commissions/:id", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("cr_", ""), 10);
  await db.delete(platformCommissionRulesTable).where(eq(platformCommissionRulesTable.id, id));
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
  await db.update(platformChargebacksTable).set({ status: "accepted", resolvedAt: new Date() }).where(eq(platformChargebacksTable.id, id));
  res.json({ id: req.params.id, status: "Accepted" });
});

router.post("/superadmin/chargebacks/:id/contest", ...admin, async (req, res) => {
  const id = parseInt(String(req.params.id).replace("CB-", ""), 10);
  await db.update(platformChargebacksTable).set({ status: "evidence_submitted" }).where(eq(platformChargebacksTable.id, id));
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
  await db.delete(platformApiKeysTable).where(eq(platformApiKeysTable.id, id));
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

router.post("/superadmin/white-label/verify-dns", ...admin, async (req, res) => {
  const domain = String(req.body?.domain ?? "");
  const result = await verifyWhiteLabelDomain(domain);
  if (result.verified) await logPlatformAudit(req, "White Label DNS Verified", "Platform", domain);
  res.json(result);
});

router.get("/superadmin/invoices/export", ...admin, async (_req, res) => {
  const plans = await db.select().from(platformPlansTable);
  const planPrices = Object.fromEntries(plans.map(p => [p.id, parseFloat(String(p.price))]));
  const restaurants = await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt));
  const header = "invoiceId,vendorId,vendorName,type,amount,status,date,dueDate\n";
  const csv = header + restaurants.map(r => {
    const amount = planPrices[r.plan || "free"] ?? 0;
    const status = amount === 0 ? "Paid" : (r.isActive ? "Paid" : "Unpaid");
    return [`INV-${r.id}`, r.id, `"${r.name}"`, "Subscription", amount, status, r.createdAt.toISOString().split("T")[0],
      new Date(r.createdAt.getTime() + 30 * 86400000).toISOString().split("T")[0]].join(",");
  }).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=invoices.csv");
  res.send(csv);
});

router.get("/superadmin/invoices/:id/download", ...admin, async (req, res) => {
  const vendorId = parseInt(String(req.params.id).replace("INV-", ""), 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, vendorId));
  if (!r) { res.status(404).json({ error: "Invoice not found" }); return; }
  const plans = await db.select().from(platformPlansTable);
  const planPrices = Object.fromEntries(plans.map(p => [p.id, parseFloat(String(p.price))]));
  const amount = planPrices[r.plan || "free"] ?? 0;
  const csv = `invoiceId,vendorName,plan,amount,status,date\nINV-${r.id},"${r.name}",${r.plan},${amount},${r.isActive ? "Paid" : "Unpaid"},${r.createdAt.toISOString().split("T")[0]}\n`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=INV-${r.id}.csv`);
  res.send(csv);
});

router.post("/superadmin/invoices/:id/email", ...admin, async (req, res) => {
  const vendorId = parseInt(String(req.params.id).replace("INV-", ""), 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, vendorId));
  if (!r) { res.status(404).json({ error: "Invoice not found" }); return; }
  const [owner] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, r.userId));
  await db.insert(platformCommunicationsTable).values({
    commType: "Invoice", subject: `Invoice INV-${r.id}`, message: `Your subscription invoice INV-${r.id} is ready.`,
    channel: "email", target: owner?.email || r.name, recipients: 1, deliveryRate: "100", status: "queued",
  });
  await logPlatformAudit(req, "Invoice Emailed", "Invoices", `INV-${r.id}`);
  res.json({ sent: true, to: owner?.email });
});

router.get("/superadmin/escrow", ...admin, async (_req, res) => {
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
  res.json({
    metrics: { totalEscrow: pending + held, activeHolds: held, pendingReleases: pending, lockedDisputes: held },
    ledger,
  });
});

router.post("/superadmin/escrow/freeze/:vendorId", ...admin, async (req, res) => {
  const id = parseInt(req.params.vendorId, 10);
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
  await db.delete(platformNotificationsTable).where(eq(platformNotificationsTable.id, id));
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
  await revokeAdminSession(req.params.id);
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
  await db.delete(platformIpWhitelistTable).where(eq(platformIpWhitelistTable.id, id));
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

  const discrepancies = failedOrders.map(({ order, vendorName }) => ({
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
  res.json({
    summary: {
      matched: payments.filter(p => p.status === "completed" || p.status === "paid").length,
      mismatched: allDisc.length,
      missing: failedOrders.length,
      duplicates: 0,
      totalAmount: payments.reduce((s, p) => s + p.grossAmount, 0),
    },
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
  res.json({ id: req.params.id, adjusted: true });
});

router.get("/superadmin/penalties", ...admin, async (_req, res) => {
  const rows = await db.select({ p: platformPenaltiesTable, vendorName: restaurantsTable.name })
    .from(platformPenaltiesTable)
    .innerJoin(restaurantsTable, eq(platformPenaltiesTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(platformPenaltiesTable.appliedAt));
  res.json(rows.map(({ p, vendorName }) => ({
    id: `PEN-${p.id}`, vendorName, reason: p.reason, amount: parseFloat(String(p.amount)),
    deductFrom: p.deductFrom, notes: p.notes, appliedBy: p.appliedBy,
    appliedAt: p.appliedAt.toISOString(), status: p.status,
  })));
});

router.post("/superadmin/penalties", ...admin, async (req, res) => {
  const { vendorName, reason, amount, deductFrom, notes, vendorId } = req.body;
  let restaurantId = Number(vendorId);
  if (!restaurantId && vendorName) {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.name, vendorName));
    restaurantId = r?.id ?? 0;
  }
  const [p] = await db.insert(platformPenaltiesTable).values({
    restaurantId: restaurantId || 1, reason, amount: String(amount),
    deductFrom: deductFrom || "wallet", notes, appliedBy: (req as any).adminUser?.email ?? "admin",
  }).returning();
  res.status(201).json({ id: `PEN-${p.id}`, vendorName, reason, amount: parseFloat(String(p.amount)), status: "Applied" });
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
  await db.delete(platformAnnouncementsTable).where(eq(platformAnnouncementsTable.id, id));
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
  if (a?.expiryDate) {
    const next = new Date(a.expiryDate); next.setFullYear(next.getFullYear() + 1);
    await db.update(platformAgreementsTable).set({ expiryDate: next, status: "active" }).where(eq(platformAgreementsTable.id, id));
  }
  res.json({ id: req.params.id, renewed: true });
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
  const { vendorName, type, notes, outcome, followUpDate, vendorId } = req.body;
  const [l] = await db.insert(platformCrmLogsTable).values({
    restaurantId: vendorId ? Number(vendorId) : null, vendorName, logType: type || "Note",
    notes, outcome, followUpDate: followUpDate ? new Date(followUpDate) : null,
    loggedBy: (req as any).adminUser?.email ?? "admin",
  }).returning();
  res.status(201).json({ id: `CRM-${l.id}`, vendorName: l.vendorName });
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
  const load = Math.min(95, Math.round(queueDepth * 8 + (failedTasks?.count ?? 0) * 5));
  res.json({
    cpu: load,
    memory: Math.min(90, Math.round(30 + queueDepth * 3)),
    disk: 55,
    network: Math.min(1000, orders + queueDepth * 10),
    uptime: orders > 0 ? "99.9%" : "100%",
    dbConnections: Math.min(50, 5 + Math.floor(orders / 100)),
    queueDepth,
    activeWebhooks: (await getWebhooks()).filter((w: { status?: string }) => w.status === "active").length,
    totalOrders: orders,
    totalVendors: restCount?.count ?? 0,
    apiRpm: Math.min(5000, Math.max(orders, queueDepth * 4)),
    cacheHitRate: "92.0",
    estimated: true,
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
  const id = parseInt(req.params.id, 10);
  const [r] = await db.update(platformRolesTable).set({
    name: req.body.name, description: req.body.description, permissions: req.body.permissions,
  }).where(eq(platformRolesTable.id, id)).returning();
  res.json(r);
});

router.post("/superadmin/restaurants/:restaurantId/toggle", ...admin, async (req, res) => {
  const id = parseInt(req.params.restaurantId, 10);
  const [existing] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(restaurantsTable).set({ isActive: !existing.isActive }).where(eq(restaurantsTable.id, id)).returning();
  res.json(updated);
});

router.put("/superadmin/restaurants/:restaurantId/plan", ...admin, async (req, res) => {
  const id = parseInt(req.params.restaurantId, 10);
  const [updated] = await db.update(restaurantsTable).set({ plan: req.body.plan }).where(eq(restaurantsTable.id, id)).returning();
  res.json(updated ?? { error: "Not found" });
});

router.put("/superadmin/vendors/:vendorId", ...admin, async (req, res) => {
  const id = parseInt(req.params.vendorId, 10);
  const { name, phone, address, businessType, email, website, gstNumber, fssaiNumber } = req.body;
  const [updated] = await db.update(restaurantsTable).set({
    name, phone, address, businessType, email, website, gstNumber, fssaiNumber,
  }).where(eq(restaurantsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  await logPlatformAudit(req, "Vendor Updated", "Vendors", String(id));
  res.json(updated);
});

router.post("/superadmin/vendors/:vendorId/controls", ...admin, async (req, res) => {
  const id = parseInt(req.params.vendorId, 10);
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
  const id = parseInt(req.params.vendorId, 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const settings = { ...(r.settings as object ?? {}), security: { forceLogoutAt: new Date().toISOString() } };
  await db.update(restaurantsTable).set({ settings }).where(eq(restaurantsTable.id, id));
  await logPlatformAudit(req, "Force Logout", "Vendors", String(id));
  res.json({ success: true });
});

router.delete("/superadmin/vendors/:vendorId", ...admin, async (req, res) => {
  const id = parseInt(req.params.vendorId, 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const settings = { ...(r.settings as object ?? {}) };
  const platformControls = { ...readPlatformControls(settings), deletedAt: new Date().toISOString() };
  await db.update(restaurantsTable).set({ isActive: false, settings: { ...settings, platformControls } }).where(eq(restaurantsTable.id, id));
  await logPlatformAudit(req, "Vendor Soft Deleted", "Vendors", String(id));
  res.json({ deleted: true });
});

router.post("/superadmin/vendors/:vendorId/restore", ...admin, async (req, res) => {
  const id = parseInt(req.params.vendorId, 10);
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
  const allowed = ["super_admin", "finance_admin", "support_admin", "compliance_admin", "sales_admin", "operations_admin"];
  if (!allowed.includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash, role }).returning();
  await logPlatformAudit(req, "Admin User Created", "Users", String(user.id));
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
});

router.patch("/superadmin/users/:id", ...admin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const patch: Record<string, unknown> = {};
  if (req.body.name) patch.name = req.body.name;
  if (req.body.role) patch.role = req.body.role;
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
  const items = (await getWebhooks() as { id: string }[]).filter(w => w.id !== req.params.id);
  await saveWebhooks(items);
  res.json({ deleted: true });
});

router.post("/superadmin/webhooks/:id/retry", ...admin, async (req, res) => {
  const items = await getWebhooks() as { id: string; failures?: number; lastDelivery?: string }[];
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
  res.json(await runArchival(req.params.policyId));
});

router.get("/superadmin/feature-releases", ...admin, async (_req, res) => { res.json(await getFeatureReleases()); });
router.put("/superadmin/feature-releases", ...admin, async (req, res) => { res.json(await saveFeatureReleases(req.body)); });

router.get("/superadmin/settlement-rules", ...admin, async (_req, res) => { res.json(await getSettlementRules()); });
router.put("/superadmin/settlement-rules", ...admin, async (req, res) => { res.json(await saveSettlementRules(req.body)); });

router.get("/superadmin/dormant-vendors", ...admin, async (_req, res) => { res.json(await getDormantVendors()); });
router.put("/superadmin/dormant-vendors/rules", ...admin, async (req, res) => { res.json(await saveDormantRules(req.body)); });

router.get("/superadmin/revenue-leakage", ...admin, async (_req, res) => { res.json(await getRevenueLeakage()); });

router.post("/superadmin/refunds/:id/retry", ...admin, async (req, res) => {
  const updated = await retryRefund(req.params.id);
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});
router.post("/superadmin/refunds/:id/cancel", ...admin, async (req, res) => {
  const updated = await cancelRefund(req.params.id);
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});
router.post("/superadmin/refunds/:id/partial", ...admin, async (req, res) => {
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
