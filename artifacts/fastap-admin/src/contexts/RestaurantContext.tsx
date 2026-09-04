import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { restaurantAuth, orders as ordersApi, tables as tablesApi, menu as menuApi, staff as staffApi, rbacApi, featuresApi, type SubscriptionStatus } from "@/lib/api";
import { canAccessPath, hasPermission, type RolePermissions } from "@/lib/restaurantRbac";
import { normalizeOrderStatus, toApiOrderStatus } from "@/lib/orderStatus";
import { setAppTimezone } from "@/lib/appTimezone";
import { useRestaurantSSE } from "@/hooks/useRestaurantSSE";
import { PLATFORM_CURRENCY_SYMBOL } from "@/lib/currency";
import { isRestaurantPublished as checkRestaurantPublished } from "@/lib/restaurantPublication";

export type StaffRole = "owner" | "manager" | "cashier" | "waiter" | "kitchen" | "chef" | "housekeeping" | "reception" | "spa" | "bar" | "finance" | "hr" | "franchise";

/** SSE events that change an order row the panel is displaying. */
const ORDER_CHANGING_EVENTS = new Set([
  "new_order",
  "order_status",
  "order_updated",
  "order_paid",
  "bill_requested",
  "table_cleared",
  "waiter_assigned",
  "housekeeping_assigned",
  "room_service_assigned",
]);

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  email: string;
  mobile: string;
  avatar?: string;
  status: "active" | "on-break" | "offline";
  shift: string;
  joinDate: string;
  performance: number;
  tablesAssigned?: string[];
}

export interface RestaurantInfo {
  id: string;
  name: string;
  slug?: string;
  branch: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  fssaiNumber: string;
  openTime: string;
  closeTime: string;
  totalTables: number;
  totalSeats: number;
  cuisineType: string;
  logo?: string;
  currency?: string;
  businessType?: string;
  isPublished?: boolean;
  publicationStatus?: "Published" | "Draft" | "Pending" | "Disabled" | "Rejected" | "Archived";
  kycStatus?: string;
}

export interface LiveOrder {
  id: string;
  // Shared tab id: same-table follow-up orders carry the first order's id so owner/cashier
  // panels can group a table's separate orders into one combined tab & total.
  tabId?: number;
  tableNo: string;
  waiter: string;
  items: { name: string; qty: number; price: number; subtotal?: number; status: "pending" | "preparing" | "ready"; variant?: string; addons?: { name: string; price: number }[]; customizations?: string[]; notes?: string }[];
  status: "new" | "accepted" | "preparing" | "ready" | "served" | "billed" | "cancelled";
  type: "dine-in" | "takeaway" | "room-service" | "delivery";
  placedAt: Date;
  total: number;
  guests: number;
  specialReq?: string;
  // Payment tracking: how it was paid, who, and whether it's a room order.
  // Undefined until someone actually collects — a fresh order has no method yet.
  paymentMethod?: string;
  paymentStatus?: string;
  customerName?: string;
  customerPhone?: string;
  roomNumber?: string;
  // Full payment breakdown (populated when a bill is collected) so the owner can click a
  // payment and see the UPI id / UTR, who collected it and from which panel.
  upiId?: string;
  utr?: string;
  collectedBy?: string;
  collectedFrom?: string;
}

export interface TableInfo {
  id: string;
  number: string;
  capacity: number;
  section: string;
  status: "free" | "occupied" | "reserved" | "cleaning" | "blocked" | "billing";
  waiter?: string;
  orderId?: string;
  guestCount?: number;
  occupiedSince?: Date;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  cost: number;
  dietary: "veg" | "non-veg" | "vegan";
  available: boolean;
  featured: boolean;
  spiceLevel: number;
  prepTime: number;
  calories: number;
  image?: string;
  description: string;
  ingredients: string[];
  allergens: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitCost: number;
  supplier: string;
  lastRestocked: string;
  category: string;
  expiryDate?: string;
}

