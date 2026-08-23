import {
  eq, desc, count, and, gte, lte, sql, sum, inArray,
} from "drizzle-orm";
import {
  db,
  pool,
  restaurantsTable,
  usersTable,
  ordersTable,
  documentsTable,
  supportTicketsTable,
  qrCodesTable,
  customersTable,
  reservationsTable,
  platformSettingsTable,
  platformAuditLogsTable,
  platformSettlementsTable,
  platformRefundsTable,
  platformChargebacksTable,
  platformFraudAlertsTable,
  platformCouponsTable,
  platformCommissionRulesTable,
  platformTaxesTable,
  platformApiKeysTable,
  platformNotificationsTable,
  platformCommunicationsTable,
  platformPenaltiesTable,
  platformTasksTable,
  platformAnnouncementsTable,
  platformExportsTable,
  platformAgreementsTable,
  platformCrmLogsTable,
  platformPlansTable,
  platformRolesTable,
  platformIpWhitelistTable,
  platformErrorLogsTable,
} from "@workspace/db";
import type { Request } from "express";
import crypto from "crypto";
import dns from "node:dns/promises";
import {
  DEFAULT_INTEGRATIONS,
  mergeIntegrations,
  maskIntegrations,
  getEnabledPaymentGateways,
  normalizePaymentIntegrations,
  type IntegrationsConfig,
} from "./platform-integrations.js";
import {
  PLATFORM_CURRENCY,
  normalizeCurrencyCode,
  normalizeGeoSettings,
} from "./currency.js";
import {
  calcCommissionAmount,
  calcNetPayout,
  isPaidOrder,
  isRefundedOrder,
  orderCommissionBase,
  orderGrossTotal,
  parseMoney,
  roundMoney,
  sumOrderCommissions,
  sumOrderTotals,
} from "./payment-calculations.js";
import { invalidateRestaurantAnalyticsCache } from "./analytics-cache.js";

const DEFAULT_FEATURE_FLAGS = [
  { id: "ff_whatsapp", name: "WhatsApp Ordering", description: "Allow vendors to accept orders via WhatsApp", group: "Ordering", enabled: true, beta: false },
  { id: "ff_ai_analytics", name: "AI Analytics", description: "AI-powered sales insights and recommendations", group: "Analytics", enabled: true, beta: true },
  { id: "ff_nfc_payments", name: "NFC Payments", description: "Enable NFC tap-to-pay for supported devices", group: "Payments", enabled: true, beta: false },
  { id: "ff_multi_currency", name: "Multi-Currency", description: "Accept payments in multiple currencies", group: "Payments", enabled: false, beta: true },
  { id: "ff_loyalty", name: "Loyalty Program", description: "Customer loyalty points and cashback system", group: "CRM", enabled: true, beta: false },
  { id: "ff_ai_demand", name: "Demand Forecasting", description: "AI prediction for peak hours and inventory", group: "Analytics", enabled: false, beta: true },
  { id: "ff_table_reservation", name: "Table Reservations", description: "Online table booking system", group: "Ordering", enabled: true, beta: false },
  { id: "ff_pos_integration", name: "POS Integration", description: "Third-party POS system sync", group: "Integrations", enabled: false, beta: false },
  { id: "ff_white_label", name: "White Label Mode", description: "Custom branding and domain for vendors", group: "Branding", enabled: true, beta: false },
  { id: "ff_bulk_sms", name: "Bulk SMS Campaigns", description: "Mass SMS marketing for vendors", group: "CRM", enabled: false, beta: false },
];

const DEFAULT_GEO_SETTINGS = [
  { country: "India", currency: PLATFORM_CURRENCY, taxRate: "18%", timezone: "Asia/Kolkata", active: true },
  { country: "United Arab Emirates", currency: PLATFORM_CURRENCY, taxRate: "5%", timezone: "Asia/Dubai", active: true },
  { country: "United States", currency: PLATFORM_CURRENCY, taxRate: "0%", timezone: "America/New_York", active: true },
  { country: "United Kingdom", currency: PLATFORM_CURRENCY, taxRate: "20%", timezone: "Europe/London", active: false },
  { country: "Singapore", currency: PLATFORM_CURRENCY, taxRate: "9%", timezone: "Asia/Singapore", active: true },
];

const DEFAULT_SETTINGS = {
  currency: PLATFORM_CURRENCY,
  timezone: "Asia/Kolkata",
  defaultCommission: 5,
  maintenanceMode: false,
  registrationOpen: true,
  minPayoutAmount: 100,
  payoutCycle: "weekly",
  supportEmail: "support@fastap.io",
  platformName: "Fastap OS",
  platformUrl: "https://fastap.io",
  featureFlags: DEFAULT_FEATURE_FLAGS,
  geoSettings: DEFAULT_GEO_SETTINGS,
  securitySettings: {
    twoFactor: true,
    otp: true,
    sessionTimeout: true,
    deviceTracking: true,
    ipWhitelistEnforced: false,
    forcePasswordReset: false,
  },
  notificationChannels: { email: true, sms: true, push: true, whatsapp: false },
  integrations: DEFAULT_INTEGRATIONS,
};

function relativeTime(d: Date) {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export async function getCommissionRate(): Promise<number> {
  const activeRules = await db.select().from(platformCommissionRulesTable)
    .where(eq(platformCommissionRulesTable.status, "active"));
  const pctRule = activeRules.find(r => {
    const apply = String(r.applyTo ?? "all").toLowerCase().replace(/\s+/g, "_");
    return (r.ruleType === "percentage" || r.unit === "%")
      && (apply === "all" || apply === "all_restaurants");
  });
  if (pctRule) {
    const rate = parseMoney(pctRule.value);
    if (rate > 0) return rate;
  }

  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "config"));
  const val = row?.value as { defaultCommission?: number } | undefined;
  return val?.defaultCommission ?? DEFAULT_SETTINGS.defaultCommission;
}

export async function computeVendorSettlement(restaurantId: number, commissionRate: number) {
  const vendorOrders = await db.select().from(ordersTable)
    .where(eq(ordersTable.restaurantId, restaurantId));

  const paidOrders = vendorOrders.filter(isPaidOrder);
  const gross = sumOrderTotals(paidOrders);
  const commission = sumOrderCommissions(paidOrders, commissionRate);

  const refundsFromOrders = vendorOrders
    .filter(isRefundedOrder)
    .reduce((s, o) => s + orderGrossTotal(o), 0);

  const refundRows = await db.select().from(platformRefundsTable)
    .where(and(
      eq(platformRefundsTable.restaurantId, restaurantId),
      inArray(platformRefundsTable.status, ["completed", "approved", "processed"]),
    ));
  const refundsFromTable = refundRows.reduce((s, r) => s + parseMoney(r.amount), 0);
  const refunds = roundMoney(Math.max(refundsFromOrders, refundsFromTable));

  const penaltyRows = await db.select().from(platformPenaltiesTable)
    .where(and(
      eq(platformPenaltiesTable.restaurantId, restaurantId),
      eq(platformPenaltiesTable.status, "applied"),
    ));
  const penalties = roundMoney(penaltyRows.reduce((s, p) => s + parseMoney(p.amount), 0));

  const finalPayout = calcNetPayout(gross, commission, refunds, penalties);
  return { gross, commission, refunds, penalties, finalPayout };
}

export async function getSubscriptionMrr(): Promise<number> {
  const plans = await db.select().from(platformPlansTable);
  const planPrices = Object.fromEntries(plans.map(p => [p.id, parseMoney(p.price)]));
  const activeRestaurants = await db.select().from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
  return roundMoney(activeRestaurants.reduce((s, r) => s + (planPrices[r.plan || "free"] ?? 0), 0));
}

