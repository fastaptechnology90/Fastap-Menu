/**
 * The cart.
 *
 * It was twelve stacked cards — group ordering, scheduling, course management, special
 * requests, split, partial, advance, favourites — with the basket itself somewhere in the
 * middle and the total near the bottom of a very long scroll. A diner adding two dosas had
 * to scroll past nine settings they will never touch to find out what they owed.
 *
 * Now: what you ordered, what it costs, and Place order. Everything else that a venue
 * genuinely offers is still here, one tap away in the "More options" sheet, so nothing
 * the client paid for has been dropped.
 *
 * The money is unchanged. The line price already carries the portion and every add-on;
 * GST, discount, tip, split, partial and advance all still come from `computeBillQuote`,
 * and the server prices the order from `menuItemId` regardless of what this screen shows.
 */
import { useState, useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { withGuestQuery } from "@/lib/guestDemo";
import { useOffline } from "@/contexts/OfflineContext";
import { publicApi, type UpsellSuggestion } from "@/lib/api";
import {
  CART_PICKUP_ORDER_TYPES, COURSE_TIMING_OPTIONS, SPECIAL_REQUEST_TAGS,
  serviceModeToOrderType, type CourseTimingId, type OrderTypeId,
} from "@/lib/orderingCatalog";
import { PAYMENT_MODES, tipPresetsFor, computeBillQuote } from "@/lib/paymentCatalog";
import { GuestIcon } from "@/components/user/GuestIcon";
import {
  GuestAppScreen, GuestAppBar, GuestAppBarButton, GuestBody, GuestSection,
  GuestList, GuestRow, GuestTableChip, GuestSheet, GuestActionBar, GuestPrimaryButton,
  guestHomePath,
} from "@/components/user/GuestShell";
import {
  Plus, Minus, Trash2, Tag, X,
  CreditCard, Smartphone, Wallet, Banknote, Nfc, Users,
  Clock, CheckCircle, ShoppingBag, Share2, Sparkles, RotateCcw, Calendar, Heart,
  QrCode, Building2, Percent, Utensils, Info, CloudOff, UtensilsCrossed,
  SlidersHorizontal, Loader2,
} from "lucide-react";

const MODE_ICONS: Record<string, typeof Smartphone> = {
  upi: Smartphone, card: CreditCard, wallet: Wallet, nfc: Nfc, cash: Banknote, qr: QrCode, netbanking: Building2,
};

function paymentMethods(walletTotal?: number) {
  return PAYMENT_MODES.map(m => ({
    id: m.id,
    label: m.label,
    icon: MODE_ICONS[m.id] ?? Smartphone,
    sub: m.id === "wallet" && walletTotal != null ? `Balance: ₹${walletTotal}` : m.desc,
  }));
}

/** A labelled block inside the "More options" sheet. */
function SheetBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-1">
      <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The on/off control the advanced blocks share. */
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={on
        ? "relative h-6 w-11 shrink-0 rounded-pill bg-primary transition-colors"
        : "relative h-6 w-11 shrink-0 rounded-pill bg-muted transition-colors"}
    >
      <span
        className={on
          ? "absolute left-[22px] top-0.5 h-5 w-5 rounded-full bg-card transition-all"
          : "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-card transition-all"}
      />
    </button>
  );
}

