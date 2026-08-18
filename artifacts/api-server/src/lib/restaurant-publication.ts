import type { Request, Response } from "express";
import { restaurantsTable } from "@workspace/db";
import { getAccessibleRestaurant } from "./restaurant-access.js";
import { readPlatformControls } from "./platform-admin.js";

export type RestaurantRow = typeof restaurantsTable.$inferSelect;

export type PublicationStatus =
  | "Published"
  | "Draft"
  | "Pending"
  | "Disabled"
  | "Rejected"
  | "Archived";

export function restaurantKycStatus(restaurant: RestaurantRow): string {
  return (restaurant.settings as { kyc?: { status?: string } } | null)?.kyc?.status ?? "approved";
}

export function getPublicationStatus(restaurant: RestaurantRow): PublicationStatus {
  const deletedAt = readPlatformControls(restaurant.settings).deletedAt;
  if (deletedAt) return "Archived";

  const kyc = restaurantKycStatus(restaurant);
  if (kyc === "rejected") return "Rejected";
  if (kyc === "pending" || kyc === "action_required") return "Pending";

  if (!restaurant.isActive) {
    return kyc === "approved" ? "Disabled" : "Draft";
  }

  if (kyc === "approved") return "Published";
  return "Draft";
}

/** Restaurant is publicly live and may accumulate customer analytics. */
export function isRestaurantPublished(restaurant: RestaurantRow): boolean {
  return getPublicationStatus(restaurant) === "Published";
}

/** Guest QR / menu links work while onboarding or live; not when disabled, rejected, or archived. */
export function canAccessGuestVenue(restaurant: RestaurantRow): boolean {
  const status = getPublicationStatus(restaurant);
  return status === "Published" || status === "Draft" || status === "Pending";
}

export function guestVenueAccessError(status: PublicationStatus): string {
  switch (status) {
    case "Archived":
      return "This restaurant is no longer available.";
    case "Rejected":
      return "This restaurant registration was not approved.";
    case "Disabled":
      return "This restaurant is temporarily unavailable.";
    default:
      return "Venue not found";
  }
}

export type AnalyticsAccess =
  | { kind: "ok"; restaurant: RestaurantRow }
  | { kind: "not_found" }
  | { kind: "unpublished"; restaurant: RestaurantRow; status: PublicationStatus };

export async function resolveAnalyticsAccess(
  req: Request,
  restaurantId: number,
): Promise<AnalyticsAccess> {
  const restaurant = await getAccessibleRestaurant(req, restaurantId);
  if (!restaurant) return { kind: "not_found" };
  const status = getPublicationStatus(restaurant);
  if (status !== "Published") {
    return { kind: "unpublished", restaurant, status };
  }
  return { kind: "ok", restaurant };
}

export function sendAnalyticsNotFound(res: Response): void {
  res.status(404).json({ error: "Restaurant not found" });
}

const ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "delivered", "completed", "cancelled"] as const;
const ORDER_TYPES = ["dine_in", "delivery", "takeaway"] as const;

export function emptyDashboardStats(status: PublicationStatus = "Draft") {
  return {
    isPublished: false,
    publicationStatus: status,
    todayOrders: 0,
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    netRevenue: 0,
    grossRevenue: 0,
    activeOrders: 0,
    cancelledOrders: 0,
    totalCustomers: 0,
    vipCustomers: 0,
    loyaltyCustomers: 0,
    avgOrderValue: 0,
    avgRating: 0,
    qrScansToday: 0,
    pendingReservations: 0,
    lowStockItems: 0,
    activeWaiterCalls: 0,
    walletBalance: 0,
    pendingSettlements: 0,
    ordersByType: {
      dine_in: 0,
      takeaway: 0,
      delivery: 0,
      room_service: 0,
    },
    recentOrders: [] as unknown[],
    growth: 0,
  };
}

export function emptyAnalyticsSummary(period: string = "all", periodLabel = "All time") {
  return {
    isPublished: false,
    period,
    periodLabel,
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    totalCustomers: 0,
    qrScans: 0,
    repeatCustomers: 0,
    feedbackAvgRating: 0,
    avgFoodRating: 0,
    topCategory: "",
    views: 0,
    ratings: 0,
    reviews: 0,
    reservations: 0,
    growth: 0,
  };
}

export function emptyOrderStats() {
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const s of ORDER_STATUSES) byStatus[s] = 0;
  for (const t of ORDER_TYPES) byType[t] = 0;
  return {
    isPublished: false,
    byStatus,
    byType,
    paymentMix: [] as { name: string; value: number; color: string }[],
    customerSegments: [] as { segment: string; count: number; percent: number; color: string; bg: string }[],
    hourlyOrders: [] as { time: string; orders: number }[],
    growth: 0,
  };
}

export function emptyFinanceSummary() {
  return {
    isPublished: false,
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    todayIncome: 0,
    transactionCount: 0,
  };
}

export function emptyFinanceWallet() {
  return {
    isPublished: false,
    balance: 0,
    pendingSettlement: 0,
    totalOnlineSales: 0,
    refundAmount: 0,
    recentTransactions: [] as unknown[],
  };
}

export function emptyKioskStats() {
  return {
    isPublished: false,
    today_orders: 0,
    today_revenue: 0,
    avg_order_value: 0,
    popular_items: [] as string[],
    top_items: [] as { name: string; orders: number; revenue: number }[],
    sessions_today: 0,
    avg_order_time: "—",
  };
}

export function emptyAiInsights() {
  return {
    isPublished: false,
    insights: [] as unknown[],
    predictions: [] as unknown[],
    menuOptimizations: [] as unknown[],
  };
}

export function emptyBranchAnalytics() {
  return [
    { metric: "Total Network Revenue", value: "₹0", sub: "0 branches · this month", trend: "0%", up: false },
    { metric: "Total Orders", value: "0", sub: "This month", trend: "0%", up: false },
    { metric: "Active Branches", value: "0", sub: "Operational", trend: "—", up: false },
    { metric: "Avg Rating", value: "—", sub: "Customer satisfaction", trend: "—", up: false },
  ];
}

export function emptyMonitoringMetrics() {
  return {
    isPublished: false,
    uptime: "—",
    uptime_seconds: 0,
    cpu_usage: "0.0",
    memory_usage: "0.0",
    db_connections: 0,
    db_response_ms: 0,
    api_requests_today: 0,
    api_errors_today: 0,
    avg_response_ms: 0,
    active_sessions: 0,
    queue_size: 0,
    last_checked: new Date().toISOString(),
  };
}