export async function getPlatformSettingsRaw() {
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "config"));
  const stored = row?.value as Record<string, unknown> | undefined;
  const integrations = mergeIntegrations(
    DEFAULT_INTEGRATIONS,
    (stored?.integrations ?? {}) as Partial<IntegrationsConfig>,
  );
  const merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}), integrations };
  merged.currency = normalizeCurrencyCode(merged.currency as string);
  if (Array.isArray(merged.geoSettings)) {
    merged.geoSettings = normalizeGeoSettings(merged.geoSettings as { currency?: string }[]);
  }
  return merged;
}

export async function getPlatformSettings(maskSecrets = true) {
  const settings = await getPlatformSettingsRaw();
  if (!maskSecrets) return settings;
  return {
    ...settings,
    integrations: maskIntegrations(settings.integrations as IntegrationsConfig),
  };
}

export async function setPlatformSettings(patch: Record<string, unknown>) {
  const current = await getPlatformSettingsRaw();
  let integrations = current.integrations as IntegrationsConfig;
  if (patch.integrations) {
    integrations = mergeIntegrations(integrations, patch.integrations as Partial<IntegrationsConfig>);
  }
  const { integrations: _drop, ...restPatch } = patch;
  const next = { ...current, ...restPatch, integrations };
  next.currency = normalizeCurrencyCode(next.currency as string);
  if (Array.isArray(next.geoSettings)) {
    next.geoSettings = normalizeGeoSettings(next.geoSettings as { currency?: string }[]);
  }
  await db.insert(platformSettingsTable).values({ key: "config", value: next })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: next } });
  return getPlatformSettings(true);
}

const WL_VERIFY_TOKEN = "fastap-verify";

export async function verifyWhiteLabelDomain(domain: string) {
  const host = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim().toLowerCase();
  if (!host) return { verified: false, error: "Domain required" };

  let method: string | null = null;
  try {
    const txtRecords = await dns.resolveTxt(`_fastap.${host}`).catch(() => dns.resolveTxt(host));
    const flat = txtRecords.flat().join("").toLowerCase();
    if (flat.includes(WL_VERIFY_TOKEN) || flat.includes("fastap")) method = "txt";
  } catch { /* try CNAME */ }

  if (!method) {
    try {
      const cnames = await dns.resolveCname(host);
      if (cnames.some(c => /fastap|thefingo|digitalrestuarants/i.test(c))) method = "cname";
    } catch { /* unverified */ }
  }

  if (!method) {
    return {
      verified: false,
      host,
      error: `Add TXT record _fastap.${host} with value "${WL_VERIFY_TOKEN}" or point CNAME to your Fastap host`,
    };
  }

  const settings = await getPlatformSettings();
  const whiteLabel = {
    ...((settings as { whiteLabel?: Record<string, unknown> }).whiteLabel ?? {}),
    domain: host,
    domainVerified: true,
    verifiedAt: new Date().toISOString(),
    verifyMethod: method,
  };
  await setPlatformSettings({ whiteLabel });
  return { verified: true, host, method, whiteLabel };
}

export async function logPlatformAudit(req: Request, action: string, module: string, target?: string, details: Record<string, unknown> = {}) {
  let userName = "System";
  let userId: number | null = null;
  if (req.session.userId) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
    userName = u?.email ?? u?.name ?? "Admin";
    userId = u?.id ?? null;
  }
  await db.insert(platformAuditLogsTable).values({
    userId,
    userName,
    action,
    module,
    target: target ?? null,
    ipAddress: req.ip ?? null,
    deviceInfo: String(req.headers["user-agent"] ?? "").slice(0, 255) || null,
    severity: "info",
    details,
  });
}

export async function ensurePlatformDefaults() {
  const existing = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "config"));
  if (!existing.length) {
    await db.insert(platformSettingsTable).values({ key: "config", value: DEFAULT_SETTINGS });
  } else {
    const stored = existing[0]?.value as Record<string, unknown> | undefined;
    const integrations = normalizePaymentIntegrations(
      mergeIntegrations(
        DEFAULT_INTEGRATIONS,
        (stored?.integrations ?? {}) as Partial<IntegrationsConfig>,
      ),
    );
    const needsIntegrationsPatch = !stored?.integrations
      || getEnabledPaymentGateways((stored.integrations ?? {}) as IntegrationsConfig).length === 0;
    if (needsIntegrationsPatch) {
      await db.insert(platformSettingsTable).values({ key: "config", value: { ...stored, integrations } })
        .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: { ...stored, integrations } } });
    }
  }

  const planCount = await db.select({ c: count() }).from(platformPlansTable);
  if (!(planCount[0]?.c ?? 0)) {
    await db.insert(platformPlansTable).values([
      { id: "free", name: "Free", price: "0", currency: "INR", features: ["1 Branch", "50 Menu Items", "QR Menu", "Basic Analytics"], maxBranches: 1, maxItems: 50, maxStaff: 2, sortOrder: 0 },
      { id: "starter", name: "Starter", price: "2499", currency: "INR", features: ["3 Branches", "200 Menu Items", "CRM", "Orders", "Loyalty"], maxBranches: 3, maxItems: 200, maxStaff: 10, sortOrder: 1 },
      { id: "pro", name: "Pro", price: "6999", currency: "INR", features: ["10 Branches", "Unlimited Items", "Campaigns", "Advanced Analytics"], maxBranches: 10, maxItems: 9999, maxStaff: 50, sortOrder: 2 },
      { id: "enterprise", name: "Enterprise", price: "19999", currency: "INR", features: ["Unlimited", "White Label", "API", "AI Analytics"], maxBranches: 9999, maxItems: 9999, maxStaff: 9999, sortOrder: 3 },
    ]);
  }

  const commCount = await db.select({ c: count() }).from(platformCommissionRulesTable);
  if (!(commCount[0]?.c ?? 0)) {
    await db.insert(platformCommissionRulesTable).values([
      { name: "Standard Platform Fee", ruleType: "percentage", value: "5", unit: "%", applyTo: "all", status: "active" },
    ]);
  }

  const taxCount = await db.select({ c: count() }).from(platformTaxesTable);
  if (!(taxCount[0]?.c ?? 0)) {
    await db.insert(platformTaxesTable).values([
      { name: "GST - Food", rate: "5", taxType: "sales_tax", region: "India", isActive: true },
      { name: "GST - AC Restaurant", rate: "18", taxType: "sales_tax", region: "India", isActive: true },
      { name: "TDS", rate: "1", taxType: "withholding", region: "India", isActive: true },
    ]);
  }

  const roleCount = await db.select({ c: count() }).from(platformRolesTable);
  if (!(roleCount[0]?.c ?? 0)) {
    await db.insert(platformRolesTable).values([
      { name: "Super Admin", description: "Full platform access", permissions: { all: true }, isSystem: true },
      { name: "Finance Admin", description: "Payments and settlements", permissions: { finance: true, refunds: true, payouts: true }, isSystem: true },
      { name: "Support Admin", description: "Tickets and vendors", permissions: { support: true, vendors: true }, isSystem: true },
      { name: "Compliance Admin", description: "KYC and documents", permissions: { kyc: true, documents: true }, isSystem: true },
      { name: "Sales Admin", description: "Vendor growth and CRM", permissions: { vendors: true }, isSystem: true },
      { name: "Operations Admin", description: "Infrastructure and fraud", permissions: { operations: true, support: true }, isSystem: true },
    ]);
  } else {
    const existing = await db.select().from(platformRolesTable);
    const names = new Set(existing.map(r => r.name));
    const missing = [
      { name: "Sales Admin", description: "Vendor growth and CRM", permissions: { vendors: true, communications: true }, isSystem: true },
      { name: "Operations Admin", description: "Infrastructure and fraud", permissions: { operations: true, support: true }, isSystem: true },
    ].filter(r => !names.has(r.name));
    if (missing.length) await db.insert(platformRolesTable).values(missing);
  }
}

