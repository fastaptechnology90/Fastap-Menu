import { eq, desc, count, and, sql, sum } from "drizzle-orm";
import {
  db, restaurantsTable, ordersTable, reservationsTable,
  platformSettingsTable, platformRefundsTable, platformSettlementsTable,
  platformExportsTable, platformChargebacksTable,
  platformAuditLogsTable, supportTicketsTable,
} from "@workspace/db";
import { getEnhancedStats, getExtendedAnalytics, getCommissionRate, computeVendorSettlement } from "./platform-admin.js";
import {
  isPaidOrder,
  isRefundedOrder,
  orderGrossTotal,
  parseMoney,
  roundMoney,
  sumOrderCommissions,
} from "./payment-calculations.js";

async function getJson<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key));
  if (!row?.value) return fallback;
  return { ...fallback, ...(row.value as object) } as T;
}

async function setJson(key: string, value: unknown) {
  await db.insert(platformSettingsTable).values({ key, value })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value } });
}

export async function listApprovals() {
  const data = await getJson<{ items: unknown[] }>("approvals", { items: [] });
  return data.items ?? [];
}

// ── Blog posts (managed by the Digital Marketing team on the admin Blog page) ──
export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl?: string;
  status: "draft" | "published";
  author: string;
  createdAt: string;
  updatedAt: string;
};

function blogSlug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function listBlogPosts(): Promise<BlogPost[]> {
  const data = await getJson<{ items: BlogPost[] }>("blogs", { items: [] });
  return data.items ?? [];
}

async function saveBlogPosts(items: BlogPost[]) {
  await setJson("blogs", { items });
}

export async function createBlogPost(input: Partial<BlogPost>, author: string): Promise<BlogPost> {
  const items = await listBlogPosts();
  const now = new Date().toISOString();
  const title = (input.title ?? "Untitled").trim() || "Untitled";
  const post: BlogPost = {
    id: `BLOG-${Date.now()}`,
    title,
    slug: blogSlug(input.slug || title) || `post-${Date.now()}`,
    excerpt: input.excerpt ?? "",
    content: input.content ?? "",
    coverUrl: input.coverUrl,
    status: input.status === "published" ? "published" : "draft",
    author,
    createdAt: now,
    updatedAt: now,
  };
  items.unshift(post);
  await saveBlogPosts(items);
  return post;
}

