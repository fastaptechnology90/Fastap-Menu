import { Router, type IRouter } from "express";
import { eq, count, desc } from "drizzle-orm";
import { db, restaurantsTable, usersTable, ordersTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import os from "os";

const router: IRouter = Router();

// ─── In-memory data stores (seeded once, persist during server lifetime) ──────

function uid() { return crypto.randomUUID().split("-")[0]; }
function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(d: number) { return new Date(Date.now() - d * 86400000).toISOString(); }
function daysFromNow(d: number) { return new Date(Date.now() + d * 86400000).toISOString(); }

const VENDOR_NAMES = ["The Grand Hotel","Cafe Mocha","Spice Garden","Ocean View Resort","Night Owl Bar","Taj Palace","Green Leaf","Pizza Express","Urban Roasters","City Diner","The Ritz","Muffin House","Sizzle & Spice","Breeze Beach Club","Healthy Bites"];
const PAYMENT_MODES = ["UPI","Card","Net Banking","Wallet","Cash","Bank Transfer"];
const FRAUD_TYPES = ["High Refund Ratio","Multiple Failed Payments","Suspicious Login Location","Volume Anomaly","Chargeback Spike","IP Spoofing","Account Takeover"];
const AI_SIGNALS = ["Velocity check failed","Geo-mismatch detected","Behavioral anomaly","Device fingerprint new","Multiple chargebacks","Blacklisted email domain"];
const DOC_STATUSES = ["Verified","Pending","Rejected","Not Submitted"];
const KYC_STATUSES = ["Approved","Pending Review","Action Required","Rejected"];
const REFUND_REASONS = ["Customer requested","Fraudulent transaction","Duplicate charge","Service not provided","Item unavailable","Wrong order"];
const REFUND_TYPES = ["Full Refund","Partial Refund","Platform Credit"];
const TICKET_SUBJECTS = ["API Integration Issue","Payout Delayed","QR Code Not Scanning","Menu Not Updating","Staff Login Issue","Branch Not Showing","Tax Calculation Error","WhatsApp Alert Not Sending"];
const TICKET_PRIORITIES = ["Low","Medium","High","Critical"];
function vname(i: number) { return VENDOR_NAMES[i % VENDOR_NAMES.length]; }

const paymentsStore = Array.from({ length: 80 }, (_, i) => ({
  id: `txn_${uid()}`, orderId: `ord_${uid()}`, vendorName: vname(i),
  grossAmount: rnd(200, 12000), commission: rnd(10, 500), netPayout: rnd(150, 11500),
  paymentMode: PAYMENT_MODES[i % PAYMENT_MODES.length],
  status: i % 10 === 0 ? "failed" : i % 7 === 0 ? "pending" : i % 3 === 0 ? "settled" : "success",
  dateTime: daysAgo(rnd(0, 30)),
}));

const settlementsStore = Array.from({ length: 30 }, (_, i) => ({
  id: `set_${uid()}`, vendorName: vname(i),
  grossSales: rnd(5000, 50000), commission: rnd(250, 2500), refunds: rnd(0, 800), finalPayout: rnd(4000, 47000),
  status: ["pending","released","held","processing"][i % 4] as string,
  cycle: ["weekly","bi-weekly","monthly"][i % 3], dueDate: daysFromNow(rnd(1, 14)),
}));

const kycStore = Array.from({ length: 20 }, (_, i) => ({
  id: `kyc_${uid()}`, vendorId: `vendor_${i + 1}`, vendorName: vname(i),
  documents: { pan: DOC_STATUSES[i % 4], gst: DOC_STATUSES[(i+1) % 4], bank: DOC_STATUSES[(i+2) % 4], fssai: DOC_STATUSES[(i+3) % 4] },
  status: KYC_STATUSES[i % 4] as string, submittedAt: daysAgo(rnd(1, 30)),
  rejectionReason: i % 5 === 0 ? "Document image blurry. PAN mismatch." : null,
}));

const refundsStore = Array.from({ length: 25 }, (_, i) => ({
  id: `ref_${uid()}`, orderId: `ord_${uid()}`, vendorName: vname(i),
  customerName: `Customer ${i + 1}`, amount: rnd(50, 2000),
  reason: REFUND_REASONS[i % REFUND_REASONS.length],
  status: ["Pending","Approved","Rejected","Processing","Completed"][i % 5] as string,
  requestedAt: daysAgo(rnd(0, 15)), type: REFUND_TYPES[i % 3],
}));

const supportStore = Array.from({ length: 20 }, (_, i) => ({
  id: `tkt_${uid()}`, vendorName: vname(i),
  subject: TICKET_SUBJECTS[i % TICKET_SUBJECTS.length],
  priority: TICKET_PRIORITIES[i % 4] as string,
  status: ["Open","In Progress","Escalated","Resolved","Closed"][i % 5] as string,
  createdAt: daysAgo(rnd(0, 10)),
  assignedTo: i % 3 === 0 ? null : `Agent ${(i % 4) + 1}`,
  slaDeadline: daysFromNow(rnd(0, 3)),
}));

const couponsStore = Array.from({ length: 12 }, (_, i) => ({
  id: `cpn_${uid()}`, code: `PROMO${(i + 1).toString().padStart(2, "0")}`,
  type: i % 2 === 0 ? "Percentage" : "Fixed",
  discount: i % 2 === 0 ? rnd(5, 40) : rnd(50, 500),
  maxUses: rnd(100, 5000), used: rnd(0, 200),
  expires: daysFromNow(rnd(5, 90)),
  status: i % 4 === 0 ? "Inactive" : "Active" as string,
  createdAt: daysAgo(rnd(5, 60)),
}));

const fraudStore = Array.from({ length: 15 }, (_, i) => ({
  id: `frd_${uid()}`, vendorName: vname(i),
  type: FRAUD_TYPES[i % FRAUD_TYPES.length], riskScore: rnd(40, 99),
  amount: rnd(500, 20000),
  status: ["Active","Investigating","Resolved","Dismissed"][i % 4] as string,
  detectedAt: daysAgo(rnd(0, 7)), aiSignal: AI_SIGNALS[i % AI_SIGNALS.length],
}));

const commissionsStore: Array<{ id: string; name: string; type: string; value: number; unit: string; applyTo: string; status: string; createdAt: string }> = [
  { id: `com_${uid()}`, name: "Standard Platform Fee", type: "Fixed %", value: 10, unit: "%", applyTo: "All Restaurants", status: "Active", createdAt: daysAgo(90) },
  { id: `com_${uid()}`, name: "Hotel Premium Rate", type: "Fixed %", value: 8, unit: "%", applyTo: "Hotels", status: "Active", createdAt: daysAgo(60) },
  { id: `com_${uid()}`, name: "Cloud Kitchen Rate", type: "Fixed %", value: 12, unit: "%", applyTo: "Cloud Kitchens", status: "Active", createdAt: daysAgo(45) },
  { id: `com_${uid()}`, name: "Enterprise Flat Fee", type: "Fixed", value: 500, unit: "USD", applyTo: "Enterprise Plan", status: "Active", createdAt: daysAgo(30) },
];

const chargebacksStore = Array.from({ length: 12 }, (_, i) => ({
  id: `chb_${uid()}`, vendorName: vname(i), customerId: `cust_${uid()}`,
  amount: rnd(100, 3000),
  reason: ["Unrecognized transaction","Item not received","Service not as described","Duplicate charge"][i % 4],
  deadline: daysFromNow(rnd(3, 21)),
  status: ["Open","Under Review","Evidence Submitted","Won","Lost"][i % 5] as string,
  filedAt: daysAgo(rnd(1, 14)),
}));

const apiKeysStore: Array<{ id: string; name: string; environment: string; prefix: string; lastUsed: string | null; status: string; createdAt: string; fullKey?: string }> = [
  { id: `key_${uid()}`, name: "Production API Key", environment: "production", prefix: "fap_live_", lastUsed: daysAgo(0), status: "Active", createdAt: daysAgo(30) },
  { id: `key_${uid()}`, name: "Staging API Key", environment: "staging", prefix: "fap_test_", lastUsed: daysAgo(2), status: "Active", createdAt: daysAgo(15) },
  { id: `key_${uid()}`, name: "Webhook Secret", environment: "production", prefix: "fap_wh_", lastUsed: null, status: "Active", createdAt: daysAgo(10) },
];

const settingsStore: Record<string, unknown> = {
  currency: "USD", timezone: "UTC", defaultCommission: 10,
  maintenanceMode: false, registrationOpen: true,
  minPayoutAmount: 100, payoutCycle: "weekly",
  supportEmail: "support@fastapmenu.com",
  platformName: "Fastap Smart Hospitality OS",
  platformUrl: "https://digitalrestuarants.thefingo.com",
};

const taxesStore: Array<{ id: string; name: string; rate: number; type: string; region: string; status: boolean }> = [
  { id: `tax_${uid()}`, name: "VAT", rate: 5, type: "Percentage", region: "UAE", status: true },
  { id: `tax_${uid()}`, name: "GST", rate: 18, type: "Percentage", region: "India", status: true },
  { id: `tax_${uid()}`, name: "Service Charge", rate: 10, type: "Percentage", region: "Global", status: false },
  { id: `tax_${uid()}`, name: "Platform Fee Tax", rate: 2, type: "Percentage", region: "Global", status: true },
];

const escrowStore = {
  metrics: { totalEscrow: 847500, activeHolds: 23, pendingReleases: 12, lockedDisputes: 5 },
  ledger: Array.from({ length: 20 }, (_, i) => ({
    id: `esw_${uid()}`, vendorName: vname(i),
    type: ["Deposit","Withdrawal","Hold","Release","Dispute"][i % 5],
    amount: rnd(500, 15000), balance: rnd(1000, 50000),
    status: ["Pending","Completed","Held","Released"][i % 4] as string,
    date: daysAgo(rnd(0, 30)),
  })),
};

const auditLogsStore = Array.from({ length: 50 }, (_, i) => ({
  id: `log_${uid()}`,
  user: ["superadmin@fastapmenu.com","admin@fastapmenu.com","manager@fastapmenu.com"][i % 3],
  action: ["LOGIN","VENDOR_SUSPEND","PLAN_CHANGE","KYC_APPROVE","REFUND_APPROVE","SETTLEMENT_RELEASE","COUPON_CREATE","SETTINGS_UPDATE","FRAUD_BLOCK","API_KEY_CREATE"][i % 10],
  module: ["Auth","Vendors","Payments","KYC","Refunds","Settlements","Coupons","Settings","Fraud","API Keys"][i % 10],
  target: vname(i), dateTime: daysAgo(rnd(0, 30)),
  ipAddress: `${rnd(1,255)}.${rnd(1,255)}.${rnd(1,255)}.${rnd(1,255)}`,
  severity: ["info","warning","critical","success"][i % 4],
}));

function addAudit(action: string, module: string, target: string, severity: string, ip: string) {
  auditLogsStore.unshift({ id: `log_${uid()}`, user: "superadmin@fastapmenu.com", action, module, target, dateTime: new Date().toISOString(), ipAddress: ip || "unknown", severity });
  if (auditLogsStore.length > 500) auditLogsStore.pop();
}

// ─── Vendor endpoints ─────────────────────────────────────────────────────────

router.get("/superadmin/vendors", requireAuth, async (req, res): Promise<void> => {
  const restaurants = await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt));
  const result = await Promise.all(restaurants.map(async (r) => {
    const [owner] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, r.userId));
    const [orderCnt] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.restaurantId, r.id));
    return { ...r, ownerName: owner?.name ?? "", ownerEmail: owner?.email ?? "", totalOrders: orderCnt?.count ?? 0 };
  }));
  res.json(result);
});

