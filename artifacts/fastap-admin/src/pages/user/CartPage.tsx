import { useState, useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { GuestHeader } from "@/components/user/GuestUI";
import { useGuestBack } from "@/hooks/useGuestBack";
import { withGuestQuery } from "@/lib/guestDemo";
import { Icon } from "@/components/shared/Icon";
import { useOffline } from "@/contexts/OfflineContext";
import { publicApi, type UpsellSuggestion } from "@/lib/api";
import {
  CART_PICKUP_ORDER_TYPES, COURSE_TIMING_OPTIONS, SPECIAL_REQUEST_TAGS,
  serviceModeToOrderType, type CourseTimingId, type OrderTypeId,
} from "@/lib/orderingCatalog";
import { PAYMENT_MODES, TIP_PRESETS, computeBillQuote } from "@/lib/paymentCatalog";
import {
  Plus, Minus, Trash2, Tag,
  CreditCard, Smartphone, Wallet, Banknote, Nfc, Receipt, Users,
  Clock, CheckCircle, ShoppingBag, Share2, Sparkles, RotateCcw, Calendar, Heart,
  QrCode, Building2, Percent,
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

export default function CartPage() {
  const [, navigate] = useAppLocation();
  const goBack = useGuestBack();
  const {
    cart, updateQuantity, removeFromCart, cartTotal, cartCount, placeOrder,
    user, activeTable, venue, smartEntry, orders,
    reorderFromOrder, repeatFavorite, favorites, saveFavoriteFromCart,
    createFamilySession, joinShareSession,
  } = useUser();
  const { pendingOrders, isOnline } = useOffline();
  const [queuedOffline, setQueuedOffline] = useState(false);

  const [orderType, setOrderType] = useState<OrderTypeId>(() =>
    venue.roomNumber ? "room-service" : activeTable ? "dine-in" : "takeaway",
  );
  const [paymentMethod, setPaymentMethod] = useState("upi");
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
  const [courseMode, setCourseMode] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [groupCode, setGroupCode] = useState("");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [upsells, setUpsells] = useState<UpsellSuggestion[]>([]);
  const [placing, setPlacing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [groupError, setGroupError] = useState("");

  useEffect(() => {
    if (activeTable) {
      setOrderType("dine-in");
      return;
    }
    const mapped = serviceModeToOrderType(venue.serviceMode, smartEntry?.params?.zone);
    setOrderType(mapped === "drive-in" ? "drive-in" : "takeaway");
  }, [activeTable, venue.serviceMode, smartEntry?.params?.zone]);

  useEffect(() => {
    const courses = [...new Set(cart.map(c => c.course))];
    const cartItemIds = cart.map(c => parseInt(c.menuItemId, 10)).filter(n => !Number.isNaN(n));
    if (!venue.restaurantId) {
      setUpsells([]);
      return;
    }
    publicApi.ai.upsell({ restaurantId: venue.restaurantId, cartCourses: courses, cartItemIds })
      .then(r => setUpsells(r.suggestions ?? []))
      .catch(() =>
        publicApi.suggestUpsell({ restaurantId: venue.restaurantId!, cartCourses: courses })
          .then(r => setUpsells(r.suggestions ?? []))
          .catch(() => setUpsells([])),
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
    if (!groupCode.trim()) return;
    try {
      await joinShareSession(groupCode.trim().toUpperCase());
    } catch { /* ignore */ }
  }

  async function handlePlaceOrder() {
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
      setShowSuccess(true);
      setTimeout(() => navigate(isQueued ? "/user/offline" : `/user/order/${order.id}`), 1800);
    } catch {
      setPlacing(false);
    }
  }

  const lastOrder = orders[0];

  if (showSuccess) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-white flex items-center justify-center flex-col gap-4">
        <div className="h-20 w-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold">{queuedOffline ? "Order Saved Offline" : "Order Placed!"}</h2>
        <p className="text-white/50">{queuedOffline ? "Will sync automatically when you're back online…" : "Taking you to live tracking…"}</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-white flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="h-20 w-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Icon name="shopping_cart" size={40} className="text-orange-400/70" />
        </div>
        <h2 className="font-display text-xl font-bold">Your cart is empty</h2>
        <p className="text-white/40 text-sm max-w-xs">Add dishes from the menu to start your order</p>
        {lastOrder && (
          <button onClick={() => { reorderFromOrder(lastOrder); navigate("/user/cart"); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-orange-500/30 text-orange-400 text-sm font-semibold">
            <RotateCcw className="h-4 w-4" /> One-click reorder last meal
          </button>
        )}
        {favorites.length > 0 && (
          <div className="w-full max-w-sm mt-2 space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">Repeat favorites</p>
            {favorites.slice(0, 3).map(f => (
              <button key={f.menuItemId} onClick={() => { repeatFavorite(f); navigate("/user/cart"); }} className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
                <span className="flex items-center gap-2"><Heart className="h-3.5 w-3.5 text-pink-400" />{f.name}</span>
                <span className="text-orange-400">₹{f.price}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => navigate(withGuestQuery("/user/menu", venue, activeTable))} className="guest-btn-primary mt-2 px-6 py-3 text-sm">
          Browse menu
        </button>
      </div>
    );
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-36">
      <GuestHeader
        title="Your order"
        subtitle={`Table ${activeTable} · ${cartCount} items`}
        onBack={goBack}
        actions={lastOrder ? (
          <button type="button" onClick={() => reorderFromOrder(lastOrder)} className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/25 flex items-center gap-1 font-medium">
            <RotateCcw className="h-3 w-3" /> Reorder
          </button>
        ) : undefined}
      />

      {(pendingOrders.length > 0 || !isOnline) && (
        <div className="mx-4 mt-3 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs text-teal-200">
          {!isOnline ? "Offline — order will be queued for sync" : `${pendingOrders.length} order(s) pending sync`}
          {" · "}
          <button onClick={() => navigate("/user/offline")} className="underline">Details</button>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* Order type — table scan defaults to dine-in; pickup options only */}
        <div className="guest-card p-4">
          <p className="menu-filter-label">Order type</p>
          {activeTable && orderType === "dine-in" && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/15 px-3 py-2.5">
              <span className="text-lg">🍽️</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-orange-200">Dine-in at your table</p>
                <p className="text-[11px] text-white/50">Table {activeTable} — staff will serve you here</p>
              </div>
            </div>
          )}
          <p className="mb-2 text-[11px] text-white/45">
            {activeTable ? "Or choose pickup instead:" : "Choose how you want your order:"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CART_PICKUP_ORDER_TYPES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOrderType(t.id)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs border transition-all ${orderType === t.id ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"}`}
              >
                <span className="text-xl">{t.icon}</span>
                <span className="leading-tight text-center font-medium">{t.label}</span>
              </button>
            ))}
          </div>
          {activeTable && orderType !== "dine-in" && (
            <button
              type="button"
              onClick={() => setOrderType("dine-in")}
              className="mt-3 w-full py-2 rounded-xl text-xs font-medium text-orange-300/90 border border-orange-500/25 bg-orange-500/10 hover:bg-orange-500/15 transition-colors"
            >
              ← Back to dine-in at Table {activeTable}
            </button>
          )}
        </div>

        {/* Group / Shared cart */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Share2 className="h-4 w-4 text-violet-400" /> Group & Shared Cart</p>
          <div className="flex gap-2 mb-2">
            <button onClick={startGroupOrder} className="flex-1 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold">
              Start group order
            </button>
            <button onClick={saveFavoriteFromCart} className="px-3 py-2.5 rounded-xl border border-pink-500/30 text-pink-300 text-xs font-semibold flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> Save favorite
            </button>
          </div>
          {shareCode && (
            <p className="text-xs text-violet-300 mb-2">Share code: <strong>{shareCode}</strong> — friends can join to share this cart</p>
          )}
          {groupError && <p className="text-xs text-red-400 mb-2">{groupError}</p>}
          <div className="flex gap-2">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-violet-500/40"
              placeholder="Enter share code to join"
              value={groupCode}
              onChange={e => setGroupCode(e.target.value.toUpperCase())}
            />
            <button onClick={joinGroup} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold">Join</button>
          </div>
        </div>

        {/* AI Upselling & Combo suggestions */}
        {upsells.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-r from-violet-600/15 to-orange-600/10 border border-violet-500/20 p-4">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-400" /> AI Upsell Suggestions</p>
            <div className="space-y-2">
              {upsells.map(u => (
                <button key={`${u.menuItemId}-${u.name}`} onClick={() => navigate(withGuestQuery("/user/menu", venue, activeTable))} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/20 border border-white/10 text-left hover:border-violet-500/30 transition-all">
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-white/40">{u.reason}</p>
                  </div>
                  <span className="text-xs text-violet-400 capitalize">{u.type.replace("_", " ")}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scheduled ordering */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-orange-400" /> Scheduled Ordering</p>
            <button onClick={() => setScheduleEnabled(!scheduleEnabled)} className={`w-10 h-5 rounded-full transition-all ${scheduleEnabled ? "bg-orange-500" : "bg-white/20"} relative`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${scheduleEnabled ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
          {scheduleEnabled && (
            <input
              type="datetime-local"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500/40"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
          )}
        </div>

        {/* Cart Items with course badges */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 divide-y divide-white/5">
          {cart.map(item => (
            <div key={item.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 rounded-xl bg-white/5 flex flex-col items-center justify-center shrink-0">
                  <span className="text-xl">{item.course === "starter" ? "🍢" : item.course === "main" ? "🍛" : item.course === "dessert" ? "🍮" : "🥤"}</span>
                  <span className="text-[9px] text-white/40 capitalize">{item.course}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      {item.customizations.length > 0 && <p className="text-xs text-white/40 mt-0.5">{item.customizations.join(", ")}</p>}
                      {item.addons.length > 0 && <p className="text-xs text-orange-400/70 mt-0.5">+ {item.addons.map(a => a.name).join(", ")}</p>}
                      {item.specialInstructions && <p className="text-xs text-yellow-400/70 mt-0.5">Note: {item.specialInstructions}</p>}
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-400/60 hover:text-red-400 p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-orange-400">₹{(item.price + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity}</span>
                    <div className="flex items-center gap-2 bg-white/5 rounded-lg p-0.5">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-7 w-7 rounded-md bg-white/10 flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-7 w-7 rounded-md bg-orange-500 flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Course Management */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <button onClick={() => setCourseMode(!courseMode)} className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold">Course Management</span>
            </div>
            <span className="text-xs text-white/40">{courseMode ? "▼" : "▶"}</span>
          </button>
          {courseMode && (
            <div className="mt-3 space-y-2">
              {COURSE_TIMING_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setCourseTiming(opt.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs border transition-all ${courseTiming === opt.id ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "border-white/10 bg-white/5 text-white/60 hover:border-orange-500/30"}`}
                >
                  <p className="font-semibold">{opt.label}</p>
                  <p className="text-white/40 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Special Order Features */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <p className="text-sm font-semibold mb-3">Special Order Requests</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {SPECIAL_REQUEST_TAGS.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleFlag(tag.flag)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${specialFlags.includes(tag.flag) ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "border-white/10 bg-white/5 text-white/50"}`}
              >
                {tag.label}
              </button>
            ))}
          </div>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-orange-500/40 resize-none mb-2"
            rows={2}
            placeholder="Allergy instructions — list all allergens and severity..."
            value={allergyInstructions}
            onChange={e => setAllergyInstructions(e.target.value)}
          />
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-orange-500/40 resize-none"
            rows={2}
            placeholder="Birthday surprise details, anniversary setup, candlelight preferences..."
            value={specialRequest}
            onChange={e => setSpecialRequest(e.target.value)}
          />
        </div>

        {/* Coupon */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Tag className="h-4 w-4 text-orange-400" /> Promo Code</p>
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-emerald-400">{appliedCoupon.code} applied!</p>
                <p className="text-xs text-white/40">Saving ₹{appliedCoupon.discount}</p>
              </div>
              <button onClick={() => setAppliedCoupon(null)} className="text-white/30 hover:text-white/60"><XIcon /></button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500/40" placeholder="Enter code" value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} />
              <button onClick={applyCoupon} className="px-4 py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-semibold">Apply</button>
            </div>
          )}
          {couponError && <p className="text-xs text-red-400 mt-1">{couponError}</p>}
        </div>

        {/* Tip */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <p className="text-sm font-semibold mb-3">Add a Tip 🙏</p>
          <div className="flex gap-2">
            {[0, 20, 50, 100, 150].map(t => (
              <button key={t} onClick={() => setTip(t)} className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${tip === t ? "bg-orange-500/20 border-orange-500/40 text-orange-300" : "bg-white/5 border-white/10 text-white/50"}`}>
                {t === 0 ? "None" : `₹${t}`}
              </button>
            ))}
          </div>
        </div>

        {/* Split ordering */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-400" />
              <p className="text-sm font-semibold">Split Ordering</p>
            </div>
            <button onClick={() => setSplitBilling(!splitBilling)} className={`w-10 h-5 rounded-full transition-all ${splitBilling ? "bg-orange-500" : "bg-white/20"} relative`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${splitBilling ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
          {splitBilling && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <button onClick={() => setSplitCount(Math.max(2, splitCount - 1))} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                <span className="flex-1 text-center text-sm font-bold">{splitCount} people</span>
                <button onClick={() => setSplitCount(Math.min(10, splitCount + 1))} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center"><Plus className="h-3 w-3" /></button>
              </div>
              <div className="bg-orange-500/10 rounded-xl p-3 text-center">
                <p className="text-xs text-white/40">Each person pays</p>
                <p className="text-xl font-extrabold text-orange-400">₹{perPerson}</p>
              </div>
            </div>
          )}
        </div>

        {/* Partial & Advance payment */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Percent className="h-4 w-4 text-amber-400" /><p className="text-sm font-semibold">Partial Payment</p></div>
            <button onClick={() => setPartialEnabled(!partialEnabled)} className={`w-10 h-5 rounded-full transition-all ${partialEnabled ? "bg-amber-500" : "bg-white/20"} relative`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${partialEnabled ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
          {partialEnabled && (
            <>
              <input type="number" placeholder={`Pay now (max ₹${grandTotal - 1})`} value={partialPayNow} onChange={e => setPartialPayNow(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
              {quote.partialRemaining != null && <p className="text-xs text-amber-300">Remaining: ₹{quote.partialRemaining}</p>}
            </>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-violet-400" /><p className="text-sm font-semibold">Advance Payment</p></div>
            <button onClick={() => setAdvanceEnabled(!advanceEnabled)} className={`w-10 h-5 rounded-full transition-all ${advanceEnabled ? "bg-violet-500" : "bg-white/20"} relative`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${advanceEnabled ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
          {advanceEnabled && (
            <>
              <input type="number" placeholder="Advance amount" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
              {quote.balanceDue != null && <p className="text-xs text-violet-300">Balance due: ₹{quote.balanceDue}</p>}
            </>
          )}
        </div>

        {/* Favorites quick repeat */}
        {favorites.length > 0 && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Heart className="h-4 w-4 text-pink-400" /> Repeat Favorite Meals</p>
            <div className="space-y-2">
              {favorites.map(f => (
                <button key={f.menuItemId} onClick={() => repeatFavorite(f)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:border-pink-500/30">
                  <span>{f.name}</span>
                  <span className="text-orange-400 text-xs">+ Add ₹{f.price}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bill Summary */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Receipt className="h-4 w-4 text-orange-400" /> Bill Summary</p>
          <div className="space-y-2 text-sm">
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
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-white/50">{row.label}</span>
                <span className={row.green ? "text-emerald-400 font-semibold" : ""}>{row.value}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-2 mt-2 flex items-center justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-orange-400">₹{grandTotal}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <p className="text-sm font-semibold mb-3">Payment Method</p>
          <div className="space-y-2">
            {paymentMethods(user?.walletTotal ?? user?.walletBalance).map(m => (
              <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === m.id ? "bg-orange-500/10 border-orange-500/40" : "bg-white/5 border-white/10"}`}>
                <m.icon className={`h-5 w-5 ${paymentMethod === m.id ? "text-orange-400" : "text-white/40"}`} />
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="text-xs text-white/40">{m.sub}</p>
                </div>
                <div className={`h-4 w-4 rounded-full border-2 ${paymentMethod === m.id ? "border-orange-500 bg-orange-500" : "border-white/20"}`} />
              </button>
            ))}
          </div>
          <button onClick={() => navigate(withGuestQuery("/user/payment", venue, activeTable))} className="mt-3 w-full py-2.5 rounded-xl border border-orange-500/30 text-orange-300 text-xs font-semibold hover:bg-orange-500/10">
            Advanced checkout — split, partial, invoices →
          </button>
        </div>

        {/* Guest details — so the order shows the guest's name & phone in every panel */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <p className="text-sm font-semibold mb-1">Your details</p>
          <p className="text-xs text-white/40 mb-3">Taaki staff aapko naam se serve kar sake aur zaroorat pade to call kar sake.</p>
          <div className="space-y-2">
            <input
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/40"
            />
            <input
              value={guestPhone}
              onChange={e => setGuestPhone(e.target.value.replace(/[^\d+]/g, ""))}
              inputMode="tel"
              placeholder="Phone number"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/40"
            />
          </div>
        </div>
      </div>

      <div className="guest-bottom-bar">
        <button onClick={handlePlaceOrder} disabled={placing} className="guest-btn-primary w-full py-4 text-base font-bold disabled:opacity-60 disabled:transform-none">
          {placing ? <><div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Placing Order…</> : <><ShoppingBag className="h-5 w-5" /> Place Order · ₹{grandTotal}</>}
        </button>
      </div>
    </div>
  );
}

function XIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