interface RestaurantContextValue {
  restaurant: RestaurantInfo;
  restaurantId: number | null;
  currentStaff: StaffMember | null;
  staffList: StaffMember[];
  liveOrders: LiveOrder[];
  tables: TableInfo[];
  menuItems: MenuItem[];
  inventory: InventoryItem[];
  isLoading: boolean;
  authBootstrapping: boolean;
  subscription: SubscriptionStatus | null;
  requiresSubscription: boolean;
  canSubscribe: boolean;
  hasActiveSubscription: boolean;
  isRestaurantPublished: boolean;
  refreshSubscription: () => Promise<void>;
  setCurrentStaff: (s: StaffMember | null) => void;
  setRestaurantId: (id: number) => void;
  setRestaurantInfo: (info: Partial<RestaurantInfo>) => void;
  updateOrderStatus: (orderId: string, status: LiveOrder["status"]) => void;
  updateTableStatus: (tableId: string, status: TableInfo["status"]) => void;
  toggleMenuItemAvailability: (itemId: string) => void;
  addOrder: (order: LiveOrder) => void;
  refreshOrders: () => Promise<void>;
  refreshTables: () => Promise<void>;
  loginStaff: (data: {
    restaurantId?: number;
    email?: string;
    password?: string;
    phone?: string;
    otp?: string;
  }) => Promise<{ staff: any; restaurant: any; subscription?: any; requiresSubscription?: boolean }>;
  applyAuthResult: (result: { staff: any; restaurant: any }) => void;
  logoutStaff: () => Promise<void>;
  rolePermissions: RolePermissions;
  canAccess: (path: string) => boolean;
  checkPermission: (key: string) => boolean;
  refreshFeaturePaths: () => Promise<void>;
}

const DEFAULT_RESTAURANT: RestaurantInfo = {
  id: "",
  name: "",
  branch: "Main Branch",
  address: "",
  phone: "",
  email: "",
  gstNumber: "",
  fssaiNumber: "",
  openTime: "11:00",
  closeTime: "23:00",
  totalTables: 0,
  totalSeats: 0,
  cuisineType: "",
  currency: PLATFORM_CURRENCY_SYMBOL,
};

function mapApiOrder(o: any): LiveOrder {
  const items = Array.isArray(o.items) ? o.items.map((i: any) => ({
    name: typeof i === "object" ? (i.name || i.menuItemName || "Item") : String(i),
    qty: typeof i === "object" ? (i.quantity || i.qty || 1) : 1,
    price: typeof i === "object" ? (parseFloat(i.price) || 0) : 0,
    // line subtotal (pre-tax) as stored on the order — the POS uses this to bill the
    // exact order amount instead of re-deriving from a possibly-stale unit price.
    subtotal: typeof i === "object" ? (parseFloat(i.subtotal) || 0) : 0,
    status: "pending" as const,
    // Carry the extras through so the owner can see them in Order Details.
    variant: typeof i === "object" ? (i.variant || undefined) : undefined,
    addons: typeof i === "object" && Array.isArray(i.addons) ? i.addons.map((a: any) => ({ name: String(a?.name ?? a), price: parseFloat(a?.price) || 0 })) : undefined,
    customizations: typeof i === "object" && Array.isArray(i.customizations) ? i.customizations.map((c: any) => String(c)) : undefined,
    notes: typeof i === "object" ? (i.notes || i.specialInstructions || undefined) : undefined,
  })) : [];
  const tableName = o.tableName ?? o.table_name;
  const tableId = o.tableId ?? o.table_id;
  return {
    id: String(o.id),
    tabId: typeof o.metadata?.tabId === "number" ? o.metadata.tabId : undefined,
    tableNo: tableName
      ? String(tableName)
      : tableId != null && tableId !== ""
        ? `T-${tableId}`
        : "Walk-in",
    waiter: o.waiterName || o.waiter_name || o.customerName || "Staff",
    items,
    status: normalizeOrderStatus(o.status),
    type: (o.type === "dine_in" ? "dine-in" : o.type === "takeaway" ? "takeaway" : o.type === "delivery" ? "delivery" : o.type === "room_service" ? "room-service" : "dine-in") as LiveOrder["type"],
    placedAt: new Date(o.createdAt),
    total: parseFloat(String(o.total)),
    guests: o.guestCount ?? o.guest_count ?? 1,
    specialReq: o.notes || undefined,
    paymentMethod: o.paymentMethod || o.payment_method || (o.metadata?.payment?.method) || undefined,
    paymentStatus: o.paymentStatus || o.payment_status || undefined,
    customerName: o.customerName || o.customer_name || undefined,
    customerPhone: o.customerPhone || o.customer_phone || undefined,
    roomNumber: (o.metadata && (o.metadata.roomNumber || o.metadata.room_number)) || o.roomNumber || undefined,
    upiId: o.metadata?.payment?.upiId || undefined,
    utr: o.metadata?.payment?.utr || o.metadata?.utr || undefined,
    collectedBy: o.metadata?.payment?.collectedBy || undefined,
    collectedFrom: o.metadata?.payment?.collectedFrom || undefined,
  };
}

