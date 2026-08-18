export const vendors = [
  { id: "v1", name: "The Grand Hotel", type: "Hotel", status: "Active", health: 98, mrr: 1500, created: "2023-01-15", tags: ["VIP", "Enterprise"] },
  { id: "v2", name: "Cafe Mocha", type: "Café", status: "Active", health: 85, mrr: 299, created: "2023-03-22", tags: [] },
  { id: "v3", name: "Burger King", type: "Restaurant", status: "Suspended", health: 30, mrr: 0, created: "2023-04-10", tags: ["High Risk"] },
  { id: "v4", name: "Ocean View Resort", type: "Resort", status: "Active", health: 92, mrr: 2500, created: "2023-02-05", tags: ["Enterprise"] },
  { id: "v5", name: "Spicy Kitchen", type: "Cloud Kitchen", status: "Trial", health: 75, mrr: 0, created: "2023-10-01", tags: [] },
  { id: "v6", name: "Night Owl Bar", type: "Bar", status: "Pending", health: 50, mrr: 0, created: "2023-11-12", tags: [] },
  { id: "v7", name: "Taj Mahal Palace", type: "Hotel", status: "Active", health: 100, mrr: 5000, created: "2022-11-20", tags: ["VIP", "Enterprise"] },
  { id: "v8", name: "Green Leaf", type: "Restaurant", status: "Active", health: 88, mrr: 499, created: "2023-05-18", tags: [] },
  { id: "v9", name: "Blue Bottle Coffee", type: "Café", status: "Active", health: 90, mrr: 399, created: "2023-06-30", tags: [] },
  { id: "v10", name: "Pizza Hut", type: "Restaurant", status: "Active", health: 95, mrr: 1200, created: "2022-09-14", tags: ["Enterprise"] },
  { id: "v11", name: "Sunset Lounge", type: "Bar", status: "Suspended", health: 40, mrr: 0, created: "2023-07-22", tags: ["High Risk"] },
  { id: "v12", name: "Urban Roasters", type: "Café", status: "Trial", health: 82, mrr: 0, created: "2023-11-05", tags: [] },
  { id: "v13", name: "Mountain Retreat", type: "Resort", status: "Active", health: 94, mrr: 1800, created: "2023-01-28", tags: ["Enterprise"] },
  { id: "v14", name: "Fresh Bowl", type: "Cloud Kitchen", status: "Active", health: 86, mrr: 299, created: "2023-08-15", tags: [] },
  { id: "v15", name: "City Diner", type: "Restaurant", status: "Pending", health: 60, mrr: 0, created: "2023-11-18", tags: [] },
  { id: "v16", name: "The Ritz", type: "Hotel", status: "Active", health: 99, mrr: 4500, created: "2022-12-10", tags: ["VIP", "Enterprise"] },
  { id: "v17", name: "Muffin House", type: "Café", status: "Active", health: 80, mrr: 199, created: "2023-09-05", tags: [] },
  { id: "v18", name: "Sizzle & Spice", type: "Restaurant", status: "Trial", health: 70, mrr: 0, created: "2023-10-25", tags: [] },
  { id: "v19", name: "Breeze Beach Club", type: "Bar", status: "Active", health: 91, mrr: 899, created: "2023-04-12", tags: [] },
  { id: "v20", name: "Healthy Bites", type: "Cloud Kitchen", status: "Suspended", health: 25, mrr: 0, created: "2023-06-08", tags: ["High Risk"] }
];

export const transactions = Array.from({ length: 50 }).map((_, i) => ({
  id: `tx_${Math.random().toString(36).substr(2, 9)}`,
  vendorId: vendors[i % vendors.length].id,
  vendorName: vendors[i % vendors.length].name,
  amount: Math.floor(Math.random() * 5000) + 100,
  status: Math.random() > 0.1 ? (Math.random() > 0.2 ? "Success" : "Pending") : "Failed",
  mode: ["UPI", "Card", "Net Banking", "Wallet"][Math.floor(Math.random() * 4)],
  date: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
  gateway: ["Stripe", "Razorpay", "PayPal", "Square"][Math.floor(Math.random() * 4)]
}));

export const tickets = [
  { id: "tk_1", title: "API Integration Issue", vendor: "The Grand Hotel", priority: "High", status: "Open", sla: "2h 15m", created: "2023-11-20T10:00:00Z" },
  { id: "tk_2", title: "Payout Delayed", vendor: "Cafe Mocha", priority: "Critical", status: "In Progress", sla: "45m", created: "2023-11-20T09:30:00Z" },
  { id: "tk_3", title: "Add New Branch", vendor: "Burger King", priority: "Low", status: "Open", sla: "23h", created: "2023-11-19T14:00:00Z" },
  { id: "tk_4", title: "QR Code Not Scanning", vendor: "Ocean View Resort", priority: "High", status: "Resolved", sla: "-", created: "2023-11-18T11:20:00Z" },
  { id: "tk_5", title: "Update Tax Details", vendor: "Spicy Kitchen", priority: "Medium", status: "Open", sla: "12h 30m", created: "2023-11-20T08:15:00Z" },
];

