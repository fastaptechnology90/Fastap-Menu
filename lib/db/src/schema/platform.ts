import {
  pgTable, text, serial, timestamp, integer, numeric, boolean, jsonb,
} from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";
import { usersTable } from "./users";
import { ordersTable } from "./orders";

export const platformSettingsTable = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const platformAuditLogsTable = pgTable("platform_audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  module: text("module").notNull(),
  target: text("target"),
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  severity: text("severity").notNull().default("info"),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformSettlementsTable = pgTable("platform_settlements", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  cycle: text("cycle").notNull().default("weekly"),
  grossSales: numeric("gross_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  commission: numeric("commission", { precision: 12, scale: 2 }).notNull().default("0"),
  refunds: numeric("refunds", { precision: 12, scale: 2 }).notNull().default("0"),
  penalties: numeric("penalties", { precision: 12, scale: 2 }).notNull().default("0"),
  finalPayout: numeric("final_payout", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending"),
  holdReason: text("hold_reason"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const platformRefundsTable = pgTable("platform_refunds", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  customerName: text("customer_name"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  refundType: text("refund_type").notNull().default("full"),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const platformChargebacksTable = pgTable("platform_chargebacks", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  customerId: text("customer_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending_response"),
  deadline: timestamp("deadline", { withTimezone: true }),
  filedAt: timestamp("filed_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const platformFraudAlertsTable = pgTable("platform_fraud_alerts", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").references(() => restaurantsTable.id, { onDelete: "set null" }),
  alertType: text("alert_type").notNull(),
  riskScore: integer("risk_score").notNull().default(50),
  amount: numeric("amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("active"),
  aiSignal: text("ai_signal"),
  details: jsonb("details").notNull().default({}),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const platformCouponsTable = pgTable("platform_coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  couponType: text("coupon_type").notNull().default("percentage"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull(),
  maxUses: integer("max_uses").notNull().default(1000),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  applicableVendorIds: jsonb("applicable_vendor_ids").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformCommissionRulesTable = pgTable("platform_commission_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ruleType: text("rule_type").notNull().default("percentage"),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("%"),
  applyTo: text("apply_to").notNull().default("all"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformTaxesTable = pgTable("platform_taxes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
  taxType: text("tax_type").notNull().default("sales_tax"),
  region: text("region").notNull().default("India"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformApiKeysTable = pgTable("platform_api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  environment: text("environment").notNull().default("production"),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformNotificationsTable = pgTable("platform_notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  notificationType: text("notification_type").notNull(),
  channel: text("channel").notNull().default("email"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("sent"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformCommunicationsTable = pgTable("platform_communications", {
  id: serial("id").primaryKey(),
  commType: text("comm_type").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  channel: text("channel").notNull(),
  target: text("target").notNull().default("all"),
  recipients: integer("recipients").notNull().default(0),
  deliveryRate: numeric("delivery_rate", { precision: 5, scale: 2 }),
  status: text("status").notNull().default("delivered"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformPenaltiesTable = pgTable("platform_penalties", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  deductFrom: text("deduct_from").notNull().default("wallet"),
  notes: text("notes"),
  appliedBy: text("applied_by").notNull(),
  status: text("status").notNull().default("applied"),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformTasksTable = pgTable("platform_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  taskType: text("task_type").notNull(),
  priority: text("priority").notNull().default("medium"),
  assignedTo: text("assigned_to"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformAnnouncementsTable = pgTable("platform_announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  announcementType: text("announcement_type").notNull(),
  severity: text("severity").notNull().default("info"),
  targetAudience: text("target_audience").notNull().default("all"),
  isActive: boolean("is_active").notNull().default(true),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformExportsTable = pgTable("platform_exports", {
  id: serial("id").primaryKey(),
  module: text("module").notNull(),
  format: text("format").notNull(),
  requestedBy: text("requested_by").notNull(),
  recordCount: integer("record_count").notNull().default(0),
  sizeMb: numeric("size_mb", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("completed"),
  dateFrom: timestamp("date_from", { withTimezone: true }),
  dateTo: timestamp("date_to", { withTimezone: true }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformAgreementsTable = pgTable("platform_agreements", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").references(() => restaurantsTable.id, { onDelete: "set null" }),
  vendorName: text("vendor_name").notNull(),
  agreementType: text("agreement_type").notNull(),
  signedDate: timestamp("signed_date", { withTimezone: true }),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformCrmLogsTable = pgTable("platform_crm_logs", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").references(() => restaurantsTable.id, { onDelete: "set null" }),
  vendorName: text("vendor_name").notNull(),
  logType: text("log_type").notNull(),
  notes: text("notes").notNull(),
  outcome: text("outcome"),
  followUpDate: timestamp("follow_up_date", { withTimezone: true }),
  upsellPlan: text("upsell_plan"),
  loggedBy: text("logged_by").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformPlansTable = pgTable("platform_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("INR"),
  features: jsonb("features").notNull().default([]),
  featureToggles: jsonb("feature_toggles").notNull().default({}),
  maxBranches: integer("max_branches").notNull().default(1),
  maxItems: integer("max_items").notNull().default(50),
  maxStaff: integer("max_staff").notNull().default(5),
  maxTables: integer("max_tables").notNull().default(20),
  maxOrdersPerMonth: integer("max_orders_per_month"),
  trialDays: integer("trial_days").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformRolesTable = pgTable("platform_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: jsonb("permissions").notNull().default({}),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformIpWhitelistTable = pgTable("platform_ip_whitelist", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformErrorLogsTable = pgTable("platform_error_logs", {
  id: serial("id").primaryKey(),
  errorType: text("error_type").notNull(),
  message: text("message").notNull(),
  source: text("source").notNull(),
  restaurantId: integer("restaurant_id").references(() => restaurantsTable.id, { onDelete: "set null" }),
  retryCount: integer("retry_count").notNull().default(0),
  severity: text("severity").notNull().default("error"),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