type StoredInvoice = {
  id: string;
  vendorId: number;
  vendorName: string;
  type: string;
  amount: number;
  status: string;
  date: string;
  dueDate: string;
  period?: string;
};

export async function listSubscriptionInvoices() {
  const restaurants = await db.select().from(restaurantsTable);
  const restaurantIds = new Set(restaurants.map(r => r.id));
  const period = new Date().toISOString().slice(0, 7);

  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "subscription_invoices"));
  const stored = (row?.value as { items?: StoredInvoice[] })?.items ?? [];
  const validStored = stored.filter(i => restaurantIds.has(i.vendorId));
  const hasStale = stored.length !== validStored.length;
  const hasCurrent = validStored.some(i => i.period === period && i.type === "Subscription");

  async function persist(items: StoredInvoice[]) {
    await db.insert(platformSettingsTable).values({ key: "subscription_invoices", value: { items } })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: { items } } });
  }

  if (restaurants.length === 0) {
    await persist([]);
    return [];
  }

  if (hasCurrent && !hasStale) {
    return validStored;
  }

  const plans = await db.select().from(platformPlansTable);
  const planPrices = Object.fromEntries(plans.map(p => [p.id, parseMoney(p.price)]));
  const generated: StoredInvoice[] = restaurants.map(r => {
    const amount = planPrices[r.plan || "free"] ?? 0;
    const due = new Date();
    due.setDate(due.getDate() + 15);
    return {
      id: `INV-${period.replace("-", "")}-${r.id}`,
      vendorId: r.id,
      vendorName: r.name,
      type: "Subscription",
      amount,
      status: amount === 0 ? "Paid" : (r.isActive ? "Paid" : "Unpaid"),
      date: new Date().toISOString().split("T")[0],
      dueDate: due.toISOString().split("T")[0],
      period,
    };
  });
  const settlements = await db.select({
    s: platformSettlementsTable,
    vendorName: restaurantsTable.name,
  }).from(platformSettlementsTable)
    .innerJoin(restaurantsTable, eq(platformSettlementsTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(platformSettlementsTable.createdAt)).limit(30);
  const commissionInvoices: StoredInvoice[] = settlements.map(({ s, vendorName }) => ({
    id: `INV-COM-${s.id}`,
    vendorId: s.restaurantId,
    vendorName,
    type: "Commission",
    amount: parseMoney(s.commission),
    status: s.status === "released" ? "Paid" : "Pending",
    date: s.createdAt.toISOString().split("T")[0],
    dueDate: s.dueDate?.toISOString().split("T")[0] ?? s.createdAt.toISOString().split("T")[0],
    period: s.createdAt.toISOString().slice(0, 7),
  }));
  const items = [
    ...generated,
    ...commissionInvoices,
    ...validStored.filter(i => i.period !== period),
  ];
  await persist(items);
  return items;
}

/** Optional period → the start Date to filter revenue from (null = all time). */
function statsPeriodStart(period?: string): Date | null {
  if (!period || period === "all") return null;
  const d = new Date();
  if (period === "today") { d.setHours(0, 0, 0, 0); return d; }
  const days: Record<string, number> = { week: 7, fortnight: 15, month: 30, year: 365 };
  if (days[period]) { d.setDate(d.getDate() - days[period]); return d; }
  return null;
}

export async function getEnhancedStats(period?: string) {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(today); monthStart.setDate(1);

  const [restaurantCount] = await db.select({ count: count() }).from(restaurantsTable);
  const [activeCount] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [orderCount] = await db.select({ count: count() }).from(ordersTable);
  const [customerCount] = await db.select({ count: count() }).from(customersTable);
  const [ticketCount] = await db.select({ count: count() }).from(supportTicketsTable);
  const [reservationCount] = await db.select({ count: count() }).from(reservationsTable);
  const [qrScanTotal] = await db.select({ total: sum(qrCodesTable.scans) }).from(qrCodesTable);

  const allOrders = await db.select().from(ordersTable);
  const paidOrdersList = allOrders.filter(isPaidOrder);
  const sumTotal = (list: typeof allOrders) => list.filter(isPaidOrder).reduce((s, o) => s + orderGrossTotal(o), 0);
  const todayOrders = paidOrdersList.filter(o => new Date(o.createdAt) >= today);
  const weekOrders = paidOrdersList.filter(o => new Date(o.createdAt) >= weekStart);
  const monthOrders = paidOrdersList.filter(o => new Date(o.createdAt) >= monthStart);

  const paidOrders = paidOrdersList;
  const failedPayments = allOrders.filter(o => String(o.paymentStatus ?? "").toLowerCase() === "failed").length;
  const refundAmount = allOrders.filter(isRefundedOrder)
    .reduce((s, o) => s + orderGrossTotal(o), 0);

  const commissionRate = await getCommissionRate();
  // Revenue/commission can be scoped to a period (for the Analytics page's 7/15/30-day
  // view). With no period it's all-time — so the Dashboard stays consistent with the
  // vendor list / settlements (which are all-time).
  const periodSince = statsPeriodStart(period);
  const revenueOrders = periodSince ? paidOrdersList.filter(o => new Date(o.createdAt) >= periodSince) : paidOrdersList;
  const totalRevenue = sumOrderTotals(revenueOrders);
  const platformCommission = sumOrderCommissions(revenueOrders, commissionRate);

  const [pendingSettlements] = await db.select({ count: count() }).from(platformSettlementsTable).where(eq(platformSettlementsTable.status, "pending"));
  const [releasedSettlements] = await db.select({ count: count() }).from(platformSettlementsTable).where(eq(platformSettlementsTable.status, "released"));
  const [failedSettlements] = await db.select({ count: count() }).from(platformSettlementsTable).where(eq(platformSettlementsTable.status, "failed"));
  const [heldSettlements] = await db.select({ count: count() }).from(platformSettlementsTable).where(eq(platformSettlementsTable.status, "held"));
  const [chargebackTotal] = await db.select({ total: sum(platformChargebacksTable.amount) }).from(platformChargebacksTable);
  const allRestaurantsForKyc = await db.select({ settings: restaurantsTable.settings }).from(restaurantsTable);
  const pendingKyc = allRestaurantsForKyc.filter(r => {
    const kyc = (r.settings as { kyc?: { status?: string } } | null)?.kyc;
    return !kyc?.status || kyc.status === "pending";
  }).length;

  const [free] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.plan, "free"));
  const [starter] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.plan, "starter"));
  const [pro] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.plan, "pro"));
  const [enterprise] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.plan, "enterprise"));

  const recentRests = await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt)).limit(10);
  const recentWithOwners = await Promise.all(recentRests.map(async (r) => {
    const [owner] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, r.userId));
    const [orderCnt] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.restaurantId, r.id));
    return { ...r, ownerName: owner?.name ?? "", ownerEmail: owner?.email ?? "", totalOrders: orderCnt?.count ?? 0 };
  }));

  const plans = await db.select().from(platformPlansTable);
  const planPrices = Object.fromEntries(plans.map(p => [p.id, parseMoney(p.price)]));

  const activeSubscriptions = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
  const trialVendors = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.plan, "free"));

  return {
    totalRestaurants: restaurantCount?.count ?? 0,
    activeRestaurants: activeCount?.count ?? 0,
    inactiveRestaurants: (restaurantCount?.count ?? 0) - (activeCount?.count ?? 0),
    suspendedVendors: (restaurantCount?.count ?? 0) - (activeCount?.count ?? 0),
    trialVendors: trialVendors[0]?.count ?? 0,
    enterpriseVendors: enterprise?.count ?? 0,
    totalUsers: userCount?.count ?? 0,
    totalOrders: orderCount?.count ?? 0,
    totalCustomers: customerCount?.count ?? 0,
    totalSupportTickets: ticketCount?.count ?? 0,
    totalBookings: reservationCount?.count ?? 0,
    totalQrScans: parseInt(String(qrScanTotal?.total ?? 0), 10),
    totalRevenue,
    todayRevenue: sumTotal(todayOrders),
    weekRevenue: sumTotal(weekOrders),
    monthRevenue: sumTotal(monthOrders),
    platformCommission,
    refundAmount,
    pendingSettlements: pendingSettlements?.count ?? 0,
    releasedSettlements: releasedSettlements?.count ?? 0,
    successfulSettlements: releasedSettlements?.count ?? 0,
    failedSettlements: failedSettlements?.count ?? 0,
    heldSettlements: heldSettlements?.count ?? 0,
    chargebackAmount: parseMoney(chargebackTotal?.total ?? 0),
    pendingKycVendors: pendingKyc,
    activeSubscriptions: activeSubscriptions[0]?.count ?? 0,
    paymentSuccessRate: paidOrders.length ? Math.round((paidOrders.length / Math.max(paidOrders.length + failedPayments, 1)) * 100) : 100,
    failedPayments,
    planBreakdown: {
      free: free?.count ?? 0,
      starter: starter?.count ?? 0,
      pro: pro?.count ?? 0,
      enterprise: enterprise?.count ?? 0,
    },
    planPrices,
    recentRestaurants: recentWithOwners,
  };
}