export async function updateBlogPost(id: string, patch: Partial<BlogPost>): Promise<BlogPost | null> {
  const items = await listBlogPosts();
  const idx = items.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const current = items[idx];
  items[idx] = {
    ...current,
    ...patch,
    id: current.id,
    slug: patch.slug !== undefined ? (blogSlug(patch.slug) || current.slug) : current.slug,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await saveBlogPosts(items);
  return items[idx];
}

export async function deleteBlogPost(id: string): Promise<boolean> {
  const items = await listBlogPosts();
  const next = items.filter(p => p.id !== id);
  if (next.length === items.length) return false;
  await saveBlogPosts(next);
  return true;
}

// Role -> allowed admin page paths. Managed on the super-admin Roles & Permissions page.
export type RolePermissionsConfig = {
  roles: Record<string, string[]>;
  teams?: { key: string; label: string }[];   // custom teams the admin added
  pages?: { href: string; title: string; group?: string }[]; // custom pages the admin added
};

export async function getRolePermissions(): Promise<RolePermissionsConfig> {
  const data = await getJson<RolePermissionsConfig>("rolePermissions", { roles: {}, teams: [], pages: [] });
  return { roles: data.roles ?? {}, teams: data.teams ?? [], pages: data.pages ?? [] };
}

export async function setRolePermissions(config: RolePermissionsConfig): Promise<RolePermissionsConfig> {
  const clean: RolePermissionsConfig = {
    roles: config.roles ?? {},
    teams: Array.isArray(config.teams) ? config.teams : [],
    pages: Array.isArray(config.pages) ? config.pages : [],
  };
  await setJson("rolePermissions", clean);
  return clean;
}

export async function createApproval(item: Record<string, unknown>) {
  const items = await listApprovals() as Record<string, unknown>[];
  const entry = { id: `APR-${Date.now()}`, status: "pending", level: 1, createdAt: new Date().toISOString(), ...item };
  await setJson("approvals", { items: [entry, ...items] });
  return entry;
}

export async function updateApproval(id: string, patch: Record<string, unknown>) {
  const items = (await listApprovals() as { id: string }[]).map(a =>
    a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a,
  );
  await setJson("approvals", { items });
  return items.find(a => a.id === id);
}

export async function listPlatformReservations() {
  const rows = await db.select({
    r: reservationsTable,
    vendorName: restaurantsTable.name,
  }).from(reservationsTable)
    .innerJoin(restaurantsTable, eq(reservationsTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(reservationsTable.createdAt)).limit(200);
  return rows.map(({ r, vendorName }) => ({
    id: `RES-${r.id}`, vendorId: r.restaurantId, vendorName,
    customerName: r.customerName, customerPhone: r.customerPhone,
    date: r.date, time: r.time, guests: r.guestCount, zone: r.zone,
    type: r.reservationType, status: r.status, deposit: parseFloat(String(r.depositAmount ?? 0)),
    depositStatus: r.depositStatus, notes: r.notes, createdAt: r.createdAt.toISOString(),
  }));
}

export async function updatePlatformReservation(id: string, status: string) {
  const rid = parseInt(id.replace("RES-", ""), 10);
  const [updated] = await db.update(reservationsTable).set({ status }).where(eq(reservationsTable.id, rid)).returning();
  return updated;
}

export async function listVendorWallets() {
  const restaurants = await db.select().from(restaurantsTable);
  const commissionRate = await getCommissionRate();
  return Promise.all(restaurants.map(async (r) => {
    const settings = (r.settings ?? {}) as { wallet?: { balance?: number; locked?: number; reserve?: number; frozen?: boolean } };
    const w = settings.wallet ?? {};
    // Order-driven balance from the SAME settlement math the Escrow / Settlements pages
    // use, so all three agree. finalPayout = paid-order gross − commission − refunds −
    // penalties, and it grows as paid orders come in. The old code filtered strictly on
    // paymentStatus = "paid" (missed most orders → 0) and then applied an arbitrary
    // ×0.15 estimate — both wrong. Now there is one source of truth.
    const { finalPayout, penalties } = await computeVendorSettlement(r.id, commissionRate);
    const balance = w.balance ?? finalPayout;
    return {
      vendorId: r.id, vendorName: r.name, plan: r.plan,
      walletBalance: balance,
      lockedBalance: w.locked ?? 0,
      reserveBalance: w.reserve ?? 0,
      penaltyDeductions: penalties,
      negativeBalance: balance < 0,
      payoutsFrozen: w.frozen ?? false,
      lastPayout: null,
    };
  }));
}

export async function getBillingRules() {
  return getJson("billingRules", {
    models: [
      { id: "subscription", name: "Subscription billing", enabled: true, description: "Monthly plan fees" },
      { id: "per_order", name: "Per-order billing", enabled: true, rate: 2, unit: "INR", description: "Fee per completed order" },
      { id: "usage", name: "Usage billing", enabled: false, rate: 0.5, unit: "%", description: "SMS/WhatsApp usage" },
      { id: "hybrid", name: "Hybrid billing", enabled: true, description: "Subscription + per-order" },
    ],
  });
}

export async function saveBillingRules(data: unknown) {
  await setJson("billingRules", data);
  return data;
}

export async function getAIInsights() {
  const extended = await getExtendedAnalytics();
  const stats = await getEnhancedStats();
  const restaurants = await db.select().from(restaurantsTable);
  const insights = [];
  for (const r of restaurants.slice(0, 20)) {
    const [orderCnt] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.restaurantId, r.id));
    const orders = orderCnt?.count ?? 0;
    if (orders > 0 && orders < 10) {
      insights.push({ type: "decline", vendor: r.name, message: `Low order volume (${orders} orders) — consider outreach`, priority: "medium" });
    }
    if (r.plan === "free" && orders > 50) {
      insights.push({ type: "upsell", vendor: r.name, message: "High activity on free plan — upsell to Starter/Pro", priority: "high" });
    }
  }
  if (stats.failedPayments > 5) {
    insights.push({ type: "payment", vendor: "Platform", message: `${stats.failedPayments} failed payments — check gateway health`, priority: "high" });
  }
  return { insights, forecast: extended.forecastSummary, churnRisk: extended.churnRiskVendors, healthData: extended.healthData };
}