export const fraudAlerts = [
  { id: "fa_1", vendor: "Sunset Lounge", type: "High Refund Ratio", score: 92, date: "2023-11-20T08:00:00Z", status: "Unresolved" },
  { id: "fa_2", vendor: "Burger King", type: "Multiple Failed Payments", score: 85, date: "2023-11-19T22:30:00Z", status: "Investigating" },
  { id: "fa_3", vendor: "Healthy Bites", type: "Suspicious Login Location", score: 78, date: "2023-11-19T18:45:00Z", status: "Unresolved" },
  { id: "fa_4", vendor: "Night Owl Bar", type: "Volume Anomaly", score: 65, date: "2023-11-18T23:10:00Z", status: "Resolved" }
];

export const revenueData = [
  { name: 'Jan', value: 40000, commission: 2400 },
  { name: 'Feb', value: 45000, commission: 2700 },
  { name: 'Mar', value: 55000, commission: 3300 },
  { name: 'Apr', value: 50000, commission: 3000 },
  { name: 'May', value: 65000, commission: 3900 },
  { name: 'Jun', value: 70000, commission: 4200 },
  { name: 'Jul', value: 85000, commission: 5100 },
  { name: 'Aug', value: 80000, commission: 4800 },
  { name: 'Sep', value: 95000, commission: 5700 },
  { name: 'Oct', value: 110000, commission: 6600 },
  { name: 'Nov', value: 125000, commission: 7500 },
  { name: 'Dec', value: 150000, commission: 9000 },
];

export const systemMetrics = {
  cpu: 67,
  ram: 74,
  db: 45,
  queue: 120,
  uptime: "99.99%",
  lastDeployment: "2 hours ago"
};

export const refunds = Array.from({ length: 20 }).map((_, i) => ({
  id: `ref_${Math.random().toString(36).substr(2, 9)}`,
  vendorId: vendors[i % vendors.length].id,
  vendorName: vendors[i % vendors.length].name,
  amount: Math.floor(Math.random() * 500) + 10,
  status: ["Requested", "Under Review", "Approved", "Processing", "Completed"][Math.floor(Math.random() * 5)],
  reason: ["Customer requested", "Fraudulent", "Duplicate charge", "Service not provided"][Math.floor(Math.random() * 4)],
  date: new Date(Date.now() - Math.random() * 1000000000).toISOString().split('T')[0]
}));

export const chargebacks = Array.from({ length: 15 }).map((_, i) => ({
  id: `cb_${Math.random().toString(36).substr(2, 9)}`,
  vendorId: vendors[i % vendors.length].id,
  vendorName: vendors[i % vendors.length].name,
  amount: Math.floor(Math.random() * 1000) + 50,
  status: ["Open", "Under Review", "Evidence Submitted", "Won", "Lost"][Math.floor(Math.random() * 5)],
  reason: "Unrecognized transaction",
  date: new Date(Date.now() - Math.random() * 1000000000).toISOString().split('T')[0],
  deadline: new Date(Date.now() + Math.random() * 1000000000).toISOString().split('T')[0]
}));

export const settlements = Array.from({ length: 20 }).map((_, i) => ({
  id: `set_${Math.random().toString(36).substr(2, 9)}`,
  vendorId: vendors[i % vendors.length].id,
  vendorName: vendors[i % vendors.length].name,
  amount: Math.floor(Math.random() * 10000) + 500,
  status: ["Pending", "Processing", "Released", "Held"][Math.floor(Math.random() * 4)],
  cycle: ["Daily", "Weekly", "15days", "Monthly"][Math.floor(Math.random() * 4)],
  date: new Date(Date.now() - Math.random() * 1000000000).toISOString().split('T')[0]
}));

export const escrowMetrics = {
  available: 8500000,
  locked: 1200000,
  pending: 450000,
  reserve: 2000000
};

export const plans = [
  { id: "p1", name: "Starter", price: 49, interval: "month", features: ["Menu Builder", "QR Ordering", "Basic Analytics"], status: "Active" },
  { id: "p2", name: "Professional", price: 149, interval: "month", features: ["Advanced Analytics", "CRM", "Marketing Tools"], status: "Active" },
  { id: "p3", name: "Enterprise", price: 499, interval: "month", features: ["Custom Domain", "White Label", "Dedicated Support"], status: "Active" }
];