import { downloadFromApi } from "./download";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export interface FavoriteMeal {
  menuItemId: string;
  name: string;
  price: number;
  customizations?: string[];
  addons?: { name: string; price: number }[];
  course?: string;
}

export interface UpsellSuggestion {
  menuItemId: number;
  name: string;
  reason: string;
  type: string;
}

export interface OrderTrackingResponse {
  id: number;
  status: string;
  updatedAt: string;
  restaurantId?: number;
  tableName?: string;
  restaurantPhone?: string;
  waiterPhone?: string;
  waiterName?: string;
  lifecycleStage: string;
  dbStatus: string;
  chefName?: string;
  waiterStatus: string;
  estimatedServingMinutes: number;
  estimatedServingAt?: string;
  preparationElapsedSeconds: number;
  isDelayed: boolean;
  delayMinutes: number;
  delayReason?: string;
  kitchenUpdates: { at: string; message: string; type?: string }[];
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    let err: { error?: string; requiresOtp?: boolean; restaurants?: { id: number; name: string; slug: string; address?: string; businessType?: string }[] } = {};
    if (ct.includes("application/json")) {
      err = await res.json().catch(() => ({ error: res.statusText })) as typeof err;
    } else {
      const text = await res.text().catch(() => "");
      if (res.status === 413) {
        err.error = "Upload too large. Use smaller images (under 3 MB each) or compress your documents.";
      } else {
        err.error = text.replace(/<[^>]+>/g, " ").trim().slice(0, 200) || res.statusText;
      }
    }
    const e = new Error(err.error || `HTTP ${res.status}`) as Error & {
      requiresOtp?: boolean;
      status?: number;
      restaurants?: typeof err.restaurants;
    };
    e.status = res.status;
    if (err.requiresOtp) e.requiresOtp = true;
    if (err.restaurants) e.restaurants = err.restaurants;
    throw e;
  }
  return res.json();
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body: unknown) => request<T>("POST", path, body);
const put = <T>(path: string, body: unknown) => request<T>("PUT", path, body);
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);

// ─── Restaurant Auth ───────────────────────────────────────────────
export class RestaurantAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestaurantAuthError";
  }
}

export interface RestaurantStaffRegisterPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  restaurantSlug: string;
}

export interface RestaurantRegisterPayload {
  staffRole?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPhone: string;
  ownerIdType?: string;
  ownerIdNumber?: string;
  restaurantName: string;
  businessType: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  restaurantPhone: string;
  restaurantEmail: string;
  website: string;
  legalBusinessName: string;
  gstNumber: string;
  fssaiNumber: string;
  panNumber: string;
  bankAccount: string;
  ifsc: string;
  documents: { type: string; name: string; fileUrl: string }[];
}

export const restaurantAuth = {
  login: (data: {
    restaurantId?: number;
    email?: string;
    password?: string;
    phone?: string;
    otp?: string;
  }) => post<{ success: boolean; staff: any; restaurant: any; subscription?: any; requiresSubscription?: boolean }>("/restaurant-auth/login", data),
  sendOtp: (data: { restaurantId?: number; phone: string; countryCode?: string }) =>
    post<{ success: boolean; message: string }>("/restaurant-auth/otp/send", data),
  register: (data: RestaurantRegisterPayload) =>
    post<{
      success: boolean;
      pendingApproval?: boolean;
      message?: string;
      restaurant?: { id: number; name: string; slug: string; kycStatus?: string };
      staff?: any;
    }>("/restaurant-auth/register", data),
  registerStaff: (data: RestaurantStaffRegisterPayload) =>
    post<{ success: boolean; staff: any; restaurant: any; subscription?: any; requiresSubscription?: boolean }>("/restaurant-auth/register/staff", data),
  me: () => get<{
    staff: any;
    restaurant: any;
    restaurantId: number;
    subscription?: { active: boolean; planId: string; planName?: string; status: string; daysRemaining?: number | null };
    requiresSubscription?: boolean;
    canSubscribe?: boolean;
  } | null>("/restaurant-auth/me"),
  logout: () => post<{ success: true }>("/restaurant-auth/logout", {}),
  forgotPassword: (email: string) =>
    post<{ success: boolean; message: string; emailConfigured: boolean; devToken?: string }>("/restaurant-auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) =>
    post<{ success: boolean; message: string }>("/restaurant-auth/reset-password", { token, password }),
  security: (restaurantId?: number) => get<any>(`/restaurant-auth/security${restaurantId ? `?restaurantId=${restaurantId}` : ""}`),
  updateSecurity: (body: any) => put<any>("/restaurant-auth/security", body),
  subscription: {
    plans: () => get<{ plans: SubscriptionPlan[]; currency: string }>("/restaurant-auth/subscription/plans"),
    status: () => get<{ subscription: SubscriptionStatus; requiresSubscription: boolean; canSubscribe: boolean }>("/restaurant-auth/subscription"),
    subscribe: (planId: string) =>
      post<{ success: boolean; subscription: SubscriptionStatus; requiresSubscription: boolean }>(
        "/restaurant-auth/subscription/subscribe",
        { planId },
      ),
  },
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  maxBranches: number;
  maxItems: number;
  maxStaff: number;
  maxTables: number;
  trialDays: number;
};

export type SubscriptionStatus = {
  active: boolean;
  planId: string;
  planName?: string;
  status: string;
  startedAt?: string | null;
  expiresAt?: string | null;
  trialEndsAt?: string | null;
  daysRemaining?: number | null;
  price?: number;
};

// ─── Orders ───────────────────────────────────────────────────────
export const orders = {
  list: (rid: number, status?: string) => get<any[]>(`/restaurants/${rid}/orders${status ? `?status=${status}` : ""}`),
  get: (rid: number, id: number) => get<any>(`/restaurants/${rid}/orders/${id}`),
  update: (rid: number, id: number, body: { status?: string; paymentMethod?: string; paymentStatus?: string; tipAmount?: number; finalTotal?: number; collectedBy?: string; collectedFrom?: string; utr?: string; upiId?: string }) =>
    put<any>(`/restaurants/${rid}/orders/${id}`, body),
  create: (body: any) => post<any>("/public/orders", body),
};

// ─── Menu ─────────────────────────────────────────────────────────
export const menu = {
  categories: (rid: number) => get<any[]>(`/restaurants/${rid}/categories`),
  createCategory: (rid: number, body: any) => post<any>(`/restaurants/${rid}/categories`, body),
  updateCategory: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/categories/${id}`, body),
  deleteCategory: (rid: number, id: number) => del<any>(`/restaurants/${rid}/categories/${id}`),
  items: (rid: number) => get<any[]>(`/restaurants/${rid}/items`),
  createItem: (rid: number, body: any) => post<any>(`/restaurants/${rid}/items`, body),
  updateItem: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/items/${id}`, body),
  deleteItem: (rid: number, id: number) => del<any>(`/restaurants/${rid}/items/${id}`),
};

