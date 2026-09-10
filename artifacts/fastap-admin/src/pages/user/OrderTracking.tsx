/**
 * Live order tracking.
 *
 * The one question a diner has after tapping Place order is "where is my food". The
 * screen used to answer it fourth, under a 3xl countdown, a prep-timer, a progress bar
 * that had no fill colour at all (so it was permanently invisible) and a card of waiter
 * controls. The stage the order is actually at, and what happens next, now lead.
 *
 * The timeline itself is the point of the screen, so it is drawn with real icons rather
 * than the emoji the catalog carries — emoji render differently on every phone, take no
 * colour, and carry no accessible name.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestLoading, GuestError } from "@/components/user/GuestApiState";
import { withGuestQuery } from "@/lib/guestDemo";
import { useUser, type Order } from "@/contexts/UserContext";
import { publicApi, type OrderTrackingResponse } from "@/lib/api";
import {
  ORDER_LIFECYCLE, WAITER_STATUS_LABELS, lifecycleIndex,
  type KitchenUpdate, type LifecycleStage, type OrderTrackingSnapshot,
} from "@/lib/orderTracking";
import {
  GuestAppScreen, GuestAppBar, GuestAppBarButton, GuestBody, GuestSection,
  GuestList, GuestRow, GuestTableChip, GuestSheet, GuestActionBar, GuestPrimaryButton,
} from "@/components/user/GuestShell";
import type { LucideIcon } from "lucide-react";
import {
  RefreshCw, Phone, Star, MessageSquare, Check, CheckCircle, ChefHat, User2, Truck,
  AlertCircle, RotateCcw, Download, Timer, Radio, FileText, Plus, XCircle,
  HeartHandshake, PartyPopper, BellRing, Inbox, Flame, Soup, Award, ConciergeBell,
  UtensilsCrossed, Wallet,
} from "lucide-react";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * A real icon per lifecycle stage.
 *
 * `ORDER_LIFECYCLE` carries an emoji per step (📥 ✅ 👨‍🍳 🎖️ 🔥 🛎️ 🎉). That catalog is
 * shared, so the mapping lives here rather than in it.
 */
const STAGE_ICONS: Record<string, LucideIcon> = {
  received: Inbox,
  accepted: Check,
  kitchen_preparing: Soup,
  chef_assigned: Award,
  cooking: Flame,
  on_the_way: ConciergeBell,
  delivered: PartyPopper,
};

// Always render order times in the venue's timezone (India by default), not the viewer's
// device/WebView timezone — a phone or an APK WebView set to another zone would otherwise
// show the clock hours shifted (e.g. UTC → 5.5h off).
function fmtOrderTime(v: string | number | Date, tz: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: tz });
}
function fmtOrderDateTime(v: string | number | Date, tz: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });
}

function applyTrackingToOrder(order: Order, t: OrderTrackingSnapshot): Order {
  return {
    ...order,
    status: t.lifecycleStage === "cancelled" ? "cancelled"
      : t.lifecycleStage === "delivered" ? "delivered"
      : t.lifecycleStage === "on_the_way" ? "serving"
      : t.lifecycleStage === "cooking" || t.lifecycleStage === "chef_assigned" || t.lifecycleStage === "kitchen_preparing" ? "preparing"
      : t.lifecycleStage === "accepted" ? "accepted"
      : "received",
    estimatedTime: t.estimatedServingMinutes,
    waiterName: t.waiterName,
  };
}

const QUICK_MESSAGES = [
  "Where is my order?",
  "Please bring extra napkins",
  "Can I get water?",
  "Need assistance at the table",
];

