import { createContext, useContext, useState, useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { resolveGuestSlug } from "@/lib/guestDemo";
import { publicApi } from "@/lib/api";
import {
  parseEntryFromUrl, persistEntryContext, getDeviceId, clearEntryContext,
  detectAccessMethodClient, detectServiceModeClient,
  type SmartEntryState,
} from "@/lib/smartEntry";
import { ORDER_TYPE_MAP, type OrderTypeId, type OrderMetadata, type CourseTimingId } from "@/lib/orderingCatalog";
import type { FavoriteMeal } from "@/lib/api";
import { queueOfflineOrder, backupCart } from "@/lib/offlineStorage";
import { saveActiveOrder } from "@/lib/activeOrder";

export type DietaryFilter = "all" | "veg" | "non-veg" | "vegan" | "jain" | "gluten-free" | "keto" | "sugar-free" | "organic" | "nut-free" | "dairy-free";

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  customizations: string[];
  addons: { name: string; price: number }[];
  specialInstructions?: string;
  course: "starter" | "main" | "dessert" | "beverage";
}

export interface Order {
  id: string;
  restaurantName: string;
  items: CartItem[];
  status: "received" | "accepted" | "preparing" | "ready" | "serving" | "delivered" | "cancelled" | "pending" | "completed";
  total: number;
  tableNo: string;
  placedAt: Date;
  estimatedTime: number;
  waiterName?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  avatar?: string;
  tier: "silver" | "gold" | "platinum" | "diamond" | "vip-elite";
  points: number;
  walletBalance: number;
  cashbackBalance: number;
  walletBalances?: {
    main: number;
    cashback: number;
    refund: number;
    reward: number;
    gift: number;
    membership: number;
  };
  walletTotal?: number;
  diningCredits?: number;
  totalOrders: number;
  isGuest: boolean;
}

export interface WaitlistEntry {
  token: string;
  tokenNumber?: number;
  position: number;
  estimatedWait: number;
  restaurantName: string;
  status?: string;
}

export interface VenueContext {
  restaurantId: number | null;
  restaurantSlug: string;
  restaurantName: string;
  tableId: number | null;
  roomNumber: string | null;
  serviceMode: string;
  entryMethod: string;
  language: string;
  timezone: string;
  branchId: number | null;
  branchName: string | null;
  areas: { id: number; name: string; areaType: string }[];
  areaGroups: SmartEntryState["areaGroups"];
}

interface UserContextValue {
  cart: CartItem[];
  orders: Order[];
  user: UserProfile | null;
  venue: VenueContext;
  smartEntry: (SmartEntryState & { offline?: boolean }) | null;
  activeRestaurant: string;
  activeTable: string;
  activeSection: string;
  dietaryFilter: DietaryFilter;
  waitlist: WaitlistEntry | null;
  authLoading: boolean;
  venueLoading: boolean;
  venueAttempted: boolean;
  venueError: string | null;
  addToCart: (item: Omit<CartItem, "id">) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  placeOrder: (opts?: PlaceOrderOptions) => Promise<Order>;
  reorderFromOrder: (order: Order) => void;
  repeatFavorite: (meal: FavoriteMeal) => void;
  favorites: FavoriteMeal[];
  saveFavoriteFromCart: () => void;
  removeFavorite: (menuItemId: string) => void;
  setUser: (u: UserProfile | null) => void;
  refreshUser: () => Promise<void>;
  loadVenue: (slug: string, params?: VenueLoadParams) => Promise<void>;
  joinShareSession: (shareCode: string) => Promise<{ session: unknown }>;
  createFamilySession: () => Promise<{ shareCode: string }>;
  setDietaryFilter: (f: DietaryFilter) => void;
  setActiveRestaurant: (name: string) => void;
  setActiveTable: (table: string) => void;
  setActiveSection: (section: string) => void;
  setWaitlist: (w: WaitlistEntry | null) => void;
  cartTotal: number;
  cartCount: number;
}

export interface VenueLoadParams {
  table?: string;
  room?: string;
  section?: string;
  branch?: string;
  lang?: string;
  entry?: string;
  zone?: string;
  pool?: string;
  spa?: string;
  event?: string;
  parking?: string;
  nfc?: string;
}