export default function CartPage() {
  const [, navigate] = useAppLocation();
  const {
    cart, updateQuantity, removeFromCart, cartTotal, cartCount, placeOrder,
    user, activeTable, venue, smartEntry, orders,
    reorderFromOrder, repeatFavorite, favorites, saveFavoriteFromCart,
    createFamilySession, joinShareSession,
  } = useUser();
  const { pendingOrders, isOnline } = useOffline();
  const [queuedOffline, setQueuedOffline] = useState(false);
  // Clock-closed is honest; ordering is only blocked when the server says so
  // (`ordersAllowed !== true`). Local/dev may still take orders after hours.
  const clockClosed = venue.hours.hoursPublished && !venue.hours.isOpen;
  const orderingBlocked = clockClosed && venue.hours.ordersAllowed !== true;

  /**
   * What is in this basket, and how long it will take.
   *
   * The allergy box below asks the guest to "list all allergens and severity" while the
   * screen itself knew the allergens of every dish in the basket and said nothing. And
   * `menu_items.prepTime` — recorded per dish — reached no screen at all, so nobody was
   * ever told whether their round was five minutes off or twenty-five. The kitchen works
   * a round in parallel, so the wait is the slowest dish, not the sum.
   */
  const cartAllergens = [...new Set(cart.flatMap(i => i.allergens ?? []))].filter(Boolean);
  const longestPrep = cart.reduce((max, i) => Math.max(max, i.prepTime ?? 0), 0);

  const [orderType, setOrderType] = useState<OrderTypeId>(() =>
    venue.roomNumber ? "room-service" : activeTable ? "dine-in" : "takeaway",
  );
  // Cash first — without gateway keys, UPI/card/etc. on this screen only mark intent;
  // the kitchen still gets the order, but nothing is charged online.
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [onlineCheckoutReady, setOnlineCheckoutReady] = useState(false);
  const [payCatalogKnown, setPayCatalogKnown] = useState(false);
  const [guestName, setGuestName] = useState(user?.name ?? "");
  const [guestPhone, setGuestPhone] = useState(user?.mobile ?? "");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [tip, setTip] = useState(0);
  const [splitBilling, setSplitBilling] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [partialEnabled, setPartialEnabled] = useState(false);
  const [partialPayNow, setPartialPayNow] = useState("");
  const [advanceEnabled, setAdvanceEnabled] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [specialFlags, setSpecialFlags] = useState<string[]>([]);
  const [allergyInstructions, setAllergyInstructions] = useState("");
  const [courseTiming, setCourseTiming] = useState<CourseTimingId>("starters_first");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [groupCode, setGroupCode] = useState("");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [upsells, setUpsells] = useState<UpsellSuggestion[]>([]);
  const [upsellError, setUpsellError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [groupError, setGroupError] = useState("");
  const [placeError, setPlaceError] = useState("");
  const [couponRefused, setCouponRefused] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    publicApi.payments.catalog()
      .then((c: { onlineCheckoutReady?: boolean; clientConfig?: { demoMode?: boolean } | null }) => {
        if (cancelled) return;
        const ready = c?.onlineCheckoutReady === true && c?.clientConfig?.demoMode !== true;
        setOnlineCheckoutReady(ready);
        setPayCatalogKnown(true);
        if (!ready) setPaymentMethod("cash");
      })
      .catch(() => {
        if (cancelled) return;
        // Fail closed: no catalog means we cannot promise online pay.
        setOnlineCheckoutReady(false);
        setPayCatalogKnown(true);
        setPaymentMethod("cash");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activeTable) {
      setOrderType("dine-in");
      return;
    }
    // Keep whatever the scan actually resolved to. Collapsing everything that was not
    // drive-in into "takeaway" filed room service, poolside, spa, bar, lounge and
    // cabana orders as takeaway — so a guest ordering to their room was told to come
    // and collect it, and the order never reached room service.
    if (venue.roomNumber) {
      setOrderType("room-service");
      return;
    }
    setOrderType(serviceModeToOrderType(venue.serviceMode, smartEntry?.params?.zone));
  }, [activeTable, venue.serviceMode, venue.roomNumber, smartEntry?.params?.zone]);

  useEffect(() => {
    const courses = [...new Set(cart.map(c => c.course))];
    const cartItemIds = cart.map(c => parseInt(c.menuItemId, 10)).filter(n => !Number.isNaN(n));
    if (!venue.restaurantId) {
      setUpsells([]);
      setUpsellError("");
      return;
    }
    publicApi.ai.upsell({ restaurantId: venue.restaurantId, cartCourses: courses, cartItemIds })
      .then(r => {
        setUpsells(r.suggestions ?? []);
        setUpsellError("");
      })
      .catch(() =>
        publicApi.suggestUpsell({ restaurantId: venue.restaurantId!, cartCourses: courses })
          .then(r => {
            setUpsells(r.suggestions ?? []);
            setUpsellError("");
          })
          .catch(e => {
            // Empty suggestions used to look like "no ideas" when the API was down.
            setUpsells([]);
            setUpsellError(e instanceof Error ? e.message : "Could not load suggestions.");
          }),
      );
  }, [cart, venue.restaurantId]);

  const subtotal = cartTotal;
  const discount = appliedCoupon?.discount ?? 0;
  const tipAmount = tip;
  const quote = computeBillQuote({
    subtotal,
    discount,
    tip: tipAmount,
    splitCount: splitBilling ? splitCount : undefined,
    partialPayNow: partialEnabled && partialPayNow ? parseFloat(partialPayNow) : undefined,
    advanceAmount: advanceEnabled && advanceAmount ? parseFloat(advanceAmount) : undefined,
  });
  const grandTotal = quote.grandTotal;
  const perPerson = quote.splitPerPerson ?? 0;

  async function applyCoupon() {
    setCouponError("");
    if (!venue.restaurantId) {
      setCouponError("Venue not loaded — refresh and try again");
      return;
    }
    try {
      const result = await publicApi.validateCoupon({ restaurantId: venue.restaurantId, code: coupon, subtotal });
      setAppliedCoupon({ code: result.code, discount: result.discount });
    } catch (e: unknown) {
      setCouponError(e instanceof Error ? e.message : "Invalid coupon");
    }
  }

  function toggleFlag(flag: string) {
    setSpecialFlags(p => p.includes(flag) ? p.filter(f => f !== flag) : [...p, flag]);
  }

  async function startGroupOrder() {
    try {
      const r = await createFamilySession();
      setShareCode(r.shareCode ?? null);
    } catch {
      setGroupError("Could not start group order — try again");
    }
  }

  async function joinGroup() {
    setGroupError("");
    if (!groupCode.trim()) {
      setGroupError("Enter the code the other person is showing you");
      return;
    }
    try {
      await joinShareSession(groupCode.trim().toUpperCase());
    } catch (e) {
      // A wrong code used to be swallowed outright, so "Join" was indistinguishable
      // from a broken button.
      setGroupError(e instanceof Error ? e.message : "That code did not work — check it and try again");
    }
  }

  async function handlePlaceOrder() {
    setPlaceError("");
    // Placing an order into a closed kitchen produced a ticket nobody was there to
    // cook and a guest left waiting for food that was never coming.
    if (orderingBlocked) {
      setPlaceError(venue.hours.message);
      return;
    }
    setPlacing(true);
    try {
      const order = await placeOrder({
        orderType,
        customerName: guestName,
        customerPhone: guestPhone,
        paymentMethod,
        tip: tipAmount,
        discount,
        couponCode: appliedCoupon?.code,
        specialRequest,
        specialFlags,
        allergyInstructions,
        courseTiming,
        scheduledAt: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        splitBilling: splitBilling ? { enabled: true, count: splitCount, perPerson } : undefined,
        partialPayNow: partialEnabled && partialPayNow ? parseFloat(partialPayNow) : undefined,
        advanceAmount: advanceEnabled && advanceAmount ? parseFloat(advanceAmount) : undefined,
        groupOrdering: Boolean(shareCode),
        shareCode: shareCode ?? undefined,
        guestCount: splitBilling ? splitCount : 1,
      });
      const isQueued = String(order.id).startsWith("pending-");
      setQueuedOffline(isQueued);
      // A coupon that was live when it was typed can be spent by someone else, or
      // expire, before the order is sent. The server says so; a guest who was shown a
      // discount and then charged full price has to be told why.
      const refused = (order as { couponNotApplied?: string }).couponNotApplied;
      if (refused) setAppliedCoupon(null);
      setCouponRefused(refused ?? "");
      setShowSuccess(true);
      // A guest who was shown a discount and then charged full price needs long enough
      // to read why before the page moves on.
      setTimeout(() => navigate(isQueued ? "/user/offline" : `/user/order/${order.id}`), refused ? 5000 : 1800);
    } catch (e) {
      // A failed order was swallowed entirely: the spinner stopped and nothing else
      // happened, while the basket was quietly queued for offline sync behind the
      // guest's back. They sat waiting for food nobody was cooking.
      setPlaceError(
        e instanceof Error
          ? `${e.message} Your basket is saved — you can try again, or ask a member of staff.`
          : "We could not send your order. Your basket is saved — please try again or ask a member of staff.",
      );
      setPlacing(false);
    }
  }

  const lastOrder = orders[0];
  const menuPath = withGuestQuery("/user/menu", venue, activeTable);

  if (showSuccess) {
    return (
      <GuestAppScreen>
        <GuestAppBar title={queuedOffline ? "Saved on this phone" : "Order placed"} showBack={false} />
        <GuestBody className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-success-border bg-success-subtle">
            <CheckCircle className="h-10 w-10 text-success" />
          </span>
          <h2 className="font-display text-xl font-semibold">
            {queuedOffline ? "Order saved offline" : "Sent to the kitchen"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {queuedOffline
              ? "It will be sent the moment you are back online. The kitchen has not seen it yet."
              : "Taking you to live tracking…"}
          </p>
          {/* The one thing on this screen that must not be missed: the guest was shown a
              discount and then charged full price, and has to be told why. */}
          {couponRefused && (
            <div className="w-full max-w-sm rounded-md border border-warning-border bg-warning-subtle px-4 py-3 text-sm text-warning">
              {couponRefused} You were charged the full amount — please speak to a member of staff if this looks wrong.
            </div>
          )}
        </GuestBody>
      </GuestAppScreen>
    );
  }

  if (cart.length === 0) {
    return (
      <GuestAppScreen withCartBar>
        <GuestAppBar title="Your order" backFallback={menuPath} />
        <GuestBody>
          <GuestSection>
            <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card px-6 py-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-md bg-muted">
                <ShoppingBag className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
              </span>
              <h2 className="font-display text-base font-semibold">Nothing in the basket yet</h2>
              <p className="max-w-xs text-sm text-muted-foreground">
                Add dishes from the menu and they will show up here.
              </p>
            </div>
          </GuestSection>

          {(lastOrder || favorites.length > 0) && (
            <GuestSection title="Start from something you had before">
              <GuestList>
                {lastOrder && (
                  <GuestRow
                    icon={<RotateCcw className="h-4 w-4" />}
                    title="Reorder your last meal"
                    detail={`${lastOrder.items.length} item${lastOrder.items.length === 1 ? "" : "s"} · ₹${lastOrder.total}`}
                    onClick={() => { reorderFromOrder(lastOrder); navigate(withGuestQuery("/user/cart", venue, activeTable)); }}
                  />
                )}
                {favorites.slice(0, 3).map(f => (
                  <GuestRow
                    key={f.menuItemId}
                    icon={<Heart className="h-4 w-4" />}
                    title={f.name}
                    detail={`₹${f.price}`}
                    onClick={() => { repeatFavorite(f); navigate(withGuestQuery("/user/cart", venue, activeTable)); }}
                  />
                ))}
              </GuestList>
            </GuestSection>
          )}
        </GuestBody>
        <GuestActionBar>
          <GuestPrimaryButton onClick={() => navigate(menuPath)}>
            <UtensilsCrossed className="h-4 w-4" />
            Browse the menu
          </GuestPrimaryButton>
        </GuestActionBar>
      </GuestAppScreen>
    );
  }

  return (
    <GuestAppScreen withCartBar>
      <GuestAppBar
        title="Your order"
        subtitle={
          activeTable || venue.roomNumber
            ? <GuestTableChip table={activeTable} room={venue.roomNumber} />
            : `${cartCount} item${cartCount === 1 ? "" : "s"}`
        }
        backFallback={menuPath}
        right={
          <GuestAppBarButton label="More options" onClick={() => setShowOptions(true)}>
            <SlidersHorizontal className="h-4 w-4" />
          </GuestAppBarButton>
        }
      />

      <GuestBody>
        {(pendingOrders.length > 0 || !isOnline) && (
          <GuestSection>
            <button
              type="button"
              onClick={() => navigate("/user/offline")}
              className="flex w-full items-start gap-2 rounded-md border border-info-border bg-info-subtle p-3 text-left"
            >
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <span className="min-w-0 flex-1 text-xs text-info">
                {!isOnline
                  ? "You are offline. This order will be held on the phone and sent when the connection is back — the kitchen will not see it until then."
                  : `${pendingOrders.length} order${pendingOrders.length === 1 ? "" : "s"} still waiting to be sent.`}
                <span className="mt-0.5 block font-semibold underline">See the queue</span>
              </span>
            </button>
          </GuestSection>
        )}

        {/* The basket itself, first, full bleed. */}
        <GuestSection title={`${cartCount} item${cartCount === 1 ? "" : "s"}`}>
          <div className="-mx-4 divide-y divide-border border-y border-border bg-card">
            {cart.map(item => (
              <div key={item.id} className="flex gap-3 px-4 py-3.5">
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-muted">
                  <GuestIcon id={`course_${item.course}`} className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[9px] capitalize text-muted-foreground">{item.course}</span>
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-medium leading-snug">{item.name}</p>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      aria-label={`Remove ${item.name}`}
                      className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {(item.variant || item.customizations.length > 0 || item.addons.length > 0 || item.specialInstructions) && (
                    <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                      {item.variant && <p>{item.variant}</p>}
                      {item.customizations.length > 0 && <p>{item.customizations.join(", ")}</p>}
                      {item.addons.length > 0 && <p>+ {item.addons.map(a => a.name).join(", ")}</p>}
                      {item.specialInstructions && <p className="text-warning">Note: {item.specialInstructions}</p>}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-3">
                    {/* item.price already includes the portion and every add-on. */}
                    <span className="text-sm font-semibold tabular-nums">₹{item.price * item.quantity}</span>
                    <div className="flex h-9 items-center gap-1 rounded-md border border-border bg-card px-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        aria-label={`One fewer ${item.name}`}
                        className="flex h-7 w-8 items-center justify-center rounded-sm text-primary"
                      >
                        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label={`One more ${item.name}`}
                        className="flex h-7 w-8 items-center justify-center rounded-sm text-primary"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => navigate(menuPath)}
              className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              Add more dishes
            </button>
          </div>

          {/* How long the round takes. `prepTime` is recorded per dish and reached no
              screen, so nobody was ever told whether their food was five minutes away or
              twenty-five. The kitchen works a round in parallel, so it is the slowest
              dish, not the sum of them. */}
          {longestPrep > 0 && !orderingBlocked && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              About {longestPrep} minutes in the kitchen once the order is accepted.
            </p>
          )}
        </GuestSection>

        {/* What is actually in the basket, said by the screen rather than asked of the
            guest. The dishes' own allergens travel on the cart line. */}
        {cartAllergens.length > 0 && (
          <GuestSection>
            <div className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-subtle p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-warning">This order contains</p>
                <p className="mt-0.5 text-xs capitalize text-muted-foreground">{cartAllergens.join(", ")}</p>
              </div>
            </div>
          </GuestSection>
        )}

        {upsellError && (
          <p className="text-xs text-danger px-1">{upsellError}</p>
        )}
        {upsells.length > 0 && (
          <GuestSection title="Goes well with this">
            <GuestList>
              {upsells.slice(0, 3).map(u => (
                <GuestRow
                  key={`${u.menuItemId}-${u.name}`}
                  icon={<Sparkles className="h-4 w-4" />}
                  title={u.name}
                  detail={u.reason}
                  onClick={() => navigate(menuPath)}
                />
              ))}
            </GuestList>
          </GuestSection>
        )}

        <GuestSection title="Promo code">
          {appliedCoupon ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-success-border bg-success-subtle px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-success">{appliedCoupon.code} applied</p>
                <p className="text-xs text-muted-foreground">Saving ₹{appliedCoupon.discount}</p>
              </div>
              <button
                type="button"
                onClick={() => setAppliedCoupon(null)}
                aria-label="Remove promo code"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={coupon}
                  onChange={e => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  aria-label="Promo code"
                  className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm uppercase text-foreground placeholder:normal-case placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={applyCoupon}
                className="h-11 shrink-0 rounded-md border border-primary bg-card px-4 text-sm font-semibold text-primary"
              >
                Apply
              </button>
            </div>
          )}
          {couponError && <p className="mt-1.5 text-xs text-danger">{couponError}</p>}
        </GuestSection>

        <GuestSection title="Add a tip">
          {/* A share of the bill, not a flat rupee ladder. On a ₹45 tea the smallest flat
              tip offered was 44%; on a ₹5,000 dinner the largest was 3%. */}
          <div className="flex flex-wrap gap-2">
            {tipPresetsFor(Math.max(0, subtotal - discount)).map(({ percent, amount }) => (
              <button
                key={percent}
                type="button"
                onClick={() => setTip(amount)}
                aria-pressed={tip === amount}
                className={tip === amount
                  ? "min-h-11 min-w-[4.5rem] flex-1 rounded-md border border-primary bg-primary text-xs font-semibold text-primary-foreground"
                  : "min-h-11 min-w-[4.5rem] flex-1 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground"}
              >
                {percent === 0 ? "None" : (
                  <>
                    {percent}%
                    <span className="block text-[10px] tabular-nums opacity-80">₹{amount}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </GuestSection>

        {/* The total the guest is about to agree to, in full. */}
        <GuestSection title="Bill">
          <div className="rounded-md border border-border bg-card px-4 py-3 text-sm">
            {[
              { label: "Subtotal", value: `₹${subtotal}` },
              { label: "CGST (2.5%)", value: `₹${quote.gst.cgst}` },
              { label: "SGST (2.5%)", value: `₹${quote.gst.sgst}` },
              appliedCoupon && { label: `Discount (${appliedCoupon.code})`, value: `-₹${discount}`, green: true },
              tip > 0 && { label: "Tip", value: `₹${tipAmount}` },
              quote.partialPayNow != null && { label: "Pay now (partial)", value: `₹${quote.partialPayNow}` },
              quote.advanceAmount != null && { label: "Advance", value: `₹${quote.advanceAmount}` },
              scheduleEnabled && scheduledAt && { label: "Scheduled for", value: new Date(scheduledAt).toLocaleString() },
            ].filter(Boolean).map((row: { label: string; value: string; green?: boolean }) => (
              <div key={row.label} className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={row.green ? "font-semibold tabular-nums text-success" : "tabular-nums"}>{row.value}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">₹{grandTotal}</span>
            </div>
            {splitBilling && (
              <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                ₹{perPerson} each, split {splitCount} ways
              </p>
            )}
          </div>
        </GuestSection>

        <GuestSection title="How you want it">
          {activeTable && orderType === "dine-in" && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-primary bg-accent px-3 py-2.5">
              <Utensils className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">Dine-in at your table</p>
                <p className="text-[11px] text-muted-foreground">Table {activeTable} — staff will serve you here</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {CART_PICKUP_ORDER_TYPES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOrderType(t.id)}
                aria-pressed={orderType === t.id}
                className={orderType === t.id
                  ? "flex min-h-12 items-center gap-2 rounded-md border border-primary bg-accent px-3 py-2.5 text-xs font-semibold text-primary"
                  : "flex min-h-12 items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-xs font-medium text-muted-foreground"}
              >
                <GuestIcon id={t.id} className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 text-left leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
          {activeTable && orderType !== "dine-in" && (
            <button
              type="button"
              onClick={() => setOrderType("dine-in")}
              className="mt-2 min-h-11 w-full rounded-md border border-primary bg-card text-xs font-medium text-primary"
            >
              Back to dine-in at Table {activeTable}
            </button>
          )}
        </GuestSection>

        <GuestSection title="Pay with">
          {payCatalogKnown && !onlineCheckoutReady && (
            <p role="status" className="mb-2 rounded-md border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning">
              Online payment is not live yet. Order goes to the kitchen — settle in cash at the table or counter.
            </p>
          )}
          <GuestList>
            {paymentMethods(user?.walletTotal ?? user?.walletBalance).map(m => {
              const needsGateway = m.id !== "cash";
              const blocked = needsGateway && !onlineCheckoutReady;
              const detail = blocked
                ? (m.id === "qr" ? "Scan-to-pay is not available yet" : "Not live yet — pay at the counter")
                : (m.id === "cash" ? "Pay at table or counter after ordering" : m.sub);
              return (
                <GuestRow
                  key={m.id}
                  icon={<m.icon className={`h-4 w-4 ${blocked ? "opacity-40" : ""}`} />}
                  title={m.label}
                  detail={detail}
                  onClick={blocked ? undefined : () => setPaymentMethod(m.id)}
                  trailing={
                    <span
                      className={paymentMethod === m.id && !blocked
                        ? "h-4 w-4 shrink-0 rounded-full border-4 border-primary"
                        : "h-4 w-4 shrink-0 rounded-full border-2 border-border opacity-40"}
                    />
                  }
                />
              );
            })}
          </GuestList>
        </GuestSection>

        <GuestSection title="Your details">
          <p className="mb-2 text-xs text-muted-foreground">
            So staff can serve you by name and call you if they need to.
          </p>
          <div className="space-y-2">
            <input
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
            <input
              value={guestPhone}
              onChange={e => setGuestPhone(e.target.value.replace(/[^\d+]/g, ""))}
              inputMode="tel"
              placeholder="Phone number"
              aria-label="Phone number"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
          </div>
        </GuestSection>

        {/* Everything a venue offers that most diners never touch. Still here, one tap
            away, instead of nine cards between the basket and the total. */}
        <GuestSection title="Anything else">
          <GuestList>
            <GuestRow
              icon={<Info className="h-4 w-4" />}
              title="Allergies & special requests"
              detail={allergyInstructions || specialFlags.length > 0 || specialRequest ? "Added" : "Tell the kitchen"}
              onClick={() => setShowNotes(true)}
            />
            <GuestRow
              icon={<Clock className="h-4 w-4" />}
              title="Serving order, split, schedule, group"
              detail={COURSE_TIMING_OPTIONS.find(o => o.id === courseTiming)?.label}
              onClick={() => setShowOptions(true)}
            />
            {lastOrder && (
              <GuestRow
                icon={<RotateCcw className="h-4 w-4" />}
                title="Reorder your last meal"
                onClick={() => reorderFromOrder(lastOrder)}
              />
            )}
            <GuestRow
              icon={<Heart className="h-4 w-4" />}
              title="Save this basket as a favourite"
              onClick={saveFavoriteFromCart}
            />
            <GuestRow
              icon={<Percent className="h-4 w-4" />}
              title="Advanced checkout"
              detail={onlineCheckoutReady ? "Split, partial payment, invoices" : "Tips, split & bill details · cash at counter"}
              onClick={() => navigate(withGuestQuery("/user/payment", venue, activeTable))}
            />
          </GuestList>
        </GuestSection>
      </GuestBody>

      <GuestActionBar>
        {placeError && (
          <p role="alert" className="mb-2 rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger">
            {placeError}
          </p>
        )}
        {clockClosed && (
          <p role="status" className="mb-2 rounded-md border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning">
            {venue.hours.demoOpenMessage
              ?? (orderingBlocked
                ? venue.hours.message
                : `Kitchen hours ${venue.hours.openTime ?? "?"}–${venue.hours.closeTime ?? "?"} (${venue.hours.timezone}). Demo ordering is still available.`)}
          </p>
        )}
        <GuestPrimaryButton onClick={handlePlaceOrder} disabled={placing || orderingBlocked}>
          {placing ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Placing order…</>
          ) : orderingBlocked ? (
            <><ShoppingBag className="h-4 w-4" /> Opens at {venue.hours.openTime}</>
          ) : paymentMethod === "cash" || !onlineCheckoutReady ? (
            <><ShoppingBag className="h-4 w-4" /> Place order · pay ₹{grandTotal} at counter</>
          ) : (
            <><ShoppingBag className="h-4 w-4" /> Place order · ₹{grandTotal}</>
          )}
        </GuestPrimaryButton>
      </GuestActionBar>

      {/* Notes for the kitchen. */}
      <GuestSheet
        open={showNotes}
        onClose={() => setShowNotes(false)}
        title="Allergies & special requests"
        description="Anything here reaches the kitchen with your order."
        size="tall"
        footer={
          <GuestPrimaryButton onClick={() => setShowNotes(false)}>Done</GuestPrimaryButton>
        }
      >
        {cartAllergens.length > 0 && (
          <div className="mt-1 flex items-start gap-2 rounded-md border border-warning-border bg-warning-subtle p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-warning">Already in this order: </span>
              <span className="capitalize">{cartAllergens.join(", ")}</span>
            </p>
          </div>
        )}

        <SheetBlock title="Occasion" icon={<Sparkles className="h-4 w-4 text-primary" />}>
          <div className="flex flex-wrap gap-2">
            {SPECIAL_REQUEST_TAGS.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleFlag(tag.flag)}
                aria-pressed={specialFlags.includes(tag.flag)}
                className={specialFlags.includes(tag.flag)
                  ? "min-h-9 rounded-pill border border-primary bg-primary px-3.5 text-xs font-medium text-primary-foreground"
                  : "min-h-9 rounded-pill border border-border bg-card px-3.5 text-xs font-medium text-muted-foreground"}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </SheetBlock>

        <SheetBlock title="Allergies" icon={<Info className="h-4 w-4 text-warning" />}>
          <textarea
            rows={3}
            value={allergyInstructions}
            onChange={e => setAllergyInstructions(e.target.value)}
            placeholder="List every allergen and how severe it is."
            className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
        </SheetBlock>

        <SheetBlock title="Anything else" icon={<Utensils className="h-4 w-4 text-primary" />}>
          <textarea
            rows={3}
            value={specialRequest}
            onChange={e => setSpecialRequest(e.target.value)}
            placeholder="Birthday surprise, anniversary setup, candlelight…"
            className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
        </SheetBlock>
      </GuestSheet>

      {/* Serving order, split, schedule, group — kept, moved out of the way. */}
      <GuestSheet
        open={showOptions}
        onClose={() => setShowOptions(false)}
        title="More options"
        size="full"
        footer={
          <GuestPrimaryButton onClick={() => setShowOptions(false)}>Done</GuestPrimaryButton>
        }
      >
        <SheetBlock title="Serving order" icon={<Clock className="h-4 w-4 text-primary" />}>
          <div className="space-y-2">
            {COURSE_TIMING_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCourseTiming(opt.id)}
                aria-pressed={courseTiming === opt.id}
                className={courseTiming === opt.id
                  ? "w-full rounded-md border border-primary bg-accent px-3 py-2.5 text-left"
                  : "w-full rounded-md border border-border bg-card px-3 py-2.5 text-left"}
              >
                <span className="block text-xs font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{opt.desc}</span>
              </button>
            ))}
          </div>
        </SheetBlock>

        <SheetBlock title="Split the bill" icon={<Users className="h-4 w-4 text-primary" />}>
          <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
            <span className="text-sm">Split between guests</span>
            <Switch on={splitBilling} onChange={setSplitBilling} label="Split the bill" />
          </div>
          {splitBilling && (
            <div className="mt-2 rounded-md border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSplitCount(Math.max(2, splitCount - 1))}
                  aria-label="Fewer people"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="flex-1 text-center text-sm font-semibold tabular-nums">{splitCount} people</span>
                <button
                  type="button"
                  onClick={() => setSplitCount(Math.min(10, splitCount + 1))}
                  aria-label="More people"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-sm">
                <span className="text-muted-foreground">Each person pays </span>
                <span className="font-semibold tabular-nums">₹{perPerson}</span>
              </p>
            </div>
          )}
        </SheetBlock>

        <SheetBlock title="Pay part of it now" icon={<Percent className="h-4 w-4 text-warning" />}>
          <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
            <span className="text-sm">Partial payment</span>
            <Switch on={partialEnabled} onChange={setPartialEnabled} label="Partial payment" />
          </div>
          {partialEnabled && (
            <div className="mt-2">
              <input
                type="number"
                inputMode="numeric"
                value={partialPayNow}
                onChange={e => setPartialPayNow(e.target.value)}
                placeholder={`Pay now (max ₹${grandTotal - 1})`}
                aria-label="Amount to pay now"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none"
              />
              {quote.partialRemaining != null && (
                <p className="mt-1 text-xs text-warning tabular-nums">Remaining: ₹{quote.partialRemaining}</p>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
            <span className="text-sm">Advance payment</span>
            <Switch on={advanceEnabled} onChange={setAdvanceEnabled} label="Advance payment" />
          </div>
          {advanceEnabled && (
            <div className="mt-2">
              <input
                type="number"
                inputMode="numeric"
                value={advanceAmount}
                onChange={e => setAdvanceAmount(e.target.value)}
                placeholder="Advance amount"
                aria-label="Advance amount"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none"
              />
              {quote.balanceDue != null && (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">Balance due: ₹{quote.balanceDue}</p>
              )}
            </div>
          )}
        </SheetBlock>

        <SheetBlock title="Order for later" icon={<Calendar className="h-4 w-4 text-primary" />}>
          <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
            <span className="text-sm">Schedule this order</span>
            <Switch on={scheduleEnabled} onChange={setScheduleEnabled} label="Schedule this order" />
          </div>
          {scheduleEnabled && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              aria-label="Scheduled time"
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none"
            />
          )}
        </SheetBlock>

        <SheetBlock title="Order together" icon={<Share2 className="h-4 w-4 text-primary" />}>
          <button
            type="button"
            onClick={startGroupOrder}
            className="min-h-11 w-full rounded-md border border-primary bg-card text-sm font-semibold text-primary"
          >
            Start a group order
          </button>
          {shareCode && (
            <p className="mt-2 text-xs text-muted-foreground">
              Share code: <strong className="text-foreground">{shareCode}</strong> — friends can join and add to this basket.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={groupCode}
              onChange={e => setGroupCode(e.target.value.toUpperCase())}
              placeholder="Enter a share code"
              aria-label="Share code"
              className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm uppercase placeholder:normal-case focus:border-ring focus:outline-none"
            />
            <button
              type="button"
              onClick={joinGroup}
              className="h-11 shrink-0 rounded-md border border-border bg-card px-4 text-sm font-semibold"
            >
              Join
            </button>
          </div>
          {groupError && <p className="mt-1.5 text-xs text-danger">{groupError}</p>}
        </SheetBlock>

        {favorites.length > 0 && (
          <SheetBlock title="Repeat a favourite" icon={<Heart className="h-4 w-4 text-primary" />}>
            <div className="space-y-2">
              {favorites.map(f => (
                <button
                  key={f.menuItemId}
                  type="button"
                  onClick={() => repeatFavorite(f)}
                  className="flex min-h-11 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-sm"
                >
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-primary tabular-nums">+ ₹{f.price}</span>
                </button>
              ))}
            </div>
          </SheetBlock>
        )}
      </GuestSheet>
    </GuestAppScreen>
  );
}
