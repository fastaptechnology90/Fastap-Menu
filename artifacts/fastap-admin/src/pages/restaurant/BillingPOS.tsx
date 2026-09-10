import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { orders as ordersApi, orderAdjustments, restaurantApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { downloadText } from "@/lib/download";
import type { RecentBill } from "@/lib/restaurant-types";
import { emptyPosStatsDisplay } from "@/lib/restaurantPublication";
import { PermissionGate } from "@/components/restaurant/PermissionGate";
import { RevenueByDate } from "@/components/restaurant/RevenueByDate";
import { PrintControls } from "@/components/restaurant/PrintControls";
import {
  AdjustedLineNote, AdjustmentHistory, LineAdjustControls, RefundControls,
  type AdjustKind,
} from "@/components/restaurant/BillAdjustments";
import {
  Receipt, CreditCard, Smartphone, Banknote, Wallet, Nfc,
  Plus, Minus, CheckCircle, Printer, Download, Search, X, ChevronLeft, Users,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────────
   Billing / POS

   The till. Two panes from 1024px — the tabs a cashier picks from on the left,
   the bill on the right — and below that the bill slides over the list as a
   sheet. In both cases the total and the Collect button live in a pinned footer
   that never scrolls away, because the one question this screen must always be
   answering is "how much, and is it taken yet".
   ──────────────────────────────────────────────────────────────────────────── */

// Till methods: record how the guest settled — they do not charge a payment gateway.
const PAYMENT_METHODS = [
  { id: "upi",    label: "UPI",      icon: Smartphone },
  { id: "card",   label: "Card",     icon: CreditCard },
  { id: "cash",   label: "Cash",     icon: Banknote },
  { id: "wallet", label: "Wallet",   icon: Wallet },
  { id: "nfc",    label: "Tap / NFC", icon: Nfc },
];

const REF_METHODS = ["upi", "card", "nfc"];

interface BillItem {
  name: string;
  qty: number;
  price: number;
  /** Position on the stored order — the adjustment routes address lines by index, and a
   *  cashier changing quantities here must not shift what "line 2" means to the server. */
  index: number;
  voided?: boolean;
  comped?: boolean;
  adjustReason?: string;
  adjustedBy?: string;
}

/**
 * The tax rate this order was actually priced at.
 *
 * Line subtotals on a stored order are tax-exclusive, so `total - sum(lines)` is the
 * tax the server charged and dividing by the line sum gives the rate that produced it.
 * That keeps the cashier's screen on the venue's own rates — and on the excise rate for
 * a bill containing alcohol — instead of a 5% figure hardcoded in the panel. Voided and
 * comped lines are excluded because the order total no longer contains them.
 */
const DEFAULT_TAX_RATE = 0.05;

function taxRateOf(order: { total: number; items: { qty: number; price: number; subtotal?: number; voided?: boolean; comped?: boolean }[] }) {
  const lineSum = order.items.reduce(
    (s, i) => (i.voided || i.comped ? s : s + (i.subtotal && i.subtotal > 0 ? i.subtotal : i.price * (i.qty || 1))),
    0,
  );
  if (lineSum <= 0) return DEFAULT_TAX_RATE;
  const rate = (Number(order.total) - lineSum) / lineSum;
  // Anything outside this band means the order carries a tip or a discount we cannot see
  // from here, so fall back rather than invent a rate.
  return Number.isFinite(rate) && rate >= 0 && rate <= 0.3 ? rate : DEFAULT_TAX_RATE;
}

const money = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n: number) => `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;

export default function BillingPOS() {
  const { liveOrders, updateOrderStatus, refreshOrders, restaurantId, isRestaurantPublished, currentStaff } = useRestaurant();
  const [selectedOrder, setSelectedOrder] = useState<typeof liveOrders[0] | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  // Bumped after every adjustment so the history under the bill refetches.
  const [adjustSeq, setAdjustSeq] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [reference, setReference] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tip, setTip] = useState(0);
  // The tax rate this order was actually priced at, read back off the order itself.
  // Not every line is 5% GST — alcohol is taxed at the venue's excise rate — and the
  // venue can set its own rates, so a rate hardcoded here would disagree with the
  // order record on any bill containing a drink. 0.05 is only the fallback for an
  // order whose own figures do not add up.
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
  const [splitCount, setSplitCount] = useState(1);
  const [paid, setPaid] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"new" | "recent">("new");
  const [recentBills, setRecentBills] = useState<RecentBill[]>([]);
  const [billDetail, setBillDetail] = useState<any | null>(null);
  const [todayStats, setTodayStats] = useState({ collection: 0, bills: 0, avgBill: 0 });

  // These tiles used to load once and never move again, so a bill collected while the
  // page was open left "Today's Collection" showing a stale figure until a manual reload —
  // and it then disagreed with the Collection widget above, which polls every 12s.
  const loadTodayStats = useCallback(() => {
    if (!restaurantId) return;
    // Always fetch — the dashboard API already returns zeros for an unpublished restaurant;
    // gating on the context flag showed ₹0 whenever it was briefly stale after login.
    restaurantApi.dashboard(restaurantId).then(d => {
      setTodayStats({
        collection: parseFloat(String(d?.todayRevenue ?? 0)),
        bills: parseInt(String(d?.todayOrders ?? 0), 10),
        avgBill: parseFloat(String(d?.avgOrderValue ?? 0)),
      });
    }).catch(() => setTodayStats(emptyPosStatsDisplay()));
  }, [restaurantId]);

  useEffect(() => {
    loadTodayStats();
    if (!restaurantId) return;
    // Same 12s beat as the Collection widget above, so the two numbers stay in step.
    const t = setInterval(loadTodayStats, 12000);
    return () => clearInterval(t);
  }, [loadTodayStats, restaurantId, isRestaurantPublished]);

  // A payment collected anywhere (waiter app, POS, another tab) reaches the panel as an
  // SSE order event, which refreshes liveOrders — react to that too, so the money lands
  // straight away instead of on the next tick. Key off counts rather than the array
  // itself: liveOrders gets a fresh identity on every 15s poll, which would otherwise
  // refetch constantly even when nothing about the billing figures changed.
  const paidCount = liveOrders.filter(o => o.paymentStatus === "paid").length;
  const settledCount = liveOrders.filter(o => o.status === "billed").length;

  useEffect(() => { loadTodayStats(); }, [paidCount, loadTodayStats]);

  useEffect(() => {
    if (!restaurantId) return;
    ordersApi.list(restaurantId, "completed").then(data => {
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.slice(0, 20).map((o: any) => {
          const pay = (o.metadata && typeof o.metadata === "object" ? o.metadata.payment : null) ?? {};
          return {
            id: `BILL-${o.id}`,
            table: o.tableNumber || o.tableName || "T-?",
            amount: parseFloat(String(o.total ?? o.totalAmount ?? 0)),
            // Fall back to cash (not upi) when no method was recorded, so this
            // matches Order Management and Revenue for the same order.
            // Blank until it is actually collected — see payMethodBadge in OrderManagement.
            method: (o.paymentMethod || pay.method || "") as string,
            time: o.updatedAt ? new Date(o.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—",
            status: "paid",
            reference: pay.utr || pay.upiId || o.invoiceNumber || undefined,
            collectedBy: pay.collectedBy || undefined,
            collectedFrom: pay.collectedFrom || undefined,
            orderId: o.id,
          };
        });
        setRecentBills(mapped);
      }
    }).catch(() => {});
  }, [restaurantId, settledCount]);

  const billableOrders = liveOrders.filter(o => ["preparing", "ready", "served", "accepted"].includes(o.status));

  /**
   * `?order=123` opens that tab's bill on arrival.
   *
   * The floor map sends a cashier here with a table's running tab; landing on an
   * unfiltered list of every open tab and asking them to find it again is the
   * step this removes. It fires once — clearing the flag before the guard means a
   * tab that has already been settled does not retry on every poll — and it never
   * overrides a bill the cashier has already opened by hand.
   */
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || selectedOrder || billableOrders.length === 0) return;
    const want = new URLSearchParams(window.location.search).get("order");
    if (!want) { deepLinked.current = true; return; }
    const match = billableOrders.find(o => String(o.id) === want);
    deepLinked.current = true;
    if (match) loadOrder(match);
    else toast({ title: `Order #${want} is not waiting to be billed`, description: "It may already be settled, or cancelled." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billableOrders.length]);

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return billableOrders;
    return billableOrders.filter(o =>
      o.tableNo.toLowerCase().includes(q) ||
      String(o.id).toLowerCase().includes(q) ||
      (o.customerName || "").toLowerCase().includes(q),
    );
  }, [billableOrders, search]);

  function loadOrder(order: typeof liveOrders[0]) {
    setSelectedOrder(order);
    setTaxRate(taxRateOf(order));
    // Bill the order's ACTUAL amount: derive the unit price from the stored line subtotal
    // (÷ qty) so the POS total matches the order total, instead of a possibly-stale unit price.
    setBillItems(order.items.map((i, index) => {
      const qty = i.qty || 1;
      // Keep FULL precision on the unit price (subtotal ÷ qty) so re-summing reproduces the
      // order's exact subtotal — rounding the unit here is what introduced a ₹0.01 drift.
      const unit = i.subtotal && i.subtotal > 0 ? (i.subtotal / qty) : i.price;
      return { name: i.name, qty, price: unit, index, voided: i.voided, comped: i.comped, adjustReason: i.adjustReason, adjustedBy: i.adjustedBy };
    }));
    setAdjustSeq(s => s + 1);
    setPaid(false);
    setDiscount(0);
    setTip(0);
    setSplitCount(1);
  }

  function closeBill() {
    setSelectedOrder(null);
    setPaid(false);
    setBillItems([]);
  }

  /** Re-read the bill from the order the server just returned, flags and all. */
  function applyAdjustedOrder(updated: any) {
    const rows = Array.isArray(updated?.items) ? updated.items : [];
    setBillItems(rows.map((i: any, index: number) => {
      const qty = Number(i.quantity ?? i.qty ?? 1) || 1;
      const sub = Number(i.subtotal ?? 0);
      return {
        name: String(i.name ?? "Item"),
        qty,
        price: sub > 0 ? sub / qty : Number(i.price ?? 0),
        index,
        voided: i.voided === true,
        comped: i.comped === true,
        adjustReason: i.voidReason || i.compReason || undefined,
        adjustedBy: i.voidedBy || i.compedBy || undefined,
      };
    }));
    setAdjustSeq(s => s + 1);
  }

  async function adjustLine(item: BillItem, kind: AdjustKind, reason: string) {
    const orderId = selectedOrder ? parseInt(selectedOrder.id, 10) : NaN;
    if (!restaurantId || Number.isNaN(orderId)) return;
    try {
      const call = kind === "void" ? orderAdjustments.voidItem : orderAdjustments.compItem;
      const updated = await call(restaurantId, orderId, { itemIndex: item.index, reason });
      applyAdjustedOrder(updated);
      toast({
        title: kind === "void" ? `${item.name} voided` : `${item.name} comped`,
        description: `Recorded against this bill: ${reason}`,
      });
      // The kitchen and the live list both read this order; keep them in step.
      refreshOrders().catch(() => { /* the bill on screen is already correct */ });
    } catch (e: any) {
      toast({
        title: kind === "void" ? "Could not void that line" : "Could not comp that line",
        description: e?.message ?? "The server rejected it. Nothing was changed on the bill.",
        variant: "destructive",
      });
    }
  }

  async function refundBill(bill: RecentBill, reason: string, amount?: number) {
    if (!restaurantId || !bill.orderId) return;
    try {
      const res = await orderAdjustments.refund(restaurantId, bill.orderId, { amount, reason });
      toast({
        title: res.full ? "Bill refunded in full" : `${res.refunded.toFixed(2)} refunded`,
        description: `Reason recorded: ${reason}`,
      });
      setBillDetail((d: any) => d ? { ...d, status: res.full ? "refunded" : "part-refunded", refundedTotal: res.refundedTotal } : d);
      refreshOrders().catch(() => { /* the refund itself already went through */ });
    } catch (e: any) {
      toast({
        title: "Refund not processed",
        description: e?.message ?? "The server rejected it. No money has been returned.",
        variant: "destructive",
      });
    }
  }

  // Keep 2-decimal precision (don't round GST to whole rupees) so the POS total matches the
  // order's exact amount — no ₹ mismatch between the bill card and what's collected.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  // Voided and comped lines stay on screen but must never be charged for.
  const subtotal = r2(billItems.reduce((s, i) => (i.voided || i.comped ? s : s + i.price * i.qty), 0));
  const discountAmt = r2(subtotal * discount / 100);
  // Tax is charged on the discounted value, which is both the law and what the server
  // records (`taxable = subtotal - discount` in the order route). This screen used to
  // tax the gross subtotal, so every discounted bill charged the guest the tax on the
  // discount as well and the printed "GST (5%)" line was not 5% of anything on the bill.
  const taxable = r2(Math.max(0, subtotal - discountAmt));
  const gst = r2(taxable * taxRate);
  const gstLabel = `${(taxRate * 100).toFixed(taxRate * 100 % 1 === 0 ? 0 : 2)}%`;
  const grandTotal = r2(taxable + gst + tip);
  const perPerson = splitCount > 1 ? Math.ceil(grandTotal / splitCount) : grandTotal;

  function downloadInvoice(gstInvoice: boolean) {
    const method = PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label || paymentMethod;
    const body = [
      gstInvoice ? "GST TAX INVOICE" : "RESTAURANT BILL",
      `Table: ${selectedOrder?.tableNo || "—"}`,
      `Order: ${selectedOrder?.id || "—"}`,
      `Payment: ${method}`,
      `Date: ${new Date().toLocaleString("en-IN")}`,
      "",
      // A voided or comped line stays printed with its reason — a guest querying the bill
      // needs to see what was taken off it, not a line that quietly vanished.
      ...billItems.map(i => i.voided || i.comped
        ? `${i.name} x${i.qty} — ${i.voided ? "VOIDED" : "COMPED"}${i.adjustReason ? ` (${i.adjustReason})` : ""} = ₹0.00`
        : `${i.name} x${i.qty} @ ₹${r2(i.price)} = ₹${r2(i.price * i.qty)}`),
      "",
      `Subtotal: ₹${subtotal}`,
      `Discount: ₹${discountAmt}`,
      `Taxable value: ₹${taxable}`,
      `GST (${gstLabel}): ₹${gst}`,
      `Tip: ₹${tip}`,
      `Grand Total: ₹${grandTotal}`,
    ].join("\n");
    downloadText(body, `${gstInvoice ? "gst-invoice" : "bill"}-${selectedOrder?.id || "order"}.txt`);
  }

  const [paying, setPaying] = useState(false);

  async function handlePay() {
    if (!selectedOrder || paying) return;
    const isUpiLike = paymentMethod === "upi" || paymentMethod === "card" || paymentMethod === "nfc";
    if (isUpiLike && !reference.trim()) {
      toast({
        title: "Reference required",
        description: paymentMethod === "upi"
          ? "Enter the UPI ID or UTR before marking this bill paid."
          : "Enter the card RRN / NFC reference before marking this bill paid.",
        variant: "destructive",
      });
      return;
    }
    setPaying(true);
    try {
      const orderId = parseInt(selectedOrder.id, 10);
      if (!Number.isNaN(orderId) && restaurantId) {
        await ordersApi.update(restaurantId, orderId, {
          status: "completed",
          paymentMethod,
          paymentStatus: "paid",
          tipAmount: tip,
          finalTotal: grandTotal,   // record exactly what was collected (incl. discount/tip)
          collectedBy: currentStaff?.name || "Cashier",
          collectedFrom: "Cashier POS",
          ...(isUpiLike && reference ? (paymentMethod === "upi" ? { upiId: reference.trim() } : { utr: reference.trim() }) : {}),
        });
      }
      updateOrderStatus(selectedOrder.id, "billed");
      setRecentBills(prev => [{
        id: `BILL-${selectedOrder.id}`,
        table: selectedOrder.tableNo,
        amount: grandTotal,
        method: paymentMethod,
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        status: "paid",
        reference: reference || undefined,
        collectedBy: currentStaff?.name || "Cashier",
        collectedFrom: "Cashier POS",
        orderId,
      }, ...prev].slice(0, 20));
      setReference("");
      setPaid(true);
    } catch (e: any) {
      // There was no catch here at all: when the write was rejected the rest of this
      // function never ran, so the cashier saw the button do nothing — no confirmation,
      // no error, and a guest walking away from a bill the system had not recorded.
      toast({
        title: "Payment not recorded",
        description: `${e?.message ?? "The server rejected it."} Do not let the guest leave — try again.`,
        variant: "destructive",
      });
    } finally {
      setPaying(false);
    }
  }

  const panelOpen = Boolean(selectedOrder || paid);
  const chip = "flex min-h-10 flex-1 items-center justify-center rounded-md border px-2 text-sm font-semibold transition-colors hover-elevate active-elevate-2";
  const chipOn = "border-primary-border bg-primary text-primary-foreground";
  const chipOff = "border-border bg-card text-muted-foreground";

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-x-hidden">
      {/* ── Left: what there is to bill ─────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">Billing &amp; POS</h1>
              <p className="text-xs text-muted-foreground">
                {billableOrders.length} open {billableOrders.length === 1 ? "tab" : "tabs"} · pick one to bill it
              </p>
            </div>

            {/* Today, at a glance. Three numbers, never a card wall. */}
            <dl className="order-last flex w-full items-stretch gap-px overflow-hidden rounded-md border border-border bg-border sm:order-none sm:ml-auto sm:w-auto">
              {[
                { label: "Collected", value: moneyShort(todayStats.collection), tone: "text-success" },
                { label: "Bills", value: String(todayStats.bills), tone: "text-foreground" },
                { label: "Avg bill", value: moneyShort(todayStats.avgBill), tone: "text-foreground" },
              ].map(s => (
                <div key={s.label} className="flex-1 bg-card px-3 py-1.5 text-center sm:flex-none">
                  <dd className={`text-base font-semibold tabular-nums ${s.tone}`}>{s.value}</dd>
                  <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
              {([
                { id: "new" as const, label: "Open tabs", count: billableOrders.length },
                { id: "recent" as const, label: "Collected", count: recentBills.length },
              ]).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={tab === t.id}
                  className={`flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors ${
                    tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover-elevate"
                  }`}
                >
                  {t.label}
                  <span className="text-2xs tabular-nums opacity-80">{t.count}</span>
                </button>
              ))}
            </div>

            {tab === "new" && (
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  className="min-h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  placeholder="Table, order number or guest"
                  aria-label="Search open tabs"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
          {tab === "new" ? (
            <div className="space-y-6">
              {visibleOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-14 text-center">
                  <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Receipt className="h-6 w-6" aria-hidden />
                  </span>
                  <h2 className="text-base font-semibold">
                    {search ? "No open tab matches that" : "Nothing waiting to be billed"}
                  </h2>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {search
                      ? "Clear the search to see every open tab."
                      : "Open tabs appear after a guest or waiter places an order and the kitchen accepts it. Take orders from Tables, Kitchen, or the waiter Take order screen."}
                  </p>
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="mt-4 inline-flex min-h-10 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold hover-elevate active-elevate-2"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleOrders.map(order => {
                    const on = selectedOrder?.id === order.id;
                    return (
                      <li key={order.id}>
                        <button
                          type="button"
                          onClick={() => loadOrder(order)}
                          aria-pressed={on}
                          className={`flex w-full flex-col gap-2 rounded-md border p-3 text-left transition-colors hover-elevate active-elevate-2 ${
                            on ? "border-primary-border bg-primary/10" : "border-border bg-card"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block truncate text-lg font-semibold leading-tight">{order.tableNo}</span>
                              <span className="mt-0.5 block text-2xs text-muted-foreground">#{order.id}</span>
                            </span>
                            <span
                              className={`shrink-0 rounded-pill px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${
                                order.status === "ready" ? "bg-success-subtle text-success"
                                  : order.status === "served" ? "bg-info-subtle text-info"
                                  : "bg-warning-subtle text-warning"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {order.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
                          </p>
                          <div className="flex items-baseline justify-between gap-2 border-t border-border pt-2">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" aria-hidden /> {order.guests}
                            </span>
                            <span className="text-base font-semibold tabular-nums">{moneyShort(order.total)}</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <RevenueByDate restaurantId={restaurantId} title="Collection" />
            </div>
          ) : (
            <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-border">
              <table className="w-full min-w-[38rem] text-sm">
                <caption className="sr-only">Bills collected today. Select a row for payment details and refunds.</caption>
                <thead>
                  <tr className="border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-medium">Bill</th>
                    <th scope="col" className="px-3 py-2 font-medium">Table</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                    <th scope="col" className="px-3 py-2 font-medium">Method</th>
                    <th scope="col" className="px-3 py-2 font-medium">Time</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentBills.map(bill => (
                    <tr
                      key={bill.id}
                      onClick={() => setBillDetail(bill)}
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBillDetail(bill); } }}
                      className="cursor-pointer bg-card hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Payment details, reprint and refund"
                    >
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{bill.id}</td>
                      <td className="px-3 py-2.5 font-semibold">{bill.table}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{money(bill.amount)}</td>
                      <td className="px-3 py-2.5 uppercase text-muted-foreground">{bill.method || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{bill.time}</td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-pill bg-success-subtle px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-success">{bill.status}</span>
                      </td>
                    </tr>
                  ))}
                  {recentBills.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No bills collected yet today.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: the bill ─────────────────────────────────────────────────
          A permanent pane from 1024px — the width a floor tablet actually runs
          at in landscape. It used to appear only from 1280px, so on every real
          tablet a cashier tapped a tab and no total, and no Collect button,
          ever appeared. Below 1024 it is a sheet over the list. */}
      {panelOpen && (
        <button
          type="button"
          aria-label="Close bill"
          onClick={closeBill}
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
        />
      )}
      <aside
        className={`${panelOpen ? "flex" : "hidden"} fixed inset-y-0 right-0 z-40 w-full max-w-md flex-col border-l border-border bg-card lg:static lg:z-auto lg:flex lg:w-[23rem] lg:max-w-none xl:w-[26rem]`}
        aria-label="Bill"
      >
        {panelOpen && (
          <button
            type="button"
            onClick={closeBill}
            className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-medium text-muted-foreground hover-elevate lg:hidden"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Back to tabs
          </button>
        )}

        {!selectedOrder && !paid ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Receipt className="mb-4 h-12 w-12" aria-hidden />
            <p className="text-sm font-semibold text-foreground">No tab open</p>
            <p className="mt-1 text-sm">Pick a table on the left to build its bill.</p>
          </div>
        ) : paid ? (
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-pill border border-success-border bg-success-subtle text-success">
                <CheckCircle className="h-8 w-8" aria-hidden />
              </span>
              <h2 className="text-lg font-semibold text-success">Payment recorded</h2>
              <p className="mt-3 text-3xl font-semibold tabular-nums">{money(grandTotal)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedOrder?.tableNo} · {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}
              </p>
            </div>
            <div className="shrink-0 space-y-2 border-t border-border p-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => window.print()} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-semibold hover-elevate active-elevate-2">
                  <Printer className="h-4 w-4" aria-hidden /> Print
                </button>
                <button type="button" onClick={() => downloadInvoice(false)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-semibold hover-elevate active-elevate-2">
                  <Download className="h-4 w-4" aria-hidden /> Download
                </button>
              </div>
              <button type="button" onClick={closeBill} className="min-h-12 w-full rounded-md border border-primary-border bg-primary text-sm font-semibold text-primary-foreground hover-elevate active-elevate-2">
                Next bill
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{selectedOrder?.tableNo}</p>
                <p className="text-xs text-muted-foreground">#{selectedOrder?.id} · {selectedOrder?.guests} guests</p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold hover-elevate active-elevate-2"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden /> KOT
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 custom-scrollbar">
              {/* Lines */}
              <section>
                <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Bill lines</h3>
                <ul className="space-y-3">
                  {billItems.map((item, i) => {
                    const adjusted = item.voided || item.comped;
                    return (
                      <li key={i} className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className={`flex shrink-0 items-center gap-1 rounded-md border border-border bg-background p-0.5 ${adjusted ? "opacity-40" : ""}`}>
                            <button
                              type="button"
                              disabled={adjusted}
                              aria-label={`One fewer ${item.name}`}
                              onClick={() => setBillItems(p => p.map((it, j) => j === i ? { ...it, qty: Math.max(0, it.qty - 1) } : it).filter(it => it.qty > 0))}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover-elevate active-elevate-2 disabled:cursor-not-allowed"
                            >
                              <Minus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.qty}</span>
                            <button
                              type="button"
                              disabled={adjusted}
                              aria-label={`One more ${item.name}`}
                              onClick={() => setBillItems(p => p.map((it, j) => j === i ? { ...it, qty: it.qty + 1 } : it))}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-primary-border bg-primary text-primary-foreground hover-elevate active-elevate-2 disabled:cursor-not-allowed"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </span>
                          <span className={`min-w-0 flex-1 text-sm ${adjusted ? "text-muted-foreground line-through" : ""}`}>{item.name}</span>
                          <span className={`shrink-0 text-sm font-semibold tabular-nums ${adjusted ? "text-muted-foreground line-through" : ""}`}>
                            {money(r2(item.price * item.qty))}
                          </span>
                        </div>
                        <AdjustedLineNote voided={item.voided} comped={item.comped} reason={item.adjustReason} by={item.adjustedBy} />
                        <LineAdjustControls
                          disabled={adjusted}
                          onAdjust={(kind, reason) => adjustLine(item, kind, reason)}
                          className="pl-[5.5rem]"
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>

              <AdjustmentHistory
                restaurantId={restaurantId}
                orderId={selectedOrder ? parseInt(selectedOrder.id, 10) : null}
                refreshKey={adjustSeq}
              />

              <PrintControls
                restaurantId={restaurantId}
                orderId={selectedOrder ? parseInt(selectedOrder.id, 10) : null}
                showHistory={false}
              />

              <section>
                <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Discount</h3>
                <div className="flex gap-1.5">
                  {[0, 5, 10, 15, 20].map(d => (
                    <button key={d} type="button" onClick={() => setDiscount(d)} aria-pressed={discount === d} className={`${chip} ${discount === d ? chipOn : chipOff}`}>
                      {d === 0 ? "None" : `${d}%`}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Tip</h3>
                <div className="flex gap-1.5">
                  {[0, 20, 50, 100].map(t => (
                    <button key={t} type="button" onClick={() => setTip(t)} aria-pressed={tip === t} className={`${chip} ${tip === t ? chipOn : chipOff}`}>
                      {t === 0 ? "None" : `₹${t}`}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Split the bill</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Split between fewer people"
                    onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover-elevate active-elevate-2"
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </button>
                  <p className="flex-1 text-center text-sm tabular-nums">
                    {splitCount === 1 ? "One bill" : <>{splitCount} ways · <span className="font-semibold">{money(perPerson)}</span> each</>}
                  </p>
                  <button
                    type="button"
                    aria-label="Split between more people"
                    onClick={() => setSplitCount(Math.min(10, splitCount + 1))}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover-elevate active-elevate-2"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">How it was paid</h3>
                <p className="mb-2 text-2xs text-muted-foreground">
                  Marks the bill paid on the till. Does not charge a gateway — enter the UPI/card/tap reference the guest already settled with.
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {PAYMENT_METHODS.map(m => {
                    const on = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        aria-pressed={on}
                        className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border text-xs font-semibold transition-colors hover-elevate active-elevate-2 ${on ? chipOn : chipOff}`}
                      >
                        <m.icon className="h-5 w-5" aria-hidden />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                {REF_METHODS.includes(paymentMethod) && (
                  <input
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    aria-label="Payment reference"
                    placeholder={paymentMethod === "upi" ? "UPI ID / UTR (required)" : paymentMethod === "card" ? "Card txn / RRN (required)" : "Tap / NFC reference (required)"}
                    className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                )}
              </section>

              {/* The workings, kept small and above the total. The total itself is
                  pinned below and never scrolls out of reach. */}
              <dl className="space-y-1.5 rounded-md border border-border bg-background p-3 text-xs">
                {([
                  ["Subtotal", money(subtotal)],
                  ...(discount > 0 ? [[`Discount (${discount}%)`, `−${money(discountAmt)}`], ["Taxable value", money(taxable)]] : []),
                  [`GST (${gstLabel})`, money(gst)],
                  ...(tip > 0 ? [["Tip", money(tip)]] : []),
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 text-muted-foreground">
                    <dt>{k}</dt>
                    <dd className="tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* ── Pinned total + collect ──────────────────────────────────
                Everything above can scroll. This cannot. The amount is the
                largest number on the screen and the button repeats it, so
                there is no way to take a payment without having read it. */}
            <div className="shrink-0 border-t border-border bg-card p-4">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total to collect</p>
                  <p className="text-3xl font-semibold tabular-nums leading-tight">{money(grandTotal)}</p>
                </div>
                {splitCount > 1 && (
                  <p className="shrink-0 text-right text-xs text-muted-foreground">
                    {splitCount} ways<br /><span className="text-sm font-semibold tabular-nums text-foreground">{money(perPerson)}</span> each
                  </p>
                )}
              </div>

              <PermissionGate permission="view_orders">
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paying}
                  className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-md border border-primary-border bg-primary px-3 text-center text-base font-semibold leading-snug text-primary-foreground transition-colors hover-elevate active-elevate-2 disabled:opacity-60"
                >
                  {paying ? "Recording payment…" : <>
                    <CheckCircle className="h-5 w-5" aria-hidden />
                    Collect {money(grandTotal)} · {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}
                  </>}
                </button>
              </PermissionGate>

              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => window.print()} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs font-semibold hover-elevate active-elevate-2">
                  <Printer className="h-3.5 w-3.5" aria-hidden /> Print bill
                </button>
                <button type="button" onClick={() => downloadInvoice(true)} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs font-semibold hover-elevate active-elevate-2">
                  <Download className="h-3.5 w-3.5" aria-hidden /> GST invoice
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ── Collected bill: how it was paid, and refunds ─────────────────── */}
      {billDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4" onClick={() => setBillDetail(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Payment details"
            className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-md border border-border bg-card sm:max-h-[calc(100dvh-2rem)] sm:max-w-sm sm:rounded-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="h-4 w-4 text-primary" aria-hidden /> Payment details
              </h2>
              <button
                type="button"
                onClick={() => setBillDetail(null)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover-elevate"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar">
              <div className="text-center">
                <p className="text-3xl font-semibold tabular-nums">{money(billDetail.amount)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{billDetail.id} · {billDetail.table}</p>
              </div>

              <dl className="divide-y divide-border rounded-md border border-border">
                {([
                  ["Method", String(billDetail.method || "—").toUpperCase()],
                  ["Reference", billDetail.reference || "—"],
                  ["Collected by", billDetail.collectedBy || "—"],
                  ["Collected from", billDetail.collectedFrom || "Cashier POS"],
                  ["Time", billDetail.time || "—"],
                  ["Status", billDetail.status || "paid"],
                  ...(billDetail.refundedTotal ? [["Refunded so far", money(billDetail.refundedTotal)]] : []),
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-3 py-2 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 break-all text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>

              {billDetail.orderId ? (
                <>
                  <AdjustmentHistory restaurantId={restaurantId} orderId={billDetail.orderId} refreshKey={adjustSeq} />
                  <PrintControls restaurantId={restaurantId} orderId={billDetail.orderId} />
                  <RefundControls
                    outstanding={Math.max(0, Number(billDetail.amount ?? 0) - Number(billDetail.refundedTotal ?? 0))}
                    onRefund={(reason, amount) => refundBill(billDetail, reason, amount).then(() => setAdjustSeq(s => s + 1))}
                  />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">This bill has no linked order, so it cannot be refunded from here.</p>
              )}
            </div>

            <div className="shrink-0 border-t border-border p-4">
              <button
                type="button"
                onClick={() => setBillDetail(null)}
                className="min-h-12 w-full rounded-md border border-border bg-card text-sm font-semibold hover-elevate active-elevate-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
