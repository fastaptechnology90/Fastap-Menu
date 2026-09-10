import type { StaffRole } from "@/contexts/RestaurantContext";

export type LoginRoleOption = {
  role: StaffRole;
  label: string;
  icon: string;
  description: string;
  defaultPath: string;
};

/** Roles shown on restaurant login — pick portal destination only. */
export const RESTAURANT_LOGIN_ROLES: LoginRoleOption[] = [
  { role: "owner", label: "Owner", icon: "👑", description: "Full control & billing", defaultPath: "/restaurant/dashboard" },
  { role: "manager", label: "Manager", icon: "🏢", description: "Ops, staff & reports", defaultPath: "/restaurant/dashboard" },
  { role: "cashier", label: "Cashier", icon: "💳", description: "POS & cash counter", defaultPath: "/restaurant/billing" },
  { role: "waiter", label: "Waiter", icon: "🍽️", description: "Tables & live orders", defaultPath: "/restaurant/orders" },
  { role: "chef", label: "Chef", icon: "👨‍🍳", description: "Kitchen & costing", defaultPath: "/restaurant/kitchen" },
  { role: "kitchen", label: "Kitchen", icon: "🍳", description: "KDS & prep queue", defaultPath: "/restaurant/kitchen" },
  { role: "reception", label: "Reception", icon: "🛎️", description: "Guests, rooms & folios", defaultPath: "/restaurant/reception" },
  { role: "finance", label: "Finance", icon: "📊", description: "Wallet & settlements", defaultPath: "/restaurant/finance" },
  { role: "housekeeping", label: "Housekeeping", icon: "🧹", description: "Rooms & tasks", defaultPath: "/restaurant/housekeeping" },
  { role: "bar", label: "Bar", icon: "🍹", description: "Bar & inventory", defaultPath: "/restaurant/bar" },
  { role: "spa", label: "Spa", icon: "💆", description: "Spa bookings", defaultPath: "/restaurant/spa" },
  { role: "hr", label: "HR", icon: "👥", description: "Staff & commissions", defaultPath: "/restaurant/staff" },
  { role: "franchise", label: "Franchise", icon: "🏪", description: "Multi-branch & royalties", defaultPath: "/restaurant/branches" },
];

/**
 * Local/dev convenience only — never shipped into production login fields.
 * Vite strips `import.meta.env.DEV` false branches from production bundles.
 */
const DEV_DEMO_EMAILS: Partial<Record<StaffRole, string>> = {
  owner: "owner@spicegarden.com",
  manager: "manager@spicegarden.com",
  cashier: "cashier@spicegarden.com",
  waiter: "waiter@spicegarden.com",
  chef: "chef@spicegarden.com",
  kitchen: "kitchen@spicegarden.com",
  reception: "reception@spicegarden.com",
  finance: "finance@spicegarden.com",
  housekeeping: "housekeeping@spicegarden.com",
  bar: "bar@spicegarden.com",
  spa: "spa@spicegarden.com",
  hr: "hr@spicegarden.com",
  franchise: "franchise@spicegarden.com",
};

export function defaultPathForRole(role: string): string {
  return RESTAURANT_LOGIN_ROLES.find(r => r.role === role)?.defaultPath ?? "/restaurant/dashboard";
}

/** Prefill credentials for local smoke tests. Returns null outside Vite DEV. */
export function devDemoCredentialsForRole(role: StaffRole): { email: string; password: string } | null {
  if (!import.meta.env.DEV) return null;
  const email = DEV_DEMO_EMAILS[role];
  if (!email) return null;
  return { email, password: "Staff@123" };
}
