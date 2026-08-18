import type { LiveOrder } from "@/contexts/RestaurantContext";

/** Map API/DB order status → restaurant panel LiveOrder status */
export function normalizeOrderStatus(apiStatus: string | undefined | null): LiveOrder["status"] {
  const s = String(apiStatus || "pending").toLowerCase();
  switch (s) {
    case "pending":
    case "new":
      return "new";
    case "confirmed":
    case "accepted":
      return "accepted";
    case "preparing":
    case "delayed":
      return "preparing";
    case "ready":
    case "billing":
      return "ready";
    case "serving":
    case "served":
    case "delivered":
      return "served";
    case "completed":
    case "billed":
      return "billed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "accepted";
  }
}

/** Map panel status → API update payload */
export function toApiOrderStatus(uiStatus: LiveOrder["status"]): string {
  switch (uiStatus) {
    case "new":
      return "pending";
    case "accepted":
      return "confirmed";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "served":
      return "served";
    case "billed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return uiStatus;
  }
}