router.get("/superadmin/vendors/:vendorId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.vendorId, 10);
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!r) { res.status(404).json({ error: "Vendor not found" }); return; }
  const [owner] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, r.userId));
  const [orderCnt] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.restaurantId, r.id));
  res.json({ ...r, ownerName: owner?.name ?? "", ownerEmail: owner?.email ?? "", totalOrders: orderCnt?.count ?? 0 });
});

router.post("/superadmin/vendors", requireAuth, async (req, res): Promise<void> => {
  const { name, email, ownerName, phone, businessType, plan, address } = req.body;
  if (!name || !email) { res.status(400).json({ error: "name and email are required" }); return; }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) { res.status(400).json({ error: "Email already registered" }); return; }
  const passwordHash = await bcrypt.hash("Vendor@123", 12);
  const [user] = await db.insert(usersTable).values({ name: ownerName || name, email, passwordHash, role: "restaurant_owner" }).returning();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + uid();
  const [restaurant] = await db.insert(restaurantsTable).values({
    userId: user.id, name, slug, phone: phone || null, businessType: businessType || "Restaurant",
    plan: plan || "free", address: address || null, isActive: true,
  }).returning();
  addAudit("VENDOR_CREATE", "Vendors", name, "info", req.ip || "unknown");
  res.status(201).json({ ...restaurant, ownerName: user.name, ownerEmail: user.email, totalOrders: 0 });
});

