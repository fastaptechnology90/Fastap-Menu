export type AdminNavItem = { title: string; href: string; icon: string };
export type AdminNavGroup = { title: string; items: AdminNavItem[] };

export const adminNavGroups: AdminNavGroup[] = [
  {
    title: "OVERVIEW",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: "dashboard" },
      { title: "Live Monitoring", href: "/live-monitoring", icon: "monitoring" },
      { title: "Master Search", href: "/search", icon: "search" },
      { title: "Revenue Leakage", href: "/revenue-leakage", icon: "trending_down" },
      { title: "Restaurant Revenues", href: "/restaurant-revenues", icon: "trending_up" },
    ],
  },
  {
    title: "FINANCIAL",
    items: [
      { title: "Payments", href: "/payments", icon: "credit_card" },
      { title: "Refunds", href: "/refunds", icon: "currency_exchange" },
      { title: "Chargebacks", href: "/chargebacks", icon: "warning" },
      { title: "Settlements", href: "/settlements", icon: "description" },
      { title: "Escrow", href: "/escrow", icon: "account_balance_wallet" },
      { title: "Vendor Wallets", href: "/vendor-wallets", icon: "wallet" },
      { title: "Invoices", href: "/invoices", icon: "receipt_long" },
      { title: "Commissions", href: "/commissions", icon: "percent" },
      { title: "Taxes", href: "/taxes", icon: "calculate" },
      { title: "Penalties", href: "/penalties", icon: "gavel" },
    ],
  },
  {
    title: "VENDORS",
    items: [
      { title: "All Vendors", href: "/vendors", icon: "storefront" },
      { title: "KYC & Compliance", href: "/kyc", icon: "verified_user" },
      { title: "Subscriptions", href: "/subscriptions", icon: "inventory_2" },
      { title: "Plan Builder", href: "/plans", icon: "layers" },
      { title: "Coupons", href: "/coupons", icon: "confirmation_number" },
      { title: "Agreements", href: "/agreements", icon: "draw" },
      { title: "Document Vault", href: "/document-vault", icon: "folder_open" },
      { title: "Reservations", href: "/reservations", icon: "event_seat" },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { title: "Support & Tickets", href: "/support", icon: "support_agent" },
      { title: "QR/NFC", href: "/qr-nfc", icon: "qr_code_scanner" },
      { title: "Fraud & Risk", href: "/fraud", icon: "security" },
      { title: "Analytics", href: "/analytics", icon: "pie_chart" },
      { title: "SLA Monitoring", href: "/sla-monitoring", icon: "schedule" },
      { title: "Tasks", href: "/tasks", icon: "task_alt" },
    ],
  },
  {
    title: "COMMUNICATIONS",
    items: [
      { title: "Notifications", href: "/notifications", icon: "notifications" },
      { title: "Blog", href: "/blog", icon: "news" },
    ],
  },
  {
    title: "PLATFORM",
    items: [
      { title: "Audit Logs", href: "/audit-logs", icon: "history" },
      { title: "Error Logs", href: "/error-logs", icon: "bug_report" },
      { title: "Export Center", href: "/export-center", icon: "download" },
      { title: "Admin Users", href: "/users", icon: "group" },
      { title: "Roles & RBAC", href: "/roles", icon: "admin_panel_settings" },
      { title: "Security", href: "/security", icon: "shield" },
      { title: "Infrastructure", href: "/infrastructure", icon: "dns" },
      { title: "Staff App Releases", href: "/app-releases", icon: "smartphone" },
      { title: "White Label", href: "/white-label", icon: "palette" },
      { title: "Settings", href: "/settings", icon: "settings" },
    ],
  },
];
