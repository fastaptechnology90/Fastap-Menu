export type RestaurantNavItem = {
  path: string;
  label: string;
  icon: string;
  badge?: "orders";
};

export type RestaurantNavGroup = {
  group: string;
  items: RestaurantNavItem[];
};

export const restaurantNavGroups: RestaurantNavGroup[] = [
  {
    group: "Operations",
    items: [
      { path: "/restaurant/dashboard", label: "Dashboard", icon: "dashboard" },
      { path: "/restaurant/orders", label: "Live Orders", icon: "shopping_bag", badge: "orders" },
      { path: "/restaurant/tables", label: "Tables", icon: "grid_view" },
      { path: "/restaurant/queue", label: "Queue & Waitlist", icon: "groups" },
      { path: "/restaurant/waiter", label: "Waiter Automation", icon: "support_agent" },
      { path: "/restaurant/kitchen", label: "Kitchen Display", icon: "skillet" },
      { path: "/restaurant/billing", label: "Billing & POS", icon: "point_of_sale" },
      { path: "/restaurant/cash-counter", label: "Cash Counter", icon: "payments" },
    ],
  },
  {
    group: "Menu & Inventory",
    items: [
      { path: "/restaurant/menu", label: "Menu Management", icon: "restaurant_menu" },
      { path: "/restaurant/inventory", label: "Inventory", icon: "inventory_2" },
      { path: "/restaurant/food-costing", label: "Food Costing", icon: "calculate" },
      { path: "/restaurant/procurement", label: "Procurement", icon: "shopping_cart" },
    ],
  },
  {
    group: "Guests & Marketing",
    items: [
      { path: "/restaurant/customers", label: "Customer CRM", icon: "person_search" },
      { path: "/restaurant/reservations", label: "Reservations", icon: "event" },
      { path: "/restaurant/loyalty", label: "Loyalty & Wallet", icon: "card_giftcard" },
      { path: "/restaurant/marketing", label: "Marketing", icon: "campaign" },
      { path: "/restaurant/reviews", label: "Review Management", icon: "star" },
    ],
  },
  {
    group: "Hotel Services",
    items: [
      { path: "/restaurant/reception", label: "Reception", icon: "concierge" },
      { path: "/restaurant/room-service", label: "Room Service", icon: "room_service" },
      { path: "/restaurant/housekeeping", label: "Housekeeping", icon: "cleaning_services" },
      { path: "/restaurant/spa", label: "Spa", icon: "spa" },
      { path: "/restaurant/bar", label: "Bar", icon: "local_bar" },
      { path: "/restaurant/events", label: "Events & Banquet", icon: "celebration" },
    ],
  },
  {
    group: "Staff & HR",
    items: [
      { path: "/restaurant/staff", label: "Staff", icon: "badge" },
      { path: "/restaurant/commissions", label: "Commissions & Chat", icon: "chat" },
      { path: "/restaurant/tasks-sop", label: "Tasks & SOP", icon: "checklist" },
    ],
  },
  {
    group: "Finance & Reports",
    items: [
      { path: "/restaurant/analytics", label: "Analytics", icon: "bar_chart" },
      { path: "/restaurant/finance", label: "Finance & Wallet", icon: "account_balance_wallet" },
      { path: "/restaurant/corporate-billing", label: "Corporate Billing", icon: "business" },
    ],
  },
  {
    group: "Technology",
    items: [
      { path: "/restaurant/qr-management", label: "QR / NFC", icon: "qr_code_2" },
      { path: "/restaurant/digital-signage", label: "Digital Signage", icon: "tv" },
      { path: "/restaurant/kiosk", label: "Self-Order Kiosk", icon: "tablet_mac" },
      { path: "/restaurant/offline", label: "Offline & Failover", icon: "cloud_off" },
      { path: "/restaurant/aggregators", label: "Aggregators", icon: "sync" },
      { path: "/restaurant/api-platform", label: "API Platform", icon: "api" },
      { path: "/restaurant/documents", label: "Docs & Hardware", icon: "description" },
    ],
  },
  {
    group: "Enterprise",
    items: [
      { path: "/restaurant/branches", label: "Branches & Franchise", icon: "corporate_fare" },
      { path: "/restaurant/ai-features", label: "AI Features", icon: "auto_awesome" },
      { path: "/restaurant/white-label", label: "White Label", icon: "palette" },
      { path: "/restaurant/feature-control", label: "Feature Control", icon: "tune" },
      { path: "/restaurant/rbac", label: "RBAC Permissions", icon: "lock" },
      { path: "/restaurant/audit", label: "Security & Audit", icon: "shield" },
      { path: "/restaurant/monitoring", label: "System Monitoring", icon: "monitoring" },
      { path: "/restaurant/backup", label: "Backup & Recovery", icon: "backup" },
      { path: "/restaurant/notifications", label: "Notifications", icon: "notifications" },
      { path: "/restaurant/communications", label: "Communications", icon: "forum" },
      { path: "/restaurant/sandbox", label: "Sandbox / Demo", icon: "science" },
      { path: "/restaurant/accessibility", label: "Accessibility", icon: "accessibility" },
      { path: "/restaurant/settings", label: "Settings", icon: "settings" },
    ],
  },
];

export const RESTAURANT_ALL_PATHS = restaurantNavGroups.flatMap(g => g.items.map(i => i.path));

export const ROLE_ICONS: Record<string, string> = {
  owner: "workspace_premium",
  manager: "business",
  chef: "restaurant",
  kitchen: "skillet",
  cashier: "point_of_sale",
  waiter: "room_service",
  reception: "desk",
  finance: "account_balance",
  hr: "groups",
  bar: "local_bar",
  spa: "spa",
  housekeeping: "cleaning_services",
  franchise: "corporate_fare",
};