// ─── Tables ───────────────────────────────────────────────────────
export const tables = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/tables`),
  zones: (rid: number) => get<string[]>(`/restaurants/${rid}/tables/zones`),
  areas: (rid: number) => get<any[]>(`/restaurants/${rid}/table-areas`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/tables`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/tables/${id}`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/tables/${id}`),
  updateStatus: (rid: number, id: number, body: { status?: string; currentGuestCount?: number; currentWaiterName?: string; isVip?: boolean }) =>
    request<any>("PATCH", `/restaurants/${rid}/tables/${id}/status`, body),
  merge: (rid: number, body: { primaryId: number; secondaryIds: number[] }) =>
    post<any>(`/restaurants/${rid}/tables/merge`, body),
  unmerge: (rid: number, id: number) => post<any>(`/restaurants/${rid}/tables/${id}/unmerge`, {}),
};

// ─── Staff ────────────────────────────────────────────────────────
export const staff = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/staff`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/staff`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/staff/${id}`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/staff/${id}`),
};

// ─── Customers ────────────────────────────────────────────────────
export const customers = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/customers`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/customers`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/customers/${id}`, body),
};

// ─── Reservations ─────────────────────────────────────────────────
export const reservations = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/reservations`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/reservations`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/reservations/${id}`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/reservations/${id}`),
};

// ─── Inventory ────────────────────────────────────────────────────
export const inventory = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/inventory`),
  lowStock: (rid: number) => get<any[]>(`/restaurants/${rid}/inventory/low-stock`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/inventory`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/inventory/${id}`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/inventory/${id}`),
  addTransaction: (rid: number, itemId: number, body: any) => post<any>(`/restaurants/${rid}/inventory/${itemId}/transaction`, body),
  getTransactions: (rid: number, itemId: number) => get<any[]>(`/restaurants/${rid}/inventory/${itemId}/transactions`),
};

// ─── Food Costing / Recipes ───────────────────────────────────────
export const foodCosting = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/recipes`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/recipes`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/recipes/${id}`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/recipes/${id}`),
};

// ─── Procurement ──────────────────────────────────────────────────
export const procurement = {
  suppliers: (rid: number) => get<any[]>(`/restaurants/${rid}/suppliers`),
  createSupplier: (rid: number, body: any) => post<any>(`/restaurants/${rid}/suppliers`, body),
  updateSupplier: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/suppliers/${id}`, body),
  deleteSupplier: (rid: number, id: number) => del<any>(`/restaurants/${rid}/suppliers/${id}`),
  purchaseOrders: (rid: number) => get<any[]>(`/restaurants/${rid}/purchase-orders`),
  createPO: (rid: number, body: any) => post<any>(`/restaurants/${rid}/purchase-orders`, body),
  updatePO: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/purchase-orders/${id}`, body),
};

// ─── Finance ──────────────────────────────────────────────────────
export const finance = {
  transactions: (rid: number) => get<any[]>(`/restaurants/${rid}/finance/transactions`),
  createTransaction: (rid: number, body: any) => post<any>(`/restaurants/${rid}/finance/transactions`, body),
  summary: (rid: number) => get<any>(`/restaurants/${rid}/finance/summary`),
  wallet: (rid: number) => get<any>(`/restaurants/${rid}/finance/wallet`),
  cashShifts: (rid: number) => get<any[]>(`/restaurants/${rid}/cash-shifts`),
  activeShift: (rid: number) => get<any>(`/restaurants/${rid}/cash-shifts/active`),
  openShift: (rid: number, body: any) => post<any>(`/restaurants/${rid}/cash-shifts`, body),
  closeShift: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/cash-shifts/${id}/close`, body),
  exportCsv: (rid: number) => downloadFromApi(`/restaurants/${rid}/finance/export`, `finance-${rid}.csv`),
};

// ─── Housekeeping & Maintenance ───────────────────────────────────
export const housekeeping = {
  tasks: (rid: number) => get<any[]>(`/restaurants/${rid}/housekeeping`),
  createTask: (rid: number, body: any) => post<any>(`/restaurants/${rid}/housekeeping`, body),
  updateTask: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/housekeeping/${id}`, body),
  deleteTask: (rid: number, id: number) => del<any>(`/restaurants/${rid}/housekeeping/${id}`),
  maintenanceList: (rid: number) => get<any[]>(`/restaurants/${rid}/maintenance`),
  createMaintenance: (rid: number, body: any) => post<any>(`/restaurants/${rid}/maintenance`, body),
  updateMaintenance: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/maintenance/${id}`, body),
};

// ─── Room Service ─────────────────────────────────────────────────
export const roomService = {
  rooms: (rid: number) => get<any[]>(`/restaurants/${rid}/rooms`),
  createRoom: (rid: number, body: any) => post<any>(`/restaurants/${rid}/rooms`, body),
  updateRoom: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/rooms/${id}`, body),
  requests: (rid: number) => get<any[]>(`/restaurants/${rid}/room-service`),
  createRequest: (rid: number, body: any) => post<any>(`/restaurants/${rid}/room-service`, body),
  updateRequest: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/room-service/${id}`, body),
  minibar: (rid: number) => get<any[]>(`/restaurants/${rid}/minibar`),
  folio: (rid: number, roomNumber: string) => get<any>(`/restaurants/${rid}/rooms/${encodeURIComponent(roomNumber)}/folio`),
  checkout: (rid: number, roomNumber: string) => post<any>(`/restaurants/${rid}/rooms/${encodeURIComponent(roomNumber)}/checkout`, {}),
  recordPayment: (rid: number, roomNumber: string, amount: number) => post<any>(`/restaurants/${rid}/rooms/${encodeURIComponent(roomNumber)}/payment`, { amount }),
};

// ─── Spa & Bar ────────────────────────────────────────────────────
export const spa = {
  services: (rid: number) => get<any[]>(`/restaurants/${rid}/spa/services`),
  createService: (rid: number, body: any) => post<any>(`/restaurants/${rid}/spa/services`, body),
  updateService: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/spa/services/${id}`, body),
  deleteService: (rid: number, id: number) => del<any>(`/restaurants/${rid}/spa/services/${id}`),
  bookings: (rid: number) => get<any[]>(`/restaurants/${rid}/spa/bookings`),
  createBooking: (rid: number, body: any) => post<any>(`/restaurants/${rid}/spa/bookings`, body),
  updateBooking: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/spa/bookings/${id}`, body),
};

// ─── Custom module packages / rate cards (events, spa, housekeeping …) ─────────
export const modulePackages = {
  list: (rid: number, module: string) => get<any[]>(`/restaurants/${rid}/module-packages/${module}`),
  create: (rid: number, module: string, body: { name: string; price: number; description?: string; duration?: string }) =>
    post<any>(`/restaurants/${rid}/module-packages/${module}`, body),
  remove: (rid: number, module: string, pkgId: string) =>
    del<any>(`/restaurants/${rid}/module-packages/${module}/${pkgId}`),
};

