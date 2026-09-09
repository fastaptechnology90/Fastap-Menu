import { useState, useEffect, useCallback } from "react";
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
  Plus, Minus, Trash2, CheckCircle, Printer, Download, Search, X, ChevronLeft
} from "lucide-react";

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI", icon: Smartphone, color: "text-info", bg: "bg-info-subtle" },
  { id: "card", label: "Card", icon: CreditCard, color: "text-muted-foreground", bg: "bg-muted" },
  { id: "cash", label: "Cash", icon: Banknote, color: "text-success", bg: "bg-success-subtle" },
  { id: "wallet", label: "Wallet", icon: Wallet, color: "text-primary", bg: "bg-primary/20" },
  { id: "nfc", label: "NFC Tap", icon: Nfc, color: "text-muted-foreground", bg: "bg-muted" },
];

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

export default function BillingPOS() {
  const { liveOrders, tables, updateOrderStatus, refreshOrders, restaurantId, isRestaurantPublished, currentStaff } = useRestaurant();
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
  const [coupon, setCoupon] = useState("");
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
    setPaying(true);
    try {
      const orderId = parseInt(selectedOrder.id, 10);
      const isUpiLike = paymentMethod === "upi" || paymentMethod === "card" || paymentMethod === "nfc";
      if (!Number.isNaN(orderId) && restaurantId) {
        await ordersApi.update(restaurantId, orderId, {
          status: "completed",
          paymentMethod,
          paymentStatus: "paid",
          tipAmount: tip,
          finalTotal: grandTotal,   // record exactly what was collected (incl. discount/tip)
          collectedBy: currentStaff?.name || "Cashier",
          collectedFrom: "Cashier POS",
          ...(isUpiLike && reference ? (paymentMethod === "upi" ? { upiId: reference } : { utr: reference }) : {}),
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

  return (
    <div className="flex h-full">
      {/* Left: Order Selection */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Billing & POS</h1>
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            <button onClick={() => setTab("new")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Active Bills</button>
            <button onClick={() => setTab("recent")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === "recent" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Recent</button>
          </div>
        </div>

        {tab === "new" && (
          <>
            <RevenueByDate restaurantId={restaurantId} title="Collection" />
            {/* Today's Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Today's Collection", value: `₹${todayStats.collection.toLocaleString("en-IN")}`, color: "text-success" },
                { label: "Bills Generated", value: String(todayStats.bills), color: "text-info" },
                { label: "Avg Bill Value", value: `₹${Math.round(todayStats.avgBill).toLocaleString("en-IN")}`, color: "text-primary" },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-card border border-border p-3 text-center">
                  <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground" placeholder="Search table..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {billableOrders.filter(o => !search || o.tableNo.toLowerCase().includes(search.toLowerCase())).map(order => (
                <button
                  key={order.id}
                  onClick={() => loadOrder(order)}
                  className={`rounded-lg border p-4 text-left hover:border-primary/30 transition-colors ${selectedOrder?.id === order.id ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-lg">{order.tableNo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === "ready" ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning"}`}>{order.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{order.items.map(i => `${i.qty}× ${i.name}`).join(", ")}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{order.guests} guests</span>
                    <span className="font-semibold text-primary">₹{order.total}</span>
                  </div>
                </button>
              ))}
              {billableOrders.length === 0 && (
                <div className="col-span-2 text-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-3" />
                  <p>No active orders to bill</p>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "recent" && (
          <div className="rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card text-xs text-muted-foreground">
                    {["Bill ID", "Table", "Amount", "Method", "Time", "Status"].map(h => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentBills.map(bill => (
                    <tr key={bill.id} onClick={() => setBillDetail(bill)} className="hover:bg-muted cursor-pointer" title="Click to view payment details">
                      <td className="px-4 py-3 font-mono text-xs">{bill.id}</td>
                      <td className="px-4 py-3 font-semibold">{bill.table}</td>
                      <td className="px-4 py-3 font-semibold text-primary">₹{bill.amount.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-muted-foreground uppercase">{bill.method}</td>
                      <td className="px-4 py-3 text-muted-foreground">{bill.time}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-success-subtle text-success px-2 py-0.5 rounded-full">{bill.status}</span></td>
                    </tr>
                  ))}
                  {recentBills.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No bills collected yet today.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Right: Bill Panel.
          This was `hidden xl:flex`, so on anything narrower than 1280px — which is every
          tablet a restaurant actually uses — a cashier tapped an order and nothing
          appeared: no total, no Collect button. Below xl it now slides in as a full-height
          sheet once an order is selected, and stays the fixed sidebar from xl upwards. */}
      {(selectedOrder || paid) && (
        <button
          type="button"
          aria-label="Close bill"
          onClick={() => { setSelectedOrder(null); setPaid(false); setBillItems([]); }}
          className="xl:hidden fixed inset-0 z-30 bg-foreground/40"
        />
      )}
      <div
        className={`${selectedOrder || paid ? "flex" : "hidden"} fixed inset-y-0 right-0 z-40 w-full max-w-md
          xl:static xl:flex xl:w-96 xl:max-w-none xl:z-auto
          border-l border-border flex-col bg-card`}
      >
        {/* Only needed while the panel is a sheet — at xl it is a permanent sidebar. */}
        {(selectedOrder || paid) && (
          <button
            onClick={() => { setSelectedOrder(null); setPaid(false); setBillItems([]); }}
            className="xl:hidden flex items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b border-border"
          >
            <ChevronLeft className="h-4 w-4" /> Back to orders
          </button>
        )}
        {!selectedOrder && !paid ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <Receipt className="h-16 w-16 mb-4" />
            <p className="font-semibold">Select an order to generate bill</p>
          </div>
        ) : paid ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="h-20 w-20 rounded-full bg-success-subtle border-2 border-success-border flex items-center justify-center mb-5">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h3 className="text-xl font-semibold text-success mb-1">Payment Successful!</h3>
            <p className="text-muted-foreground text-sm mb-1">{selectedOrder?.tableNo} · ₹{grandTotal}</p>
            <p className="text-xs text-muted-foreground">{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}</p>
            <div className="flex gap-2 mt-6 w-full">
              <button onClick={() => window.print()} className="flex-1 py-3 rounded-lg border border-border hover:bg-muted text-sm font-semibold flex items-center justify-center gap-2"><Printer className="h-4 w-4" /> Print</button>
              <button onClick={() => downloadInvoice(false)} className="flex-1 py-3 rounded-lg border border-border hover:bg-muted text-sm font-semibold flex items-center justify-center gap-2"><Download className="h-4 w-4" /> PDF</button>
            </div>
            <button onClick={() => { setSelectedOrder(null); setPaid(false); setBillItems([]); }} className="mt-2 w-full py-3 rounded-lg bg-primary hover:bg-primary/90 text-sm font-semibold">New Bill</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <p className="font-semibold">{selectedOrder?.tableNo}</p>
                <p className="text-xs text-muted-foreground">{selectedOrder?.id} · {selectedOrder?.guests} guests</p>
              </div>
              <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted"><Printer className="h-3.5 w-3.5" /> KOT</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Items */}
              <div className="space-y-2.5">
                {billItems.map((item, i) => {
                  const adjusted = item.voided || item.comped;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 bg-muted rounded-lg p-0.5 ${adjusted ? "opacity-40" : ""}`}>
                          <button disabled={adjusted} onClick={() => setBillItems(p => p.map((it, j) => j === i ? { ...it, qty: Math.max(0, it.qty - 1) } : it).filter(it => it.qty > 0))} className="h-6 w-6 rounded-md bg-muted flex items-center justify-center hover-elevate disabled:cursor-not-allowed"><Minus className="h-3 w-3" /></button>
                          <span className="w-5 text-center text-xs font-semibold">{item.qty}</span>
                          <button disabled={adjusted} onClick={() => setBillItems(p => p.map((it, j) => j === i ? { ...it, qty: it.qty + 1 } : it))} className="h-6 w-6 rounded-md bg-primary flex items-center justify-center hover:bg-primary/90 disabled:cursor-not-allowed"><Plus className="h-3 w-3" /></button>
                        </div>
                        <span className={`flex-1 text-sm ${adjusted ? "line-through text-muted-foreground" : ""}`}>{item.name}</span>
                        <span className={`font-semibold text-sm ${adjusted ? "line-through text-muted-foreground" : "text-primary"}`}>₹{r2(item.price * item.qty)}</span>
                      </div>
                      <AdjustedLineNote voided={item.voided} comped={item.comped} reason={item.adjustReason} by={item.adjustedBy} />
                      <LineAdjustControls
                        disabled={adjusted}
                        onAdjust={(kind, reason) => adjustLine(item, kind, reason)}
                        className="pl-[4.25rem]"
                      />
                    </div>
                  );
                })}
              </div>

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

              {/* Discount */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Discount</p>
                <div className="flex gap-2">
                  {[0, 5, 10, 15, 20].map(d => (
                    <button key={d} onClick={() => setDiscount(d)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${discount === d ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                      {d === 0 ? "None" : `${d}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tip */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Tip</p>
                <div className="flex gap-2">
                  {[0, 20, 50, 100].map(t => (
                    <button key={t} onClick={() => setTip(t)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${tip === t ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                      {t === 0 ? "None" : `₹${t}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Split Bill</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSplitCount(Math.max(1, splitCount - 1))} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                  <span className="flex-1 text-center text-sm">{splitCount === 1 ? "No split" : `${splitCount} ways`}</span>
                  <button onClick={() => setSplitCount(Math.min(10, splitCount + 1))} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                </div>
              </div>

              {/* Bill Summary */}
              <div className="rounded-lg bg-muted p-3 space-y-1.5 text-xs">
                {[
                  ["Subtotal", `₹${subtotal}`],
                  discount > 0 && [`Discount (${discount}%)`, `-₹${discountAmt}`],
                  discount > 0 && ["Taxable value", `₹${taxable}`],
                  [`GST (${gstLabel})`, `₹${gst}`],
                  tip > 0 && ["Tip", `₹${tip}`],
                ].filter(Boolean).map((row: any) => (
                  <div key={row[0]} className="flex justify-between text-muted-foreground">
                    <span>{row[0]}</span>
                    <span>{row[1]}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-1.5 flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span className="text-primary">₹{grandTotal}</span>
                </div>
                {splitCount > 1 && (
                  <div className="text-center text-success font-semibold pt-1 border-t border-border">
                    ₹{perPerson} / person
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Payment Method</p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${paymentMethod === m.id ? `${m.bg} border-current ${m.color}` : "border-border bg-muted text-muted-foreground"}`}>
                      <m.icon className="h-4 w-4" />
                      <span className="text-xs">{m.label}</span>
                    </button>
                  ))}
                </div>
                {(paymentMethod === "upi" || paymentMethod === "card" || paymentMethod === "nfc") && (
                  <input
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder={paymentMethod === "upi" ? "UPI ID / UTR number (optional)" : paymentMethod === "card" ? "Card txn / RRN (optional)" : "NFC txn reference (optional)"}
                    className="mt-2 w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"
                  />
                )}
              </div>
            </div>

            {/* Pay Button */}
            <div className="p-4 border-t border-border space-y-2">
              <PermissionGate permission="view_orders">
              <button onClick={handlePay} disabled={paying} className="w-full py-3.5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-60 font-semibold text-base shadow-xl flex items-center justify-center gap-2 transition-colors">
                {paying ? "Processing…" : <>Collect ₹{grandTotal.toLocaleString()} <CheckCircle className="h-5 w-5" /></>}
              </button>
              </PermissionGate>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="flex-1 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold flex items-center justify-center gap-1"><Printer className="h-3.5 w-3.5" /> Print Bill</button>
                <button onClick={() => downloadInvoice(true)} className="flex-1 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold flex items-center justify-center gap-1"><Download className="h-3.5 w-3.5" /> GST Invoice</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bill payment detail — click a recent bill to see how the payment was made */}
      {billDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={() => setBillDetail(null)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card text-foreground max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Payment details</h3>
              <button onClick={() => setBillDetail(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="text-center py-2">
                <p className="text-3xl font-semibold text-primary">₹{Number(billDetail.amount).toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mt-1">{billDetail.id} · {billDetail.table}</p>
              </div>
              {[
                ["Payment method", String(billDetail.method || "—").toUpperCase()],
                ["Reference (UPI/UTR)", billDetail.reference || "—"],
                ["Collected by", billDetail.collectedBy || "—"],
                ["Collected from", billDetail.collectedFrom || "Cashier POS"],
                ["Time", billDetail.time || "—"],
                ["Status", billDetail.status || "paid"],
                ...(billDetail.refundedTotal ? [["Refunded so far", `₹${Number(billDetail.refundedTotal).toFixed(2)}`]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-border pb-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-right break-all">{v}</span>
                </div>
              ))}

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
          </div>
        </div>
      )}
    </div>
  );
}