export async function getAlertRules() {
  return getJson("alertRules", {
    rules: [
      { id: "AR1", name: "Payment gateway failure", channel: "email", enabled: true, threshold: "any" },
      { id: "AR2", name: "Fraud alert spike", channel: "sms", enabled: true, threshold: "3/hour" },
      { id: "AR3", name: "Settlement failure", channel: "whatsapp", enabled: true, threshold: "any" },
      { id: "AR4", name: "Server overload", channel: "push", enabled: true, threshold: "CPU>80%" },
    ],
    recentAlerts: [],
  });
}

export async function saveAlertRules(data: unknown) {
  await setJson("alertRules", data);
  return data;
}

export async function getIncidents() {
  return getJson("incidents", { items: [] });
}

export async function saveIncident(item: Record<string, unknown>) {
  const data = await getIncidents() as { items: unknown[] };
  const entry = { id: `INC-${Date.now()}`, status: "open", severity: "medium", createdAt: new Date().toISOString(), ...item };
  await setJson("incidents", { items: [entry, ...(data.items ?? [])] });
  return entry;
}

export async function updateIncident(id: string, patch: Record<string, unknown>) {
  const data = await getIncidents() as { items: { id: string }[] };
  const items = (data.items ?? []).map(i => i.id === id ? { ...i, ...patch } : i);
  await setJson("incidents", { items });
  return items.find(i => i.id === id);
}

export async function getDRStatus() {
  return getJson("drStatus", {
    primaryRegion: "IN-Mumbai", backupRegion: "IN-Bangalore", lastFailoverTest: null,
    backupIntegrity: "verified", rpo: "1 hour", rto: "4 hours", status: "healthy",
    recoveryPoints: [],
  });
}

export async function saveDRStatus(data: unknown) {
  await setJson("drStatus", data);
  return data;
}

export async function getLegalCenter() {
  return getJson("legalCenter", {
    documents: [
      { id: "LD1", type: "Terms & Conditions", version: "2.1", updatedAt: new Date().toISOString(), status: "published" },
      { id: "LD2", type: "Privacy Policy", version: "1.8", updatedAt: new Date().toISOString(), status: "published" },
      { id: "LD3", type: "Refund Policy", version: "1.2", updatedAt: new Date().toISOString(), status: "published" },
      { id: "LD4", type: "GST Compliance", version: "1.0", updatedAt: new Date().toISOString(), status: "published" },
    ],
    holds: [],
  });
}

export async function saveLegalHold(hold: Record<string, unknown>) {
  const data = await getLegalCenter();
  const holds = [...(data.holds ?? []), { id: `LH-${Date.now()}`, createdAt: new Date().toISOString(), active: true, ...hold }];
  await setJson("legalCenter", { ...data, holds });
  if (hold.vendorId) {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, Number(hold.vendorId)));
    if (r) {
      const settings = { ...(r.settings as object ?? {}), legalHold: true, investigationMode: true };
      await db.update(restaurantsTable).set({ settings }).where(eq(restaurantsTable.id, r.id));
    }
  }
  return holds[holds.length - 1];
}

export async function getSandboxConfig() {
  return getJson("sandboxConfig", {
    enabled: true, apiBase: "/api", testVendors: [], demoPayments: true, featureFlagsBeta: true,
  });
}

export async function saveSandboxConfig(data: unknown) {
  await setJson("sandboxConfig", data);
  return data;
}

export async function getArchivalPolicies() {
  return getJson("archival", {
    policies: [
      { id: "ARC1", type: "orders", retentionDays: 365, autoArchive: true, lastRun: null },
      { id: "ARC2", type: "audit_logs", retentionDays: 730, autoArchive: true, lastRun: null },
      { id: "ARC3", type: "transactions", retentionDays: 2555, autoArchive: false, lastRun: null },
    ],
    archives: [],
  });
}

