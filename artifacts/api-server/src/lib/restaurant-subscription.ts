import { eq } from "drizzle-orm";
import { db, restaurantsTable, platformPlansTable } from "@workspace/db";
import type { Restaurant } from "@workspace/db";
import { ensurePlatformDefaults } from "./platform-admin.js";
import { syncPlanKitchenEntitlements } from "./feature-modules/entitlements.js";

export type SubscriptionStatus = "active" | "trial" | "expired" | "cancelled" | "none";

export type RestaurantSubscriptionRecord = {
  planId: string;
  status: SubscriptionStatus;
  startedAt: string | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
  price?: number;
  currency?: string;
  paymentReference?: string;
  renewedAt?: string;
};

export type SubscriptionSummary = RestaurantSubscriptionRecord & {
  active: boolean;
  planName?: string;
  daysRemaining: number | null;
};

type RestaurantSettings = {
  subscription?: Partial<RestaurantSubscriptionRecord>;
  kyc?: { status?: string };
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() <= Date.now();
}

export function readSubscriptionRecord(restaurant: Restaurant): RestaurantSubscriptionRecord {
  const settings = (restaurant.settings ?? {}) as RestaurantSettings;
  const stored = settings.subscription;
  if (stored && typeof stored === "object" && stored.planId) {
    return {
      planId: stored.planId,
      status: (stored.status as SubscriptionStatus) ?? "none",
      startedAt: stored.startedAt ?? null,
      expiresAt: stored.expiresAt ?? null,
      trialEndsAt: stored.trialEndsAt ?? null,
      price: stored.price,
      currency: stored.currency,
      paymentReference: stored.paymentReference,
      renewedAt: stored.renewedAt,
    };
  }

  const planId = restaurant.plan || "free";
  if (planId !== "free") {
    return {
      planId,
      status: "active",
      startedAt: restaurant.createdAt?.toISOString?.() ?? new Date().toISOString(),
      expiresAt: null,
      trialEndsAt: null,
    };
  }

  return {
    planId: "free",
    status: "none",
    startedAt: null,
    expiresAt: null,
    trialEndsAt: null,
  };
}

export function hasActiveSubscription(restaurant: Restaurant): boolean {
  const sub = readSubscriptionRecord(restaurant);
  if (sub.planId === "free" && sub.status !== "trial") return false;
  if (sub.status === "expired" || sub.status === "cancelled" || sub.status === "none") return false;
  if (sub.status === "trial" && isExpired(sub.trialEndsAt)) return false;
  if (isExpired(sub.expiresAt)) return false;
  return sub.status === "active" || sub.status === "trial";
}

export function buildSubscriptionSummary(
  restaurant: Restaurant,
  planName?: string,
): SubscriptionSummary {
  const record = readSubscriptionRecord(restaurant);
  const active = hasActiveSubscription(restaurant);
  const expiry = record.status === "trial" ? record.trialEndsAt : record.expiresAt;
  return {
    ...record,
    active,
    planName,
    daysRemaining: active ? daysUntil(expiry) : 0,
  };
}

export async function listPublishedPlans() {
  await ensurePlatformDefaults();
  const plans = await db
    .select()
    .from(platformPlansTable)
    .where(eq(platformPlansTable.isPublished, true))
    .orderBy(platformPlansTable.sortOrder);
  return plans.map(p => ({
    id: p.id,
    name: p.name,
    price: parseFloat(String(p.price)),
    currency: p.currency,
    features: p.features,
    featureToggles: p.featureToggles,
    maxBranches: p.maxBranches,
    maxItems: p.maxItems,
    maxStaff: p.maxStaff,
    maxTables: p.maxTables,
    maxOrdersPerMonth: p.maxOrdersPerMonth,
    trialDays: p.trialDays,
    isPublished: p.isPublished,
  }));
}

const SUBSCRIBE_ROLES = new Set(["owner", "manager", "franchise", "finance"]);

export function canSubscribeStaffRole(role: string | undefined): boolean {
  return SUBSCRIBE_ROLES.has(String(role || "").toLowerCase());
}

export async function activateRestaurantSubscription(
  restaurantId: number,
  planId: string,
  options?: { paymentReference?: string },
): Promise<SubscriptionSummary> {
  await ensurePlatformDefaults();

  if (planId === "free") {
    throw new Error("Select a paid plan to access the restaurant panel.");
  }

  const [planRow] = await db
    .select()
    .from(platformPlansTable)
    .where(eq(platformPlansTable.id, planId))
    .limit(1);
  if (!planRow || !planRow.isPublished) {
    throw new Error("Selected plan is not available.");
  }

  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);
  if (!restaurant) throw new Error("Restaurant not found");

  const now = new Date();
  const trialDays = planRow.trialDays ?? 0;
  const price = parseFloat(String(planRow.price));
  const status: SubscriptionStatus = trialDays > 0 ? "trial" : "active";
  const subscription: RestaurantSubscriptionRecord = {
    planId,
    status,
    startedAt: now.toISOString(),
    expiresAt: addDays(now, 30).toISOString(),
    trialEndsAt: trialDays > 0 ? addDays(now, trialDays).toISOString() : null,
    price,
    currency: planRow.currency,
    paymentReference: options?.paymentReference ?? `SUB-${restaurantId}-${Date.now()}`,
    renewedAt: now.toISOString(),
  };

  const settings = {
    ...((restaurant.settings ?? {}) as RestaurantSettings),
    subscription,
  };

  await db
    .update(restaurantsTable)
    .set({ plan: planId, settings, isActive: true, updatedAt: now })
    .where(eq(restaurantsTable.id, restaurantId));

  await syncPlanKitchenEntitlements(restaurantId, planId);

  const [updated] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);

  return buildSubscriptionSummary(updated!, planRow.name);
}