export async function getRevenueTimeSeries(months = 12) {
  const allOrders = await db.select().from(ordersTable);
  const commissionRate = await getCommissionRate();
  const bucket = new Map<string, { revenue: number; orders: number }>();

  for (const order of allOrders.filter(isPaidOrder)) {
    const month = order.createdAt.toISOString().slice(0, 7);
    const cur = bucket.get(month) ?? { revenue: 0, orders: 0 };
    cur.revenue += orderGrossTotal(order);
    cur.orders += 1;
    bucket.set(month, cur);
  }

  return [...bucket.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-months)
    .map(([name, stats]) => ({
      name,
      value: roundMoney(stats.revenue),
      commission: roundMoney(stats.revenue * (commissionRate / 100)),
      orders: stats.orders,
    }));
}

export async function listPayments(limit = 100, status?: string) {
  const commissionRate = await getCommissionRate();
  let query = db.select({
    order: ordersTable,
    restaurantName: restaurantsTable.name,
  }).from(ordersTable)
    .innerJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit);

  const rows = await query;
  return rows
    .filter(r => !status || r.order.paymentStatus === status || r.order.status === status)
    .map(({ order, restaurantName }) => {
      const gross = orderGrossTotal(order);
      const paid = isPaidOrder(order);
      const commission = calcCommissionAmount(order, commissionRate);
      const net = paid ? calcNetPayout(gross, commission) : 0;
      return {
        id: `TXN-${order.id}`,
        orderId: `ORD-${order.id}`,
        gatewayTxnId: (order.metadata as { gatewayTxnId?: string })?.gatewayTxnId ?? `GW${order.id}`,
        vendorId: String(order.restaurantId),
        vendorName: restaurantName,
        grossAmount: gross,
        // Whether this transaction counts toward platform revenue (same paid-order rule
        // the dashboard/settlements use). Lets the UI total only paid volume so every
        // page shows the same figure — failed/pending attempts don't inflate revenue.
        isPaid: paid,
        commission,
        netPayout: net,
        paymentMode: order.paymentMethod || "cash",
        status: order.paymentStatus || order.status,
        dateTime: order.createdAt.toISOString(),
        utr: (order.metadata as { utr?: string })?.utr ?? null,
      };
    });
}

export async function syncPendingSettlements() {
  const commissionRate = await getCommissionRate();
  const restaurants = await db.select().from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
  const settings = await getPlatformSettings();
  const cycle = settings.payoutCycle || "weekly";

  for (const r of restaurants) {
    const { gross, commission, refunds, penalties, finalPayout } = await computeVendorSettlement(r.id, commissionRate);
    if (gross <= 0) continue;

    const [existing] = await db.select().from(platformSettlementsTable)
      .where(and(eq(platformSettlementsTable.restaurantId, r.id), eq(platformSettlementsTable.status, "pending")));

    if (existing) {
      await db.update(platformSettlementsTable).set({
        grossSales: String(gross),
        commission: String(commission),
        refunds: String(refunds),
        penalties: String(penalties),
        finalPayout: String(finalPayout),
        cycle,
      }).where(eq(platformSettlementsTable.id, existing.id));
      continue;
    }

    await db.insert(platformSettlementsTable).values({
      restaurantId: r.id,
      cycle,
      grossSales: String(gross),
      commission: String(commission),
      refunds: String(refunds),
      penalties: String(penalties),
      finalPayout: String(finalPayout),
      status: "pending",
      dueDate: new Date(Date.now() + 7 * 86400000),
    });
  }
}

export async function listSettlements() {
  await syncPendingSettlements();
  const rows = await db.select({
    settlement: platformSettlementsTable,
    vendorName: restaurantsTable.name,
  }).from(platformSettlementsTable)
    .innerJoin(restaurantsTable, eq(platformSettlementsTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(platformSettlementsTable.createdAt));

  return rows.map(({ settlement, vendorName }) => ({
    id: `STL-${settlement.id}`,
    vendorId: String(settlement.restaurantId),
    vendorName,
    grossSales: parseMoney(settlement.grossSales),
    commission: parseMoney(settlement.commission),
    refunds: parseMoney(settlement.refunds),
    penalties: parseMoney(settlement.penalties),
    finalPayout: parseMoney(settlement.finalPayout),
    status: settlement.status,
    cycle: settlement.cycle,
    dueDate: settlement.dueDate?.toISOString() ?? new Date().toISOString(),
    holdReason: settlement.holdReason,
  }));
}

export async function listKycRecords() {
  const restaurants = await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt));
  const docs = await db.select().from(documentsTable);

  return restaurants.map(r => {
    const settings = (r.settings ?? {}) as { kyc?: Record<string, unknown> };
    const kyc = settings.kyc ?? {};
    const vendorDocs = docs.filter(d => d.restaurantId === r.id);
    const docStatus = (cat: string) => {
      // Registration stores the real doc kind in `description` (gst_certificate, fssai_license,
      // bank_proof …); match on that first, then fall back to category / filename.
      const d = vendorDocs.find(x =>
        (x.description ?? "").toLowerCase().includes(cat) ||
        x.category === cat ||
        (x.name ?? "").toLowerCase().includes(cat),
      );
      if (!d) return "Not Uploaded";
      if (d.status === "active") return "Verified";
      if (d.status === "expired") return "Expired";
      if (d.status === "rejected") return "Rejected";
      return "Pending";
    };
    const status = String(kyc.status ?? "pending");
    return {
      id: `kyc_${r.id}`,
      vendorId: String(r.id),
      vendorName: r.name,
      ownerEmail: r.email ?? null,
      ownerPhone: r.phone ?? null,
      isActive: r.isActive,
      documents: {
        pan: docStatus("pan") !== "Not Uploaded" ? docStatus("pan") : (kyc.panNumber ? "Pending" : "Not Uploaded"),
        gst: docStatus("gst") !== "Not Uploaded" ? docStatus("gst") : (r.gstNumber ? "Pending" : "Not Uploaded"),
        bank: kyc.bankAccount ? "Pending" : "Not Uploaded",
        fssai: docStatus("fssai") !== "Not Uploaded" ? docStatus("fssai") : (r.fssaiNumber ? "Pending" : "Not Uploaded"),
      },
      status: status === "approved" ? "Approved" : status === "rejected" ? "Action Required" : "Pending Review",
      submittedAt: r.createdAt.toISOString(),
      rejectionReason: (kyc.rejectionReason as string) ?? null,
      kycData: kyc,
    };
  });
}