export async function runArchival(policyId: string) {
  const data = await getArchivalPolicies();
  const policy = (data.policies as { id: string; type: string; retentionDays?: number }[]).find(p => p.id === policyId);
  const retentionDays = policy?.retentionDays ?? 365;
  const cutoff = new Date(Date.now() - retentionDays * 86400000);
  let records = 0;
  if (policy?.type === "orders") {
    const [c] = await db.select({ count: count() }).from(ordersTable).where(sql`${ordersTable.createdAt} < ${cutoff}`);
    records = c?.count ?? 0;
  } else if (policy?.type === "audit_logs") {
    const [c] = await db.select({ count: count() }).from(platformAuditLogsTable).where(sql`${platformAuditLogsTable.createdAt} < ${cutoff}`);
    records = c?.count ?? 0;
  }
  const policies = (data.policies as { id: string; type: string }[]).map(p =>
    p.id === policyId ? { ...p, lastRun: new Date().toISOString() } : p,
  );
  const archive = {
    id: `ARCH-${Date.now()}`, policyId, status: "completed",
    records, note: records > 0 ? `${records} records eligible for archive` : "No records past retention",
    at: new Date().toISOString(),
  };
  await setJson("archival", { ...data, policies, archives: [archive, ...(data.archives ?? [])] });
  return archive;
}

export async function getFeatureReleases() {
  return getJson("featureReleases", {
    releases: [
      { id: "FR1", name: "AI Analytics", status: "beta", rollout: "10%", vendors: "enterprise" },
      { id: "FR2", name: "NFC Payments", status: "limited", rollout: "25%", vendors: "pro,enterprise" },
    ],
  });
}

export async function saveFeatureReleases(data: unknown) {
  await setJson("featureReleases", data);
  return data;
}

export async function getSettlementRules() {
  const settings = await getJson<{ settlementRules?: unknown }>("settlementRules", {
    cycles: ["daily", "weekly", "15_days", "monthly", "manual"],
    defaultCycle: "weekly",
    autoHoldRules: [
      { id: "HR1", name: "Refund pending", enabled: true, action: "auto_hold" },
      { id: "HR2", name: "Active chargeback", enabled: true, action: "auto_hold" },
      { id: "HR3", name: "KYC incomplete", enabled: true, action: "auto_hold" },
      { id: "HR4", name: "Subscription unpaid", enabled: true, action: "auto_hold" },
      { id: "HR5", name: "High refund ratio", enabled: true, action: "risk_alert" },
    ],
  });
  return settings;
}

export async function saveSettlementRules(data: unknown) {
  await setJson("settlementRules", data);
  return data;
}

export async function getDormantVendors() {
  const restaurants = await db.select().from(restaurantsTable);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const dormant = [];
  for (const r of restaurants) {
    const [recentOrders] = await db.select({ count: count() }).from(ordersTable)
      .where(and(eq(ordersTable.restaurantId, r.id), sql`${ordersTable.createdAt} >= ${thirtyDaysAgo}`));
    const orderCount = recentOrders?.count ?? 0;
    if (orderCount === 0 && r.isActive) {
      dormant.push({
        id: r.id, name: r.name, plan: r.plan, lastActive: r.updatedAt.toISOString(),
        daysInactive: Math.floor((Date.now() - r.updatedAt.getTime()) / 86400000),
        signals: ["No orders in 30 days"],
      });
    }
  }
  const rules = await getJson("dormantRules", { autoRemind: true, autoDeactivateDays: 90, salesFollowUp: true });
  return { vendors: dormant, rules };
}

export async function saveDormantRules(data: unknown) {
  await setJson("dormantRules", data);
  return data;
}

export async function getRevenueLeakage() {
  const stats = await getEnhancedStats();
  const allOrders = await db.select().from(ordersTable);
  const paid = allOrders.filter(isPaidOrder);
  const commissionRate = await getCommissionRate();
  const expectedCommission = sumOrderCommissions(paid, commissionRate);
  const issues = [];
  const refunded = allOrders.filter(isRefundedOrder);
  if (paid.length > 0 && refunded.length > paid.length * 0.1) {
    issues.push({ type: "high_refund_ratio", severity: "warning", message: `${refunded.length} refunds vs ${paid.length} paid orders` });
  }
  const [pendingSettlements] = await db.select({ total: sum(platformSettlementsTable.finalPayout) })
    .from(platformSettlementsTable).where(eq(platformSettlementsTable.status, "pending"));
  const pending = parseMoney(pendingSettlements?.total);
  if (stats.monthRevenue > 0 && pending > stats.monthRevenue * 0.5) {
    issues.push({ type: "settlement_mismatch", severity: "critical", message: `Pending settlements ₹${pending.toLocaleString()} exceed 50% monthly revenue` });
  }
  return {
    expectedCommission: roundMoney(expectedCommission),
    actualCommission: roundMoney(stats.platformCommission),
    leakageAmount: Math.max(0, roundMoney(expectedCommission - stats.platformCommission)),
    issues,
    hiddenRefunds: refunded.length,
  };
}