router.post("/superadmin/vendors/:vendorId/toggle", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.vendorId, 10);
  const [existing] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(restaurantsTable).set({ isActive: !existing.isActive }).where(eq(restaurantsTable.id, id)).returning();
  addAudit(updated.isActive ? "VENDOR_ACTIVATE" : "VENDOR_SUSPEND", "Vendors", existing.name, updated.isActive ? "info" : "warning", req.ip || "unknown");
  res.json(updated);
});

router.put("/superadmin/vendors/:vendorId/plan", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.vendorId, 10);
  const { plan } = req.body;
  const [updated] = await db.update(restaurantsTable).set({ plan }).where(eq(restaurantsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  addAudit("PLAN_CHANGE", "Vendors", updated.name, "info", req.ip || "unknown");
  res.json(updated);
});

// Legacy /restaurants routes
router.get("/superadmin/restaurants", requireAuth, async (req, res): Promise<void> => {
  const restaurants = await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt));
  const result = await Promise.all(restaurants.map(async (r) => {
    const [owner] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, r.userId));
    const [orderCnt] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.restaurantId, r.id));
    return { ...r, ownerName: owner?.name ?? "", ownerEmail: owner?.email ?? "", totalOrders: orderCnt?.count ?? 0 };
  }));
  res.json(result);
});
router.post("/superadmin/restaurants/:restaurantId/toggle", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const [existing] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(restaurantsTable).set({ isActive: !existing.isActive }).where(eq(restaurantsTable.id, id)).returning();
  res.json(updated);
});
router.put("/superadmin/restaurants/:restaurantId/plan", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { plan } = req.body;
  const [updated] = await db.update(restaurantsTable).set({ plan }).where(eq(restaurantsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/superadmin/stats", requireAuth, async (req, res): Promise<void> => {
  const [restaurantCount] = await db.select({ count: count() }).from(restaurantsTable);
  const [activeCount] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [orderCount] = await db.select({ count: count() }).from(ordersTable);
  const allOrders = await db.select({ total: ordersTable.total }).from(ordersTable);
  const totalRevenue = allOrders.reduce((s, o) => s + parseFloat(o.total as string || "0"), 0);
  const [free] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.plan, "free"));
  const [starter] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.plan, "starter"));
  const [pro] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.plan, "pro"));
  const [enterprise] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.plan, "enterprise"));
  const recentRests = await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt)).limit(5);
  const recentWithOwners = await Promise.all(recentRests.map(async (r) => {
    const [owner] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, r.userId));
    const [orderCnt] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.restaurantId, r.id));
    return { ...r, ownerName: owner?.name ?? "", ownerEmail: owner?.email ?? "", totalOrders: orderCnt?.count ?? 0 };
  }));
  res.json({
    totalRestaurants: restaurantCount?.count ?? 0, activeRestaurants: activeCount?.count ?? 0,
    totalUsers: userCount?.count ?? 0, totalOrders: orderCount?.count ?? 0, totalRevenue,
    planBreakdown: { free: free?.count ?? 0, starter: starter?.count ?? 0, pro: pro?.count ?? 0, enterprise: enterprise?.count ?? 0 },
    recentRestaurants: recentWithOwners,
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

router.get("/superadmin/users", requireAuth, async (req, res): Promise<void> => {
  const users = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt }).from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users);
});

