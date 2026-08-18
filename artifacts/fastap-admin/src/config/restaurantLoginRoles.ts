import type { StaffRole } from "@/contexts/RestaurantContext";

export type LoginRoleOption = {
  role: StaffRole;
  label: string;
  icon: string;
  description: string;
  demoEmail: string;
  defaultPath: string;
};

/** Roles shown on restaurant login — pick portal / quick demo sign-in */
export const RESTAURANT_LOGIN_ROLES: LoginRoleOption[] = [
  { role: "owner", label: "Owner", icon: "👑", description: "Full control & billing", demoEmail: "owner@spicegarden.com", defaultPath: "/restaurant/dashboard" },
  { role: "manager", label: "Manager", icon: "🏢", description: "Ops, staff & reports", demoEmail: "manager@spicegarden.com", defaultPath: "/restaurant/dashboard" },
  { role: "cashier", label: "Cashier", icon: "💳", description: "POS & cash counter", demoEmail: "cashier@spicegarden.com", defaultPath: "/restaurant/billing" },
  { role: "waiter", label: "Waiter", icon: "🍽️", description: "Tables & live orders", demoEmail: "waiter@spicegarden.com", defaultPath: "/restaurant/orders" },
  { role: "chef", label: "Chef", icon: "👨‍🍳", description: "Kitchen & costing", demoEmail: "chef@spicegarden.com", defaultPath: "/restaurant/kitchen" },
  { role: "kitchen", label: "Kitchen", icon: "🍳", description: "KDS & prep queue", demoEmail: "kitchen@spicegarden.com", defaultPath: "/restaurant/kitchen" },
  { role: "reception", label: "Reception", icon: "🛎️", description: "Reservations & queue", demoEmail: "reception@spicegarden.com", defaultPath: "/restaurant/reservations" },
  { role: "finance", label: "Finance", icon: "📊", description: "Wallet & settlements", demoEmail: "finance@spicegarden.com", defaultPath: "/restaurant/finance" },
  { role: "housekeeping", label: "Housekeeping", icon: "🧹", description: "Rooms & tasks", demoEmail: "housekeeping@spicegarden.com", defaultPath: "/restaurant/housekeeping" },
  { role: "bar", label: "Bar", icon: "🍹", description: "Bar & inventory", demoEmail: "bar@spicegarden.com", defaultPath: "/restaurant/spa-bar" },
  { role: "spa", label: "Spa", icon: "💆", description: "Spa bookings", demoEmail: "spa@spicegarden.com", defaultPath: "/restaurant/spa-bar" },
  { role: "hr", label: "HR", icon: "👥", description: "Staff & commissions", demoEmail: "hr@spicegarden.com", defaultPath: "/restaurant/staff" },
  { role: "franchise", label: "Franchise", icon: "🏪", description: "Multi-branch & royalties", demoEmail: "franchise@spicegarden.com", defaultPath: "/restaurant/branches" },
];

export const DEMO_STAFF_PASSWORD = "Staff@123";

export function defaultPathForRole(role: string): string {
  return RESTAURANT_LOGIN_ROLES.find(r => r.role === role)?.defaultPath ?? "/restaurant/dashboard";
}