function mapApiTable(t: any): TableInfo {
  return {
    id: String(t.id),
    number: t.name || t.number || `T-${t.id}`,
    capacity: t.capacity || 4,
    section: t.zone || t.section || "Main Hall",
    status: (t.status === "available" ? "free" : t.status === "occupied" ? "occupied" : t.status || "free") as TableInfo["status"],
    waiter: t.currentWaiterName || t.current_waiter_name || undefined,
    guestCount: t.currentGuestCount || t.current_guest_count || undefined,
    occupiedSince: t.occupiedSince || t.occupied_since ? new Date(t.occupiedSince || t.occupied_since) : undefined,
  };
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [restaurantId, setRestaurantIdState] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem("fastap_restaurant_id");
      if (!stored) return null;
      const parsed = Number.parseInt(stored, 10);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  });
  const [restaurant, setRestaurant] = useState<RestaurantInfo>(DEFAULT_RESTAURANT);
  const [currentStaff, setCurrentStaffState] = useState<StaffMember | null>(() => {
    try {
      const stored = localStorage.getItem("fastap_staff");
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem("fastap_staff");
      return null;
    }
  });
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [staffListState, setStaffListState] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [requiresSubscription, setRequiresSubscription] = useState(false);
  const [canSubscribe, setCanSubscribe] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
  const [enabledFeaturePaths, setEnabledFeaturePaths] = useState<string[] | null>(null);
  const authGeneration = useRef(0);

  function setCurrentStaff(s: StaffMember | null) {
    setCurrentStaffState(s);
    if (s) localStorage.setItem("fastap_staff", JSON.stringify(s));
    else localStorage.removeItem("fastap_staff");
  }

  function setRestaurantId(id: number) {
    setRestaurantIdState(id);
    localStorage.setItem("fastap_restaurant_id", String(id));
  }

  function setRestaurantInfo(info: Partial<RestaurantInfo>) {
    setRestaurant(prev => ({ ...prev, ...info }));
  }

  async function refreshOrders() {
    if (!restaurantId) return;
    try {
      const data = await ordersApi.list(restaurantId);
      const mapped = Array.isArray(data) ? data.map(mapApiOrder) : [];
      mapped.sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());
      setLiveOrders(mapped);
    } catch {}
  }

  const refreshOrdersRef = useRef(refreshOrders);
  refreshOrdersRef.current = refreshOrders;

  const onSSE = useCallback((event: string) => {
    if (ORDER_CHANGING_EVENTS.has(event)) {
      refreshOrdersRef.current();
    }
  }, []);

  useRestaurantSSE(onSSE, Boolean(restaurantId));

  async function refreshTables() {
    if (!restaurantId) return;
    try {
      const data = await tablesApi.list(restaurantId);
      setTables(Array.isArray(data) ? data.map(mapApiTable) : []);
    } catch {}
  }

  async function refreshStaff() {
    if (!restaurantId) return;
    try {
      const data = await staffApi.list(restaurantId);
      if (Array.isArray(data)) {
        setStaffListState(data.map((s: any): StaffMember => ({
          id: String(s.id),
          name: s.name,
          role: (s.role || "waiter") as StaffRole,
          email: s.email || "",
          mobile: s.phone || "",
          status: s.isActive || s.is_active ? "active" : "offline",
          shift: s.shift ? String(s.shift).charAt(0).toUpperCase() + String(s.shift).slice(1) : "—",
          joinDate: s.createdAt ? new Date(s.createdAt).toISOString().split("T")[0] : "",
          performance: s.performanceScore ?? s.performance_score ?? 0,
        })));
      }
    } catch {}
  }

  function applySubscriptionFromAuth(payload?: {
    subscription?: SubscriptionStatus;
    requiresSubscription?: boolean;
    canSubscribe?: boolean;
  }) {
    if (payload?.subscription) setSubscription(payload.subscription);
    setRequiresSubscription(Boolean(payload?.requiresSubscription));
    if (payload?.canSubscribe != null) setCanSubscribe(payload.canSubscribe);
  }

  async function refreshSubscription() {
    try {
      const res = await restaurantAuth.subscription.status();
      setSubscription(res.subscription);
      setRequiresSubscription(res.requiresSubscription);
      setCanSubscribe(res.canSubscribe);
    } catch {
      setSubscription(null);
      setRequiresSubscription(true);
    }
  }

  function applyAuthResult(result: { staff: any; restaurant: any; subscription?: SubscriptionStatus; requiresSubscription?: boolean; canSubscribe?: boolean }) {
    authGeneration.current += 1;
    const r = result.restaurant;
    const s = result.staff;
    setAppTimezone(r?.timezone); // show all dates/times in this restaurant's timezone
    flushSync(() => {
      setRestaurantId(r.id);
      setRestaurant({
        id: String(r.id),
        name: r.name || "Restaurant",
        slug: r.slug || undefined,
        branch: r.address || "Main Branch",
        address: r.address || "",
        phone: r.phone || "",
        email: r.email || "",
        gstNumber: r.gstNumber || "",
        fssaiNumber: r.fssaiNumber || "",
        openTime: "11:00",
        closeTime: "23:00",
        totalTables: 0,
        totalSeats: 0,
        cuisineType: r.businessType || "Restaurant",
        logo: r.logoUrl || undefined,
        currency: PLATFORM_CURRENCY_SYMBOL,
        businessType: r.businessType,
        isPublished: r.isPublished ?? false,
        publicationStatus: r.publicationStatus,
        kycStatus: r.kycStatus,
      });
      setCurrentStaff({
        id: String(s.id),
        name: s.name,
        role: s.role as StaffRole,
        email: s.email || "",
        mobile: s.phone || "",
        status: "active",
        shift: s.shift ? String(s.shift).charAt(0).toUpperCase() + String(s.shift).slice(1) : "—",
        joinDate: new Date().toISOString().split("T")[0],
        performance: s.performanceScore ?? s.performance_score ?? 0,
      });
      setAuthBootstrapping(false);
    });
    applySubscriptionFromAuth(result);
  }

  async function loginStaff(data: {
    restaurantId?: number;
    email?: string;
    password?: string;
    phone?: string;
    otp?: string;
  }) {
    const result = await restaurantAuth.login(data);
    applyAuthResult(result);
    return result;
  }

  async function logoutStaff() {
    try { await restaurantAuth.logout(); } catch {}
    setCurrentStaff(null);
    setRestaurantIdState(null);
    setSubscription(null);
    setRequiresSubscription(false);
    setCanSubscribe(false);
    localStorage.removeItem("fastap_restaurant_id");
    localStorage.removeItem("fastap_staff");
    setLiveOrders([]);
    setTables([]);
  }

  useEffect(() => {
    let cancelled = false;
    const bootGeneration = authGeneration.current;
    (async () => {
      try {
        const me = await restaurantAuth.me();
        if (cancelled || !me?.restaurantId) return;
        authGeneration.current += 1;
        setRestaurantIdState(me.restaurantId);
        localStorage.setItem("fastap_restaurant_id", String(me.restaurantId));
        const r = me.restaurant;
        if (r) {
          setAppTimezone(r.timezone); // restore this restaurant's timezone for date/time display
          setRestaurant({
            id: String(r.id),
            name: r.name || "Restaurant",
            slug: r.slug || undefined,
            branch: r.address || "Main Branch",
            address: r.address || "",
            phone: r.phone || "",
            email: r.email || "",
            gstNumber: "",
            fssaiNumber: "",
            openTime: "11:00",
            closeTime: "23:00",
            totalTables: 0,
            totalSeats: 0,
            cuisineType: r.businessType || "Restaurant",
            logo: r.logoUrl || undefined,
            currency: PLATFORM_CURRENCY_SYMBOL,
            businessType: r.businessType,
            isPublished: r.isPublished ?? false,
            publicationStatus: r.publicationStatus,
            kycStatus: r.kycStatus,
          });
        }
        const s = me.staff;
        if (s) {
          const staffMember: StaffMember = {
            id: String(s.id),
            name: s.name,
            role: (s.role || "waiter") as StaffRole,
            email: "",
            mobile: "",
            status: "active",
            shift: s.shift ? String(s.shift).charAt(0).toUpperCase() + String(s.shift).slice(1) : "—",
            joinDate: new Date().toISOString().split("T")[0],
            performance: s.performanceScore ?? s.performance_score ?? 0,
          };
          setCurrentStaffState(staffMember);
          localStorage.setItem("fastap_staff", JSON.stringify(staffMember));
        }
        if (me.subscription) setSubscription(me.subscription);
        setRequiresSubscription(me.requiresSubscription ?? !me.subscription?.active);
        setCanSubscribe(Boolean(me.canSubscribe));
      } catch {
        if (!cancelled && bootGeneration === authGeneration.current) {
          setCurrentStaffState(null);
          setRestaurantIdState(null);
          localStorage.removeItem("fastap_restaurant_id");
          localStorage.removeItem("fastap_staff");
        }
      } finally {
        if (!cancelled) setAuthBootstrapping(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    rbacApi.get(restaurantId).then(d => {
      if (d?.permissions) setRolePermissions(d.permissions);
    }).catch(() => {});
    featuresApi.getRestaurant(restaurantId).then(d => {
      if (d?.enabledRestaurantPaths) setEnabledFeaturePaths(d.enabledRestaurantPaths);
    }).catch(() => setEnabledFeaturePaths(null));
  }, [restaurantId]);

  const checkPermission = useCallback((key: string) => {
    const role = currentStaff?.role || "waiter";
    return hasPermission(role, rolePermissions, key);
  }, [currentStaff?.role, rolePermissions]);

  const refreshFeaturePaths = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const d = await featuresApi.getRestaurant(restaurantId);
      if (d?.enabledRestaurantPaths) {
        setEnabledFeaturePaths(d.enabledRestaurantPaths);
      }
    } catch {
      setEnabledFeaturePaths(null);
    }
  }, [restaurantId]);

  const canAccess = useCallback((path: string) => {
    const role = currentStaff?.role || "waiter";
    return canAccessPath(role, rolePermissions, path);
  }, [currentStaff?.role, rolePermissions]);

  useEffect(() => {
    if (!restaurantId) return;
    setIsLoading(true);
    Promise.all([
      refreshOrders(),
      refreshTables(),
      refreshStaff(),
    ]).finally(() => setIsLoading(false));

    const refreshLiveData = () => {
      refreshOrders();
      refreshTables();
      refreshStaff();
    };
    const interval = setInterval(refreshLiveData, 15_000);
    return () => clearInterval(interval);
  }, [restaurantId]);

  function updateOrderStatus(orderId: string, status: LiveOrder["status"]) {
    setLiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    if (restaurantId) {
      const apiStatus = toApiOrderStatus(status);
      ordersApi.update(restaurantId, parseInt(orderId), { status: apiStatus }).catch(() => {});
    }
  }

  function updateTableStatus(tableId: string, status: TableInfo["status"]) {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, status } : t));
  }

  function toggleMenuItemAvailability(itemId: string) {
    setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, available: !m.available } : m));
  }

  function addOrder(order: LiveOrder) {
    setLiveOrders(prev => [order, ...prev]);
  }

  return (
    <RestaurantContext.Provider value={{
      restaurant,
      restaurantId,
      currentStaff,
      staffList: staffListState,
      liveOrders,
      tables,
      menuItems,
      inventory: [],
      isLoading,
      authBootstrapping,
      subscription,
      requiresSubscription,
      canSubscribe,
      hasActiveSubscription: Boolean(subscription?.active),
      isRestaurantPublished: checkRestaurantPublished(restaurant),
      refreshSubscription,
      setCurrentStaff,
      setRestaurantId,
      setRestaurantInfo,
      updateOrderStatus,
      updateTableStatus,
      toggleMenuItemAvailability,
      addOrder,
      refreshOrders,
      refreshTables,
      loginStaff,
      applyAuthResult,
      logoutStaff,
      rolePermissions,
      canAccess,
      checkPermission,
      refreshFeaturePaths,
    }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error("useRestaurant must be used within RestaurantProvider");
  return ctx;
}