export interface PlaceOrderOptions {
  orderType?: OrderTypeId | string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  tip?: number;
  discount?: number;
  couponCode?: string;
  specialRequest?: string;
  guestCount?: number;
  courseTiming?: CourseTimingId;
  allergyInstructions?: string;
  specialFlags?: string[];
  splitBilling?: { enabled: boolean; count: number; perPerson: number };
  splitPayments?: { method: string; amount: number }[];
  partialPayNow?: number;
  advanceAmount?: number;
  scheduledAt?: string;
  groupOrdering?: boolean;
  shareCode?: string;
}

const defaultVenue: VenueContext = {
  restaurantId: null,
  restaurantSlug: "",
  restaurantName: "Restaurant",
  tableId: null,
  roomNumber: null,
  serviceMode: "browse",
  entryMethod: "direct_url",
  language: "en",
  timezone: "Asia/Kolkata",
  branchId: null,
  branchName: null,
  areas: [],
  areaGroups: [],
};

const UserContext = createContext<UserContextValue | null>(null);

function mapApiStatus(status: string): Order["status"] {
  const map: Record<string, Order["status"]> = {
    pending: "received", confirmed: "accepted", accepted: "accepted",
    preparing: "preparing", ready: "ready", serving: "serving",
    delivered: "delivered", completed: "delivered", cancelled: "cancelled",
  };
  return map[status] ?? "received";
}

function buildOrderMetadata(opts: PlaceOrderOptions): OrderMetadata {
  const servingMode = opts.courseTiming === "all_together" ? "simultaneous" : "sequential";
  return {
    courseTiming: opts.courseTiming,
    servingMode,
    splitBilling: opts.splitBilling,
    specialFlags: opts.specialFlags,
    allergyInstructions: opts.allergyInstructions,
    scheduledOrdering: Boolean(opts.scheduledAt),
    groupOrdering: opts.groupOrdering,
    shareCode: opts.shareCode,
  };
}

function buildOrderNotes(opts: PlaceOrderOptions): string | null {
  const parts: string[] = [];
  if (opts.specialRequest) parts.push(opts.specialRequest);
  if (opts.specialFlags?.length) parts.push(`Flags: ${opts.specialFlags.join(", ")}`);
  if (opts.allergyInstructions) parts.push(`Allergy: ${opts.allergyInstructions}`);
  if (opts.courseTiming) parts.push(`Course timing: ${opts.courseTiming}`);
  if (opts.splitBilling?.enabled) parts.push(`Split ${opts.splitBilling.count} ways · ₹${opts.splitBilling.perPerson}/person`);
  if (opts.groupOrdering && opts.shareCode) parts.push(`Group order · Share: ${opts.shareCode}`);
  return parts.length ? parts.join(" | ") : null;
}

function mapOrderFromApi(o: any, restaurantName: string): Order {
  const items: CartItem[] = (Array.isArray(o.items) ? o.items : []).map((i: any, idx: number) => ({
    id: String(i.id ?? idx),
    menuItemId: String(i.menuItemId ?? i.id),
    name: i.name,
    price: parseFloat(String(i.price ?? 0)),
    quantity: i.quantity ?? 1,
    customizations: i.customizations ?? (i.variant ? [i.variant] : []),
    addons: Array.isArray(i.addons) ? i.addons : [],
    specialInstructions: i.notes,
    course: i.course ?? "main",
  }));
  return {
    id: String(o.id),
    restaurantName,
    items,
    status: mapApiStatus(o.status),
    total: parseFloat(String(o.total ?? 0)),
    tableNo: o.tableName ?? "",
    placedAt: new Date(o.createdAt),
    estimatedTime: 20,
    waiterName: o.waiterName ?? undefined,
  };
}