export default function OrderTracking() {
  const [, navigate] = useAppLocation();
  const params = useParams<{ id: string }>();
  const { orders, venue, activeTable, reorderFromOrder } = useUser();
  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<OrderTrackingSnapshot | null>(null);
  const [contactInfo, setContactInfo] = useState<{
    restaurantId?: number;
    restaurantPhone?: string;
    waiterPhone?: string;
    tableName?: string;
  }>({});
  const [showMessageSheet, setShowMessageSheet] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  // Payment + table state now arrive with every status poll, so the bill prompt
  // and the closed-table screen update live instead of only after a reload.
  const [live, setLive] = useState<{ paymentStatus?: string; billRequested?: boolean; tableCleared?: boolean }>({});
  const [countdownSec, setCountdownSec] = useState(20 * 60);
  const [liveConnected, setLiveConnected] = useState(false);
  const [statusPollError, setStatusPollError] = useState<string | null>(null);
  const pollFailRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);

  const isNumericId = !Number.isNaN(parseInt(params.id || "", 10));

  const applyStatus = useCallback((data: OrderTrackingResponse) => {
    const snap: OrderTrackingSnapshot = {
      lifecycleStage: data.lifecycleStage as LifecycleStage,
      dbStatus: data.dbStatus ?? data.status,
      chefName: data.chefName,
      waiterName: data.waiterName,
      waiterStatus: data.waiterStatus as OrderTrackingSnapshot["waiterStatus"],
      estimatedServingMinutes: data.estimatedServingMinutes,
      estimatedServingAt: data.estimatedServingAt,
      preparationElapsedSeconds: data.preparationElapsedSeconds,
      isDelayed: data.isDelayed,
      delayMinutes: data.delayMinutes,
      delayReason: data.delayReason,
      kitchenUpdates: (data.kitchenUpdates ?? []).map((u: { at: string; message: string; type?: string }) => ({
        at: u.at,
        message: u.message,
        type: u.type as KitchenUpdate["type"],
      })),
    };
    setTracking(snap);
    setLive({
      paymentStatus: data.paymentStatus,
      billRequested: data.billRequested,
      tableCleared: data.tableCleared,
    });
    setContactInfo({
      restaurantId: data.restaurantId,
      restaurantPhone: data.restaurantPhone,
      waiterPhone: data.waiterPhone,
      tableName: data.tableName,
    });
    if (data.estimatedServingAt) {
      const rem = Math.max(0, Math.floor((new Date(data.estimatedServingAt).getTime() - Date.now()) / 1000));
      setCountdownSec(rem);
    }
    pollFailRef.current = 0;
    setStatusPollError(null);
    setOrder(prev => {
      const base = prev ?? orders.find(o => o.id === params.id) ?? {
        id: String(data.id),
        restaurantName: venue.restaurantName,
        items: [],
        total: 0,
        tableNo: "",
        placedAt: new Date(),
        estimatedTime: data.estimatedServingMinutes,
        status: "received" as const,
      };
      return applyTrackingToOrder(base, snap);
    });
  }, [orders, params.id, venue.restaurantName]);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    const local = orders.find(o => o.id === params.id);
    if (local && !isNumericId) {
      setOrder(local);
      setLoading(false);
      return;
    }
    const id = parseInt(params.id || "", 10);
    if (Number.isNaN(id)) {
      setApiError("Invalid order ID.");
      setLoading(false);
      return;
    }
    try {
      const [data, st] = await Promise.all([
        publicApi.getOrder(id),
        publicApi.orderStatus(id),
      ]);
      setOrder({
        id: String(data.id),
        restaurantName: venue.restaurantName,
        items: (Array.isArray(data.items) ? data.items : []).map((i: Record<string, unknown>, idx: number) => ({
          id: String(i.id ?? idx),
          menuItemId: String(i.menuItemId ?? i.id),
          name: String(i.name),
          price: parseFloat(String(i.price ?? 0)),
          quantity: Number(i.quantity ?? 1),
          customizations: Array.isArray(i.customizations) ? i.customizations as string[] : [],
          addons: Array.isArray(i.addons) ? i.addons as { name: string; price: number }[] : [],
          course: (i.course as Order["items"][0]["course"]) ?? "main",
        })),
        status: "received",
        total: parseFloat(String(data.total ?? 0)),
        tableNo: String(data.tableName ?? ""),
        placedAt: new Date(String(data.createdAt)),
        estimatedTime: 20,
        waiterName: data.waiterName,
        paymentStatus: data.paymentStatus,
        billRequested: Boolean((data.metadata as { billRequested?: boolean } | undefined)?.billRequested),
      });
      applyStatus(st);
    } catch {
      setApiError("Could not load order tracking.");
      setOrder(null);
      setTracking(null);
    } finally {
      setLoading(false);
    }
  }, [orders, params.id, venue.restaurantName, isNumericId, applyStatus]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const refreshStatus = useCallback((id: number) => {
    publicApi.orderStatus(id).then(applyStatus).catch(e => {
      pollFailRef.current += 1;
      // One dropped poll is noise; repeated failures mean the guest is staring at a stale stage.
      if (pollFailRef.current >= 2) {
        setStatusPollError(e instanceof Error ? e.message : "Live status updates paused — pull to refresh.");
      }
    });
  }, [applyStatus]);

  // SSE live stream
  useEffect(() => {
    const id = parseInt(params.id || "", 10);
    if (Number.isNaN(id)) return;
    try {
      const es = new EventSource(publicApi.orderLiveUrl(id));
      esRef.current = es;
      es.addEventListener("connected", () => setLiveConnected(true));
      es.addEventListener("order_status", () => {
        refreshStatus(id);
      });
      es.addEventListener("order_paid", () => {
        refreshStatus(id);
      });
      es.onerror = () => setLiveConnected(false);
      return () => { es.close(); esRef.current = null; };
    } catch {
      return undefined;
    }
  }, [params.id, refreshStatus]);

  // Polling fallback every 4s
  useEffect(() => {
    const id = parseInt(params.id || "", 10);
    if (Number.isNaN(id)) return;
    const interval = setInterval(() => {
      refreshStatus(id);
    }, 4000);
    return () => clearInterval(interval);
  }, [params.id, refreshStatus]);

  // Preparation timer countdown
  useEffect(() => {
    const t = setInterval(() => {
      setCountdownSec(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  function showToast(msg: string) {
    setActionToast(msg);
    window.setTimeout(() => setActionToast(null), 3500);
  }

  async function notifyWaiter(type: string, message: string) {
    const restaurantId = contactInfo.restaurantId ?? venue.restaurantId;
    if (!restaurantId) {
      throw new Error("Venue not loaded — scan the table QR and try again.");
    }
    await publicApi.waiterCall({
      restaurantId,
      tableId: venue.tableId,
      tableName: contactInfo.tableName || displayOrder?.tableNo || activeTable,
      type,
      message,
    });
  }

  async function handleCallWaiter() {
    const phone = contactInfo.waiterPhone || contactInfo.restaurantPhone;
    const orderId = parseInt(params.id || "", 10);
    try {
      if (!Number.isNaN(orderId)) {
        await notifyWaiter("phone_request", `Guest requested a call for order #${orderId}`);
      } else if (!phone) {
        showToast("We could not reach anyone from here — please wave a member of staff over.");
        return;
      }
      if (phone) {
        window.location.href = `tel:${phone.replace(/\s/g, "")}`;
        showToast(phone === contactInfo.waiterPhone ? "Calling your waiter…" : "Calling restaurant…");
      } else {
        // API accepted the call request; nobody has answered yet.
        showToast("Request sent to the floor — they will call you shortly");
      }
    } catch (e) {
      if (phone) {
        window.location.href = `tel:${phone.replace(/\s/g, "")}`;
        showToast(e instanceof Error ? `${e.message} Opening phone…` : "Could not notify staff — opening phone…");
      } else {
        showToast(e instanceof Error ? e.message : "Could not reach waiter. Please ask staff at the counter.");
      }
    }
  }

  async function handleSendMessage(preset?: string) {
    const text = (preset ?? messageText).trim();
    if (!text) return;
    const orderId = parseInt(params.id || "", 10);
    if (Number.isNaN(orderId)) {
      showToast("Cannot send message for this order");
      return;
    }
    setSendingMessage(true);
    try {
      await publicApi.orderMessage(orderId, { message: text });
      setMessageText("");
      setShowMessageSheet(false);
      showToast("Message sent to your waiter");
      refreshStatus(orderId);
    } catch {
      try {
        await notifyWaiter("guest_message", `Order #${orderId}: ${text}`);
        setMessageText("");
        setShowMessageSheet(false);
        showToast("Message sent to staff");
      } catch {
        showToast("Could not send message. Please try again.");
      }
    } finally {
      setSendingMessage(false);
    }
  }

  const displayOrder = order ?? orders.find(o => o.id === params.id) ?? null;
  const displayTracking = tracking;
  const menuPath = withGuestQuery("/user/menu", venue, activeTable);

  if (loading) {
    return (
      <GuestAppScreen>
        <GuestAppBar title="Your order" backFallback={menuPath} />
        <GuestLoading label="Loading order…" />
      </GuestAppScreen>
    );
  }

  if (apiError || !displayOrder || !displayTracking) {
    return (
      <GuestAppScreen>
        <GuestAppBar title="Your order" backFallback={menuPath} />
        <GuestError message={apiError ?? "Order tracking unavailable."} onRetry={fetchOrder} />
      </GuestAppScreen>
    );
  }

  const tz = venue.timezone || "Asia/Kolkata";
  const elapsedMin = Math.floor((Date.now() - new Date(displayOrder.placedAt).getTime()) / 60000);
  const placedAtLabel = fmtOrderDateTime(displayOrder.placedAt, tz);

  const isCancelled = displayTracking.lifecycleStage === "cancelled";
  const isDelivered = displayTracking.lifecycleStage === "delivered";
  const activeIdx = isCancelled ? -1 : lifecycleIndex(
    displayTracking.lifecycleStage === "delayed" ? "cooking" : displayTracking.lifecycleStage,
  );
  const currentStep = activeIdx >= 0 ? ORDER_LIFECYCLE[activeIdx] : undefined;
  const paid = (live.paymentStatus ?? displayOrder.paymentStatus) === "paid";
  const billReady = Boolean(live.billRequested ?? displayOrder.billRequested);
  const progressPct = Math.min(
    100,
    Math.max(
      0,
      displayTracking.estimatedServingMinutes > 0
        ? (displayTracking.preparationElapsedSeconds / (displayTracking.estimatedServingMinutes * 60)) * 100
        : 0,
    ),
  );

  function handleReorder() {
    if (!displayOrder) return;
    reorderFromOrder(displayOrder);
    navigate(withGuestQuery("/user/cart", venue, activeTable));
  }

  const dbStatus = String(displayTracking.dbStatus ?? "").toLowerCase();
  // Matches POST /public/orders/:id/cancel — short window; kitchen-started tickets are staff-only.
  const canGuestCancel =
    !paid
    && !isCancelled
    && ["pending", "new", "confirmed"].includes(dbStatus);

  async function handleCancelOrder() {
    const orderId = parseInt(params.id || "", 10);
    if (Number.isNaN(orderId) || cancelling) return;
    const ok = window.confirm("Cancel this order? The kitchen will be told straight away.");
    if (!ok) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await publicApi.cancelOrder(orderId, "Cancelled by guest");
      await fetchOrder();
      showToast("Order cancelled — the kitchen has been told.");
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Could not cancel this order. Please ask a team member.");
    } finally {
      setCancelling(false);
    }
  }

  if (isCancelled) {
    return (
      <GuestAppScreen withCartBar>
        <GuestAppBar title={`Order #${displayOrder.id}`} backFallback={menuPath} />
        <GuestBody className="flex flex-col items-center gap-3 py-20 text-center">
          <XCircle className="h-14 w-14 text-danger" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-semibold text-danger">Order cancelled</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            This order was cancelled. Speak to a member of staff if that was unexpected.
          </p>
        </GuestBody>
        <GuestActionBar>
          <GuestPrimaryButton onClick={() => navigate(menuPath)}>
            <UtensilsCrossed className="h-4 w-4" />
            Order again
          </GuestPrimaryButton>
        </GuestActionBar>
      </GuestAppScreen>
    );
  }

  // Once the waiter clears the table the visit is over — keep showing a live
  // order and the guest thinks something is still coming.
  if (live.tableCleared) {
    return (
      <GuestAppScreen withCartBar>
        <GuestAppBar title="Thanks for visiting" showBack={false} />
        <GuestBody className="flex flex-col items-center gap-3 py-20 text-center">
          <HeartHandshake className="h-14 w-14 text-success" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-semibold text-success">Your table has been closed</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            {paid ? "The bill is settled. " : ""}We hope to see you again soon.
          </p>
        </GuestBody>
        <GuestActionBar>
          <GuestPrimaryButton onClick={() => navigate(menuPath)}>
            <UtensilsCrossed className="h-4 w-4" />
            Start a new order
          </GuestPrimaryButton>
        </GuestActionBar>
      </GuestAppScreen>
    );
  }

  return (
    <GuestAppScreen withCartBar>
      <GuestAppBar
        title={`Order #${displayOrder.id}`}
        subtitle={
          displayOrder.tableNo || activeTable
            ? <GuestTableChip table={displayOrder.tableNo || activeTable} />
            : undefined
        }
        backFallback={menuPath}
        right={
          <div className="flex items-center gap-1.5">
            <span
              className={liveConnected
                ? "flex items-center gap-1 rounded-pill border border-success-border bg-success-subtle px-2 py-0.5 text-[10px] font-semibold text-success"
                : "flex items-center gap-1 rounded-pill border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"}
            >
              <Radio className={liveConnected ? "h-3 w-3 animate-pulse" : "h-3 w-3"} />
              {liveConnected ? "Live" : "Polling"}
            </span>
            <GuestAppBarButton label="Refresh" onClick={fetchOrder}>
              <RefreshCw className="h-4 w-4" />
            </GuestAppBarButton>
          </div>
        }
      />

      <GuestBody>
        {actionToast && (
          <GuestSection>
            <div role="status" className="rounded-md border border-success-border bg-success-subtle px-4 py-2.5 text-center text-sm text-success">
              {actionToast}
            </div>
          </GuestSection>
        )}
        {statusPollError && (
          <GuestSection>
            <div role="alert" className="rounded-md border border-warning-border bg-warning-subtle px-4 py-2.5 text-center text-sm text-warning">
              {statusPollError}
            </div>
          </GuestSection>
        )}

        {cancelError && (
          <GuestSection>
            <div role="alert" className="rounded-md border border-danger-border bg-danger-subtle px-4 py-2.5 text-center text-sm text-danger">
              {cancelError}
            </div>
          </GuestSection>
        )}

        {/* Where the order is, said first and in words. */}
        <GuestSection>
          {isDelivered ? (
            <div className="rounded-md border border-success-border bg-success-subtle p-5 text-center">
              <PartyPopper className="mx-auto mb-2 h-9 w-9 text-success" strokeWidth={1.5} />
              <h2 className="font-display text-lg font-semibold text-success">Served</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Enjoy your meal.</p>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Right now</p>
              <h2 className="mt-0.5 font-display text-lg font-semibold leading-tight">
                {currentStep?.label ?? "Sent to the kitchen"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{currentStep?.desc}</p>

              <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Should be served in</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {displayTracking.estimatedServingMinutes}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">min</span>
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                    <Timer className="h-3 w-3" /> Counting down
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-primary">{formatCountdown(countdownSec)}</p>
                </div>
              </div>

              {/* The fill had no background class at all, so this bar was empty on every
                  screen it has ever been on. */}
              <div className="mt-3 h-2 overflow-hidden rounded-pill bg-muted">
                <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${progressPct}%` }} />
              </div>

              <p className="mt-2 text-center text-xs text-muted-foreground">
                Ordered {elapsedMin} min ago
                {displayOrder.tableNo ? ` · Table ${displayOrder.tableNo}` : ""}
                {displayTracking.chefName ? ` · ${displayTracking.chefName}` : ""}
              </p>
              {placedAtLabel && (
                <p className="mt-0.5 text-center text-[11px] text-muted-foreground">Placed {placedAtLabel}</p>
              )}
            </div>
          )}
        </GuestSection>

        {displayTracking.isDelayed && !isDelivered && (
          <GuestSection>
            <div role="status" className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-subtle p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-warning">
                  Running late · about {displayTracking.delayMinutes} min more
                </p>
                {displayTracking.delayReason && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{displayTracking.delayReason}</p>
                )}
              </div>
            </div>
          </GuestSection>
        )}

        {/* Who is bringing it, and the two ways to reach them. */}
        <GuestSection title="Your waiter">
          <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <User2 className="h-5 w-5 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayTracking.waiterName ?? "Being assigned…"}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {displayTracking.waiterStatus === "on_the_way" && <Truck className="h-3.5 w-3.5 text-primary" />}
                {WAITER_STATUS_LABELS[displayTracking.waiterStatus]}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCallWaiter}
              aria-label="Call your waiter"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground transition-colors hover:bg-accent"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowMessageSheet(true)}
              aria-label="Message your waiter"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground transition-colors hover:bg-accent"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          </div>
        </GuestSection>

        {/* The timeline. */}
        <GuestSection title="Progress">
          <div className="rounded-md border border-border bg-card px-4 py-4">
            {ORDER_LIFECYCLE.map((step, idx) => {
              // Once delivered, the final "Delivered" step is complete, not "in
              // progress" — it is the terminal stage, nothing follows.
              const isDone = idx < activeIdx || (isDelivered && idx === activeIdx);
              const isCurrent = idx === activeIdx && !isDelivered;
              const showDelayed = displayTracking.isDelayed && isCurrent;
              const StepIcon = STAGE_ICONS[step.key] ?? Inbox;
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={
                        isDone
                          ? "flex h-8 w-8 items-center justify-center rounded-full border border-success-border bg-success-subtle text-success"
                          : isCurrent
                            ? (showDelayed
                              ? "flex h-8 w-8 items-center justify-center rounded-full border border-warning-border bg-warning-subtle text-warning"
                              : "flex h-8 w-8 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground")
                            : "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground"
                      }
                    >
                      {isDone ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                    </span>
                    {idx < ORDER_LIFECYCLE.length - 1 && (
                      <span className={idx < activeIdx ? "my-0.5 w-0.5 flex-1 bg-success" : "my-0.5 w-0.5 flex-1 bg-border"} />
                    )}
                  </div>
                  <div className={idx < ORDER_LIFECYCLE.length - 1 ? "min-w-0 flex-1 pb-4" : "min-w-0 flex-1"}>
                    <p
                      className={
                        isDone ? "text-sm font-medium text-success"
                          : isCurrent ? (showDelayed ? "text-sm font-semibold text-warning" : "text-sm font-semibold text-foreground")
                            : "text-sm font-medium text-muted-foreground"
                      }
                    >
                      {step.label}
                      {showDelayed && <span className="ml-2 text-xs font-normal text-warning">Delayed</span>}
                      {isCurrent && !showDelayed && <span className="ml-2 text-xs font-normal text-primary">In progress</span>}
                    </p>
                    {(isDone || isCurrent) && <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>}
                    {step.key === "chef_assigned" && isCurrent && displayTracking.chefName && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ChefHat className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {displayTracking.chefName}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </GuestSection>

        {displayTracking.kitchenUpdates.length > 0 && (
          <GuestSection title="From the kitchen">
            <ul className="thin-scroll max-h-52 space-y-2 overflow-y-auto rounded-md border border-border bg-card p-3">
              {displayTracking.kitchenUpdates.map((u, i) => (
                <li
                  key={`${u.at}-${i}`}
                  className={
                    u.type === "delay"
                      ? "flex gap-2 rounded-sm border border-warning-border bg-warning-subtle p-2 text-xs"
                      : u.type === "ready"
                        ? "flex gap-2 rounded-sm border border-success-border bg-success-subtle p-2 text-xs"
                        : "flex gap-2 rounded-sm bg-muted p-2 text-xs"
                  }
                >
                  <span className="shrink-0 tabular-nums text-muted-foreground">{fmtOrderTime(u.at, tz)}</span>
                  <span className="min-w-0 text-muted-foreground">{u.message}</span>
                </li>
              ))}
            </ul>
          </GuestSection>
        )}

        <GuestSection title="What you ordered">
          <div className="-mx-4 divide-y divide-border border-y border-border bg-card">
            {displayOrder.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                  {item.quantity}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.name}</span>
                  <span className="block text-[11px] capitalize text-muted-foreground">{item.course}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">₹{item.price * item.quantity}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-base font-semibold tabular-nums">₹{displayOrder.total}</span>
            </div>
          </div>
        </GuestSection>

        {/* Pay the bill — cash / UPI / card at the table; the waiter collects and marks
            it paid. The payment state is read from the 4s status poll, not from the
            order fetched on mount, which was never re-fetched. */}
        <GuestSection title="Bill">
          {paid ? (
            <div className="flex items-center justify-center gap-2 rounded-md border border-success-border bg-success-subtle py-3 text-sm font-semibold text-success">
              <CheckCircle className="h-4 w-4" /> Paid · ₹{displayOrder.total}
            </div>
          ) : (
            <>
              {billReady ? (
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <BellRing className="h-3.5 w-3.5 shrink-0" />
                  Your bill is ready — pay staff at the table or counter (Cash / UPI / Card).
                </p>
              ) : (
                <p className="mb-2 text-xs text-muted-foreground">
                  Staff collect payment at your table. Tap how you want to pay so they know:
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {["Cash", "UPI", "Card"].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={async () => {
                      try {
                        await notifyWaiter("payment_request", `Guest wants to pay ₹${displayOrder.total} by ${m} — order #${displayOrder.id}`);
                        showToast(`Waiter notified — they will collect your ${m} payment`);
                      } catch { showToast("Could not notify waiter, please try again"); }
                    }}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs font-semibold transition-colors hover:bg-accent"
                  >
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}
        </GuestSection>

        <GuestSection title="Paperwork & repeats">
          <GuestList>
            <GuestRow
              icon={<FileText className="h-4 w-4" />}
              title="GST invoice"
              detail="Save it to this phone"
              onClick={async () => {
                const id = parseInt(String(displayOrder.id).replace(/\D/g, ""), 10);
                if (!id) return;
                try {
                  const res = await publicApi.payments.invoice(id);
                  const blob = new Blob([res.html], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${res.invoice.invoiceNumber}.html`;
                  a.click();
                } catch { showToast("Could not fetch the invoice. Please ask a member of staff."); }
              }}
            />
            <GuestRow
              icon={<Download className="h-4 w-4" />}
              title="Open the invoice to print"
              onClick={async () => {
                const id = parseInt(String(displayOrder.id).replace(/\D/g, ""), 10);
                if (!id) return;
                try {
                  const res = await publicApi.payments.invoice(id);
                  const w = window.open("", "_blank");
                  w?.document.write(res.html);
                  w?.document.close();
                } catch { showToast("Could not fetch the invoice. Please ask a member of staff."); }
              }}
            />
            <GuestRow
              icon={<RotateCcw className="h-4 w-4" />}
              title="Reorder the same items"
              detail="Puts them straight into your basket"
              onClick={handleReorder}
            />
          </GuestList>
        </GuestSection>

        {isDelivered && !reviewSubmitted && (
          <GuestSection title="Rate your experience">
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    aria-label={`${star} star${star === 1 ? "" : "s"}`}
                    className="flex h-11 w-11 items-center justify-center"
                  >
                    <Star className={star <= rating ? "h-7 w-7 fill-warning text-warning" : "h-7 w-7 text-muted-foreground"} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <>
                  <textarea
                    rows={2}
                    value={review}
                    onChange={e => setReview(e.target.value)}
                    placeholder="Anything you want the restaurant to know?"
                    className="mt-3 w-full resize-none rounded-md border border-input bg-background p-3 text-sm focus:border-ring focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={submittingReview}
                    onClick={async () => {
                      if (submittingReview) return;
                      if (!venue.restaurantId) {
                        showToast("We do not know which restaurant this order belongs to. Scan the table QR and try again.");
                        return;
                      }
                      setSubmittingReview(true);
                      try {
                        await publicApi.feedback({
                          restaurantId: venue.restaurantId,
                          orderId: parseInt(String(displayOrder.id), 10) || undefined,
                          rating,
                          comment: review,
                        });
                        // "Thanks for your review" only after the restaurant has it.
                        setReviewSubmitted(true);
                      } catch (e) {
                        showToast(e instanceof Error ? e.message : "Your review did not send. Please try again.");
                      } finally {
                        setSubmittingReview(false);
                      }
                    }}
                    className="mt-3 flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {submittingReview ? "Sending…" : "Submit review"}
                  </button>
                </>
              )}
            </div>
          </GuestSection>
        )}
        {reviewSubmitted && (
          <GuestSection>
            <div className="rounded-md border border-success-border bg-success-subtle p-4 text-center">
              <CheckCircle className="mx-auto mb-2 h-6 w-6 text-success" />
              <p className="text-sm font-semibold text-success">Thanks for your review.</p>
            </div>
          </GuestSection>
        )}

        {/* Extra clearance when Cancel + Order more both sit in the action bar. */}
        {canGuestCancel && <div className="h-14" aria-hidden />}
      </GuestBody>

      {/* The guest can keep ordering while this round is cooking. */}
      <GuestActionBar>
        <div className="space-y-2">
          {canGuestCancel && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => { void handleCancelOrder(); }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-danger-border bg-danger-subtle text-sm font-semibold text-danger disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              {cancelling ? "Cancelling…" : "Cancel order"}
            </button>
          )}
          <GuestPrimaryButton onClick={() => navigate(menuPath)}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Order more items
          </GuestPrimaryButton>
        </div>
      </GuestActionBar>

      <GuestSheet
        open={showMessageSheet}
        onClose={() => { if (!sendingMessage) setShowMessageSheet(false); }}
        title="Message your waiter"
        description={`Order #${displayOrder.id}${displayOrder.tableNo ? ` · Table ${displayOrder.tableNo}` : ""}${displayTracking.waiterName ? ` · ${displayTracking.waiterName}` : ""}`}
        footer={
          <GuestPrimaryButton
            onClick={() => handleSendMessage()}
            disabled={sendingMessage || !messageText.trim()}
          >
            {sendingMessage ? "Sending…" : "Send message"}
          </GuestPrimaryButton>
        }
      >
        <div className="flex flex-wrap gap-2">
          {QUICK_MESSAGES.map(msg => (
            <button
              key={msg}
              type="button"
              onClick={() => handleSendMessage(msg)}
              disabled={sendingMessage}
              className="min-h-9 rounded-pill border border-border bg-card px-3.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              {msg}
            </button>
          ))}
        </div>
        <textarea
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          placeholder="Type your message…"
          rows={3}
          className="mt-4 w-full resize-none rounded-md border border-input bg-background p-3 text-sm focus:border-ring focus:outline-none"
        />
      </GuestSheet>
    </GuestAppScreen>
  );
}