// ─── Plans ────────────────────────────────────────────────────────────────────

router.get("/superadmin/plans", async (req, res): Promise<void> => {
  res.json([
    { id: "free", name: "Free", price: 0, currency: "USD", features: ["1 Branch","50 Menu Items","QR Menu","Basic Analytics"], maxBranches: 1, maxItems: 50, maxStaff: 2 },
    { id: "starter", name: "Starter", price: 29, currency: "USD", features: ["3 Branches","200 Menu Items","QR + Tablet Menu","CRM","Orders Management","Analytics"], maxBranches: 3, maxItems: 200, maxStaff: 10 },
    { id: "pro", name: "Pro", price: 79, currency: "USD", features: ["10 Branches","Unlimited Items","All Features","Loyalty Program","Campaigns","Priority Support"], maxBranches: 10, maxItems: 9999, maxStaff: 50 },
    { id: "enterprise", name: "Enterprise", price: 199, currency: "USD", features: ["Unlimited Branches","Unlimited Items","White Label","API Access","Dedicated Support","Custom Integrations"], maxBranches: 9999, maxItems: 9999, maxStaff: 9999 },
  ]);
});

// ─── Setup super admin ────────────────────────────────────────────────────────

router.post("/superadmin/setup", async (req, res): Promise<void> => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) { res.status(400).json({ error: "name, email, and password required" }); return; }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) { res.status(400).json({ error: "Admin already exists" }); return; }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash, role: "super_admin" }).returning();
  req.session.userId = user.id;
  res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// ─── Payments ─────────────────────────────────────────────────────────────────