export async function updateKycStatus(restaurantId: number, status: string, rejectionReason?: string) {
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!r) return null;
  const settings = {
    ...(r.settings as object ?? {}),
    kyc: {
      ...((r.settings as { kyc?: object })?.kyc ?? {}),
      status,
      rejectionReason: rejectionReason ?? null,
      reviewedAt: new Date().toISOString(),
    },
  };
  const isApproved = status === "approved";
  const [updated] = await db
    .update(restaurantsTable)
    .set({
      settings,
      isActive: isApproved,
    })
    .where(eq(restaurantsTable.id, restaurantId))
    .returning();
  invalidateRestaurantAnalyticsCache(restaurantId);
  return updated;
}

export async function detectFraudAlerts() {
  const restaurants = await db.select().from(restaurantsTable);
  for (const r of restaurants) {
    const recentOrders = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.restaurantId, r.id), gte(ordersTable.createdAt, new Date(Date.now() - 86400000))));
    const failed = recentOrders.filter(o => o.paymentStatus === "failed").length;
    if (failed >= 5) {
      const [exists] = await db.select().from(platformFraudAlertsTable)
        .where(and(eq(platformFraudAlertsTable.restaurantId, r.id), eq(platformFraudAlertsTable.status, "active")));
      if (!exists) {
        await db.insert(platformFraudAlertsTable).values({
          restaurantId: r.id,
          alertType: "Multiple Failed Payments",
          riskScore: Math.min(95, 50 + failed * 5),
          amount: String(recentOrders.reduce((s, o) => s + parseMoney(o.total), 0)),
          status: "active",
          aiSignal: `${failed} failed payments in 24h`,
        });
      }
    }
  }
}

export async function listQrCodes() {
  const rows = await db.select({
    qr: qrCodesTable,
    vendorName: restaurantsTable.name,
    vendorId: restaurantsTable.id,
  }).from(qrCodesTable)
    .innerJoin(restaurantsTable, eq(qrCodesTable.restaurantId, restaurantsTable.id))
    .orderBy(desc(qrCodesTable.scans));

  return rows.map(({ qr, vendorName, vendorId }) => ({
    id: String(qr.id),
    vendorId: String(vendorId),
    vendorName,
    label: qr.label,
    type: qr.type,
    url: qr.url,
    scans: qr.scans,
    status: "active",
    tableId: qr.tableId,
    createdAt: qr.createdAt.toISOString(),
  }));
}

export function hashApiKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function vendorHealthScore(isActive: boolean, totalOrders: number) {
  let score = 50;
  if (isActive) score += 20;
  if (totalOrders > 500) score += 20;
  else if (totalOrders > 100) score += 10;
  if (!isActive) score -= 30;
  return Math.min(100, Math.max(10, score));
}

export async function getExtendedAnalytics() {
  const restaurants = await db.select().from(restaurantsTable);
  const allOrders = await db.select().from(ordersTable);
  const commissionRate = await getCommissionRate();
  const stats = await getEnhancedStats();

  const vendorOrders = new Map<number, number>();
  for (const o of allOrders) {
    vendorOrders.set(o.restaurantId, (vendorOrders.get(o.restaurantId) ?? 0) + 1);
  }

  let healthy = 0;
  let risk = 0;
  let critical = 0;
  const churnRiskVendors: { name: string; plan: string; score: number; signals: string[] }[] = [];

  for (const r of restaurants) {
    const orders = vendorOrders.get(r.id) ?? 0;
    const score = vendorHealthScore(r.isActive, orders);
    if (score >= 80) healthy++;
    else if (score >= 50) risk++;
    else critical++;

    const signals: string[] = [];
    if (!r.isActive) signals.push("Suspended");
    if (orders === 0) signals.push("No orders");
    if (orders > 0 && orders < 5) signals.push("Low activity");
    const riskScore = 100 - score;
    if (riskScore >= 60) {
      churnRiskVendors.push({ name: r.name, plan: r.plan || "free", score: riskScore, signals: signals.length ? signals : ["Low health score"] });
    }
  }

  const healthData = [
    { name: "Healthy (80-100)", value: healthy, color: "#22c55e" },
    { name: "Risk (50-79)", value: risk, color: "#eab308" },
    { name: "Critical (<50)", value: critical, color: "#ef4444" },
  ];

  const monthBuckets = new Map<string, { new: number; churned: number }>();
  for (const r of restaurants) {
    const m = new Date(r.createdAt).toLocaleString("en", { month: "short" });
    const b = monthBuckets.get(m) ?? { new: 0, churned: 0 };
    b.new += 1;
    if (!r.isActive) b.churned += 1;
    monthBuckets.set(m, b);
  }
  const churnData = [...monthBuckets.entries()].map(([month, v]) => ({
    month, new: v.new, churned: v.churned, net: v.new - v.churned,
  }));

  const revenueSeries = await getRevenueTimeSeries();
  const last = revenueSeries[revenueSeries.length - 1];
  const prev = revenueSeries[revenueSeries.length - 2];
  const growth = last && prev && prev.value > 0 ? (last.value - prev.value) / prev.value : 0.08;
  const base = last?.value ?? stats.monthRevenue;
  const forecastData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    const name = d.toLocaleString("en", { month: "short", year: "2-digit" });
    const forecast = Math.round(base * Math.pow(1 + growth, i + 1));
    return { name, actual: i === 0 ? base : null, forecast };
  });

  const paidOrders = allOrders.filter(o => o.paymentStatus === "paid" || o.paymentStatus === "success");
  const failedOrders = allOrders.filter(o => o.paymentStatus === "failed");
  const refundedOrders = allOrders.filter(o => o.paymentStatus === "refunded");

  const revenueKpis = [
    { label: "Avg Daily Revenue", value: stats.todayRevenue, trend: "Today", up: null as boolean | null },
    { label: "Refund Ratio", value: stats.totalRevenue ? `${((stats.refundAmount / stats.totalRevenue) * 100).toFixed(1)}%` : "0%", trend: "Platform-wide", up: null },
    { label: "Payment Success Rate", value: `${stats.paymentSuccessRate}%`, trend: "Paid vs failed", up: stats.paymentSuccessRate >= 90 },
    { label: "Commission Rate", value: `${commissionRate}%`, trend: "Platform default", up: null },
    { label: "Pending Settlements", value: stats.pendingSettlements, trend: "Awaiting release", up: null },
    { label: "Failed Payments", value: failedOrders.length, trend: `${paidOrders.length} successful`, up: failedOrders.length === 0 },
  ];

  return {
    healthData,
    churnData,
    forecastData,
    churnRiskVendors: churnRiskVendors.sort((a, b) => b.score - a.score).slice(0, 10),
    revenueKpis,
    forecastSummary: {
      projectedRevenue: forecastData[forecastData.length - 1]?.forecast ?? base,
      commissionForecast: (forecastData[forecastData.length - 1]?.forecast ?? base) * (commissionRate / 100),
      vendorCount: restaurants.length,
      churnRiskMrr: churnRiskVendors.length * 2500,
    },
  };
}

export async function getTaxReports(months = 6) {
  const rows = await db.select({
    month: sql<string>`to_char(${ordersTable.createdAt}, 'YYYY-MM')`,
    totalSales: sum(ordersTable.total),
    taxCollected: sum(ordersTable.tax),
  }).from(ordersTable)
    .groupBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM') DESC`)
    .limit(months);

  return rows.map((r, i) => {
    const d = r.month ? new Date(`${r.month}-01`) : new Date();
    return {
      month: d.toLocaleString("default", { month: "long", year: "numeric" }),
      totalSales: parseMoney(r.totalSales ?? 0),
      taxCollected: parseMoney(r.taxCollected ?? 0),
      status: i === 0 ? "Pending" : "Filed",
    };
  });
}