// ─── Queue / Waitlist ─────────────────────────────────────────────
export const queue = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/queue`),
  add: (rid: number, body: any) => post<any>(`/restaurants/${rid}/queue`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/queue/${id}`, body),
  remove: (rid: number, id: number) => del<any>(`/restaurants/${rid}/queue/${id}`),
};

// ─── Loyalty ──────────────────────────────────────────────────────
export const loyalty = {
  program: (rid: number) => get<any>(`/restaurants/${rid}/loyalty`),
  updateProgram: (rid: number, body: any) => put<any>(`/restaurants/${rid}/loyalty`, body),
  transactions: (rid: number) => get<any[]>(`/restaurants/${rid}/loyalty/transactions`),
  giftCards: (rid: number) => get<any[]>(`/restaurants/${rid}/gift-cards`),
  /** @deprecated use program() — returns loyalty program config, not member list */
  list: (rid: number) => get<any>(`/restaurants/${rid}/loyalty`),
  create: (rid: number, body: any) => put<any>(`/restaurants/${rid}/loyalty`, body),
  update: (rid: number, _id: number, body: any) => put<any>(`/restaurants/${rid}/loyalty`, body),
};

export const promoCodesApi = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/promo-codes`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/promo-codes`, body),
};

export const aiApi = {
  insights: (rid: number) => get<any>(`/restaurants/${rid}/ai/insights`),
  generateMenu: (rid: number, dishName: string) => post<any>(`/restaurants/${rid}/ai/generate-menu`, { dishName }),
  copilot: (rid: number, question: string) => post<any>(`/restaurants/${rid}/ai/copilot`, { question }),
};

// ─── Campaigns / Marketing ────────────────────────────────────────
export const marketing = {
  campaigns: (rid: number) => get<any[]>(`/restaurants/${rid}/campaigns`),
  createCampaign: (rid: number, body: any) => post<any>(`/restaurants/${rid}/campaigns`, body),
  updateCampaign: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/campaigns/${id}`, body),
  deleteCampaign: (rid: number, id: number) => del<any>(`/restaurants/${rid}/campaigns/${id}`),
  automation: (rid: number) => get<any>(`/restaurants/${rid}/marketing/automation`),
};

// ─── Events / Banquet ─────────────────────────────────────────────
export const events = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/events`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/events`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/events/${id}`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/events/${id}`),
};

// ─── Branches ─────────────────────────────────────────────────────
export const branches = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/branches`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/branches`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/branches/${id}`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/branches/${id}`),
  franchise: (rid: number) => get<any[]>(`/restaurants/${rid}/franchise`),
  updateFranchise: (rid: number, franchisees: any[]) => put<any>(`/restaurants/${rid}/franchise`, { franchisees }),
  stockTransfers: (rid: number) => get<any[]>(`/restaurants/${rid}/stock-transfers`),
  updateStockTransfers: (rid: number, transfers: any[]) => put<any>(`/restaurants/${rid}/stock-transfers`, { transfers }),
  analytics: (rid: number) => get<any[]>(`/restaurants/${rid}/branches/analytics`),
};

// ─── Analytics ────────────────────────────────────────────────────
export const analytics = {
  summary: (rid: number, period?: string) => get<any>(`/restaurants/${rid}/analytics/summary${period ? `?period=${period}` : ""}`),
  popularItems: (rid: number) => get<any[]>(`/restaurants/${rid}/analytics/popular-items`),
  dailySales: (rid: number, period?: string) => get<any[]>(`/restaurants/${rid}/analytics/daily-sales${period ? `?period=${period}` : ""}`),
  orderStats: (rid: number, period?: string) => get<any>(`/restaurants/${rid}/analytics/order-stats${period ? `?period=${period}` : ""}`),
  exportCsv: (rid: number) => downloadFromApi(`/restaurants/${rid}/analytics/export`, `analytics-${rid}.csv`),
};

// ─── Tasks & SOP ──────────────────────────────────────────────────
export const tasksSop = {
  tasks: (rid: number) => get<any[]>(`/restaurants/${rid}/tasks`),
  createTask: (rid: number, body: any) => post<any>(`/restaurants/${rid}/tasks`, body),
  updateTask: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/tasks/${id}`, body),
  deleteTask: (rid: number, id: number) => del<any>(`/restaurants/${rid}/tasks/${id}`),
  sopList: (rid: number) => get<any[]>(`/restaurants/${rid}/sop`),
  createSop: (rid: number, body: any) => post<any>(`/restaurants/${rid}/sop`, body),
  updateSop: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/sop/${id}`, body),
  downloadSop: (rid: number, sopId: number) => downloadFromApi(`/restaurants/${rid}/sop/${sopId}/download`, `sop-${sopId}.txt`),
  trainingVideos: (rid: number) => get<any[]>(`/restaurants/${rid}/training-videos`),
  recordVideoView: (rid: number, videoId: string) => post<any>(`/restaurants/${rid}/training-videos/${videoId}/view`, {}),
  completeVideo: (rid: number, videoId: string) => post<any>(`/restaurants/${rid}/training-videos/${videoId}/complete`, {}),
  checklists: (rid: number) => get<{ templates: { opening: any[]; closing: any[] }; progress: { opening: string[]; closing: string[] } }>(`/restaurants/${rid}/checklists`),
  saveChecklistProgress: (rid: number, type: "opening" | "closing", checkedIds: string[]) =>
    put<any>(`/restaurants/${rid}/checklists/progress`, { type, checkedIds }),
};

// ─── Audit Logs ───────────────────────────────────────────────────
export const auditLogs = {
  list: (rid: number, params?: { severity?: string; category?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return get<any[]>(`/restaurants/${rid}/audit-logs${qs ? `?${qs}` : ""}`);
  },
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/audit-logs`, body),
};

// ─── Notifications ────────────────────────────────────────────────
export const notificationsApi = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/notifications-log`),
  send: (rid: number, body: any) => post<any>(`/restaurants/${rid}/notifications-log`, body),
};

// ─── Documents ────────────────────────────────────────────────────
export const documentsApi = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/documents`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/documents`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/documents/${id}`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/documents/${id}`),
};

// ─── Commissions & Chat ───────────────────────────────────────────
export const commissionsApi = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/commissions`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/commissions`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/commissions/${id}`, body),
  chatMessages: (rid: number, channel?: string) => get<any[]>(`/restaurants/${rid}/chat${channel ? `?channel=${channel}` : ""}`),
  sendChat: (rid: number, body: any) => post<any>(`/restaurants/${rid}/chat`, body),
};