router.get("/superadmin/payments", requireAuth, async (req, res): Promise<void> => {
  const { status, limit } = req.query;
  let data = [...paymentsStore];
  if (status && status !== "all") data = data.filter(p => p.status === status);
  if (limit) data = data.slice(0, parseInt(limit as string, 10));
  res.json(data);
});

// ─── Settlements ──────────────────────────────────────────────────────────────

router.get("/superadmin/settlements", requireAuth, async (req, res): Promise<void> => {
  res.json(settlementsStore);
});
router.post("/superadmin/settlements/:id/release", requireAuth, async (req, res): Promise<void> => {
  const item = settlementsStore.find(s => s.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "released";
  addAudit("SETTLEMENT_RELEASE", "Settlements", item.vendorName, "info", req.ip || "unknown");
  res.json(item);
});
router.post("/superadmin/settlements/:id/hold", requireAuth, async (req, res): Promise<void> => {
  const item = settlementsStore.find(s => s.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "held";
  addAudit("SETTLEMENT_HOLD", "Settlements", item.vendorName, "warning", req.ip || "unknown");
  res.json(item);
});

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get("/superadmin/analytics/summary", requireAuth, async (req, res): Promise<void> => {
  const [restaurantCount] = await db.select({ count: count() }).from(restaurantsTable);
  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [orderCount] = await db.select({ count: count() }).from(ordersTable);
  const allOrders = await db.select({ total: ordersTable.total }).from(ordersTable);
  const totalRevenue = allOrders.reduce((s, o) => s + parseFloat(o.total as string || "0"), 0);
  const commission = totalRevenue * 0.1;
  res.json({ totalVendors: restaurantCount?.count ?? 0, totalUsers: userCount?.count ?? 0, totalOrders: orderCount?.count ?? 0, totalRevenue, platformCommission: commission, mrr: commission / 12 });
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

router.get("/superadmin/audit-logs", requireAuth, async (req, res): Promise<void> => {
  res.json(auditLogsStore.slice(0, 100));
});

// ─── KYC ─────────────────────────────────────────────────────────────────────

router.get("/superadmin/kyc", requireAuth, async (req, res): Promise<void> => { res.json(kycStore); });
router.post("/superadmin/kyc/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const item = kycStore.find(k => k.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Approved";
  item.documents = { pan: "Verified", gst: "Verified", bank: "Verified", fssai: "Verified" };
  addAudit("KYC_APPROVE", "KYC", item.vendorName, "success", req.ip || "unknown");
  res.json(item);
});
router.post("/superadmin/kyc/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const item = kycStore.find(k => k.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Rejected"; item.rejectionReason = req.body.reason || "Documents invalid";
  addAudit("KYC_REJECT", "KYC", item.vendorName, "warning", req.ip || "unknown");
  res.json(item);
});
router.post("/superadmin/kyc/:id/request-more", requireAuth, async (req, res): Promise<void> => {
  const item = kycStore.find(k => k.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Action Required";
  addAudit("KYC_REQUEST_MORE", "KYC", item.vendorName, "info", req.ip || "unknown");
  res.json(item);
});

// ─── Refunds ──────────────────────────────────────────────────────────────────

router.get("/superadmin/refunds", requireAuth, async (req, res): Promise<void> => { res.json(refundsStore); });
router.post("/superadmin/refunds/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const item = refundsStore.find(r => r.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Approved";
  addAudit("REFUND_APPROVE", "Refunds", item.vendorName, "success", req.ip || "unknown");
  res.json(item);
});
router.post("/superadmin/refunds/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const item = refundsStore.find(r => r.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Rejected";
  addAudit("REFUND_REJECT", "Refunds", item.vendorName, "warning", req.ip || "unknown");
  res.json(item);
});

// ─── Support ──────────────────────────────────────────────────────────────────

router.get("/superadmin/support", requireAuth, async (req, res): Promise<void> => { res.json(supportStore); });
router.post("/superadmin/support/:id/resolve", requireAuth, async (req, res): Promise<void> => {
  const item = supportStore.find(t => t.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Resolved";
  addAudit("TICKET_RESOLVE", "Support", item.subject, "success", req.ip || "unknown");
  res.json(item);
});
router.post("/superadmin/support/:id/escalate", requireAuth, async (req, res): Promise<void> => {
  const item = supportStore.find(t => t.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Escalated"; item.priority = "Critical";
  addAudit("TICKET_ESCALATE", "Support", item.subject, "warning", req.ip || "unknown");
  res.json(item);
});
router.post("/superadmin/support/:id/close", requireAuth, async (req, res): Promise<void> => {
  const item = supportStore.find(t => t.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Closed";
  addAudit("TICKET_CLOSE", "Support", item.subject, "info", req.ip || "unknown");
  res.json(item);
});

// ─── Coupons ──────────────────────────────────────────────────────────────────

router.get("/superadmin/coupons", requireAuth, async (req, res): Promise<void> => { res.json(couponsStore); });
router.post("/superadmin/coupons", requireAuth, async (req, res): Promise<void> => {
  const { code, type, discount, maxUses, expires } = req.body;
  if (!code) { res.status(400).json({ error: "code is required" }); return; }
  if (couponsStore.find(c => c.code === code)) { res.status(400).json({ error: "Coupon code already exists" }); return; }
  const newCoupon = { id: `cpn_${uid()}`, code, type: type || "Percentage", discount: Number(discount) || 10, maxUses: Number(maxUses) || 1000, used: 0, expires: expires || daysFromNow(30), status: "Active", createdAt: new Date().toISOString() };
  couponsStore.unshift(newCoupon);
  addAudit("COUPON_CREATE", "Coupons", code, "info", req.ip || "unknown");
  res.status(201).json(newCoupon);
});
router.patch("/superadmin/coupons/:id/toggle", requireAuth, async (req, res): Promise<void> => {
  const item = couponsStore.find(c => c.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = item.status === "Active" ? "Inactive" : "Active";
  res.json(item);
});
router.delete("/superadmin/coupons/:id", requireAuth, async (req, res): Promise<void> => {
  const idx = couponsStore.findIndex(c => c.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  couponsStore.splice(idx, 1);
  res.json({ message: "Deleted" });
});

// ─── Fraud ────────────────────────────────────────────────────────────────────

router.get("/superadmin/fraud", requireAuth, async (req, res): Promise<void> => { res.json(fraudStore); });
router.post("/superadmin/fraud/:id/resolve", requireAuth, async (req, res): Promise<void> => {
  const item = fraudStore.find(f => f.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Resolved";
  addAudit("FRAUD_RESOLVE", "Fraud", item.vendorName, "success", req.ip || "unknown");
  res.json(item);
});
router.post("/superadmin/fraud/:id/dismiss", requireAuth, async (req, res): Promise<void> => {
  const item = fraudStore.find(f => f.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Dismissed"; res.json(item);
});
router.post("/superadmin/fraud/:id/block", requireAuth, async (req, res): Promise<void> => {
  const item = fraudStore.find(f => f.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Blocked";
  addAudit("FRAUD_BLOCK", "Fraud", item.vendorName, "critical", req.ip || "unknown");
  res.json(item);
});

// ─── Commissions ──────────────────────────────────────────────────────────────

router.get("/superadmin/commissions", requireAuth, async (req, res): Promise<void> => { res.json(commissionsStore); });
router.post("/superadmin/commissions", requireAuth, async (req, res): Promise<void> => {
  const { name, type, value, unit, applyTo } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const newRule = { id: `com_${uid()}`, name, type: type || "Fixed %", value: Number(value) || 10, unit: unit || "%", applyTo: applyTo || "All Restaurants", status: "Active", createdAt: new Date().toISOString() };
  commissionsStore.unshift(newRule);
  addAudit("COMMISSION_CREATE", "Commissions", name, "info", req.ip || "unknown");
  res.status(201).json(newRule);
});
router.put("/superadmin/commissions/:id", requireAuth, async (req, res): Promise<void> => {
  const item = commissionsStore.find(c => c.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  Object.assign(item, req.body); res.json(item);
});
router.delete("/superadmin/commissions/:id", requireAuth, async (req, res): Promise<void> => {
  const idx = commissionsStore.findIndex(c => c.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  commissionsStore.splice(idx, 1); res.json({ message: "Deleted" });
});

// ─── Chargebacks ──────────────────────────────────────────────────────────────

router.get("/superadmin/chargebacks", requireAuth, async (req, res): Promise<void> => { res.json(chargebacksStore); });
router.post("/superadmin/chargebacks/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const item = chargebacksStore.find(c => c.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Lost";
  addAudit("CHARGEBACK_ACCEPT", "Chargebacks", item.vendorName, "warning", req.ip || "unknown");
  res.json(item);
});
router.post("/superadmin/chargebacks/:id/contest", requireAuth, async (req, res): Promise<void> => {
  const item = chargebacksStore.find(c => c.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = "Evidence Submitted";
  addAudit("CHARGEBACK_CONTEST", "Chargebacks", item.vendorName, "info", req.ip || "unknown");
  res.json(item);
});

// ─── API Keys ─────────────────────────────────────────────────────────────────

router.get("/superadmin/api-keys", requireAuth, async (req, res): Promise<void> => {
  res.json(apiKeysStore.map(k => { const { fullKey: _fk, ...rest } = k; return rest; }));
});
router.post("/superadmin/api-keys", requireAuth, async (req, res): Promise<void> => {
  const { name, environment } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const prefix = environment === "production" ? "fap_live_" : "fap_test_";
  const rawKey = crypto.randomBytes(32).toString("hex");
  const newKey = { id: `key_${uid()}`, name, environment: environment || "production", prefix, lastUsed: null, status: "Active", createdAt: new Date().toISOString(), fullKey: `${prefix}${rawKey}` };
  apiKeysStore.push(newKey);
  addAudit("API_KEY_CREATE", "API Keys", name, "info", req.ip || "unknown");
  res.status(201).json(newKey);
});
router.delete("/superadmin/api-keys/:id", requireAuth, async (req, res): Promise<void> => {
  const idx = apiKeysStore.findIndex(k => k.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  apiKeysStore.splice(idx, 1); res.json({ message: "Deleted" });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get("/superadmin/settings", requireAuth, async (req, res): Promise<void> => { res.json(settingsStore); });
router.put("/superadmin/settings", requireAuth, async (req, res): Promise<void> => {
  Object.assign(settingsStore, req.body);
  addAudit("SETTINGS_UPDATE", "Settings", "Platform Settings", "info", req.ip || "unknown");
  res.json(settingsStore);
});

// ─── Taxes ────────────────────────────────────────────────────────────────────

router.get("/superadmin/taxes", requireAuth, async (req, res): Promise<void> => { res.json(taxesStore); });
router.post("/superadmin/taxes", requireAuth, async (req, res): Promise<void> => {
  const { name, rate, type, region } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const newTax = { id: `tax_${uid()}`, name, rate: Number(rate) || 0, type: type || "Percentage", region: region || "Global", status: true };
  taxesStore.push(newTax); res.status(201).json(newTax);
});
router.patch("/superadmin/taxes/:id/toggle", requireAuth, async (req, res): Promise<void> => {
  const item = taxesStore.find(t => t.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  item.status = !item.status; res.json(item);
});

// ─── Subscriptions ────────────────────────────────────────────────────────────

router.get("/superadmin/subscriptions", requireAuth, async (req, res): Promise<void> => {
  const restaurants = await db.select().from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
  const PRICES: Record<string, number> = { free: 0, starter: 29, pro: 79, enterprise: 199 };
  res.json(restaurants.map(r => ({
    id: `sub_${r.id}`, vendorName: r.name, plan: r.plan, amount: PRICES[r.plan] ?? 0,
    renewal: new Date(new Date(r.createdAt).setFullYear(new Date().getFullYear() + 1)).toLocaleDateString(),
    status: r.isActive ? "Active" : "Inactive", autoRenew: r.plan !== "free",
  })));
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

router.get("/superadmin/invoices", requireAuth, async (req, res): Promise<void> => {
  const restaurants = await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt)).limit(30);
  const PRICES: Record<string, number> = { free: 0, starter: 29, pro: 79, enterprise: 199 };
  res.json(restaurants.map((r, i) => ({
    id: `INV-${(1000 + i).toString()}`, vendorName: r.name, plan: r.plan,
    amount: PRICES[r.plan] ?? 0,
    tax: parseFloat(((PRICES[r.plan] ?? 0) * 0.18).toFixed(2)),
    total: parseFloat(((PRICES[r.plan] ?? 0) * 1.18).toFixed(2)),
    status: i % 5 === 0 ? "Overdue" : i % 3 === 0 ? "Pending" : "Paid",
    issuedAt: daysAgo(rnd(0, 30)), dueAt: daysFromNow(rnd(0, 15)),
  })));
});

// ─── Escrow ───────────────────────────────────────────────────────────────────

router.get("/superadmin/escrow", requireAuth, async (req, res): Promise<void> => { res.json(escrowStore); });
router.post("/superadmin/escrow/freeze/:vendorId", requireAuth, async (req, res): Promise<void> => {
  const entry = { id: `esw_${uid()}`, vendorName: `Vendor #${req.params.vendorId}`, type: "Hold", amount: 0, balance: 0, status: "Held", date: new Date().toISOString() };
  escrowStore.ledger.unshift(entry);
  escrowStore.metrics.activeHolds++;
  addAudit("ESCROW_FREEZE", "Escrow", req.params.vendorId, "warning", req.ip || "unknown");
  res.json({ message: "Vendor escrow frozen", entry });
});
router.post("/superadmin/escrow/add-reserve", requireAuth, async (req, res): Promise<void> => {
  const { amount, reason } = req.body;
  escrowStore.metrics.totalEscrow += Number(amount) || 0;
  const entry = { id: `esw_${uid()}`, vendorName: "Platform Reserve", type: "Deposit", amount: Number(amount) || 0, balance: escrowStore.metrics.totalEscrow, status: "Completed", date: new Date().toISOString() };
  escrowStore.ledger.unshift(entry);
  addAudit("ESCROW_ADD_RESERVE", "Escrow", `$${amount} - ${reason}`, "info", req.ip || "unknown");
  res.json({ message: "Reserve added", entry });
});

// ─── Infrastructure Metrics ───────────────────────────────────────────────────

router.get("/superadmin/metrics", requireAuth, async (req, res): Promise<void> => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsedPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
  const loadAvg = os.loadavg()[0];
  const cpuPct = Math.min(Math.round(loadAvg * 25), 100);
  const uptimeSecs = os.uptime();
  const days = Math.floor(uptimeSecs / 86400);
  const hours = Math.floor((uptimeSecs % 86400) / 3600);
  const uptimeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  const [orderCount] = await db.select({ count: count() }).from(ordersTable);
  const [vendorCount] = await db.select({ count: count() }).from(restaurantsTable);
  res.json({
    cpu: cpuPct, memory: memUsedPct, disk: rnd(30, 55), network: rnd(5, 30),
    uptime: uptimeStr, dbConnections: rnd(3, 12), queueDepth: rnd(0, 150),
    activeWebhooks: rnd(5, 25), totalOrders: orderCount?.count ?? 0,
    totalVendors: vendorCount?.count ?? 0, apiRpm: rnd(80, 400),
    cacheHitRate: `${rnd(78, 96)}%`,
  });
});

export default router;