export async function getInfrastructureOverview() {
  const tasks = await db.select().from(platformTasksTable);
  const bucket = new Map<string, { pending: number; running: number; failed: number; lastRun: Date | null }>();
  for (const t of tasks) {
    const name = t.taskType || "Platform Tasks";
    const b = bucket.get(name) ?? { pending: 0, running: 0, failed: 0, lastRun: null };
    if (t.status === "pending") b.pending += 1;
    else if (t.status === "in_progress") b.running += 1;
    else if (t.status === "cancelled") b.failed += 1;
    if (!b.lastRun || t.createdAt > b.lastRun) b.lastRun = t.createdAt;
    bucket.set(name, b);
  }

  const comms = await db.select().from(platformCommunicationsTable).orderBy(desc(platformCommunicationsTable.sentAt)).limit(50);
  const commPending = comms.filter(c => c.status === "queued" || c.status === "pending").length;
  if (comms.length) {
    bucket.set("Communications", {
      pending: commPending,
      running: comms.filter(c => c.status === "sending").length,
      failed: comms.filter(c => c.status === "failed").length,
      lastRun: comms[0]?.sentAt ?? null,
    });
  }

  const jobQueues = [...bucket.entries()].map(([name, v]) => ({
    name,
    pending: v.pending,
    running: v.running,
    failed: v.failed,
    lastRun: v.lastRun ? relativeTime(v.lastRun) : "—",
    status: v.failed > 0 ? "Degraded" : v.pending > 0 || v.running > 0 ? "Running" : "Idle",
  }));

  const exports = await db.select().from(platformExportsTable).orderBy(desc(platformExportsTable.requestedAt)).limit(30);
  const backupHistory = exports.map(e => ({
    id: `BKP-${e.id}`,
    type: `${e.module} (${e.format})`,
    triggeredBy: e.requestedBy,
    size: `${parseMoney(e.sizeMb ?? 0).toFixed(1)} MB`,
    duration: "—",
    completedAt: e.requestedAt.toISOString(),
    status: e.status === "completed" ? "Completed" : e.status === "rejected" ? "Rejected" : e.status,
    exportId: `EXP-${e.id}`,
  }));

  const fraud = await db.select().from(platformFraudAlertsTable).where(eq(platformFraudAlertsTable.status, "active")).limit(5);
  const errors = await db.select().from(platformErrorLogsTable).orderBy(desc(platformErrorLogsTable.createdAt)).limit(5);
  const openTickets = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.status, "open")).limit(5);
  const pendingSettlements = await db.select({ c: count() }).from(platformSettlementsTable).where(eq(platformSettlementsTable.status, "pending"));

  const systemAlerts = [
    ...(pendingSettlements[0]?.c ? [{ type: "warning", message: `${pendingSettlements[0].c} settlements pending release`, time: new Date().toISOString() }] : []),
    ...fraud.map(f => ({ type: "warning", message: `Fraud: ${f.alertType} (risk ${f.riskScore})`, time: f.detectedAt.toISOString() })),
    ...openTickets.map(t => ({ type: "info", message: `Open ticket: ${t.subject || t.message.slice(0, 60)}`, time: t.createdAt.toISOString() })),
    ...errors.map(e => ({ type: e.severity === "critical" ? "warning" : "info", message: e.message, time: e.createdAt.toISOString() })),
  ].slice(0, 12);

  const auditRows = await db.select().from(platformAuditLogsTable).orderBy(desc(platformAuditLogsTable.createdAt)).limit(25);
  const errorRows = await db.select().from(platformErrorLogsTable).orderBy(desc(platformErrorLogsTable.createdAt)).limit(15);
  const systemLogs = [
    ...auditRows.map(l => `[${l.severity.toUpperCase()}] ${l.module}: ${l.action} — ${l.userName}`),
    ...errorRows.map(e => `[${(e.severity ?? "error").toUpperCase()}] ${e.message}`),
  ];

  const settings = await getPlatformSettings();
  const totalSizeMb = exports.reduce((s, e) => s + parseMoney(e.sizeMb ?? 0), 0);

  return {
    jobQueues,
    backupHistory,
    systemAlerts,
    systemLogs,
    maintenanceMode: !!(settings as { maintenanceMode?: boolean }).maintenanceMode,
    backupStats: {
      total: exports.length,
      lastBackup: exports[0]?.requestedAt?.toISOString() ?? null,
      totalSizeMb,
    },
  };
}

export async function getSlaMonitoring() {
  const now = new Date();
  const tickets = await db.select().from(supportTicketsTable);
  const open = tickets.filter(t => t.status === "open" || t.status === "in_progress");
  const breaches = open.filter(t => t.slaDeadline && new Date(t.slaDeadline) < now);
  const warnings = open.filter(t => {
    if (!t.slaDeadline) return false;
    const hrs = (new Date(t.slaDeadline).getTime() - now.getTime()) / 3600000;
    return hrs > 0 && hrs <= 4;
  });

  const pendingRefunds = await db.select().from(platformRefundsTable).where(eq(platformRefundsTable.status, "pending"));
  const pendingSettlements = await db.select().from(platformSettlementsTable).where(eq(platformSettlementsTable.status, "pending"));

  const resolvedTickets = tickets.filter(t => t.status === "resolved" || t.status === "closed");
  const avgResolveHrs = resolvedTickets.length
    ? resolvedTickets.reduce((s, t) => s + (t.updatedAt.getTime() - t.createdAt.getTime()) / 3600000, 0) / resolvedTickets.length
    : 0;

  return {
    supportAvg: avgResolveHrs ? `${avgResolveHrs.toFixed(1)}h` : "—",
    supportCompliance: open.length ? Math.max(0, 100 - Math.round((breaches.length / open.length) * 100)) : 100,
    refundAvg: pendingRefunds.length ? `${pendingRefunds.length} pending` : "0 pending",
    refundCompliance: pendingRefunds.length === 0 ? 100 : Math.max(60, 100 - pendingRefunds.length * 5),
    settlementAvg: pendingSettlements.length ? `${pendingSettlements.length} pending` : "0 pending",
    settlementCompliance: pendingSettlements.length === 0 ? 100 : 95,
    uptimeActual: "99.9%",
    uptimeCompliance: 99.9,
    breaches: breaches.map(t => ({
      id: `TKT-${t.id}`,
      slaType: "Support SLA",
      type: "Support SLA",
      severity: "critical",
      vendor: String(t.restaurantId ?? "—"),
      subject: t.subject || t.message.slice(0, 40),
      description: t.subject || t.message.slice(0, 80),
      deadline: t.slaDeadline?.toISOString() ?? "",
      overdue: t.slaDeadline ? relativeTime(new Date(t.slaDeadline)) : "—",
      overduBy: t.slaDeadline ? relativeTime(new Date(t.slaDeadline)) : "—",
      breachedAt: t.slaDeadline?.toISOString() ?? t.createdAt.toISOString(),
    })),
    warnings: warnings.map(t => {
      const hrs = t.slaDeadline ? (new Date(t.slaDeadline).getTime() - Date.now()) / 3600000 : 0;
      return {
        id: `TKT-${t.id}`,
        slaType: "Support SLA",
        type: "Support SLA",
        subject: t.subject || t.message.slice(0, 40),
        description: t.subject || t.message.slice(0, 80),
        deadline: t.slaDeadline?.toISOString() ?? "",
        timeLeft: hrs > 0 ? `${hrs.toFixed(1)}h` : "—",
      };
    }),
    history: resolvedTickets.slice(0, 10).map(t => {
      const hrs = (t.updatedAt.getTime() - t.createdAt.getTime()) / 3600000;
      return {
        id: `TKT-${t.id}`,
        slaType: "Support SLA",
        reference: t.subject || `Ticket #${t.id}`,
        target: "< 4 hours",
        actual: `${hrs.toFixed(1)}h`,
        overdueBy: hrs > 4 ? `${(hrs - 4).toFixed(1)}h` : "—",
        severity: hrs > 8 ? "critical" : "warning",
        breachedAt: t.updatedAt.toISOString(),
        subject: t.subject || "Resolved",
        resolvedAt: t.updatedAt.toISOString(),
      };
    }),
  };
}

