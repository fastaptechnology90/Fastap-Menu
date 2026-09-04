const API_BASE = (import.meta.env.VITE_API_BASE as string) || "/api";

async function request<T>(path: string, options?: RequestInit, skipAuthRedirect = false): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (res.status === 401 && !skipAuthRedirect) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    if (!window.location.pathname.includes("/login")) {
      window.location.href = `${base}/login`;
    }
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    // The message is unchanged; `code` is carried alongside it so a caller that
    // needs to react to a specific failure (rather than just display it) can.
    const error = new Error(err.error || "Request failed") as Error & { code?: string; status?: number };
    error.code = err.code;
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export type RolePermissionsConfig = {
  roles: Record<string, string[]>;
  teams?: { key: string; label: string }[];
  pages?: { href: string; title: string; group?: string }[];
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl?: string;
  status: "draft" | "published";
  author: string;
  createdAt: string;
  updatedAt: string;
};

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: AdminUser; message: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),
    me: () => request<AdminUser>("/auth/me", undefined, true),
    forgotPassword: (email: string) =>
      request<{ message: string; emailConfigured: boolean; devToken?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, password: string) =>
      request<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),
    setupSuperAdmin: (name: string, email: string, password: string) =>
      request<{ user: AdminUser }>("/superadmin/setup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      }),
  },
  dashboard: {
    stats: () => request<DashboardStats>("/superadmin/stats"),
    revenue: (params?: { from?: string; to?: string; restaurantId?: number }) => {
      const q = new URLSearchParams();
      if (params?.from) q.set("from", params.from);
      if (params?.to) q.set("to", params.to);
      if (params?.restaurantId) q.set("restaurantId", String(params.restaurantId));
      const qs = q.toString();
      return request<{ from: string | null; to: string | null; revenue: number; totalOrders: number }>(`/superadmin/revenue${qs ? `?${qs}` : ""}`);
    },
    restaurantRevenues: () => request<{ restaurants: { id: number; name: string; isActive: boolean; orderRevenue: number; spaRevenue: number; totalRevenue: number; paidOrders: number }[]; grandTotal: number; count: number }>("/superadmin/restaurant-revenues"),
  },
  vendors: {
    list: (includeDeleted = false) =>
      request<Vendor[]>(`/superadmin/vendors${includeDeleted ? "?includeDeleted=true" : ""}`),
    get: (id: number) => request<Vendor>(`/superadmin/vendors/${id}`),
    create: (data: CreateVendorData) =>
      request<Vendor>("/superadmin/vendors", { method: "POST", body: JSON.stringify(data) }),
    toggle: (id: number) =>
      request<Vendor>(`/superadmin/vendors/${id}/toggle`, { method: "POST" }),
    updatePlan: (id: number, plan: string) =>
      request<Vendor>(`/superadmin/vendors/${id}/plan`, { method: "PUT", body: JSON.stringify({ plan }) }),
    freezePayouts: (id: number) =>
      request<{ frozen: boolean }>(`/superadmin/vendors/${id}/freeze-payouts`, { method: "POST" }),
    staff: (id: number) => request<any[]>(`/superadmin/vendors/${id}/staff`),
    branches: (id: number) => request<any[]>(`/superadmin/vendors/${id}/branches`),
    documents: (id: number) => request<any[]>(`/superadmin/vendors/${id}/documents`),
    crmLogs: (id: number) => request<any[]>(`/superadmin/vendors/${id}/crm-logs`),
    resetPassword: (id: number) =>
      request<{ message: string; temporaryPassword: string }>(`/superadmin/vendors/${id}/reset-password`, { method: "POST" }),
    settlements: (id: number) => request<any[]>(`/superadmin/vendors/${id}/settlements`),
    createBranch: (id: number, data: { name: string; address?: string; phone?: string }) =>
      request<any>(`/superadmin/vendors/${id}/branches`, { method: "POST", body: JSON.stringify(data) }),
    updateBranch: (id: number, branchId: string, data: { name?: string; address?: string; isActive?: boolean }) =>
      request<any>(`/superadmin/vendors/${id}/branches/${branchId}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteBranch: (id: number, branchId: string) =>
      request<any>(`/superadmin/vendors/${id}/branches/${branchId}`, { method: "DELETE" }),
    createStaff: (id: number, data: { name: string; email: string; role: string; phone?: string; password?: string }) =>
      request<any>(`/superadmin/vendors/${id}/staff`, { method: "POST", body: JSON.stringify(data) }),
    deleteStaff: (id: number, staffId: string) =>
      request<any>(`/superadmin/vendors/${id}/staff/${staffId}`, { method: "DELETE" }),
    createQr: (id: number, data: { label?: string; type?: string; tableId?: number }) =>
      request<any>(`/superadmin/vendors/${id}/qrcodes`, { method: "POST", body: JSON.stringify(data) }),
    deleteQr: (id: number, qrId: string) =>
      request<any>(`/superadmin/vendors/${id}/qrcodes/${qrId}`, { method: "DELETE" }),
    update: (id: number, data: Record<string, unknown>) =>
      request<Vendor>(`/superadmin/vendors/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    setControls: (id: number, controls: Record<string, boolean | null>) =>
      request<any>(`/superadmin/vendors/${id}/controls`, { method: "POST", body: JSON.stringify(controls) }),
    getFeatures: (id: number) => request<any>(`/superadmin/vendors/${id}/features`),
    setFeatures: (id: number, overrides: Record<string, boolean>) =>
      request<any>(`/superadmin/vendors/${id}/features`, {
        method: "PUT",
        body: JSON.stringify({ overrides }),
      }),
    forceLogout: (id: number) =>
      request<{ success: boolean }>(`/superadmin/vendors/${id}/force-logout`, { method: "POST" }),
    delete: (id: number) =>
      request<{ deleted: boolean }>(`/superadmin/vendors/${id}`, { method: "DELETE" }),
    restore: (id: number) =>
      request<{ restored: boolean }>(`/superadmin/vendors/${id}/restore`, { method: "POST" }),
    bulkAction: (vendorIds: number[], action: string) =>
      request<{ updated: number; action: string }>("/superadmin/vendors/bulk-action", { method: "POST", body: JSON.stringify({ vendorIds, action }) }),
  },
  payments: {
    list: (params?: { status?: string; limit?: number }) => {
      const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
      return request<Payment[]>(`/superadmin/payments${qs}`);
    },
    get: (id: string) => request<PaymentDetail>(`/superadmin/payments/${id}`),
    hold: (id: string, reason?: string) =>
      request<any>(`/superadmin/payments/${id}/hold`, { method: "POST", body: JSON.stringify({ reason }) }),
    retry: (id: string) =>
      request<any>(`/superadmin/payments/${id}/retry`, { method: "POST" }),
    refund: (id: string, body?: { amount?: number; reason?: string; type?: string }) =>
      request<any>(`/superadmin/payments/${id}/refund`, { method: "POST", body: JSON.stringify(body ?? {}) }),
  },
  settlements: {
    list: () => request<Settlement[]>("/superadmin/settlements"),
    release: (id: string) =>
      request<Settlement>(`/superadmin/settlements/${id}/release`, { method: "POST" }),
    hold: (id: string, reason: string) =>
      request<Settlement>(`/superadmin/settlements/${id}/hold`, { method: "POST", body: JSON.stringify({ reason }) }),
    retry: (id: string) =>
      request<Settlement>(`/superadmin/settlements/${id}/retry`, { method: "POST" }),
  },
  analytics: {
    summary: (period?: string) => request<AnalyticsSummary>(`/superadmin/analytics/summary${period ? `?period=${period}` : ""}`),
    revenueSeries: () => request<{ name: string; value: number; commission: number; orders: number }[]>("/superadmin/analytics/revenue-series"),
    extended: () => request<any>("/superadmin/analytics/extended"),
  },
  qr: {
    list: () => request<any[]>("/superadmin/qr-codes"),
    bulkGenerate: (data: { vendorId: number; count: number; prefix?: string; type?: string }) =>
      request<{ created: any[]; count: number }>("/superadmin/qr-codes/bulk", { method: "POST", body: JSON.stringify(data) }),
  },
  roles: {
    list: () => request<any[]>("/superadmin/roles"),
    update: (id: string, data: any) => request<any>(`/superadmin/roles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  },
  auditLogs: {
    list: () => request<AuditLog[]>("/superadmin/audit-logs"),
  },
  plans: {
    list: () => request<Plan[]>("/superadmin/plans"),
    create: (data: Partial<Plan> & { id?: string }) =>
      request<Plan>("/superadmin/plans", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Plan>) =>
      request<Plan>(`/superadmin/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/superadmin/plans/${id}`, { method: "DELETE" }),
    duplicate: (id: string) => request<Plan>(`/superadmin/plans/${id}/duplicate`, { method: "POST" }),
  },
  users: {
    list: () => request<AdminUser[]>("/superadmin/users"),
    create: (data: { name: string; email: string; password: string; role: string }) =>
      request<AdminUser>("/superadmin/users", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; role?: string; password?: string }) =>
      request<AdminUser>(`/superadmin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
  liveFeed: {
    get: () => request<LiveFeed>("/superadmin/live-feed"),
  },
  webhooks: {
    list: () => request<Webhook[]>("/superadmin/webhooks"),
    create: (data: { url: string; events?: string[] }) =>
      request<Webhook>("/superadmin/webhooks", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/superadmin/webhooks/${id}`, { method: "DELETE" }),
    retry: (id: string) => request<any>(`/superadmin/webhooks/${id}/retry`, { method: "POST" }),
  },
  apiUsage: {
    get: () => request<ApiUsageStats>("/superadmin/api-usage"),
  },
  search: {
    query: (q: string) => request<MasterSearchResults>(`/superadmin/search?q=${encodeURIComponent(q)}`),
  },
  kyc: {
    list: () => request<KYCRecord[]>("/superadmin/kyc"),
    approve: (id: string) => request<any>(`/superadmin/kyc/${id}/approve`, { method: "POST" }),
    reject: (id: string, reason: string) => request<any>(`/superadmin/kyc/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
    requestMore: (id: string) => request<any>(`/superadmin/kyc/${id}/request-more`, { method: "POST" }),
    documents: (vendorId: string | number) => request<any[]>(`/superadmin/vendors/${vendorId}/documents`),
    verifyDocument: (docId: number, status: "verified" | "rejected", reason?: string) =>
      request<any>(`/superadmin/documents/${docId}/verify`, { method: "POST", body: JSON.stringify({ status, reason }) }),
  },
  refunds: {
    list: () => request<Refund[]>("/superadmin/refunds"),
    approve: (id: string) => request<any>(`/superadmin/refunds/${id}/approve`, { method: "POST" }),
    reject: (id: string, reason: string) => request<any>(`/superadmin/refunds/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
    retry: (id: string) => request<any>(`/superadmin/refunds/${id}/retry`, { method: "POST" }),
    cancel: (id: string) => request<any>(`/superadmin/refunds/${id}/cancel`, { method: "POST" }),
    partial: (id: string, amount: number) => request<any>(`/superadmin/refunds/${id}/partial`, { method: "POST", body: JSON.stringify({ amount }) }),
    escalate: (id: string, data?: { reason?: string; amount?: number }) =>
      request<any>(`/superadmin/refunds/${id}/escalate`, { method: "POST", body: JSON.stringify(data ?? {}) }),
  },
  support: {
    list: () => request<SupportTicket[]>("/superadmin/support"),
    resolve: (id: string, resolution: string) => request<any>(`/superadmin/support/${id}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) }),
    escalate: (id: string) => request<any>(`/superadmin/support/${id}/escalate`, { method: "POST" }),
    close: (id: string) => request<any>(`/superadmin/support/${id}/close`, { method: "POST" }),
    assign: (id: string, agent: string) =>
      request<any>(`/superadmin/support/${id}/assign`, { method: "POST", body: JSON.stringify({ agent }) }),
    merge: (primaryId: string, secondaryId: string) =>
      request<any>("/superadmin/support/merge", { method: "POST", body: JSON.stringify({ primaryId, secondaryId }) }),
  },
  coupons: {
    list: () => request<Coupon[]>("/superadmin/coupons"),
    create: (data: any) => request<Coupon>("/superadmin/coupons", { method: "POST", body: JSON.stringify(data) }),
    toggle: (id: string) => request<Coupon>(`/superadmin/coupons/${id}/toggle`, { method: "PATCH" }),
    delete: (id: string) => request<any>(`/superadmin/coupons/${id}`, { method: "DELETE" }),
  },
  fraud: {
    list: () => request<FraudAlert[]>("/superadmin/fraud"),
    resolve: (id: string) => request<any>(`/superadmin/fraud/${id}/resolve`, { method: "POST" }),
    dismiss: (id: string) => request<any>(`/superadmin/fraud/${id}/dismiss`, { method: "POST" }),
    block: (id: string) => request<any>(`/superadmin/fraud/${id}/block`, { method: "POST" }),
  },
  commissions: {
    list: () => request<CommissionRule[]>("/superadmin/commissions"),
    create: (data: any) => request<CommissionRule>("/superadmin/commissions", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<CommissionRule>(`/superadmin/commissions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/superadmin/commissions/${id}`, { method: "DELETE" }),
  },
  chargebacks: {
    list: () => request<Chargeback[]>("/superadmin/chargebacks"),
    accept: (id: string) => request<any>(`/superadmin/chargebacks/${id}/accept`, { method: "POST" }),
    contest: (id: string) => request<any>(`/superadmin/chargebacks/${id}/contest`, { method: "POST" }),
    uploadEvidence: (id: string, evidence: string) =>
      request<any>(`/superadmin/chargebacks/${id}/evidence`, { method: "POST", body: JSON.stringify({ evidence }) }),
  },
  apiKeys: {
    list: () => request<ApiKey[]>("/superadmin/api-keys"),
    create: (data: { name: string; environment: string }) => request<ApiKey>("/superadmin/api-keys", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/superadmin/api-keys/${id}`, { method: "DELETE" }),
  },
  settings: {
    get: () => request<PlatformSettings>("/superadmin/settings"),
    update: (data: Partial<PlatformSettings>) => request<PlatformSettings>("/superadmin/settings", { method: "PUT", body: JSON.stringify(data) }),
    integrationsSchema: () => request<{ services: IntegrationServiceDef[] }>("/superadmin/integrations/schema"),
    verifyWhiteLabelDns: (domain: string) =>
      request<{ verified: boolean; host?: string; method?: string; error?: string; whiteLabel?: Record<string, unknown> }>(
        "/superadmin/white-label/verify-dns", { method: "POST", body: JSON.stringify({ domain }) },
      ),
  },
  taxes: {
    list: () => request<Tax[]>("/superadmin/taxes"),
    reports: () => request<{ month: string; totalSales: number; taxCollected: number; status: string }[]>("/superadmin/taxes/reports"),
    toggle: (id: string) => request<Tax>(`/superadmin/taxes/${id}/toggle`, { method: "PATCH" }),
    create: (data: any) => request<Tax>("/superadmin/taxes", { method: "POST", body: JSON.stringify(data) }),
  },
  subscriptions: {
    list: () => request<any[]>("/superadmin/subscriptions"),
    action: (vendorId: number, body: { action: string; plan?: string }) =>
      request<any>(`/superadmin/subscriptions/${vendorId}/action`, { method: "POST", body: JSON.stringify(body) }),
  },
  invoices: {
    list: () => request<any[]>("/superadmin/invoices"),
    download: async (id: string) => {
      const res = await fetch(`${API_BASE}/superadmin/invoices/${id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    exportAll: async () => {
      const res = await fetch(`${API_BASE}/superadmin/invoices/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "invoices.csv";
      a.click();
      URL.revokeObjectURL(url);
    },
    email: (id: string) => request<any>(`/superadmin/invoices/${id}/email`, { method: "POST" }),
  },
  escrow: {
    get: () => request<{ metrics: EscrowMetrics; ledger: EscrowEntry[] }>("/superadmin/escrow"),
    freeze: (vendorId: string) => request<any>(`/superadmin/escrow/freeze/${vendorId}`, { method: "POST" }),
    addReserve: (amount: number, reason: string) => request<any>("/superadmin/escrow/add-reserve", { method: "POST", body: JSON.stringify({ amount, reason }) }),
  },
  metrics: {
    get: () => request<InfraMetrics>("/superadmin/metrics"),
  },
  notifications: {
    list: () => request<any[]>("/superadmin/notifications"),
    create: (data: any) => request<any>("/superadmin/notifications", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/superadmin/notifications/${id}`, { method: "DELETE" }),
  },
  communications: {
    list: () => request<any[]>("/superadmin/communications"),
    send: (data: any) => request<any>("/superadmin/communications/send", { method: "POST", body: JSON.stringify(data) }),
  },
  security: {
    get: () => request<any>("/superadmin/security"),
    updateSettings: (data: Record<string, boolean>) =>
      request<any>("/superadmin/security/settings", { method: "PUT", body: JSON.stringify(data) }),
    revokeSession: (id: string) => request<any>(`/superadmin/security/sessions/${id}`, { method: "DELETE" }),
    addIpWhitelist: (ip: string) => request<any>("/superadmin/security/ip-whitelist", { method: "POST", body: JSON.stringify({ ip }) }),
    removeIpWhitelist: (id: string) => request<any>(`/superadmin/security/ip-whitelist/${id}`, { method: "DELETE" }),
  },
  reconciliation: {
    get: () => request<any>("/superadmin/reconciliation"),
    run: () => request<any>("/superadmin/reconciliation/run", { method: "POST" }),
    adjust: (id: string) => request<any>(`/superadmin/reconciliation/adjust/${id}`, { method: "POST" }),
  },
  penalties: {
    list: () => request<any[]>("/superadmin/penalties"),
    create: (data: any) => request<any>("/superadmin/penalties", { method: "POST", body: JSON.stringify(data) }),
    reverse: (id: string) => request<any>(`/superadmin/penalties/${id}/reverse`, { method: "POST" }),
  },
  tasks: {
    list: () => request<any[]>("/superadmin/tasks"),
    create: (data: any) => request<any>("/superadmin/tasks", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) => request<any>(`/superadmin/tasks/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  },
  announcements: {
    list: () => request<any[]>("/superadmin/announcements"),
    create: (data: any) => request<any>("/superadmin/announcements", { method: "POST", body: JSON.stringify(data) }),
    toggle: (id: string) => request<any>(`/superadmin/announcements/${id}/toggle`, { method: "PATCH" }),
    delete: (id: string) => request<any>(`/superadmin/announcements/${id}`, { method: "DELETE" }),
  },
  errorLogs: {
    list: () => request<any[]>("/superadmin/error-logs"),
  },
  exportCenter: {
    history: () => request<any[]>("/superadmin/export/history"),
    create: (data: any) => request<any>("/superadmin/export", { method: "POST", body: JSON.stringify(data) }),
    download: async (id: string) => {
      const res = await fetch(`${API_BASE}/superadmin/export/${id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    updateStatus: (id: string, status: string) =>
      request<any>(`/superadmin/export/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    approve: (id: string) => request<any>(`/superadmin/export/${id}/approve`, { method: "POST" }),
    reject: (id: string, reason?: string) =>
      request<any>(`/superadmin/export/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  },
  approvals: {
    list: () => request<any[]>("/superadmin/approvals"),
    create: (data: Record<string, unknown>) => request<any>("/superadmin/approvals", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<any>(`/superadmin/approvals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
  rolePermissions: {
    get: () => request<RolePermissionsConfig>("/superadmin/role-permissions"),
    save: (config: RolePermissionsConfig) =>
      request<RolePermissionsConfig>("/superadmin/role-permissions", { method: "PUT", body: JSON.stringify(config) }),
  },
  blogs: {
    list: () => request<{ posts: BlogPost[] }>("/superadmin/blogs"),
    create: (post: Partial<BlogPost>) => request<BlogPost>("/superadmin/blogs", { method: "POST", body: JSON.stringify(post) }),
    update: (id: string, post: Partial<BlogPost>) => request<BlogPost>(`/superadmin/blogs/${id}`, { method: "PUT", body: JSON.stringify(post) }),
    remove: (id: string) => request<{ success: boolean }>(`/superadmin/blogs/${id}`, { method: "DELETE" }),
  },
  reservations: {
    list: () => request<any[]>("/superadmin/reservations"),
    updateStatus: (id: string, status: string) =>
      request<any>(`/superadmin/reservations/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  },
  vendorWallets: {
    list: () => request<any[]>("/superadmin/vendor-wallets"),
  },
  billing: {
    getRules: () => request<any>("/superadmin/billing-rules"),
    saveRules: (data: unknown) => request<any>("/superadmin/billing-rules", { method: "PUT", body: JSON.stringify(data) }),
  },
  aiInsights: {
    get: () => request<any>("/superadmin/ai-insights"),
  },
  alerts: {
    get: () => request<any>("/superadmin/alert-rules"),
    save: (data: unknown) => request<any>("/superadmin/alert-rules", { method: "PUT", body: JSON.stringify(data) }),
  },
  incidents: {
    list: () => request<any>("/superadmin/incidents"),
    create: (data: Record<string, unknown>) => request<any>("/superadmin/incidents", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<any>(`/superadmin/incidents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
  disasterRecovery: {
    get: () => request<any>("/superadmin/dr-status"),
    save: (data: unknown) => request<any>("/superadmin/dr-status", { method: "PUT", body: JSON.stringify(data) }),
  },
  legal: {
    get: () => request<any>("/superadmin/legal"),
    createHold: (data: Record<string, unknown>) =>
      request<any>("/superadmin/legal/hold", { method: "POST", body: JSON.stringify(data) }),
  },
  sandbox: {
    get: () => request<any>("/superadmin/sandbox"),
    save: (data: unknown) => request<any>("/superadmin/sandbox", { method: "PUT", body: JSON.stringify(data) }),
  },
  archival: {
    get: () => request<any>("/superadmin/archival"),
    run: (policyId: string) => request<any>(`/superadmin/archival/${policyId}/run`, { method: "POST" }),
  },
  featureReleases: {
    get: () => request<any>("/superadmin/feature-releases"),
    save: (data: unknown) => request<any>("/superadmin/feature-releases", { method: "PUT", body: JSON.stringify(data) }),
  },
  settlementRules: {
    get: () => request<any>("/superadmin/settlement-rules"),
    save: (data: unknown) => request<any>("/superadmin/settlement-rules", { method: "PUT", body: JSON.stringify(data) }),
  },
  dormantVendors: {
    get: () => request<any>("/superadmin/dormant-vendors"),
    saveRules: (data: unknown) => request<any>("/superadmin/dormant-vendors/rules", { method: "PUT", body: JSON.stringify(data) }),
  },
  revenueLeakage: {
    get: () => request<any>("/superadmin/revenue-leakage"),
  },
  infrastructure: {
    overview: () => request<any>("/superadmin/infrastructure/overview"),
    triggerBackup: () => request<any>("/superadmin/infrastructure/backup", { method: "POST" }),
    retryTasks: () => request<any>("/superadmin/infrastructure/retry-tasks", { method: "POST" }),
  },
  sla: {
    get: () => request<any>("/superadmin/sla"),
  },
  documents: {
    list: () => request<any[]>("/superadmin/documents"),
    download: async (id: string) => {
      const res = await fetch(`${API_BASE}/superadmin/documents/${id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      if (res.redirected) { window.open(res.url, "_blank"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    remind: (id: string) => request<any>(`/superadmin/documents/${id}/remind`, { method: "POST" }),
  },
  agreements: {
    list: () => request<any[]>("/superadmin/agreements"),
    create: (data: any) => request<any>("/superadmin/agreements", { method: "POST", body: JSON.stringify(data) }),
    renew: (id: string) => request<any>(`/superadmin/agreements/${id}/renew`, { method: "POST" }),
  },
  vendorCrm: {
    get: () => request<any>("/superadmin/vendor-crm"),
    createLog: (data: any) => request<any>("/superadmin/vendor-crm/logs", { method: "POST", body: JSON.stringify(data) }),
    completeLog: (id: string) => request<any>(`/superadmin/vendor-crm/logs/${id}/complete`, { method: "PATCH" }),
    remind: (data: { vendorId?: number; vendorName?: string; subject?: string; message?: string }) =>
      request<any>("/superadmin/vendor-crm/remind", { method: "POST", body: JSON.stringify(data) }),
    renew: (vendorId: number) =>
      request<any>("/superadmin/vendor-crm/renew", { method: "POST", body: JSON.stringify({ vendorId }) }),
  },
  appReleases: {
    list: () => request<AppReleasesResponse>("/superadmin/app-releases"),
    create: (data: {
      appKey: string; version: string; changelog?: string;
      fileName?: string; fileSize?: number; storage: "db" | "link"; downloadUrl?: string;
    }) => request<{ release: AppRelease }>("/superadmin/app-releases", { method: "POST", body: JSON.stringify(data) }),
    publish: (id: number) => request<any>(`/superadmin/app-releases/${id}/publish`, { method: "POST" }),
    remove: (id: number) => request<any>(`/superadmin/app-releases/${id}`, { method: "DELETE" }),
    visibility: () => request<{ restaurants: AppVisibilityRow[] }>("/superadmin/app-releases/visibility"),
    setVisibility: (restaurantId: number, appKey: string, visible: boolean) =>
      request<any>("/superadmin/app-releases/visibility", {
        method: "PUT", body: JSON.stringify({ restaurantId, appKey, visible }),
      }),
    setVisibilityForAll: (appKey: string, visible: boolean) =>
      request<{ updated: number }>("/superadmin/app-releases/visibility/bulk", {
        method: "PUT", body: JSON.stringify({ appKey, visible }),
      }),
    /**
     * Send the APK up in slices. An 80 MB file cannot go in one request — the body
     * limit would reject it and a dropped connection would lose the whole upload.
     */
    uploadFile: async (
      releaseId: number,
      file: File,
      onProgress?: (sentBytes: number, totalBytes: number) => void,
      signal?: AbortSignal,
    ) => {
      const CHUNK = 4 * 1024 * 1024;
      let sent = 0;
      for (let idx = 0; idx * CHUNK < file.size; idx++) {
        if (signal?.aborted) throw new Error("Upload cancelled");
        const slice = file.slice(idx * CHUNK, Math.min((idx + 1) * CHUNK, file.size));
        const res = await fetch(`${API_BASE}/superadmin/app-releases/${releaseId}/chunk?index=${idx}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/octet-stream" },
          body: slice,
          signal,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || `Upload failed at part ${idx + 1}`);
        }
        sent += slice.size;
        onProgress?.(sent, file.size);
      }
      return { sent };
    },
  },
};

export type AppRelease = {
  id: number;
  appKey: string;
  version: string;
  changelog: string | null;
  fileName: string | null;
  fileSize: number;
  storage: "db" | "link";
  downloadUrl: string | null;
  status: "draft" | "ready" | "published" | "archived";
  uploadedBytes: number;
  downloads: number;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
};

export type AppCatalogEntry = {
  appKey: string;
  name: string;
  tagline: string;
  role: string;
  accent: string;
  liveReleaseId: number | null;
};

export type AppReleasesResponse = { catalog: AppCatalogEntry[]; releases: AppRelease[] };

export type AppVisibilityRow = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  plan: string;
  apps: Record<string, boolean>;
};

export interface KYCRecord {
  id: string; vendorId: string; vendorName: string;
  ownerEmail?: string | null; ownerPhone?: string | null; isActive?: boolean;
  documents: { pan: string; gst: string; bank: string; fssai: string };
  status: string; submittedAt: string; rejectionReason: string | null;
}

export interface Refund {
  id: string; orderId: string; vendorName: string; customerName: string;
  amount: number; reason: string; status: string; requestedAt: string; type: string;
}

export interface SupportTicket {
  id: string; vendorName: string; subject: string; priority: string;
  status: string; createdAt: string; assignedTo: string | null; slaDeadline: string;
}

export interface Coupon {
  id: string; code: string; type: string; discount: number;
  maxUses: number; used: number; expires: string; status: string; createdAt: string;
}

export interface FraudAlert {
  id: string; vendorName: string; type: string; riskScore: number;
  amount: number; status: string; detectedAt: string; aiSignal: string;
}

export interface CommissionRule {
  id: string; name: string; type: string; value: number; unit: string;
  applyTo: string; status: string; createdAt: string;
}

export interface Chargeback {
  id: string; vendorName: string; customerId: string; amount: number;
  reason: string; deadline: string; status: string; filedAt: string;
}

export interface ApiKey {
  id: string; name: string; environment: string; prefix: string;
  lastUsed: string | null; status: string; createdAt: string; fullKey?: string;
}

export interface FeatureFlag {
  id: string; name: string; description: string; group: string; enabled: boolean; beta: boolean;
}

export interface GeoRegion {
  country: string; currency: string; taxRate: string; timezone: string; active: boolean;
}

export type IntegrationFieldType = "text" | "password" | "textarea" | "switch" | "select";

export interface IntegrationFieldDef {
  key: string;
  label: string;
  type: IntegrationFieldType;
  secret?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
}

export interface IntegrationServiceDef {
  id: string;
  name: string;
  category: string;
  description: string;
  icon?: string;
  fields: IntegrationFieldDef[];
}

export interface IntegrationsConfig {
  defaultPaymentGateway: string;
  services: Record<string, Record<string, string | boolean>>;
}

export interface PlatformSettings {
  currency: string; timezone: string; defaultCommission: number;
  maintenanceMode: boolean; registrationOpen: boolean;
  minPayoutAmount: number; payoutCycle: string;
  supportEmail: string; platformName: string; platformUrl: string;
  supportPhone?: string;
  featureFlags?: FeatureFlag[];
  geoSettings?: GeoRegion[];
  securitySettings?: Record<string, boolean>;
  notificationChannels?: Record<string, boolean>;
  integrations?: IntegrationsConfig;
}

export interface Tax {
  id: string; name: string; rate: number; type: string; region: string; status: boolean;
}

export interface EscrowMetrics {
  totalEscrow: number; activeHolds: number; pendingReleases: number; lockedDisputes: number;
}

export interface EscrowEntry {
  id: string; vendorName: string; type: string; amount: number;
  balance: number; status: string; date: string;
}

export interface InfraMetrics {
  cpu: number; memory: number; disk: number; network: number;
  uptime: string; dbConnections: number; queueDepth: number;
  activeWebhooks: number; totalOrders: number; totalVendors: number;
  apiRpm: number; cacheHitRate: string;
  estimated?: boolean;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  permissions?: string[];
}

export interface DashboardStats {
  totalRestaurants: number;
  activeRestaurants: number;
  inactiveRestaurants?: number;
  suspendedVendors?: number;
  trialVendors?: number;
  enterpriseVendors?: number;
  totalUsers: number;
  totalOrders: number;
  totalCustomers?: number;
  totalSupportTickets?: number;
  totalBookings?: number;
  totalQrScans?: number;
  totalRevenue: number;
  todayRevenue?: number;
  weekRevenue?: number;
  monthRevenue?: number;
  platformCommission?: number;
  refundAmount?: number;
  pendingSettlements?: number;
  releasedSettlements?: number;
  heldSettlements?: number;
  activeSubscriptions?: number;
  paymentSuccessRate?: number;
  failedPayments?: number;
  chargebackAmount?: number;
  pendingKycVendors?: number;
  successfulSettlements?: number;
  failedSettlements?: number;
  planBreakdown: { free: number; starter: number; pro: number; enterprise: number };
  recentRestaurants: Vendor[];
}

export interface PaymentDetail extends Payment {
  vendorId: string;
  taxAmount?: number;
  utr?: string | null;
  upiId?: string | null;
  reference?: string | null;
  collectedBy?: string | null;
  collectedFrom?: string | null;
  gatewayTxnId?: string;
  held?: boolean;
  customerName?: string | null;
  tableName?: string | null;
  roomNumber?: string | null;
  retryCount?: number;
}

export interface LiveFeed {
  orders: { type: string; id: string; amount: number; status: string; at: string }[];
  payments: { type: string; id: string; vendor: string; amount: number; status: string; at: string }[];
  refunds: { type: string; id: string; vendor: string; amount: number; status: string; at: string }[];
  settlements: { type: string; id: string; vendor: string; amount: number; status: string; at: string }[];
  tickets: { type: string; id: string; subject: string; status: string; priority?: string; at: string }[];
  activity: { type: string; id: string; user: string; action: string; module: string; at: string }[];
  support?: { type: string; id: string; subject: string; priority?: string; status: string; at: string }[];
  system?: { type: string; event: string; at: string }[];
}

export interface Webhook {
  id: string; url: string; events: string[]; status: string;
  failures: number; lastDelivery: string | null; createdAt: string;
}

export interface ApiUsageStats {
  totalCalls: number; failedCalls: number; successRate: number; avgResponseMs: number;
  activeKeys: number; totalKeys: number; activeWebhooks: number;
  hourly: { hour: string; calls: number; errors: number }[];
  endpoints: { path: string; calls: number; errors: number; avgMs: number }[];
}

export interface MasterSearchResults {
  vendors: { id: number; name: string; plan: string; isActive: boolean }[];
  payments: Payment[];
  refunds: { id: string; amount: number; status: string }[];
  tickets: { id: string; subject: string; status: string }[];
  logs: { id: string; action: string; module: string; user: string }[];
}

export interface Vendor {
  id: number;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  businessType?: string;
  phone?: string;
  address?: string;
  ownerName: string;
  ownerEmail: string;
  totalOrders: number;
  createdAt: string;
  platformControls?: PlatformControls;
  payoutsFrozen?: boolean;
  kycStatus?: string;
}

export interface CreateVendorData {
  name: string;
  ownerName?: string;
  email: string;
  phone?: string;
  businessType?: string;
  plan?: string;
  address?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  vendorName: string;
  grossAmount: number;
  commission: number;
  netPayout: number;
  paymentMode: string;
  status: string;
  dateTime: string;
}

export interface Settlement {
  id: string;
  vendorName: string;
  grossSales: number;
  commission: number;
  refunds: number;
  finalPayout: number;
  status: string;
  cycle: string;
  dueDate: string;
}

export interface AnalyticsSummary {
  totalVendors: number;
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  platformCommission: number;
  mrr: number;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  module: string;
  target: string;
  dateTime: string;
  ipAddress: string;
  severity: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  featureToggles?: Record<string, boolean>;
  maxBranches: number;
  maxItems: number;
  maxStaff: number;
  maxTables?: number;
  maxOrdersPerMonth?: number | null;
  trialDays?: number;
  isPublished?: boolean;
}

export interface PlatformControls {
  orderingDisabled?: boolean;
  qrDisabled?: boolean;
  nfcDisabled?: boolean;
  deletedAt?: string | null;
}
