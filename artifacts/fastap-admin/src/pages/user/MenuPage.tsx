/**
 * The menu.
 *
 * Where a diner spends their whole visit, so it is the screen that had to stop reading as
 * a website at a phone width. What changed:
 *
 *  - one sticky head — venue, search, category rail — instead of a header, a separate
 *    search block and a category strip that each scrolled away independently;
 *  - dishes as full-bleed rows, not a two-column grid of tiles that clipped the name at
 *    three words and left the description unreadable;
 *  - the dish detail is the shell's bottom sheet, not a centre-anchored modal whose add
 *    button sat in the middle of the screen;
 *  - the basket is the shell's floating cart bar above the tab bar, so it never covers
 *    the last dish and it says what is in the basket and what it comes to.
 *
 * Every pricing rule here is load-bearing and unchanged: the guest's screen and the
 * server's invoice have to agree.
 */
import { useState, useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { useLocaleAccessibility } from "@/contexts/LocaleAccessibilityContext";
import { useOffline } from "@/contexts/OfflineContext";
import { publicApi } from "@/lib/api";
import { TABLE_INTERACTION_REQUESTS } from "@/lib/smartDiningCatalog";
import { useWaiterCalls, WaiterCallBanner, SERVICE_REQUEST_ICONS } from "@/components/user/WaiterCallStatus";
import { GuestEmpty } from "@/components/user/GuestApiState";
import { resolveGuestSlug, withGuestQuery } from "@/lib/guestDemo";
import { loadActiveOrders, removeActiveOrder } from "@/lib/activeOrder";
import { MenuDishRow } from "@/components/user/MenuDishRow";
import { MenuFilterSheet } from "@/components/user/MenuFilterSheet";
import { DishSheet, type DishSelection } from "@/components/user/DishSheet";
import { AppImage } from "@/components/shared/AppImage";
import {
  courseOf, mapApiItem, matchesDietaryFilter, sortMenuItems,
  type CategoryGroup, type MenuCategoryTab, type MenuDisplayItem, type MenuSort,
} from "@/components/user/menuModel";
import {
  GuestAppScreen, GuestAppBar, GuestAppBarButton, GuestBody, GuestSection,
  GuestList, GuestRow, GuestTableChip, GuestCartBar, GuestSheet, guestHomePath,
} from "@/components/user/GuestShell";
import {
  Search, Bell, Info, Check, Sparkles, SlidersHorizontal, CloudOff, Loader2, Tag,
  ChevronRight,
} from "lucide-react";

/** The guest's active (unbilled) rounds, restored on reopen so each can be tracked. */
type ActiveOrderInfo = {
  id: string;
  total: number;
  status: string;
  waiterName?: string;
  at: number;
  items: {
    menuItemId?: number | string;
    id?: number | string;
    name: string;
    quantity?: number;
    qty?: number;
    customizations?: string[];
    addons?: unknown[];
    variant?: string;
  }[];
};

const OPEN_ORDER = ["new", "pending", "accepted", "confirmed", "preparing", "ready", "serving", "served"];

function orderStatusLabel(status: string): string {
  if (status === "ready") return "Ready to serve";
  if (status === "preparing") return "Being prepared";
  if (status === "served" || status === "serving") return "On the way / served";
  if (status === "accepted" || status === "confirmed") return "Accepted by kitchen";
  return "Sent to kitchen";
}

export default function MenuPage() {
  const [, navigate] = useAppLocation();
  const {
    addToCart, cart, updateQuantity, cartCount, cartTotal,
    activeRestaurant, activeTable, dietaryFilter, setDietaryFilter,
    setActiveRestaurant, setActiveTable, loadVenue, venue,
  } = useUser();

  // The marketing preview menu is VIEW-ONLY: a visitor who arrived from the landing page
  // with no venue of their own can browse but not order.
  //
  // "No venue of their own" is the whole test, and it has to consider the context saved
  // when the guest scanned — not just the current URL. Comparing the raw ?slug (which is
  // absent on a reload or a link that dropped its query) against the demo alias put real
  // diners into the read-only preview and told them ordering was disabled while they were
  // sitting at a table. resolveGuestSlug returns null only when neither the URL nor the
  // saved scan knows a real venue.
  // The server decides this, not the URL — see VenueContext.isDemo.
  const isDemo = venue.isDemo;
  const clockClosed = venue.hours.hoursPublished && !venue.hours.isOpen;
  const orderingBlocked = clockClosed && venue.hours.ordersAllowed !== true;

  const { t, announce } = useLocaleAccessibility();
  const { loadMenuWithCache, isOnline, pendingOrders } = useOffline();
  const [menuFromCache, setMenuFromCache] = useState(false);

  const [activeOrders, setActiveOrders] = useState<ActiveOrderInfo[]>([]);
  // The latest round — used for the row's ordered-qty / remove controls.
  const activeOrder = activeOrders.length ? activeOrders[activeOrders.length - 1] : null;

  async function refreshActiveOrder() {
    const refs = loadActiveOrders();
    if (refs.length === 0) { setActiveOrders([]); return; }
    const fetched = await Promise.all(refs.map(async ref => {
      try {
        const o = await publicApi.getOrder(ref.id);
        const status = String(o?.status ?? "").toLowerCase();
        if (!o || !OPEN_ORDER.includes(status)) { removeActiveOrder(ref.id); return null; }
        return {
          id: String(o.id),
          total: parseFloat(String(o.total)) || 0,
          status,
          waiterName: o.waiterName ? String(o.waiterName) : undefined,
          at: ref.at ?? 0,
          items: Array.isArray(o.items) ? o.items : [],
        } as ActiveOrderInfo;
      } catch { return null; }
    }));
    setActiveOrders(fetched.filter((x): x is ActiveOrderInfo => x !== null).sort((a, b) => a.at - b.at));
  }
  useEffect(() => { refreshActiveOrder(); /* eslint-disable-next-line */ }, []);

  // How many of a menu item the guest has in the running order — counting EVERY line of the
  // dish (plain and customised), so a dish ordered with extras/removals also shows the
  // "ordered" −.
  function orderedQtyOf(itemId: string) {
    if (!activeOrder) return 0;
    return activeOrder.items
      .filter(i => String(i.menuItemId ?? i.id) === String(itemId))
      .reduce((s, i) => s + (i.quantity ?? i.qty ?? 1), 0);
  }
  async function adjustOrdered(itemId: string, delta: number) {
    if (!activeOrder) return;
    try { await publicApi.adjustOrderItem(activeOrder.id, Number(itemId), delta); await refreshActiveOrder(); }
    catch { /* order may be locked (already prepared) */ await refreshActiveOrder(); }
  }

  const [activeCategory, setActiveCategory] = useState("all");
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup>("all");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<MenuDisplayItem | null>(null);
  const [showServicePanel, setShowServicePanel] = useState(false);
  const [waiterSent, setWaiterSent] = useState<string | null>(null);
  const [waiterError, setWaiterError] = useState<string | null>(null);
  // Whether anybody has picked the table's calls up. Polled only while the service
  // sheet is open, so a guest reading the menu is not making a request every 15s.
  const { calls: waiterCalls, refresh: refreshWaiterCalls } = useWaiterCalls(
    venue.restaurantId, activeTable, showServicePanel,
  );
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [sortBy, setSortBy] = useState<MenuSort>("default");
  const [menuItems, setMenuItems] = useState<MenuDisplayItem[]>([]);
  const [categories, setCategories] = useState<MenuCategoryTab[]>([{ id: "all", label: "All", group: "all" }]);
  const [featuredItems, setFeaturedItems] = useState<MenuDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [promo, setPromo] = useState<{ title: string; detail: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = resolveGuestSlug(venue.restaurantSlug) || params.get("slug") || "";
    if (!slug) {
      setLoading(false);
      setMenuError("no_venue");
      return;
    }
    const venueParams = {
      table: params.get("table") || undefined,
      room: params.get("room") || undefined,
      section: params.get("section") || undefined,
      branch: params.get("branch") || undefined,
      lang: params.get("lang") || undefined,
      entry: params.get("entry") || params.get("via") || undefined,
      zone: params.get("zone") || undefined,
      pool: params.get("pool") || undefined,
      spa: params.get("spa") || undefined,
      event: params.get("event") || undefined,
      parking: params.get("parking") || undefined,
      nfc: params.get("nfc") || undefined,
    };
    const table = venueParams.table;
    setLoading(true);
    setMenuError("");
    // The menu load below owns the visible error; venue metadata failing on its
    // own only costs the header, so it must not blank the page.
    loadVenue(slug, venueParams).catch(() => undefined);
    loadMenuWithCache(slug, table, () => publicApi.menu(slug, table))
      .then(({ data, fromCache }) => {
        setMenuFromCache(fromCache);
        applyMenuData(data);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "";
        const status = (err as { status?: number }).status;
        if (status === 404 || msg.toLowerCase().includes("not found")) {
          setMenuError("not_found");
        } else {
          setMenuError("connection");
        }
        setMenuItems([]);
        setCategories([{ id: "all", label: "All", group: "all" }]);
        setFeaturedItems([]);
      }).finally(() => setLoading(false));

    function applyMenuData(data: Record<string, unknown>) {
      const restaurant = data.restaurant as { name?: string } | undefined;
      const scannedTable = data.table as { name?: string } | undefined;
      const restaurantRating = parseFloat(String(data.avgRating ?? 0)) || 0;
      if (restaurant?.name) setActiveRestaurant(restaurant.name);
      if (scannedTable?.name) setActiveTable(scannedTable.name);
      const cats = Array.isArray(data.categories) ? data.categories : [];
      setCategories([
        { id: "all", label: "All", group: "all" },
        ...cats.map((c: Record<string, unknown>) => ({
          id: String(c.slug || c.id),
          label: String(c.name),
          group: String(c.categoryGroup || "food"),
        })),
      ]);
      const items = cats.flatMap((c: Record<string, unknown>) => {
        const catSlug = String(c.slug || c.id);
        const catGroup = String(c.categoryGroup || "food");
        return ((c.items as Record<string, unknown>[]) || []).map(i => mapApiItem(i, catSlug, catGroup, restaurantRating));
      });
      setMenuItems(items);
      const featured = Array.isArray(data.featuredItems)
        ? data.featuredItems.map((i: Record<string, unknown>) => {
            const cat = cats.find((c: Record<string, unknown>) => c.id === i.categoryId);
            return mapApiItem(
              i,
              String(cat?.slug || i.categoryId || "main-course"),
              String(cat?.categoryGroup || "food"),
              restaurantRating,
            );
          })
        : [];
      setFeaturedItems(featured.length > 0 ? featured : items.filter(i => i.badges.includes("bestseller") || i.chefRecommended));

      // The promo strip used to be the words "Happy Hour · 3–6 PM / 20% off beverages",
      // hardcoded and shown to every venue, discounting nothing. Drive it from the
      // venue's own live campaigns, and show nothing when there are none.
      const today = new Date().toISOString().slice(0, 10);
      const campaigns = (Array.isArray(data.activeCampaigns) ? data.activeCampaigns : []) as Record<string, unknown>[];
      const live = campaigns.find(c =>
        c.isActive !== false
        && (!c.startDate || String(c.startDate).slice(0, 10) <= today)
        && (!c.endDate || String(c.endDate).slice(0, 10) >= today),
      );
      setPromo(live ? { title: String(live.name ?? ""), detail: String(live.description ?? "") } : null);
    }
    // Deliberately NOT keyed on the venue slug: `loadVenue` writes that slug back into
    // context, so depending on it would re-run this effect from its own side effect and
    // refetch the menu forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveRestaurant, setActiveTable, loadVenue]);

  const visibleCategories = categories.filter(
    c => c.id === "all" || categoryGroup === "all" || c.group === categoryGroup,
  );

  const filteredItems = sortMenuItems(
    menuItems.filter(item => {
      const groupMatch = categoryGroup === "all" || item.categoryGroup === categoryGroup;
      const catMatch = activeCategory === "all" || item.category === activeCategory;
      const dietMatch = matchesDietaryFilter(item.dietaryTags, dietaryFilter);
      const q = search.trim().toLowerCase();
      const searchMatch = !q || item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
      return groupMatch && catMatch && dietMatch && searchMatch;
    }),
    sortBy,
  );

  function handleAdd(
    item: MenuDisplayItem,
    customizations: string[],
    addons: { name: string; price: number }[],
    instructions?: string,
    unitPrice?: number,
    variant?: string,
    quantity = 1,
  ) {
    if (isDemo) return; // demo menu is view-only — ordering disabled
    // Everything the guest taps + on goes into the CART (even when they already have an
    // order running). Nothing is sent to the kitchen until they tap Place Order — which
    // submits a new order for the table. This is what stops a tap from silently placing
    // an order on its own.
    //
    // A chosen portion replaces the base price, matching how the server prices the line.
    const portionPrice = variant ? item.variants.find(v => v.name === variant)?.price : undefined;
    const linePrice = unitPrice ?? (portionPrice ?? item.price) + addons.reduce((s, a) => s + a.price, 0);
    addToCart({
      menuItemId: item.id,
      name: item.name,
      price: linePrice,
      quantity,
      customizations,
      addons,
      variant,
      specialInstructions: instructions,
      course: courseOf(item.category),
      allergens: item.allergens,
      prepTime: item.prepTime,
    });
  }

  function handleSheetAdd(item: MenuDisplayItem, sel: DishSelection) {
    handleAdd(item, sel.customizations, sel.addons, sel.instructions, sel.unitPrice, sel.variant, sel.quantity);
    announce(`${item.name} added to cart`);
  }

  async function callWaiter(request: string, type?: string) {
    if (!venue.restaurantId) {
      setWaiterError("We do not know which restaurant you are in. Scan the table QR and try again.");
      setTimeout(() => setWaiterError(null), 4000);
      return;
    }
    try {
      await publicApi.waiterCall({
        restaurantId: venue.restaurantId,
        tableId: venue.tableId,
        tableName: activeTable,
        type: type ?? request.toLowerCase().replace(/\s+/g, "_"),
        message: request,
      });
    } catch {
      // "Waiter notified" for a call that never left the phone leaves a guest
      // waiting for someone who was never told.
      setWaiterError("We could not reach the staff. Please try again.");
      setTimeout(() => setWaiterError(null), 4000);
      return;
    }
    setWaiterSent(request);
    refreshWaiterCalls();
    setTimeout(() => setWaiterSent(null), 3000);
    setShowServicePanel(false);
  }

  const activeFilterCount = [
    categoryGroup !== "all",
    dietaryFilter !== "all",
    activeCategory !== "all",
    sortBy !== "default",
  ].filter(Boolean).length;

  function clearAllFilters() {
    setCategoryGroup("all");
    setDietaryFilter("all");
    setActiveCategory("all");
    setSortBy("default");
  }

  const cartPath = withGuestQuery("/user/cart", venue, activeTable);

  return (
    <GuestAppScreen withCartBar>
      <GuestAppBar
        title={isDemo ? "Demo menu" : (activeRestaurant || venue.restaurantName || "Menu")}
        subtitle={
          activeTable || venue.roomNumber
            ? <GuestTableChip table={activeTable} room={venue.roomNumber} />
            : undefined
        }
        backFallback={guestHomePath(venue, activeTable)}
        right={
          !isDemo ? (
            <GuestAppBarButton label="Call a waiter" onClick={() => setShowServicePanel(true)}>
              <Bell className="h-4 w-4" />
            </GuestAppBarButton>
          ) : undefined
        }
        below={
          <>
            <div className="mx-auto flex max-w-lg items-center gap-2 px-3 pb-2.5">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder={t("search")}
                  aria-label={t("search")}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                />
              </div>
              <GuestAppBarButton
                label="Filter and sort"
                onClick={() => setShowFilterSheet(true)}
                badge={activeFilterCount}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </GuestAppBarButton>
            </div>

            {/* The category rail rides the sticky head, so it is reachable from anywhere
                in a 200-dish menu without scrolling back to the top. */}
            {visibleCategories.length > 1 && (
              <nav aria-label="Categories" className="border-t border-border">
                <div className="thin-scroll mx-auto flex max-w-lg gap-1.5 overflow-x-auto px-3 py-2">
                  {visibleCategories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      aria-current={activeCategory === cat.id ? "true" : undefined}
                      className={
                        activeCategory === cat.id
                          ? "min-h-9 shrink-0 rounded-pill border border-primary bg-primary px-3.5 text-xs font-semibold text-primary-foreground"
                          : "min-h-9 shrink-0 rounded-pill border border-border bg-card px-3.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </nav>
            )}
          </>
        }
      />

      <GuestBody>
        {/* Trading hours. Nothing anywhere told a guest the venue was shut — the kitchen's
            own opening hours were in the database and unread, so a 4 a.m. order was taken
            in silence. */}
        {clockClosed && (
          <GuestSection>
            <div className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-subtle p-3" role="status">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-warning">
                  {orderingBlocked ? "Kitchen closed" : "Outside kitchen hours"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {venue.hours.demoOpenMessage ?? venue.hours.message}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {orderingBlocked
                    ? `You can browse the menu — ordering opens at ${venue.hours.openTime}.`
                    : "You can still place a demo order — the kitchen may not be staffed."}
                </p>
              </div>
            </div>
          </GuestSection>
        )}

        {/* Said out loud rather than hidden: a cached menu can be out of date, and an
            order queued on a dead connection has not reached the kitchen. */}
        {(!isOnline || menuFromCache || pendingOrders.length > 0) && (
          <GuestSection>
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3" role="status">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 text-xs text-muted-foreground">
                {menuFromCache && <p>Showing the menu saved on this phone — prices may have changed.</p>}
                {pendingOrders.length > 0 && (
                  <p className="mt-0.5">
                    {pendingOrders.length} order{pendingOrders.length === 1 ? "" : "s"} still waiting to be sent.
                    The kitchen has not seen {pendingOrders.length === 1 ? "it" : "them"} yet.
                  </p>
                )}
                {!isOnline && !menuFromCache && <p>You are offline.</p>}
              </div>
            </div>
          </GuestSection>
        )}

        {promo && (
          <GuestSection>
            <div className="flex items-center gap-3 rounded-md border border-border border-l-2 border-l-primary bg-card px-4 py-3">
              <Tag className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-primary">{promo.title}</p>
                {promo.detail && <p className="mt-0.5 text-sm font-medium">{promo.detail}</p>}
              </div>
            </div>
          </GuestSection>
        )}

        {/* Rounds already with the kitchen, each tappable through to its own tracking. */}
        {activeOrders.length > 0 && !isDemo && (
          <GuestSection title={activeOrders.length > 1 ? "Your orders" : "Your order"}>
            <GuestList>
              {activeOrders.map((ord, i) => (
                <GuestRow
                  key={ord.id}
                  icon={
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                    </span>
                  }
                  title={`${activeOrders.length > 1 ? `Round ${i + 1}` : "Sent to the kitchen"} · ${orderStatusLabel(ord.status)}`}
                  detail={`${ord.items.length} item${ord.items.length === 1 ? "" : "s"} · ₹${ord.total} · ${ord.waiterName ? `waiter: ${ord.waiterName}` : "waiter being assigned"}`}
                  trailing={<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  onClick={() => navigate(`/user/order/${ord.id}`)}
                />
              ))}
            </GuestList>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Want more? Add dishes with <b className="text-foreground">Add</b>, then tap
              {" "}<b className="text-foreground">Place order</b> in the cart — it reaches your table as a new round.
            </p>
          </GuestSection>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading the menu…</p>
          </div>
        )}

        {menuError && !loading && (
          menuError === "not_found" || menuError === "no_venue" ? (
            <GuestEmpty
              title="No menu data found"
              message="This restaurant has no menu yet, or the venue link is invalid. Try another venue or ask staff for a QR code."
            />
          ) : (
            <GuestEmpty
              title="Could not load menu"
              message="Please check your connection and try again."
            />
          )
        )}

        {!loading && !menuError && (
          <>
            {/* Chef's specials — the 2-4 dishes the owner marked "Featured". */}
            {featuredItems.length > 0 && !search && (
              <GuestSection
                title="Chef's specials"
                action={<span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" />Must-try</span>}
              >
                <div className="thin-scroll -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                  {featuredItems.slice(0, 6).map(item => (
                    <button
                      key={`special-${item.id}`}
                      type="button"
                      onClick={() => { setSelectedItem(item); announce(`${item.name} selected`); }}
                      className="w-36 shrink-0 snap-start overflow-hidden rounded-md border border-border bg-card text-left"
                    >
                      <span className="block h-24 w-full bg-muted">
                        <AppImage
                          src={item.imageUrl}
                          alt={item.name}
                          fallbackId={item.id}
                          category={item.category}
                          className="h-full w-full"
                          iconFallback="restaurant_menu"
                        />
                      </span>
                      <span className="block px-2.5 py-2">
                        <span className="block truncate text-xs font-semibold leading-tight">{item.name}</span>
                        <span className="mt-0.5 block text-[13px] font-semibold tabular-nums">₹{item.price}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </GuestSection>
            )}

            <GuestSection
              title={`${filteredItems.length} ${filteredItems.length === 1 ? "dish" : "dishes"}`}
              action={
                search ? (
                  <button type="button" onClick={() => setSearch("")} className="text-xs font-medium text-primary">
                    Clear search
                  </button>
                ) : activeFilterCount > 0 ? (
                  <button type="button" onClick={clearAllFilters} className="text-xs font-medium text-primary">
                    Clear filters
                  </button>
                ) : undefined
              }
            >
              {filteredItems.length > 0 ? (
                // Full-bleed rows: the name gets the width it needs and the add control
                // sits on the right edge where a thumb already is.
                <div className="-mx-4 divide-y divide-border border-y border-border bg-card">
                  {filteredItems.map(item => {
                    // The +/- on a row only build the CART (add / remove) — nothing is
                    // ordered yet. The guest reviews the cart and taps "Place order".
                    const line = cart.find(c => c.menuItemId === item.id && (!c.customizations || c.customizations.length === 0));
                    const qty = line?.quantity ?? 0;
                    return (
                      <MenuDishRow
                        key={item.id}
                        item={item}
                        readOnly={isDemo}
                        quantity={qty}
                        orderedQty={activeOrder ? orderedQtyOf(item.id) : 0}
                        onRemoveOrdered={e => { e.stopPropagation(); adjustOrdered(item.id, -1); }}
                        onOpen={() => { setSelectedItem(item); announce(`${item.name} selected`); }}
                        onAdd={e => { e.stopPropagation(); handleAdd(item, [], []); announce(`${item.name} added to cart`); }}
                        onIncrement={e => { e.stopPropagation(); handleAdd(item, [], []); }}
                        onDecrement={e => { e.stopPropagation(); if (line) updateQuantity(line.id, qty - 1); }}
                      />
                    );
                  })}
                </div>
              ) : (
                <GuestEmpty
                  title="No dishes found"
                  message={search || activeFilterCount > 0
                    ? "Try a different search or reset the filters."
                    : "This venue has no live dishes yet. Ask staff to publish items in Menu Management."}
                  actionLabel={search || activeFilterCount > 0 ? "Reset filters" : undefined}
                  onAction={search || activeFilterCount > 0 ? () => { setSearch(""); clearAllFilters(); } : undefined}
                />
              )}
            </GuestSection>

            {isDemo && (
              <p className="mt-5 text-center text-xs text-muted-foreground">
                This is a demo menu — for viewing only. Ordering is disabled.
              </p>
            )}
          </>
        )}
      </GuestBody>

      {/* The basket, above the tab bar, never covering the last dish. */}
      {!isDemo && (
        <GuestCartBar
          count={cartCount}
          total={cartTotal}
          onClick={() => navigate(cartPath)}
          disabled={orderingBlocked}
          disabledLabel={venue.hours.openTime ? `Opens ${venue.hours.openTime}` : "Kitchen closed"}
        />
      )}

      {waiterError && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-[55] mx-auto w-fit max-w-[90vw] rounded-md border border-danger-border bg-danger-subtle px-4 py-2.5 text-sm font-medium text-foreground shadow-lg"
        >
          {waiterError}
        </div>
      )}
      {waiterSent && (
        <div
          role="status"
          className="fixed inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-[55] mx-auto flex w-fit max-w-[90vw] items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm shadow-lg"
        >
          <Check className="h-4 w-4 shrink-0 text-success" />
          {/* Was "Waiter notified!", which claims a person has seen it. The request is
              with the floor; whether anyone picked it up is shown in the sheet. */}
          <span>{waiterSent} — sent to the floor</span>
        </div>
      )}

      <GuestSheet
        open={showServicePanel}
        onClose={() => setShowServicePanel(false)}
        title="Request service"
        description={
          activeOrder?.waiterName
            ? `${activeOrder.waiterName} is serving your table.`
            : "Tap a request and it goes to the floor for your table."
        }
        size="tall"
      >
        {waiterCalls.length > 0 && (
          <div className="mb-4">
            <WaiterCallBanner calls={waiterCalls} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TABLE_INTERACTION_REQUESTS.map(r => {
            const RequestIcon = SERVICE_REQUEST_ICONS[r.type] ?? Bell;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => callWaiter(r.label, r.type)}
                className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:bg-accent"
              >
                <RequestIcon className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-center text-xs leading-tight break-words">{r.label}</span>
              </button>
            );
          })}
        </div>
      </GuestSheet>

      <MenuFilterSheet
        open={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        categoryGroup={categoryGroup}
        setCategoryGroup={setCategoryGroup}
        dietaryFilter={dietaryFilter}
        setDietaryFilter={setDietaryFilter}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        sortBy={sortBy}
        setSortBy={setSortBy}
        categories={categories}
        activeCount={activeFilterCount}
        onClear={clearAllFilters}
      />

      <DishSheet
        item={selectedItem}
        open={selectedItem !== null}
        readOnly={isDemo}
        onClose={() => setSelectedItem(null)}
        onAdd={handleSheetAdd}
      />
    </GuestAppScreen>
  );
}