export async function countExportRecords(module: string) {
  switch (module) {
    case "vendors": return (await db.select({ c: count() }).from(restaurantsTable))[0]?.c ?? 0;
    case "payments": return (await db.select({ c: count() }).from(ordersTable))[0]?.c ?? 0;
    case "refunds": return (await db.select({ c: count() }).from(platformRefundsTable))[0]?.c ?? 0;
    case "settlements": return (await db.select({ c: count() }).from(platformSettlementsTable))[0]?.c ?? 0;
    case "subscriptions": return (await db.select({ c: count() }).from(restaurantsTable))[0]?.c ?? 0;
    case "invoices": return (await db.select({ c: count() }).from(restaurantsTable))[0]?.c ?? 0;
    case "taxes": return (await db.select({ c: count() }).from(platformTaxesTable))[0]?.c ?? 0;
    case "audit-logs": return (await db.select({ c: count() }).from(platformAuditLogsTable))[0]?.c ?? 0;
    case "kyc": return (await db.select({ c: count() }).from(restaurantsTable))[0]?.c ?? 0;
    case "fraud": return (await db.select({ c: count() }).from(platformFraudAlertsTable))[0]?.c ?? 0;
    case "support": return (await db.select({ c: count() }).from(supportTicketsTable))[0]?.c ?? 0;
    case "analytics": return (await db.select({ c: count() }).from(ordersTable))[0]?.c ?? 0;
    case "platform_backup": return (await db.select({ c: count() }).from(restaurantsTable))[0]?.c ?? 0;
    default: return 0;
  }
}

export async function generateExportCsv(module: string): Promise<string> {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  if (module === "vendors") {
    const rows = await db.select().from(restaurantsTable);
    const header = "id,name,slug,plan,isActive,createdAt\n";
    return header + rows.map(r => [r.id, r.name, r.slug, r.plan, r.isActive, r.createdAt.toISOString()].map(esc).join(",")).join("\n");
  }
  if (module === "payments" || module === "analytics") {
    const rows = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(5000);
    const header = "id,restaurantId,total,paymentStatus,paymentMethod,createdAt\n";
    return header + rows.map(r => [r.id, r.restaurantId, r.total, r.paymentStatus, r.paymentMethod, r.createdAt.toISOString()].map(esc).join(",")).join("\n");
  }
  if (module === "audit-logs") {
    const rows = await db.select().from(platformAuditLogsTable).orderBy(desc(platformAuditLogsTable.createdAt)).limit(5000);
    const header = "id,userName,action,module,target,createdAt\n";
    return header + rows.map(r => [r.id, r.userName, r.action, r.module, r.target, r.createdAt.toISOString()].map(esc).join(",")).join("\n");
  }
  const rows = await db.select().from(restaurantsTable).limit(100);
  const header = "id,name\n";
  return header + rows.map(r => [r.id, r.name].map(esc).join(",")).join("\n");
}

export type PlatformControls = {
  orderingDisabled?: boolean;
  qrDisabled?: boolean;
  nfcDisabled?: boolean;
  deletedAt?: string | null;
};

export function readPlatformControls(settings: unknown): PlatformControls {
  const s = (settings ?? {}) as { platformControls?: PlatformControls };
  return s.platformControls ?? {};
}

export async function getPaymentDetail(txnId: string) {
  const orderId = parseInt(txnId.replace(/^TXN-/, ""), 10);
  if (!Number.isFinite(orderId)) return null;
  const [row] = await db.select({
    order: ordersTable,
    restaurantName: restaurantsTable.name,
    restaurantId: restaurantsTable.id,
  }).from(ordersTable)
    .innerJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!row) return null;
  const commissionRate = await getCommissionRate();
  const gross = orderGrossTotal(row.order);
  const commission = calcCommissionAmount(row.order, commissionRate);
  const net = isPaidOrder(row.order) ? calcNetPayout(gross, commission) : 0;
  const meta = (row.order.metadata ?? {}) as Record<string, unknown>;
  return {
    id: `TXN-${row.order.id}`,
    orderId: `ORD-${row.order.id}`,
    vendorId: String(row.restaurantId),
    vendorName: row.restaurantName,
    gatewayTxnId: String(meta.gatewayTxnId ?? `GW${row.order.id}`),
    utr: meta.utr ?? null,
    grossAmount: gross,
    taxAmount: parseMoney(row.order.tax),
    commissionBase: orderCommissionBase(row.order),
    commission,
    netPayout: net,
    paymentMode: row.order.paymentMethod || "cash",
    status: row.order.paymentStatus || row.order.status,
    held: Boolean(meta.held),
    dateTime: row.order.createdAt.toISOString(),
    customerName: row.order.customerName ?? null,
    tableName: row.order.tableName ?? null,
    retryCount: Number(meta.retryCount ?? 0),
    gatewayResponse: meta.gatewayResponse ?? null,
  };
}

export async function getLiveFeed() {
  const [recentOrders, recentPayments, recentRefunds, recentSettlements, recentTickets, recentAudit] = await Promise.all([
    db.select({ id: ordersTable.id, restaurantId: ordersTable.restaurantId, restaurantName: restaurantsTable.name, tableName: ordersTable.tableName, total: ordersTable.total, status: ordersTable.status, createdAt: ordersTable.createdAt })
      .from(ordersTable).innerJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id)).orderBy(desc(ordersTable.createdAt)).limit(8),
    db.select({ order: ordersTable, restaurantName: restaurantsTable.name })
      .from(ordersTable).innerJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
      .orderBy(desc(ordersTable.createdAt)).limit(8),
    db.select({ refund: platformRefundsTable, restaurantName: restaurantsTable.name })
      .from(platformRefundsTable).innerJoin(restaurantsTable, eq(platformRefundsTable.restaurantId, restaurantsTable.id))
      .orderBy(desc(platformRefundsTable.requestedAt)).limit(6),
    db.select({ settlement: platformSettlementsTable, restaurantName: restaurantsTable.name })
      .from(platformSettlementsTable).innerJoin(restaurantsTable, eq(platformSettlementsTable.restaurantId, restaurantsTable.id))
      .orderBy(desc(platformSettlementsTable.createdAt)).limit(6),
    db.select().from(supportTicketsTable).orderBy(desc(supportTicketsTable.createdAt)).limit(6),
    db.select().from(platformAuditLogsTable).orderBy(desc(platformAuditLogsTable.createdAt)).limit(10),
  ]);

  return {
    orders: recentOrders.map(o => ({
      type: "order", id: `ORD-${o.id}`, vendorId: o.restaurantId, vendor: o.restaurantName,
      tableName: o.tableName, amount: parseMoney(o.total), status: o.status, at: o.createdAt.toISOString(),
    })),
    payments: recentPayments.map(({ order, restaurantName }) => ({
      type: "payment", id: `TXN-${order.id}`, vendor: restaurantName,
      amount: parseMoney(order.total), status: order.paymentStatus || order.status,
      at: order.createdAt.toISOString(),
    })),
    refunds: recentRefunds.map(({ refund, restaurantName }) => ({
      type: "refund", id: `REF-${refund.id}`, vendor: restaurantName,
      amount: parseMoney(refund.amount), status: refund.status, at: refund.requestedAt.toISOString(),
    })),
    settlements: recentSettlements.map(({ settlement, restaurantName }) => ({
      type: "settlement", id: `SET-${settlement.id}`, vendor: restaurantName,
      amount: parseMoney(settlement.finalPayout), status: settlement.status, at: settlement.createdAt.toISOString(),
    })),
    tickets: recentTickets.map(t => ({
      type: "ticket", id: `TKT-${t.id}`, vendor: String(t.restaurantId ?? "—"),
      subject: t.subject || t.message.slice(0, 60), status: t.status,
      priority: t.priority ?? "medium", at: t.createdAt.toISOString(),
    })),
    activity: recentAudit.map(a => ({
      type: "audit", id: `LOG-${a.id}`, user: a.userName, action: a.action,
      module: a.module, at: a.createdAt.toISOString(),
    })),
    // Legacy aliases (older admin builds)
    support: recentTickets.map(t => ({
      type: "ticket", id: `TKT-${t.id}`, subject: t.subject || t.message.slice(0, 60),
      priority: t.priority ?? "medium", status: t.status, at: t.createdAt.toISOString(),
    })),
    system: recentAudit.map(a => ({
      type: "audit", event: a.action, at: a.createdAt.toISOString(),
    })),
  };
}

