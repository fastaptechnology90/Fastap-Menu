import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError } from "@/components/user/GuestApiState";
import { withGuestQuery } from "@/lib/guestDemo";
import { useUser, type Order } from "@/contexts/UserContext";
import { publicApi, type OrderTrackingResponse } from "@/lib/api";
import {
  ORDER_LIFECYCLE, WAITER_STATUS_LABELS, lifecycleIndex,
  type KitchenUpdate, type LifecycleStage, type OrderTrackingSnapshot,
} from "@/lib/orderTracking";
import {
  ChevronLeft, RefreshCw, Phone, Star, MessageSquare,
  CheckCircle, ChefHat, User2, Truck, AlertCircle, RotateCcw, Share2, Download, Timer, Radio, FileText, Plus,
  XCircle, HeartHandshake, PartyPopper, BellRing,
} from "lucide-react";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  // Payment + table state now arrive with every status poll, so the bill prompt
  // and the closed-table screen update live instead of only after a reload.
  const [live, setLive] = useState<{ paymentStatus?: string; billRequested?: boolean; tableCleared?: boolean }>({});
  const [countdownSec, setCountdownSec] = useState(20 * 60);
  const [liveConnected, setLiveConnected] = useState(false);
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

  // SSE live stream
  useEffect(() => {
    const id = parseInt(params.id || "", 10);
    if (Number.isNaN(id)) return;
    try {
      const es = new EventSource(publicApi.orderLiveUrl(id));
      esRef.current = es;
      es.addEventListener("connected", () => setLiveConnected(true));
      es.addEventListener("order_status", () => {
        // Background refresh: the last known status stays on screen rather than
        // interrupting the guest with a toast on every dropped poll.
        publicApi.orderStatus(id).then(applyStatus).catch(() => undefined);
      });
      es.onerror = () => setLiveConnected(false);
      return () => { es.close(); esRef.current = null; };
    } catch {
      return undefined;
    }
  }, [params.id, applyStatus]);

  // Polling fallback every 4s
  useEffect(() => {
    const id = parseInt(params.id || "", 10);
    if (Number.isNaN(id)) return;
    const interval = setInterval(() => {
      publicApi.orderStatus(id).then(applyStatus).catch(() => undefined);
    }, 4000);
    return () => clearInterval(interval);
  }, [params.id, applyStatus]);

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
    if (!restaurantId) return;
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
      }
      if (phone) {
        window.location.href = `tel:${phone.replace(/\s/g, "")}`;
        showToast(phone === contactInfo.waiterPhone ? "Calling your waiter…" : "Calling restaurant…");
      } else if (!Number.isNaN(orderId)) {
        showToast("Waiter notified — they will call you shortly");
      } else {
        // No order id means notifyWaiter above was skipped, and with no phone there is
        // nothing left to try. Claiming a waiter was notified sent the guest on to wait
        // for someone who had heard nothing.
        showToast("We could not reach anyone from here — please wave a member of staff over.");
      }
    } catch {
      if (phone) window.location.href = `tel:${phone.replace(/\s/g, "")}`;
      else showToast("Could not reach waiter. Please ask staff at the counter.");
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
      setShowMessageModal(false);
      showToast("Message sent to your waiter");
      publicApi.orderStatus(orderId).then(applyStatus).catch(() => undefined);
    } catch {
      try {
        await notifyWaiter("guest_message", `Order #${orderId}: ${text}`);
        setMessageText("");
        setShowMessageModal(false);
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

  if (loading) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-foreground">
        <GuestLoading label="Loading order…" />
      </div>
    );
  }

  if (apiError || !displayOrder || !displayTracking) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-foreground">
        <div className="guest-header px-4 py-3">
          <GuestBackButton />
        </div>
        <GuestError message={apiError ?? "Order tracking unavailable."} onRetry={fetchOrder} />
      </div>
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

  function handleReorder() {
    if (!displayOrder) return;
    reorderFromOrder(displayOrder);
    navigate("/user/cart");
  }

  if (isCancelled) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-foreground flex flex-col items-center justify-center gap-4 px-8 text-center">
        <GuestBackButton className="absolute top-4 left-4" />
        <XCircle className="h-16 w-16 text-danger" strokeWidth={1.5} />
        <h2 className="text-xl font-semibold text-danger">Order Cancelled</h2>
        <p className="text-muted-foreground text-sm">This order was cancelled. Contact staff if this was unexpected.</p>
        <button onClick={() => navigate(withGuestQuery("/user/menu", venue, activeTable))} className="mt-2 px-6 py-3 rounded-xl bg-primary font-semibold text-sm">Order Again</button>
      </div>
    );
  }

  // Once the waiter clears the table the visit is over — keep showing a live
  // order and the guest thinks something is still coming.
  if (live.tableCleared) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-foreground flex flex-col items-center justify-center gap-4 px-8 text-center">
        <HeartHandshake className="h-16 w-16 text-success" strokeWidth={1.5} />
        <h2 className="text-xl font-semibold text-success">Thank you for visiting!</h2>
        <p className="text-muted-foreground text-sm">
          Your table has been closed{live.paymentStatus === "paid" ? " and the bill is settled" : ""}.
          We hope to see you again soon.
        </p>
        <button
          onClick={() => navigate(withGuestQuery("/user/menu", venue, activeTable))}
          className="mt-2 px-6 py-3 rounded-xl bg-primary font-semibold text-sm"
        >
          Start a new order
        </button>
      </div>
    );
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-8">
      <div className="guest-header px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GuestBackButton />
          <div>
            <h1 className="font-semibold text-sm">Live Order Tracking</h1>
            <p className="text-xs text-muted-foreground">#{displayOrder.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-2xs px-2 py-1 rounded-full ${liveConnected ? "text-success bg-success-subtle" : "text-muted-foreground bg-muted"}`}>
            <Radio className={`h-3 w-3 ${liveConnected ? "animate-pulse" : ""}`} />
            {liveConnected ? "Live" : "Polling"}
          </div>
          <button onClick={fetchOrder} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {actionToast && (
          <div className="rounded-xl border border-success-border bg-success-subtle px-4 py-2.5 text-sm text-success text-center">
            {actionToast}
          </div>
        )}

        {/* Estimated serving time + prep timer */}
        {!isDelivered && (
          <div className="rounded-2xl border border-primary p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Estimated Serving Time</div>
                <div className="text-3xl font-semibold">{displayTracking.estimatedServingMinutes} <span className="text-lg font-semibold text-muted-foreground">min</span></div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1 justify-end"><Timer className="h-3 w-3" /> Prep Timer</div>
                <div className="text-3xl font-semibold text-primary font-mono">{formatCountdown(countdownSec)}</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full transition-all duration-1000"
                style={{ width: `${Math.min(100, (displayTracking.preparationElapsedSeconds / (displayTracking.estimatedServingMinutes * 60)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Ordered {elapsedMin} min ago · Table {displayOrder.tableNo}
              {displayTracking.chefName && ` · ${displayTracking.chefName}`}
            </p>
            {placedAtLabel && (
              <p className="text-2xs text-muted-foreground mt-1 text-center">Placed on {placedAtLabel}</p>
            )}
          </div>
        )}

        {isDelivered && (
          <div className="rounded-2xl bg-success-subtle border border-success-border p-5 text-center">
            <PartyPopper className="h-10 w-10 text-success mx-auto mb-2" strokeWidth={1.5} />
            <h2 className="text-xl font-semibold text-success">Delivered!</h2>
            <p className="text-muted-foreground text-sm mt-1">Your order has been served</p>
          </div>
        )}

        {/* Delay alert */}
        {displayTracking.isDelayed && !isDelivered && (
          <div className="rounded-2xl bg-warning-subtle border border-warning-border p-4 flex items-start gap-3 animate-pulse">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">Order Delayed · +{displayTracking.delayMinutes} min</p>
              <p className="text-xs text-muted-foreground mt-0.5">{displayTracking.delayReason}</p>
            </div>
          </div>
        )}

        {/* Waiter live status */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full border border-border flex items-center justify-center">
              <User2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{displayTracking.waiterName ?? "Assigning waiter…"}</p>
              <p className="text-xs text-success font-medium mt-0.5">
                {WAITER_STATUS_LABELS[displayTracking.waiterStatus]}
              </p>
            </div>
            {displayTracking.waiterStatus === "on_the_way" && (
              <div className="flex items-center gap-1 text-xs text-primary bg-muted px-2 py-1 rounded-full">
                <Truck className="h-3 w-3 animate-bounce" /> En route
              </div>
            )}
            <button
              type="button"
              onClick={handleCallWaiter}
              className="h-9 w-9 rounded-xl bg-success-subtle border border-success-border flex items-center justify-center hover:bg-success-subtle transition-all"
              aria-label="Call waiter"
            >
              <Phone className="h-4 w-4 text-success" />
            </button>
            <button
              type="button"
              onClick={() => setShowMessageModal(true)}
              className="h-9 w-9 rounded-xl bg-info-subtle border border-info-border flex items-center justify-center hover:bg-info-subtle transition-all"
              aria-label="Message waiter"
            >
              <MessageSquare className="h-4 w-4 text-info" />
            </button>
          </div>
        </div>

        {/* Real-time kitchen updates */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-primary" /> Kitchen Live Updates
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {displayTracking.kitchenUpdates.map((u, i) => (
              <div key={`${u.at}-${i}`} className={`flex gap-2 text-xs p-2 rounded-lg ${u.type === "delay" ? "bg-warning-subtle border border-warning-border" : u.type === "chef" ? "bg-muted border border-primary" : u.type === "ready" ? "bg-success-subtle border border-success-border" : "bg-muted"}`}>
                <span className="text-muted-foreground shrink-0">{fmtOrderTime(u.at, tz)}</span>
                <span className="text-muted-foreground">{u.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Full lifecycle timeline — 7 steps */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-sm font-semibold mb-4">Order Lifecycle</p>
          <div className="space-y-0">
            {ORDER_LIFECYCLE.map((step, idx) => {
              // Once delivered, the final "Delivered" step is complete (green ✓),
              // not "in progress" — it's the terminal stage, nothing follows.
              const isDone = idx < activeIdx || (isDelivered && idx === activeIdx);
              const isCurrent = idx === activeIdx && !isDelivered;
              const showDelayed = displayTracking.isDelayed && isCurrent;
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 text-sm ${isDone ? "bg-primary border-success-border" : isCurrent ? (showDelayed ? "bg-primary border-warning-border" : "bg-primary border-primary") : "bg-muted border-border"}`}>
                      {isDone ? <CheckCircle className="h-4 w-4 text-foreground" /> : isCurrent ? <span className="animate-pulse">{step.icon}</span> : <span className="opacity-30">{step.icon}</span>}
                    </div>
                    {idx < ORDER_LIFECYCLE.length - 1 && (
                      <div className={`w-0.5 h-8 mt-0.5 ${idx < activeIdx ? "bg-success-subtle" : "bg-muted"}`} />
                    )}
                  </div>
                  <div className="pb-4 flex-1">
                    <p className={`text-sm font-semibold ${isDone ? "text-success" : isCurrent ? (showDelayed ? "text-warning" : "text-primary") : "text-muted-foreground"}`}>
                      {step.label}
                      {showDelayed && <span className="ml-2 text-xs text-warning font-normal">Delayed</span>}
                      {isCurrent && !showDelayed && <span className="ml-2 text-xs text-primary font-normal">In progress…</span>}
                    </p>
                    {(isDone || isCurrent) && <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>}
                    {step.key === "chef_assigned" && isCurrent && displayTracking.chefName && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><ChefHat className="h-3.5 w-3.5 text-primary shrink-0" />{displayTracking.chefName}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Cancelled / Delayed legend */}
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2 text-2xs text-muted-foreground">
            <span>Delayed — the kitchen is running late</span>
            <span>Cancelled — the order was voided</span>
          </div>
        </div>

        {/* Order items */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-sm font-semibold mb-3">Your Order</p>
          <div className="space-y-3">
            {displayOrder.items.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-muted text-primary text-xs font-semibold flex items-center justify-center">{item.quantity}×</span>
                  <div>
                    <p className="text-sm">{item.name}</p>
                    <p className="text-2xs text-muted-foreground capitalize">{item.course}</p>
                  </div>
                </div>
                <span className="text-sm text-primary font-semibold">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-primary">₹{displayOrder.total}</span>
            </div>
            <div className="flex gap-2">
              <button
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
                  } catch { /* demo */ }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted border border-border text-xs font-semibold hover:bg-muted"
              >
                <FileText className="h-3.5 w-3.5" /> GST Invoice
              </button>
              <button
                onClick={async () => {
                  const id = parseInt(String(displayOrder.id).replace(/\D/g, ""), 10);
                  if (!id) return;
                  try {
                    const res = await publicApi.payments.invoice(id);
                    const w = window.open("", "_blank");
                    w?.document.write(res.html);
                    w?.document.close();
                  } catch { /* demo */ }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted border border-primary text-primary text-xs font-semibold hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" /> PDF Invoice
              </button>
            </div>
            {/* Pay bill — cash / UPI at the table; the waiter collects and marks it paid.
                Read the payment state from `live` (the 4s status poll) rather than from the
                order fetched on mount — the order object is never re-fetched, so reading it
                here meant the guest only saw "bill is ready" / "Paid" after a page reload. */}
            {(live.paymentStatus ?? displayOrder.paymentStatus) === "paid" ? (
              <div className="flex items-center gap-2 justify-center py-2.5 rounded-xl bg-success-subtle border border-success-border text-success text-sm font-semibold">
                <CheckCircle className="h-4 w-4" /> Paid · ₹{displayOrder.total}
              </div>
            ) : (
              <div>
                {(live.billRequested ?? displayOrder.billRequested) ? (
                  <p className="text-xs text-warning font-semibold mb-2 flex items-center gap-1.5"><BellRing className="h-3.5 w-3.5 shrink-0" />Your bill is ready — please pay</p>
                ) : (
                  <p className="text-xs text-muted-foreground mb-2">Pay your bill — a waiter will collect at your table</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {["Cash", "UPI", "Card"].map(m => (
                    <button
                      key={m}
                      onClick={async () => {
                        try {
                          await notifyWaiter("payment_request", `Guest wants to pay ₹${displayOrder.total} by ${m} — order #${displayOrder.id}`);
                          showToast(`Waiter notified — they will collect your ${m} payment`);
                        } catch { showToast("Could not notify waiter, please try again"); }
                      }}
                      className="py-2.5 rounded-xl bg-muted border border-border text-xs font-semibold hover:bg-muted hover:border-primary transition-colors"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order more — the guest can keep ordering (new/different items) while this
            order is being prepared; goes back to the menu keeping table + venue. */}
        <button
          onClick={() => navigate(withGuestQuery("/user/menu", venue, activeTable))}
          className="w-full flex items-center gap-2 justify-center py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Order More Items
        </button>

        <button onClick={handleReorder} className="w-full flex items-center gap-2 justify-center py-3 rounded-xl border border-border bg-muted text-sm font-semibold">
          <RotateCcw className="h-4 w-4 text-primary" /> Reorder same items
        </button>

        {isDelivered && !reviewSubmitted && (
          <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-sm font-semibold mb-4 text-center">Rate your experience</h3>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setRating(star)}>
                  <Star className={`h-8 w-8 ${star <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <>
                <textarea className="w-full bg-muted border border-border rounded-xl p-3 text-sm mb-3 resize-none" rows={2} placeholder="Share feedback..." value={review} onChange={e => setReview(e.target.value)} />
                <button
                  disabled={submittingReview}
                  onClick={async () => {
                    if (!venue.restaurantId || submittingReview) return;
                    setSubmittingReview(true);
                    try {
                      await publicApi.feedback({ restaurantId: venue.restaurantId, orderId: parseInt(String(displayOrder.id), 10) || undefined, rating, comment: review });
                      // "Thanks for your review" only after the restaurant has it.
                      setReviewSubmitted(true);
                    } catch {
                      showToast("Your review did not send. Please try again.");
                    } finally {
                      setSubmittingReview(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-primary font-semibold text-sm disabled:opacity-60"
                >{submittingReview ? "Sending…" : "Submit Review"}</button>
              </>
            )}
          </div>
        )}
        {reviewSubmitted && (
          <div className="rounded-2xl bg-success-subtle border border-success-border p-4 text-center">
            <CheckCircle className="h-6 w-6 text-success mx-auto mb-2" />
            <p className="text-sm font-semibold text-success">Thanks for your review!</p>
          </div>
        )}
      </div>

      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-4" onClick={() => !sendingMessage && setShowMessageModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-border p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Message your waiter</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Order #{displayOrder.id} · Table {displayOrder.tableNo}
                  {displayTracking.waiterName ? ` · ${displayTracking.waiterName}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setShowMessageModal(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_MESSAGES.map(msg => (
                <button
                  key={msg}
                  type="button"
                  onClick={() => handleSendMessage(msg)}
                  disabled={sendingMessage}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted border border-border hover:border-info-border hover:bg-info-subtle disabled:opacity-50"
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
              className="w-full bg-muted border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-info-border"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={sendingMessage || !messageText.trim()}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-sm disabled:opacity-40 transition-all"
            >
              {sendingMessage ? "Sending…" : "Send Message"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