export async function retryRefund(id: string) {
  const rid = parseInt(id.replace(/^REF-(ORD-)?/, "").replace("ORD-", ""), 10);
  const [updated] = await db.update(platformRefundsTable).set({ status: "processing" })
    .where(eq(platformRefundsTable.id, rid)).returning();
  return updated;
}

export async function cancelRefund(id: string) {
  const rid = parseInt(id.replace("REF-", ""), 10);
  const [updated] = await db.update(platformRefundsTable).set({ status: "cancelled", processedAt: new Date() })
    .where(eq(platformRefundsTable.id, rid)).returning();
  return updated;
}

export async function partialRefund(id: string, amount: number) {
  // Postgres accepts the literal 'NaN' in a numeric column, so an unchecked
  // String(NaN) here poisons every later total that reads this row (BUG.md #23).
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  const rid = parseInt(id.replace("REF-", ""), 10);
  if (!Number.isFinite(rid)) throw new Error("INVALID_REFUND_ID");

  const [updated] = await db.update(platformRefundsTable).set({
    amount: String(amount), refundType: "partial", status: "pending",
  }).where(eq(platformRefundsTable.id, rid)).returning();
  return updated;
}

export async function mergeSupportTickets(primaryId: string, secondaryId: string) {
  const pid = parseInt(primaryId.replace(/^TKT-/, ""), 10);
  const sid = parseInt(secondaryId.replace(/^TKT-/, ""), 10);
  const [primary] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, pid));
  const [secondary] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, sid));
  if (!primary || !secondary) return null;
  const mergedNotes = [primary.message, `[Merged from TKT-${sid}]`, secondary.message].filter(Boolean).join("\n");
  const [updated] = await db.update(supportTicketsTable).set({
    message: mergedNotes,
    status: "in_progress",
  }).where(eq(supportTicketsTable.id, pid)).returning();
  await db.update(supportTicketsTable).set({ status: "closed", message: `Merged into TKT-${pid}` })
    .where(eq(supportTicketsTable.id, sid));
  return updated;
}

export async function uploadChargebackEvidence(id: string, evidence: string) {
  const cid = parseInt(id.replace("CB-", ""), 10);
  const [updated] = await db.update(platformChargebacksTable).set({
    status: "evidence_submitted",
  }).where(eq(platformChargebacksTable.id, cid)).returning();
  await setJson(`chargeback_evidence_${cid}`, { evidence, submittedAt: new Date().toISOString() });
  return updated;
}

export async function bulkVendorAction(vendorIds: number[], action: string) {
  const { invalidateRestaurantAnalyticsCache } = await import("./analytics-cache.js");
  for (const id of vendorIds) {
    if (action === "suspend") await db.update(restaurantsTable).set({ isActive: false }).where(eq(restaurantsTable.id, id));
    else if (action === "activate") await db.update(restaurantsTable).set({ isActive: true }).where(eq(restaurantsTable.id, id));
    if (action === "suspend" || action === "activate") invalidateRestaurantAnalyticsCache(id);
    else if (action === "freeze_payouts") {
      const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
      if (r) {
        const settings = { ...(r.settings as object ?? {}), wallet: { ...((r.settings as { wallet?: object })?.wallet ?? {}), frozen: true } };
        await db.update(restaurantsTable).set({ settings }).where(eq(restaurantsTable.id, id));
      }
    }
  }
  return { updated: vendorIds.length, action };
}

export async function approveExport(id: string) {
  const eid = parseInt(id.replace("EXP-", ""), 10);
  const [updated] = await db.update(platformExportsTable).set({ status: "completed" })
    .where(eq(platformExportsTable.id, eid)).returning();
  return updated;
}

export async function rejectExport(id: string, reason: string) {
  const eid = parseInt(id.replace("EXP-", ""), 10);
  const [updated] = await db.update(platformExportsTable).set({ status: "rejected" })
    .where(eq(platformExportsTable.id, eid)).returning();
  await setJson(`export_reject_${eid}`, { reason });
  return updated;
}