const ADMIN_ROLES = new Set(["super_admin", "finance_admin", "support_admin", "compliance_admin", "sales_admin", "operations_admin"]);

export async function listAdminSessions() {
  try {
    const { rows } = await pool.query<{ sid: string; sess: string | Record<string, unknown>; expire: Date }>(
      `SELECT sid, sess, expire FROM user_sessions WHERE expire > NOW() ORDER BY expire DESC LIMIT 50`,
    );
    const parsed = rows.map(row => {
      const sess = typeof row.sess === "string" ? JSON.parse(row.sess) as Record<string, unknown> : row.sess;
      return { sid: row.sid, sess, expire: row.expire };
    });
    const userIds = [...new Set(parsed.map(p => Number(p.sess?.userId)).filter(id => id > 0))];
    const users = userIds.length
      ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
      : [];
    const byId = new Map(users.map(u => [u.id, u]));
    return parsed
      .filter(p => {
        const uid = Number(p.sess?.userId);
        const user = byId.get(uid);
        return user && ADMIN_ROLES.has(user.role);
      })
      .map(p => {
        const uid = Number(p.sess.userId);
        const user = byId.get(uid)!;
        const staff = p.sess.staffSession as { ip?: string; device?: string; loginAt?: string } | undefined;
        return {
          id: p.sid,
          user: user.email,
          ipAddress: staff?.ip ?? "—",
          device: staff?.device ?? "Web",
          location: "—",
          startedAt: staff?.loginAt ?? user.createdAt.toISOString(),
          lastActive: p.expire.toISOString(),
          current: false,
        };
      });
  } catch {
    return [];
  }
}

export async function revokeAdminSession(sessionId: string) {
  await pool.query(`DELETE FROM user_sessions WHERE sid = $1`, [sessionId]);
}

export async function getWebhooks() {
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "webhooks"));
  const list = (row?.value as { items?: unknown[] })?.items;
  return Array.isArray(list) ? list : [];
}

export async function saveWebhooks(items: unknown[]) {
  await db.insert(platformSettingsTable).values({ key: "webhooks", value: { items } })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: { items } } });
  return items;
}

export async function getApiUsageAnalytics() {
  const [orderCount] = await db.select({ count: count() }).from(ordersTable);
  const [keyCount] = await db.select({ count: count() }).from(platformApiKeysTable);
  const [activeKeys] = await db.select({ count: count() }).from(platformApiKeysTable).where(eq(platformApiKeysTable.status, "active"));
  const [errorCount] = await db.select({ count: count() }).from(platformErrorLogsTable);
  const audit24h = await db.select({ count: count() }).from(platformAuditLogsTable)
    .where(gte(platformAuditLogsTable.createdAt, new Date(Date.now() - 86400000)));
  const totalCalls = (orderCount?.count ?? 0) * 3 + (audit24h[0]?.count ?? 0) * 2;
  const failedCalls = errorCount?.count ?? 0;
  const webhooks = await getWebhooks();
  return {
    totalCalls,
    failedCalls,
    successRate: totalCalls ? Math.round(((totalCalls - failedCalls) / totalCalls) * 1000) / 10 : 100,
    avgResponseMs: 120 + (failedCalls % 40),
    activeKeys: activeKeys?.count ?? 0,
    totalKeys: keyCount?.count ?? 0,
    activeWebhooks: (webhooks as { status?: string }[]).filter(w => w.status !== "disabled").length,
    hourly: Array.from({ length: 24 }, (_, h) => {
      const base = Math.max(5, Math.floor(totalCalls / 48));
      return { hour: `${h}:00`, calls: base + (h % 5) * 3, errors: h % 7 === 0 ? 2 : 0 };
    }),
    endpoints: [
      { path: "/api/public/venue/*", calls: Math.floor(totalCalls * 0.35), errors: Math.floor(failedCalls * 0.2), avgMs: 95 },
      { path: "/api/orders", calls: Math.floor(totalCalls * 0.28), errors: Math.floor(failedCalls * 0.3), avgMs: 140 },
      { path: "/api/restaurant-auth/*", calls: Math.floor(totalCalls * 0.15), errors: Math.floor(failedCalls * 0.1), avgMs: 110 },
      { path: "/api/superadmin/*", calls: Math.floor(totalCalls * 0.12), errors: Math.floor(failedCalls * 0.15), avgMs: 180 },
      { path: "/api/public/reservations", calls: Math.floor(totalCalls * 0.1), errors: Math.floor(failedCalls * 0.25), avgMs: 160 },
    ],
  };
}

export async function masterSearch(query: string) {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return { vendors: [], payments: [], refunds: [], tickets: [], logs: [] };

  const restaurants = await db.select().from(restaurantsTable).limit(200);
  const vendorHits = restaurants.filter(r =>
    r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || String(r.id) === q,
  ).slice(0, 10).map(r => ({ id: r.id, name: r.name, plan: r.plan, isActive: r.isActive }));

  const payments = (await listPayments(50)).filter(p =>
    p.id.toLowerCase().includes(q) || p.vendorName.toLowerCase().includes(q) || p.orderId.toLowerCase().includes(q),
  ).slice(0, 10);

  const refunds = await db.select().from(platformRefundsTable).orderBy(desc(platformRefundsTable.requestedAt)).limit(100);
  const refundHits = refunds.filter(r => String(r.id).includes(q) || r.status.includes(q)).slice(0, 8).map(r => ({
    id: `REF-${r.id}`, amount: parseMoney(r.amount), status: r.status,
  }));

  const tickets = await db.select().from(supportTicketsTable).orderBy(desc(supportTicketsTable.createdAt)).limit(100);
  const ticketHits = tickets.filter(t =>
    String(t.id).includes(q) || (t.subject ?? "").toLowerCase().includes(q) || t.message.toLowerCase().includes(q),
  ).slice(0, 8).map(t => ({ id: `TKT-${t.id}`, subject: t.subject || t.message.slice(0, 50), status: t.status }));

  const logs = await db.select().from(platformAuditLogsTable).orderBy(desc(platformAuditLogsTable.createdAt)).limit(100);
  const logHits = logs.filter(l =>
    l.action.toLowerCase().includes(q) || l.module.toLowerCase().includes(q) || l.userName.toLowerCase().includes(q),
  ).slice(0, 8).map(l => ({ id: `LOG-${l.id}`, action: l.action, module: l.module, user: l.userName }));

  return { vendors: vendorHits, payments, refunds: refundHits, tickets: ticketHits, logs: logHits };
}