// ─── Feedback ─────────────────────────────────────────────────────
export const feedbackApi = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/feedback`),
};

// ─── Public (guest menu & customer) ───────────────────────────────
export const publicApi = {
  venues: () => get<{ venues: { id: number; name: string; slug: string; businessType?: string; publicationStatus?: string }[] }>("/public/venues"),
  menu: (slug: string, table?: string) => {
    const qs = new URLSearchParams();
    if (table) qs.set("table", table);
    const q = qs.toString();
    return get<any>(`/public/menu/${slug}${q ? `?${q}` : ""}`);
  },
  scan: (slug: string, params?: { table?: string; room?: string }) => {
    const qs = new URLSearchParams();
    if (params?.table) qs.set("table", params.table);
    if (params?.room) qs.set("room", params.room);
    const q = qs.toString();
    return get<any>(`/public/scan/${slug}${q ? `?${q}` : ""}`);
  },
  venue: (slug: string, params?: {
    table?: string; room?: string; section?: string; branch?: string; lang?: string;
    entry?: string; zone?: string; pool?: string; spa?: string; event?: string; parking?: string; nfc?: string; session?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.table) qs.set("table", params.table);
    if (params?.room) qs.set("room", params.room);
    if (params?.section) qs.set("section", params.section);
    if (params?.branch) qs.set("branch", params.branch);
    if (params?.lang) qs.set("lang", params.lang);
    if (params?.entry) qs.set("entry", params.entry);
    if (params?.zone) qs.set("zone", params.zone);
    if (params?.pool) qs.set("pool", params.pool);
    if (params?.spa) qs.set("spa", params.spa);
    if (params?.event) qs.set("event", params.event);
    if (params?.parking) qs.set("parking", params.parking);
    if (params?.nfc) qs.set("nfc", params.nfc);
    if (params?.session) qs.set("session", params.session);
    const q = qs.toString();
    return get<any>(`/public/venue/${slug}${q ? `?${q}` : ""}`);
  },
  session: {
    init: (body: Record<string, unknown>) => post<any>("/public/session/init", body),
    restore: (token?: string) => get<any>(`/public/session/restore${token ? `?token=${encodeURIComponent(token)}` : ""}`),
    join: (shareCode: string, deviceId: string) => post<any>("/public/session/join", { shareCode, deviceId }),
    family: (restaurantId?: number, tableName?: string) => post<any>("/public/session/family", { restaurantId, tableName }),
    sync: (cart: unknown[], deviceId: string) => request<any>("PATCH", "/public/session/sync", { cart, deviceId }),
    info: () => get<any>("/public/session/info"),
  },
  tablesAvailability: (restaurantId: number) => get<any[]>(`/public/tables/availability/${restaurantId}`),
  auth: {
    me: () => get<{ user: any } | null>("/public/auth/me"),
    guest: (body: { name?: string; restaurantId?: number }) => post<{ user: any }>("/public/auth/guest", body),
    sendOtp: (phone: string) => post<{ success: boolean; devOtp?: string }>("/public/auth/otp/send", { phone }),
    verifyOtp: (body: { phone: string; otp: string; name?: string; restaurantId?: number }) => post<{ user: any }>("/public/auth/otp/verify", body),
    emailLogin: (body: { email: string; password: string; restaurantId?: number }) => post<{ user: any }>("/public/auth/email/login", body),
    register: (body: { email: string; password: string; name?: string; phone?: string; restaurantId?: number }) => post<{ user: any }>("/public/auth/register", body),
    logout: () => post<{ success: boolean }>("/public/auth/logout", {}),
    social: (body: { provider: "google" | "apple"; name?: string; email?: string; avatar?: string; providerId?: string; restaurantId?: number; guestType?: string }) =>
      post<{ user: any }>("/public/auth/social", body),
    oneTap: (body: { phone: string; deviceId: string; restaurantId?: number }) =>
      post<{ user: any }>("/public/auth/one-tap", body),
    oauthConfig: () => get<{ google: boolean; apple: boolean; manualSocialFlow?: boolean }>("/public/auth/oauth-config"),
    guestTypes: () => get<{ types: { id: string; label: string; desc: string }[] }>("/public/auth/guest-types"),
    setGuestType: (guestType: string) => request<{ user: any }>("PATCH", "/public/auth/guest-type", { guestType }),
    devices: () => get<{ devices: unknown[]; currentDeviceId: string }>("/public/auth/devices"),
    removeDevice: (deviceId: string) => request<{ devices: unknown[] }>("DELETE", `/public/auth/devices/${deviceId}`),
    trustDevice: (deviceId: string) => post<{ devices: unknown[] }>(`/public/auth/devices/${deviceId}/trust`, {}),
    loginAlerts: () => get<{ alerts: unknown[] }>("/public/auth/login-alerts"),
    markAlertsRead: () => post<{ success: boolean }>("/public/auth/login-alerts/read", {}),
    security: () => get<{ security: Record<string, unknown> }>("/public/auth/security"),
    updateSecurity: (body: Record<string, unknown>) => request<{ security: Record<string, unknown> }>("PATCH", "/public/auth/security", body),
  },
  createOrder: (body: any) => post<any>("/public/orders", body),
  reorder: (orderId: number, body?: { tableName?: string; paymentMethod?: string }) =>
    post<any>(`/public/orders/reorder/${orderId}`, body ?? {}),
  getOrder: (orderId: number | string) => get<any>(`/public/orders/${orderId}`),
  orderStatus: (orderId: number | string) => get<OrderTrackingResponse>(`/public/orders/${orderId}/status`),
  orderMessage: (orderId: number | string, body: { message: string }) =>
    post<{ success: boolean; callId?: number }>(`/public/orders/${orderId}/message`, body),
  orderLiveUrl: (orderId: number | string) => `${BASE}/public/orders/${orderId}/live`,
  feedback: (body: any) => post<any>("/public/feedback", body),
  waiterCall: (body: any) => post<any>("/public/waiter-call", body),
  joinQueue: (body: any) => post<any>("/public/queue", body),
  queueStats: (restaurantId: number, partySize?: number) =>
    get<any>(`/public/queue/stats/${restaurantId}${partySize ? `?partySize=${partySize}` : ""}`),
  queueWaitlist: (restaurantId: number) => get<any>(`/public/queue/waitlist/${restaurantId}`),
  queueStatus: (token: string) => get<any>(`/public/queue/${token}`),
  leaveQueue: (token: string) => request<any>("DELETE", `/public/queue/${token}`),
  createReservation: (body: any) => post<any>("/public/reservations", body),
  reservations: (restaurantId: number, phone: string) => get<any[]>(`/public/reservations?restaurantId=${restaurantId}&phone=${encodeURIComponent(phone)}`),
  reservationTypes: () => get<{ types: unknown[] }>("/public/reservations/types"),
  reservationSlots: (restaurantId: number, date: string, reservationType: string) =>
    get<{ slots: { time: string; label: string; available: boolean; remaining: number }[]; deposit: number; availableCount: number }>(
      `/public/reservations/slots?restaurantId=${restaurantId}&date=${encodeURIComponent(date)}&reservationType=${encodeURIComponent(reservationType)}`,
    ),
  payReservationDeposit: (id: number, body: { paymentMethod?: string }) => post<any>(`/public/reservations/${id}/deposit`, body),
  cancelReservation: (id: number) => request<any>("PATCH", `/public/reservations/${id}/cancel`),
  updateReservation: (id: number, body: any) => put<any>(`/public/reservations/${id}`, body),
  validateCoupon: (body: { restaurantId: number; code: string; subtotal: number }) => post<{ code: string; discount: number }>("/public/coupons/validate", body),
  wallet: () => get<any>("/public/me/wallet"),
  rechargeWallet: (amount: number, method?: string) => post<any>("/public/me/wallet/recharge", { amount, method }),
  walletCatalog: () => get<any>("/public/wallet/catalog"),
  walletTransactions: (walletType?: string, limit?: number) => {
    const qs = new URLSearchParams();
    if (walletType) qs.set("walletType", walletType);
    if (limit) qs.set("limit", String(limit));
    const q = qs.toString();
    return get<any>(`/public/me/wallet/transactions${q ? `?${q}` : ""}`);
  },
  walletCashback: () => get<any>("/public/me/wallet/cashback"),
  walletTransfer: (body: { from: string; to: string; amount: number }) =>
    post<any>("/public/me/wallet/transfer", body),
  payments: {
    catalog: () => get<any>("/public/payments/catalog"),
    quote: (body: { subtotal: number; discount?: number; tip?: number; splitCount?: number; partialPayNow?: number; advanceAmount?: number }) =>
      post<any>("/public/payments/quote", body),
    intent: (orderId: number, body: Record<string, unknown>) => post<any>(`/public/payments/intent/${orderId}`, body),
    process: (orderId: number, body: Record<string, unknown>) => post<any>(`/public/payments/process/${orderId}`, body),
    invoice: (orderId: number) => get<any>(`/public/payments/invoice/${orderId}`),
    invoiceDownload: (orderId: number) => `${BASE}/public/payments/invoice/${orderId}/download`,
    invoicePdf: (orderId: number) => `${BASE}/public/payments/invoice/${orderId}/pdf`,
  },
  loyalty: () => get<any>("/public/me/loyalty"),
  loyaltyCatalog: () => get<any>("/public/loyalty/catalog"),
  loyaltyRewards: () => get<any>("/public/me/loyalty/rewards"),
  redeemLoyaltyPoints: (points: number) => post<any>("/public/me/loyalty/redeem-points", { points }),
  claimBirthdayReward: () => post<any>("/public/me/loyalty/claim-birthday", {}),
  claimAnniversaryReward: () => post<any>("/public/me/loyalty/claim-anniversary", {}),
  updateLoyaltyProfile: (body: { birthday?: string; anniversary?: string }) =>
    request<any>("PATCH", "/public/me/loyalty/profile", body),
  myOrders: () => get<any[]>("/public/me/orders"),
  favorites: {
    get: (restaurantId?: number) => get<{ favorites: FavoriteMeal[] }>(`/public/me/favorites${restaurantId ? `?restaurantId=${restaurantId}` : ""}`),
    save: (favorites: FavoriteMeal[], restaurantId?: number) => request<{ favorites: FavoriteMeal[] }>("PATCH", "/public/me/favorites", { favorites, restaurantId }),
  },
  suggestUpsell: (body: { restaurantId: number; cartCourses: string[] }) => post<{ suggestions: UpsellSuggestion[] }>("/public/suggest-upsell", body),
  ai: {
    catalog: () => get<any>("/public/ai/catalog"),
    engine: (body: {
      restaurantId: number;
      dietaryFilter?: string;
      cartCourses?: string[];
      cartItemIds?: number[];
      cartItemNames?: string[];
      favorites?: string[];
    }) => post<any>("/public/ai/engine", body),
    personalizedMenu: (restaurantId: number, dietaryFilter?: string) =>
      get<any>(`/public/ai/personalized-menu/${restaurantId}${dietaryFilter ? `?dietaryFilter=${dietaryFilter}` : ""}`),
    favoritePredictions: (restaurantId: number) => get<any>(`/public/ai/favorite-predictions/${restaurantId}`),
    comboRecommendations: (body: { restaurantId: number; cartItemNames?: string[] }) =>
      post<any>("/public/ai/combo-recommendations", body),
    upsell: (body: { restaurantId: number; cartCourses?: string[]; cartItemIds?: number[] }) =>
      post<any>("/public/ai/upsell", body),
    dietarySuggestions: (body: { restaurantId: number; dietaryFilter?: string }) =>
      post<any>("/public/ai/dietary-suggestions", body),
    spendingAnalysis: (restaurantId: number) => get<any>(`/public/ai/spending-analysis/${restaurantId}`),
  },
  bar: {
    catalog: (restaurantId: number) => get<any>(`/public/bar/catalog/${restaurantId}`),
    happyHour: (slug: string) => get<any>(`/public/bar/happy-hour/${slug}`),
    cocktail: (body: { baseId: string; mixerId?: string; styleId?: string; garnishIds?: string[]; name?: string }) =>
      post<any>("/public/bar/cocktail", body),
    tableSlots: (restaurantId: number, date: string, tableId?: string) => {
      const qs = new URLSearchParams({ restaurantId: String(restaurantId), date });
      if (tableId) qs.set("tableId", tableId);
      return get<any>(`/public/bar/table-slots?${qs}`);
    },
    tableReservation: (body: any) => post<any>("/public/bar/table-reservation", body),
    loungeBooking: (body: any) => post<any>("/public/bar/lounge-booking", body),
    djBooking: (body: any) => post<any>("/public/bar/dj-booking", body),
  },
  spa: {
    catalog: (restaurantId: number) => get<any>(`/public/spa/catalog/${restaurantId}`),
    services: (restaurantId: number) => get<any[]>(`/public/spa/services/${restaurantId}`),
    slots: (restaurantId: number, date: string, duration?: number, therapist?: string) => {
      const qs = new URLSearchParams({ restaurantId: String(restaurantId), date });
      if (duration) qs.set("duration", String(duration));
      if (therapist) qs.set("therapist", therapist);
      return get<{ slots: { time: string; label: string; available: boolean }[] }>(`/public/spa/slots?${qs}`);
    },
    book: (body: any) => post<any>("/public/spa/bookings", body),
    membership: (body: { restaurantId: number; guestName: string; guestPhone?: string; membershipPlanId: string; startDate?: string }) =>
      post<any>("/public/spa/membership", body),
    bookings: (restaurantId: number, phone: string) =>
      get<any[]>(`/public/spa/bookings?restaurantId=${restaurantId}&phone=${encodeURIComponent(phone)}`),
    cancel: (id: number) => request<any>("PATCH", `/public/spa/bookings/${id}/cancel`),
  },
  // legacy aliases
  spaServices: (restaurantId: number) => get<any[]>(`/public/spa/services/${restaurantId}`),
  bookSpa: (body: any) => post<any>("/public/spa/bookings", body),
  spaBookings: (restaurantId: number, phone: string) =>
    get<any[]>(`/public/spa/bookings?restaurantId=${restaurantId}&phone=${encodeURIComponent(phone)}`),
  roomService: (body: any) => post<any>("/public/room-service", body),
  housekeeping: (body: any) => post<any>("/public/housekeeping", body),
  maintenance: (body: any) => post<any>("/public/maintenance", body),
  room: (restaurantId: number, roomNumber: string) => get<any>(`/public/room/${restaurantId}/${roomNumber}`),
  hotel: {
    catalog: (restaurantId: number) => get<any>(`/public/hotel/catalog/${restaurantId}`),
    room: (restaurantId: number, roomNumber: string) => get<any>(`/public/hotel/room/${restaurantId}/${encodeURIComponent(roomNumber)}`),
    updateControls: (restaurantId: number, roomNumber: string, roomControls: Record<string, unknown>) =>
      request<any>("PATCH", `/public/hotel/room/${restaurantId}/${encodeURIComponent(roomNumber)}/controls`, { roomControls }),
    wakeUpCall: (body: { restaurantId: number; roomNumber: string; guestName?: string; scheduledAt: string; notes?: string }) =>
      post<any>("/public/hotel/wake-up-call", body),
    requests: (restaurantId: number, roomNumber: string) =>
      get<any[]>(`/public/hotel/requests/${restaurantId}/${encodeURIComponent(roomNumber)}`),
  },
  events: {
    catalog: (restaurantId: number, eventType?: string) =>
      get<any>(`/public/events/catalog/${restaurantId}${eventType ? `?eventType=${eventType}` : ""}`),
    quotation: (body: { hallId: string; guestCount: number; cateringPackageId?: string; decorationPackageId?: string }) =>
      post<any>("/public/events/quotation", body),
    list: (restaurantId: number) => get<any[]>(`/public/events/${restaurantId}`),
    my: (restaurantId: number, phone: string) =>
      get<any[]>(`/public/events/my?restaurantId=${restaurantId}&phone=${encodeURIComponent(phone)}`),
    enquiry: (body: any) => post<any>("/public/events/enquiry", body),
    sendInvitations: (eventId: number, invitations: { name: string; phone?: string; email?: string }[]) =>
      post<any>(`/public/events/${eventId}/invitations`, { invitations }),
    updateInvitation: (eventId: number, inviteId: string, status: string) =>
      request<any>("PATCH", `/public/events/${eventId}/invitations/${inviteId}`, { status }),
  },
  locale: {
    catalog: () => get<any>("/public/locale/catalog"),
    translations: (lang: string) => get<any>(`/public/locale/translations/${lang}`),
    preferences: () => get<any>("/public/locale/preferences"),
    savePreferences: (body: { language?: string; accessibility?: Record<string, boolean> }) =>
      request<any>("PATCH", "/public/locale/preferences", body),
    voiceMenu: (body: { restaurantId?: number; language?: string; limit?: number; items?: { name: string; price: number; description?: string }[] }) =>
      post<any>("/public/locale/voice-menu", body),
  },
  offline: {
    catalog: () => get<any>("/public/offline/catalog"),
    status: (slug?: string) => get<any>(`/public/offline/status${slug ? `?slug=${slug}` : ""}`),
    syncOrders: (orders: { clientId: string; body: Record<string, unknown>; createdAt?: string }[]) =>
      post<any>("/public/offline/sync-orders", { orders }),
  },
  pwa: {
    catalog: () => get<any>("/public/pwa/catalog"),
    pushPrefs: () => get<any>("/public/pwa/push/prefs"),
    savePushPrefs: (prefs: Record<string, unknown>) => request<any>("PATCH", "/public/pwa/push/prefs", prefs),
    installEvent: (body: { platform?: string; standalone?: boolean }) =>
      post<any>("/public/pwa/install-event", body),
  },
  kiosk: {
    catalog: () => get<any>("/public/kiosk/catalog"),
    config: (slug: string) => get<any>(`/public/kiosk/config/${slug}`),
    menu: (slug: string) => get<any>(`/public/kiosk/menu/${slug}`),
    nfcTap: (body: { tagId: string; cart: unknown[] }) => post<any>("/public/kiosk/nfc-tap", body),
    qrPayment: (body: { restaurantId: number; amount: number }) => post<any>("/public/kiosk/qr-payment", body),
    checkout: (body: { restaurantId: number; items: unknown[]; paymentMethod: string; tip?: number }) =>
      post<any>("/public/kiosk/checkout", body),
    token: (tokenNumber: string) => get<any>(`/public/kiosk/token/${tokenNumber}`),
    tokenBoard: (slug: string) => get<any>(`/public/kiosk/token-board/${slug}`),
  },
  digitalExperience: {
    catalog: () => get<any>("/public/digital-experience/catalog"),
    offers: (slug: string) => get<any>(`/public/digital-experience/offers/${slug}`),
    banners: (slug: string) => get<any>(`/public/digital-experience/banners/${slug}`),
    promotions: (slug: string) => get<any>(`/public/digital-experience/promotions/${slug}`),
    spin: () => post<any>("/public/digital-experience/promotions/spin", {}),
    claimOffer: (offerId: string) => post<any>("/public/digital-experience/promotions/claim", { offerId }),
    themes: () => get<any>("/public/digital-experience/themes"),
    preferences: () => get<any>("/public/digital-experience/preferences"),
    savePreferences: (body: { festivalTheme?: string; seasonalAnimation?: string }) =>
      request<any>("PATCH", "/public/digital-experience/preferences", body),
  },
  social: {
    catalog: () => get<any>("/public/social/catalog"),
    ratings: (slug: string) => get<any>(`/public/social/ratings/${slug}`),
    reviews: (slug: string) => get<any>(`/public/social/reviews/${slug}`),
    submitReview: (body: Record<string, unknown>) => post<any>("/public/social/reviews", body),
    foodPhotos: (slug: string) => get<any>(`/public/social/food-photos/${slug}`),
    uploadPhoto: (body: { restaurantId: number; imageData: string; caption?: string; uploader?: string; reviewId?: string | number }) =>
      post<any>("/public/social/food-photos", body),
    likePhoto: (photoId: string, restaurantId: number) =>
      post<any>(`/public/social/food-photos/${photoId}/like`, { restaurantId }),
    share: (body: Record<string, unknown>) => post<any>("/public/social/share", body),
    referral: (slug: string, baseUrl?: string) =>
      get<any>(`/public/social/referral/${slug}${baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : ""}`),
    trackReferralShare: (body: { restaurantId: number; slug: string; baseUrl?: string }) =>
      post<any>("/public/social/referral/share", body),
  },
  support: {
    catalog: () => get<any>("/public/support/catalog"),
    config: (restaurantId: number) => get<any>(`/public/support/config/${restaurantId}`),
    startChat: (body: { restaurantId: number; guestName?: string }) =>
      post<any>("/public/support/chat/start", body),
    chatMessages: (sessionId: string, restaurantId: number) =>
      get<any>(`/public/support/chat/${sessionId}/messages?restaurantId=${restaurantId}`),
    sendChatMessage: (sessionId: string, body: {
      restaurantId: number; message: string; guestName?: string; agentName?: string;
    }) => post<any>(`/public/support/chat/${sessionId}/message`, body),
    whatsapp: (body: { restaurantId: number; message: string; subject?: string; guestName?: string; guestPhone?: string }) =>
      post<any>("/public/support/whatsapp", body),
    voice: (body: { restaurantId: number; guestPhone: string; guestName?: string; preferredSlot?: string; reason?: string }) =>
      post<any>("/public/support/voice", body),
    ticket: (body: {
      restaurantId?: number; channel?: string; subject?: string; message: string;
      guestName?: string; guestPhone?: string; priority?: string; category?: string;
    }) => post<any>("/public/support/tickets", body),
    myTickets: () => get<any[]>("/public/support/tickets/mine"),
    emergency: (body: {
      restaurantId: number; emergencyType: string; message?: string; location?: string;
      guestName?: string; guestPhone?: string; tableName?: string;
    }) => post<any>("/public/support/emergency", body),
  },
  dining: {
    runningBill: (params: { restaurantId?: number; slug?: string; table?: string }) => {
      const qs = new URLSearchParams();
      if (params.restaurantId) qs.set("restaurantId", String(params.restaurantId));
      if (params.slug) qs.set("slug", params.slug);
      if (params.table) qs.set("table", params.table);
      return get<{ lines: unknown[]; subtotal: number; gst: number; total: number; updatedAt: string }>(`/public/dining/running-bill?${qs}`);
    },
    splitBill: (body: { lines: unknown[]; splitCount?: number; seatCount?: number; mode?: string }) =>
      post<any>("/public/dining/split-bill", body),
    groupPayment: (body: { total: number; payments: { method: string; amount: number }[] }) =>
      post<any>("/public/dining/group-payment", body),
  },
  aiFuture: {
    catalog: () => get<{ features: unknown[] }>("/public/ai-future/catalog"),
    waitlist: (body: { featureId: string; email?: string; phone?: string }) =>
      post<{ message: string }>("/public/ai-future/waitlist", body),
  },
  seating: {
    catalog: () => get<any>("/public/seating/catalog"),
    availability: (slug: string, params?: { category?: string; tableType?: string; zone?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.category) qs.set("category", params.category);
      if (params?.tableType) qs.set("tableType", params.tableType);
      if (params?.zone) qs.set("zone", params.zone);
      if (params?.status) qs.set("status", params.status);
      const q = qs.toString();
      return get<any>(`/public/seating/${slug}/availability${q ? `?${q}` : ""}`);
    },
    suggestions: (slug: string, partySize: number, params?: { category?: string; zone?: string; vip?: boolean }) => {
      const qs = new URLSearchParams({ partySize: String(partySize) });
      if (params?.category) qs.set("category", params.category);
      if (params?.zone) qs.set("zone", params.zone);
      if (params?.vip) qs.set("vip", "1");
      return get<any>(`/public/seating/${slug}/suggestions?${qs}`);
    },
    waitEstimate: (slug: string, partySize: number) =>
      get<any>(`/public/seating/${slug}/wait-estimate?partySize=${partySize}`),
    joinRequest: (slug: string, body: Record<string, unknown>) => post<any>(`/public/seating/${slug}/join-request`, body),
    splitRequest: (slug: string, body: Record<string, unknown>) => post<any>(`/public/seating/${slug}/split-request`, body),
    transferRequest: (slug: string, body: Record<string, unknown>) => post<any>(`/public/seating/${slug}/transfer-request`, body),
    requestStatus: (token: string) => get<any>(`/public/seating/request/${token}`),
  },
};

// ─── Restaurant Settings ──────────────────────────────────────────
export const restaurantSettingsApi = {
  getApp: (rid: number) => get<any>(`/restaurants/${rid}/settings/app`),
  updateApp: (rid: number, body: Record<string, unknown>) => put<any>(`/restaurants/${rid}/settings/app`, body),
};

export const restaurantApi = {
  get: (rid: number) => get<any>(`/restaurants/${rid}`),
  update: (rid: number, body: any) => put<any>(`/restaurants/${rid}`, body),
  dashboard: (rid: number) => get<any>(`/restaurants/${rid}/dashboard`),
  revenue: (rid: number, params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return get<{ from: string | null; to: string | null; revenue: number; totalOrders: number }>(`/restaurants/${rid}/revenue${qs ? `?${qs}` : ""}`);
  },
  create: (body: any) => post<any>("/restaurants", body),
  whiteLabel: (rid: number) => get<any>(`/restaurants/${rid}/settings/white-label`),
  saveWhiteLabel: (rid: number, body: any) => put<any>(`/restaurants/${rid}/settings/white-label`, body),
};

// ─── Waiter Calls (admin) ─────────────────────────────────────────
export const waiterCalls = {
  list: (rid: number) => get<any[]>(`/restaurants/${rid}/waiter-calls`),
  resolve: (rid: number, callId: number) => post<any>(`/restaurants/${rid}/waiter-calls/${callId}/resolve`, {}),
};

// ─── RBAC ─────────────────────────────────────────────────────────
export const rbacApi = {
  get: (rid: number) => get<any>(`/restaurants/${rid}/rbac`),
  update: (rid: number, role: string, permissions: any) => put<any>(`/restaurants/${rid}/rbac/${role}`, { permissions }),
  updateAll: (rid: number, permissions: Record<string, Record<string, boolean>>) =>
    put<any>(`/restaurants/${rid}/rbac`, { permissions }),
  reset: (rid: number, role: string) => post<any>(`/restaurants/${rid}/rbac/reset/${role}`, {}),
};

// ─── Feature modules (kitchen app + panel linking) ────────────────
export const featuresApi = {
  catalog: () => get<any>("/feature-modules/catalog"),
  getRestaurant: (rid: number) => get<any>(`/restaurants/${rid}/features`),
  setRestaurant: (rid: number, toggles: Record<string, boolean>) =>
    put<any>(`/restaurants/${rid}/features`, { toggles }),
  getVendor: (vendorId: number) => get<any>(`/superadmin/vendors/${vendorId}/features`),
  setVendor: (vendorId: number, overrides: Record<string, boolean>) =>
    put<any>(`/superadmin/vendors/${vendorId}/features`, { overrides }),
};

// ─── Reviews ──────────────────────────────────────────────────────
export const reviewsApi = {
  list: (rid: number, params?: any) => { const qs = new URLSearchParams(params).toString(); return get<any>(`/restaurants/${rid}/reviews${qs ? `?${qs}` : ""}`); },
  reply: (rid: number, id: number, reply: string) => post<any>(`/restaurants/${rid}/reviews/${id}/reply`, { reply }),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/reviews`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/reviews/${id}`),
};

// ─── Digital Signage ──────────────────────────────────────────────
export const signageApi = {
  get: (rid: number) => get<any>(`/restaurants/${rid}/signage`),
  updateSettings: (rid: number, body: any) => put<any>(`/restaurants/${rid}/signage/settings`, body),
  createSlide: (rid: number, body: any) => post<any>(`/restaurants/${rid}/signage/slides`, body),
  updateSlide: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/signage/slides/${id}`, body),
  deleteSlide: (rid: number, id: number) => del<any>(`/restaurants/${rid}/signage/slides/${id}`),
};

