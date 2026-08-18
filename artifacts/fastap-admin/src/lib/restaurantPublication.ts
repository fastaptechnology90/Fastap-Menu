export type PublicationStatus =
  | "Published"
  | "Draft"
  | "Pending"
  | "Disabled"
  | "Rejected"
  | "Archived";

export interface PublicationAware {
  isPublished?: boolean;
  publicationStatus?: PublicationStatus;
  kycStatus?: string;
  isActive?: boolean;
}

/** True only when the restaurant is live and may accumulate customer analytics. */
export function isRestaurantPublished(restaurant?: PublicationAware | null): boolean {
  if (!restaurant) return false;
  if (typeof restaurant.isPublished === "boolean") return restaurant.isPublished;
  return restaurant.publicationStatus === "Published";
}

/** Zeroed analytics summary for unpublished restaurants (matches backend emptyAnalyticsSummary). */
export function emptyAnalyticsSummaryDisplay(periodLabel = "All time") {
  return {
    isPublished: false,
    periodLabel,
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    totalCustomers: 0,
    qrScans: 0,
    feedbackAvgRating: 0,
    reviews: 0,
    views: 0,
    ratings: 0,
    reservations: 0,
    growth: 0,
  };
}

/** Zeroed POS / dashboard stats for unpublished restaurants. */
export function emptyPosStatsDisplay() {
  return { collection: 0, bills: 0, avgBill: 0 };
}

export function publicationEmptyMessage(status?: PublicationStatus): string {
  switch (status) {
    case "Pending":
      return "Analytics will appear after KYC approval and publication.";
    case "Rejected":
      return "Resolve KYC issues and republish to view analytics.";
    case "Disabled":
      return "This restaurant is suspended. Analytics are paused.";
    case "Archived":
      return "This restaurant is archived. Analytics are unavailable.";
    default:
      return "Publish your restaurant to start tracking orders, revenue, and customer activity.";
  }
}