function applyVenueFromApi(data: any, slug: string, params?: VenueLoadParams): { venue: VenueContext; smartEntry: SmartEntryState & { offline?: boolean } } {
  const detection = data.detection ?? {};
  const smartEntry: SmartEntryState & { offline?: boolean } = {
    params: { slug, ...params },
    detection: {
      entryMethod: detection.entryMethod ?? "direct_url",
      serviceMode: detection.serviceMode ?? "browse",
      language: detection.language ?? "en",
      timezone: detection.timezone ?? "Asia/Kolkata",
      branchId: detection.branchId,
      branchName: detection.branchName,
      autoDetection: detection.autoDetection,
    },
    session: data.session ?? null,
    areaGroups: data.areaGroups,
    offline: false,
  };
  persistEntryContext(smartEntry);
  return {
    venue: {
      restaurantId: data.restaurant?.id ?? null,
      restaurantSlug: slug,
      restaurantName: data.restaurant?.name ?? slug,
      tableId: data.table?.id ?? null,
      roomNumber: data.room?.number ?? params?.room ?? null,
      serviceMode: detection.serviceMode ?? "browse",
      entryMethod: detection.entryMethod ?? "direct_url",
      language: detection.language ?? "en",
      timezone: detection.timezone ?? "Asia/Kolkata",
      branchId: detection.branchId ?? data.branch?.id ?? null,
      branchName: detection.branchName ?? data.branch?.name ?? null,
      areas: (data.areas ?? []).map((a: any) => ({ id: a.id, name: a.name, areaType: a.areaType })),
      areaGroups: data.areaGroups ?? [],
    },
    smartEntry,
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [venue, setVenue] = useState<VenueContext>(defaultVenue);
  const [smartEntry, setSmartEntry] = useState<(SmartEntryState & { offline?: boolean }) | null>(null);
  const [activeRestaurant, setActiveRestaurant] = useState("Restaurant");
  const [activeTable, setActiveTable] = useState("");
  const [activeSection, setActiveSection] = useState("");
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>("all");
  const [waitlist, setWaitlist] = useState<WaitlistEntry | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [venueLoading, setVenueLoading] = useState(false);
  const [venueAttempted, setVenueAttempted] = useState(false);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteMeal[]>(() => {
    try {
      const raw = localStorage.getItem("fastap_favorites");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const refreshUser = useCallback(async () => {
    try {
      const data = await publicApi.auth.me();
      if (data?.user) setUser(data.user);
    } catch { /* optional */ }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setAuthLoading(false));
    const saved = localStorage.getItem("fastap_waitlist");
    if (saved) {
      try { setWaitlist(JSON.parse(saved)); } catch { /* ignore */ }
    }
    publicApi.session.restore().then(r => {
      if (r?.cart?.length) setCart(r.cart as CartItem[]);
    }).catch(() => {});
    publicApi.favorites.get().then(r => {
      if (r?.favorites?.length) {
        setFavorites(r.favorites);
        localStorage.setItem("fastap_favorites", JSON.stringify(r.favorites));
      }
    }).catch(() => {});
  }, [refreshUser]);

  const loadVenue = useCallback(async (slug: string, params?: VenueLoadParams) => {
    const normalized = slug?.trim();
    setVenueAttempted(true);
    setVenueError(null);
    if (!normalized) {
      setVenueLoading(false);
      setVenueError(null);
      throw new Error("venue_slug_missing");
    }
    setVenueLoading(true);
    try {
      const data = await publicApi.venue(normalized, params);
      const { venue: v, smartEntry: se } = applyVenueFromApi(data, normalized, params);
      setVenue(v);
      setSmartEntry(se);
      setActiveRestaurant(v.restaurantName);
      if (data.table?.name) setActiveTable(data.table.name);
      if (data.section?.name) setActiveSection(data.section.name);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      const status = (err as { status?: number }).status;
      const isDev = import.meta.env.DEV;
      const onAuth =
        typeof window !== "undefined"
        && window.location.pathname.replace(/\/$/, "").endsWith("/user/auth");
      const notFound =
        status === 404
        || detail.toLowerCase().includes("venue not found")
        || detail.toLowerCase().includes("menu not found");
      if (notFound) {
        clearEntryContext();
        if (!onAuth) setVenueError("venue_not_found");
      } else if (!onAuth) {
        const message = detail
          || (isDev
            ? "Could not load restaurant data. Run: pnpm db:start then pnpm db:setup, then refresh."
            : "Could not load restaurant data. Please check your connection and try again.");
        setVenueError(message);
      }
      throw new Error("venue_load_failed");
    } finally {
      setVenueLoading(false);
    }
  }, []);

  const joinShareSession = useCallback(async (shareCode: string) => {
    const result = await publicApi.session.join(shareCode, getDeviceId());
    if (smartEntry) {
      const next = { ...smartEntry, session: result.session };
      setSmartEntry(next);
      persistEntryContext(next);
    }
    if (result.cart?.length) setCart(result.cart as CartItem[]);
    return result;
  }, [smartEntry]);

  const createFamilySession = useCallback(async () => {
    const result = await publicApi.session.family(venue.restaurantId ?? undefined, activeTable || undefined);
    if (smartEntry) {
      const next = { ...smartEntry, session: result.session };
      setSmartEntry(next);
      persistEntryContext(next);
    }
    return { shareCode: result.shareCode ?? result.session?.shareCode };
  }, [smartEntry, venue.restaurantId, activeTable]);

  useEffect(() => {
    if (cart.length === 0) return;
    backupCart(cart);
    const t = setTimeout(() => {
      publicApi.session.sync(cart, getDeviceId()).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [cart]);

  const addToCart = useCallback((item: Omit<CartItem, "id">) => {
    setCart(prev => {
      const existing = prev.find(c =>
        c.menuItemId === item.menuItemId &&
        JSON.stringify(c.customizations) === JSON.stringify(item.customizations),
      );
      if (existing) {
        return prev.map(c => c.id === existing.id ? { ...c, quantity: c.quantity + item.quantity } : c);
      }
      return [...prev, { ...item, id: `${Date.now()}-${Math.random()}` }];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, qty: number) => {
    setCart(prev => qty <= 0 ? prev.filter(c => c.id !== id) : prev.map(c => c.id === id ? { ...c, quantity: qty } : c));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const placeOrder = useCallback(async (opts: PlaceOrderOptions = {}): Promise<Order> => {
    const apiType = ORDER_TYPE_MAP[opts.orderType as OrderTypeId] ?? opts.orderType?.replace(/-/g, "_") ?? "dine_in";
    const body = {
      restaurantId: venue.restaurantId,
      tableId: venue.tableId,
      tableName: activeTable || (venue.roomNumber ? `Room ${venue.roomNumber}` : null),
      customerName: opts.customerName?.trim() || user?.name,
      customerPhone: opts.customerPhone?.trim() || user?.mobile,
      customerEmail: user?.email,
      type: apiType,
      items: cart.map(c => ({
        menuItemId: parseInt(c.menuItemId, 10),
        quantity: c.quantity,
        unitPrice: c.price,
        addons: c.addons,
        customizations: c.customizations,
        notes: c.specialInstructions,
        course: c.course,
      })),
      notes: buildOrderNotes(opts),
      metadata: {
        ...buildOrderMetadata(opts),
        ...(venue.roomNumber ? { roomNumber: venue.roomNumber } : {}),
      },
      scheduledAt: opts.scheduledAt ?? null,
      paymentMethod: opts.paymentMethod ?? "upi",
      tipAmount: opts.tip ?? 0,
      discountAmount: opts.discount ?? 0,
      couponCode: opts.couponCode,
      guestCount: opts.guestCount ?? (opts.splitBilling?.enabled ? opts.splitBilling.count : 1),
      splitPayments: opts.splitPayments,
      partialPayNow: opts.partialPayNow,
      advanceAmount: opts.advanceAmount,
      nfcTagId: smartEntry?.detection?.entryMethod === "nfc" ? "nfc-tap" : undefined,
    };

    if (!venue.restaurantId) {
      throw new Error("Restaurant not loaded. Check API connection.");
    }
    if (cart.length === 0) {
      throw new Error("Cart is empty");
    }

    try {
      const created = await publicApi.createOrder(body);
      const order = mapOrderFromApi(created, activeRestaurant);
      setOrders(prev => [order, ...prev]);
      setCart([]);
      // Remember this as the guest's active order so a close+reopen returns to it (with timer).
      saveActiveOrder({ id: String(order.id), slug: venue.restaurantSlug ?? null, table: activeTable ?? null, at: Date.now() });
      return order;
    } catch (err) {
      const pendingId = `pending-${Date.now()}`;
      const total = cart.reduce((sum, i) => sum + (i.price + i.addons.reduce((a, b) => a + b.price, 0)) * i.quantity, 0);
      queueOfflineOrder({
        id: pendingId,
        body: body as Record<string, unknown>,
        createdAt: new Date().toISOString(),
        restaurantName: activeRestaurant,
        total,
        itemCount: cart.length,
      });
      throw err instanceof Error ? err : new Error("Order failed — saved for offline sync");
    }
  }, [cart, activeRestaurant, activeTable, venue, user]);

  const reorderFromOrder = useCallback((order: Order) => {
    setCart(order.items.map((item, idx) => ({
      ...item,
      id: `reorder-${Date.now()}-${idx}`,
    })));
  }, []);

  const repeatFavorite = useCallback((meal: FavoriteMeal) => {
    addToCart({
      menuItemId: meal.menuItemId,
      name: meal.name,
      price: meal.price,
      quantity: 1,
      customizations: meal.customizations ?? [],
      addons: meal.addons ?? [],
      course: (meal.course as CartItem["course"]) ?? "main",
    });
  }, [addToCart]);

  const saveFavoriteFromCart = useCallback(() => {
    if (cart.length === 0) return;
    const primary = cart[0];
    const meal: FavoriteMeal = {
      menuItemId: primary.menuItemId,
      name: primary.name,
      price: primary.price,
      customizations: primary.customizations,
      addons: primary.addons,
      course: primary.course,
    };
    setFavorites(prev => {
      const next = prev.filter(f => f.menuItemId !== meal.menuItemId).concat(meal);
      localStorage.setItem("fastap_favorites", JSON.stringify(next));
      publicApi.favorites.save(next, venue.restaurantId ?? undefined).catch(() => {});
      return next;
    });
  }, [cart, venue.restaurantId]);

  const removeFavorite = useCallback((menuItemId: string) => {
    setFavorites(prev => {
      const next = prev.filter(f => f.menuItemId !== menuItemId);
      localStorage.setItem("fastap_favorites", JSON.stringify(next));
      publicApi.favorites.save(next, venue.restaurantId ?? undefined).catch(() => {});
      return next;
    });
  }, [venue.restaurantId]);

  const cartTotal = cart.reduce((sum, i) => sum + (i.price + i.addons.reduce((a, b) => a + b.price, 0)) * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const setWaitlistPersist = useCallback((w: WaitlistEntry | null) => {
    setWaitlist(w);
    if (w) localStorage.setItem("fastap_waitlist", JSON.stringify(w));
    else localStorage.removeItem("fastap_waitlist");
  }, []);

  return (
    <UserContext.Provider value={{
      cart, orders, user, venue, smartEntry, activeRestaurant, activeTable, activeSection, dietaryFilter, waitlist,
      authLoading,
      addToCart, removeFromCart, updateQuantity, clearCart, placeOrder,
      reorderFromOrder, repeatFavorite, favorites, saveFavoriteFromCart, removeFavorite,
      setUser, refreshUser, loadVenue, joinShareSession, createFamilySession,
      setDietaryFilter, setActiveRestaurant, setActiveTable, setActiveSection,
      setWaitlist: setWaitlistPersist,
      cartTotal, cartCount,
      venueLoading, venueAttempted, venueError,
    }}>
      <UserVenueSync loadVenue={loadVenue}>{children}</UserVenueSync>
    </UserContext.Provider>
  );
}

/** Sync slug/table/room from URL into venue context (must live inside UserProvider). */
function subscribeLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("pushState", onStoreChange);
  window.addEventListener("replaceState", onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("pushState", onStoreChange);
    window.removeEventListener("replaceState", onStoreChange);
  };
}

function getGuestLocationKey() {
  return `${window.location.pathname}${window.location.search}`;
}

function UserVenueSync({
  children,
  loadVenue,
}: {
  children: ReactNode;
  loadVenue: (slug: string, params?: VenueLoadParams) => Promise<void>;
}) {
  const [location] = useAppLocation();
  const locationKey = useSyncExternalStore(subscribeLocation, getGuestLocationKey, () => "");

  useEffect(() => {
    if (!location.startsWith("/user")) return;
    const params = parseEntryFromUrl();
    const slug = resolveGuestSlug();
    if (!slug) {
      loadVenue("", {
        table: params.table,
        room: params.room,
        section: params.section,
      }).catch(() => {});
      return;
    }
    loadVenue(slug, {
      table: params.table,
      room: params.room,
      section: params.section,
    }).catch(() => {});
  }, [location, locationKey, loadVenue]);

  return <>{children}</>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