// ─── Hardware ─────────────────────────────────────────────────────
export const hardwareApi = {
  get: (rid: number) => get<any>(`/restaurants/${rid}/hardware`),
  create: (rid: number, body: any) => post<any>(`/restaurants/${rid}/hardware`, body),
  update: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/hardware/${id}`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/hardware/${id}`),
  ping: (rid: number, id: number) => post<any>(`/restaurants/${rid}/hardware/${id}/ping`, {}),
};

// ─── Corporate Billing ────────────────────────────────────────────
export const corporateApi = {
  accounts: (rid: number) => get<any[]>(`/restaurants/${rid}/corporate/accounts`),
  createAccount: (rid: number, body: any) => post<any>(`/restaurants/${rid}/corporate/accounts`, body),
  updateAccount: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/corporate/accounts/${id}`, body),
  invoices: (rid: number) => get<any[]>(`/restaurants/${rid}/corporate/invoices`),
  createInvoice: (rid: number, body: any) => post<any>(`/restaurants/${rid}/corporate/invoices`, body),
  updateInvoice: (rid: number, id: number, body: any) => put<any>(`/restaurants/${rid}/corporate/invoices/${id}`, body),
  wallets: (rid: number) => get<any[]>(`/restaurants/${rid}/corporate/wallets`),
};

// ─── Backup ───────────────────────────────────────────────────────
export const backupApi = {
  get: (rid: number) => get<any>(`/restaurants/${rid}/backup`),
  create: (rid: number, body?: any) => post<any>(`/restaurants/${rid}/backup/create`, body || {}),
  updateSettings: (rid: number, body: any) => put<any>(`/restaurants/${rid}/backup/settings`, body),
  delete: (rid: number, id: number) => del<any>(`/restaurants/${rid}/backup/${id}`),
  restore: (rid: number, id: number) => post<any>(`/restaurants/${rid}/backup/${id}/restore`, {}),
  download: (rid: number, id: number) => downloadFromApi(`/restaurants/${rid}/backup/${id}/download`, `backup-${id}-manifest.txt`),
};

// ─── Kiosk ────────────────────────────────────────────────────────
export const kioskApi = {
  settings: (rid: number) => get<any>(`/restaurants/${rid}/kiosk/settings`),
  updateSettings: (rid: number, body: any) => put<any>(`/restaurants/${rid}/kiosk/settings`, body),
  menu: (rid: number) => get<any>(`/restaurants/${rid}/kiosk/menu`),
  stats: (rid: number) => get<any>(`/restaurants/${rid}/kiosk/stats`),
  deviceQr: (rid: number, deviceId: string) => get<{ url: string; deviceId: string; restaurantName: string; label: string }>(`/restaurants/${rid}/kiosk/devices/${deviceId}/qr`),
};

// ─── Monitoring ───────────────────────────────────────────────────
export const monitoringApi = {
  metrics: (rid: number) => get<any>(`/restaurants/${rid}/monitoring/metrics`),
  logs: (rid: number) => get<any[]>(`/restaurants/${rid}/monitoring/logs`),
  health: (rid: number) => get<any>(`/restaurants/${rid}/monitoring/health`),
  history: (rid: number) => get<{ history: any[]; peaks: Record<string, string> }>(`/restaurants/${rid}/monitoring/history`),
};

// ─── Bar Admin ────────────────────────────────────────────────────
export const barApi = {
  inventory: (rid: number) => get<any[]>(`/restaurants/${rid}/bar/inventory`),
  updateInventory: (rid: number, items: any[]) => put<any>(`/restaurants/${rid}/bar/inventory`, { items }),
  patchItem: (rid: number, itemId: string, body: any) => patch<any>(`/restaurants/${rid}/bar/inventory/${itemId}`, body),
  recipes: (rid: number) => get<any[]>(`/restaurants/${rid}/bar/recipes`),
  updateRecipes: (rid: number, recipes: any[]) => put<any>(`/restaurants/${rid}/bar/recipes`, { recipes }),
  catalog: (rid: number) => get<any>(`/restaurants/${rid}/bar/catalog`),
  updateHappyHour: (rid: number, body: any) => put<any>(`/restaurants/${rid}/bar/happy-hour`, body),
};

// ─── Restaurant Platform ──────────────────────────────────────────
export const platformApi = {
  offline: (rid: number) => get<any>(`/restaurants/${rid}/platform/offline`),
  updateOffline: (rid: number, body: any) => put<any>(`/restaurants/${rid}/platform/offline`, body),
  syncOffline: (rid: number) => post<any>(`/restaurants/${rid}/platform/offline/sync`, {}),
  communications: (rid: number) => get<any>(`/restaurants/${rid}/platform/communications`),
  broadcast: (rid: number, body: any) => post<any>(`/restaurants/${rid}/platform/communications/broadcast`, body),
  aggregators: (rid: number) => get<any[]>(`/restaurants/${rid}/platform/aggregators`),
  updateAggregator: (rid: number, id: string, body: any) => put<any>(`/restaurants/${rid}/platform/aggregators/${id}`, body),
  syncAggregator: (rid: number, id: string) => post<any>(`/restaurants/${rid}/platform/aggregators/${id}/sync`, {}),
  ingestAggregatorOrder: (rid: number, id: string, body: any) => post<any>(`/restaurants/${rid}/platform/aggregators/${id}/ingest-order`, body),
  ingestOtaBooking: (rid: number, provider: string, body: any) => post<any>(`/restaurants/${rid}/platform/ota/${provider}/ingest-booking`, body),
  sandbox: (rid: number) => get<any>(`/restaurants/${rid}/platform/sandbox`),
  updateSandbox: (rid: number, body: any) => put<any>(`/restaurants/${rid}/platform/sandbox`, body),
  accessibility: (rid: number) => get<any>(`/restaurants/${rid}/platform/accessibility`),
  updateAccessibility: (rid: number, body: any) => put<any>(`/restaurants/${rid}/platform/accessibility`, body),
  apiKeys: (rid: number) => get<any>(`/restaurants/${rid}/platform/api-keys`),
  regenerateApiKey: (rid: number) => post<any>(`/restaurants/${rid}/platform/api-keys/regenerate`, {}),
};
