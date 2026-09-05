import { useState, useEffect, useCallback } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { orders as ordersApi, restaurantApi } from "@/lib/api";
import { downloadText } from "@/lib/download";
import type { RecentBill } from "@/lib/restaurant-types";
import { emptyPosStatsDisplay } from "@/lib/restaurantPublication";
import { PermissionGate } from "@/components/restaurant/PermissionGate";
import { RevenueByDate } from "@/components/restaurant/RevenueByDate";
import {
  Receipt, CreditCard, Smartphone, Banknote, Wallet, Nfc,
  Plus, Minus, Trash2, CheckCircle, Printer, Download, Search, X
} from "lucide-react";

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI", icon: Smartphone, color: "text-blue-400", bg: "bg-blue-500/20" },
  { id: "card", label: "Card", icon: CreditCard, color: "text-violet-400", bg: "bg-violet-500/20" },
  { id: "cash", label: "Cash", icon: Banknote, color: "text-emerald-400", bg: "bg-emerald-500/20" },
  { id: "wallet", label: "Wallet", icon: Wallet, color: "text-amber-400", bg: "bg-amber-500/20" },
  { id: "nfc", label: "NFC Tap", icon: Nfc, color: "text-pink-400", bg: "bg-pink-500/20" },
];

interface BillItem { name: string; qty: number; price: number; }

export default function BillingPOS() {
  const { liveOrders, tables, updateOrderStatus, restaurantId, isRestaurantPublished, currentStaff } = useRestaurant();
  const [selectedOrder, setSelectedOrder] = useState<typeof liveOrders[0] | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [reference, setReference] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tip, setTip] = useState(0);
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
    // Bill the order's ACTUAL amount: derive the unit price from the stored line subtotal
    // (÷ qty) so the POS total matches the order total, instead of a possibly-stale unit price.
    setBillItems(order.items.map(i => {
      const qty = i.qty || 1;
      // Keep FULL precision on the unit price (subtotal ÷ qty) so re-summing reproduces the
      // order's exact subtotal — rounding the unit here is what introduced a ₹0.01 drift.
      const unit = i.subtotal && i.subtotal > 0 ? (i.subtotal / qty) : i.price;
      return { name: i.name, qty, price: unit };
    }));
    setPaid(false);
    setDiscount(0);
    setTip(0);
  }

  // Keep 2-decimal precision (don't round GST to whole rupees) so the POS total matches the
  // order's exact amount — no ₹ mismatch between the bill card and what's collected.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal = r2(billItems.reduce((s, i) => s + i.price * i.qty, 0));
  const gst = r2(subtotal * 0.05);
  const discountAmt = r2(subtotal * discount / 100);
  const grandTotal = r2(subtotal + gst - discountAmt + tip);
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
      ...billItems.map(i => `${i.name} x${i.qty} @ ₹${r2(i.price)} = ₹${r2(i.price * i.qty)}`),
      "",
      `Subtotal: ₹${subtotal}`,
      `GST (5%): ₹${gst}`,
      `Discount: ₹${discountAmt}`,
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
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* Left: Order Selection */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold">Billing & POS</h1>
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
            <button onClick={() => setTab("new")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === "new" ? "bg-amber-500 text-white" : "text-white/50"}`}>Active Bills</button>
            <button onClick={() => setTab("recent")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === "recent" ? "bg-amber-500 text-white" : "text-white/50"}`}>Recent</button>
          </div>
        </div>

        {tab === "new" && (
          <>
            <RevenueByDate restaurantId={restaurantId} title="Collection" />
            {/* Today's Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Today's Collection", value: `₹${todayStats.collection.toLocaleString("en-IN")}`, color: "text-emerald-400" },
                { label: "Bills Generated", value: String(todayStats.bills), color: "text-blue-400" },
                { label: "Avg Bill Value", value: `₹${Math.round(todayStats.avgBill).toLocaleString("en-IN")}`, color: "text-amber-400" },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
                  <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" placeholder="Search table..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {billableOrders.filter(o => !search || o.tableNo.toLowerCase().includes(search.toLowerCase())).map(order => (
                <button
                  key={order.id}
                  onClick={() => loadOrder(order)}
                  className={`rounded-2xl border p-4 text-left hover:border-amber-500/30 transition-all ${selectedOrder?.id === order.id ? "border-amber-500/50 bg-amber-500/10" : "border-white/8 bg-white/[0.03]"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-lg">{order.tableNo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === "ready" ? "bg-emerald-500/20 text-emerald-400" : "bg-orange-500/20 text-orange-400"}`}>{order.status}</span>
                  </div>
                  <p className="text-xs text-white/40 mb-1">{order.items.map(i => `${i.qty}× ${i.name}`).join(", ")}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/30">{order.guests} guests</span>
                    <span className="font-bold text-amber-400">₹{order.total}</span>
                  </div>
                </button>
              ))}
              {billableOrders.length === 0 && (
                <div className="col-span-2 text-center py-12 text-white/30">
                  <Receipt className="h-12 w-12 mx-auto mb-3" />
                  <p>No active orders to bill</p>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "recent" && (
          <div className="rounded-2xl border border-white/8 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02] text-xs text-white/40">
                    {["Bill ID", "Table", "Amount", "Method", "Time", "Status"].map(h => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentBills.map(bill => (
                    <tr key={bill.id} onClick={() => setBillDetail(bill)} className="hover:bg-white/5 cursor-pointer" title="Click to view payment details">
                      <td className="px-4 py-3 font-mono text-xs">{bill.id}</td>
                      <td className="px-4 py-3 font-semibold">{bill.table}</td>
                      <td className="px-4 py-3 font-bold text-amber-400">₹{bill.amount.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-white/60 uppercase">{bill.method}</td>
                      <td className="px-4 py-3 text-white/40">{bill.time}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">{bill.status}</span></td>
                    </tr>
                  ))}
                  {recentBills.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30 text-sm">No bills collected yet today.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Right: Bill Panel */}
      <div className="hidden xl:flex w-96 border-l border-white/5 flex-col bg-[#0e1520]">
        {!selectedOrder && !paid ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20 p-8 text-center">
            <Receipt className="h-16 w-16 mb-4" />
            <p className="font-semibold">Select an order to generate bill</p>
          </div>
        ) : paid ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="h-20 w-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mb-5">
              <CheckCircle className="h-10 w-10 text-emerald-400" />
            </div>
            <h3 className="text-xl font-extrabold text-emerald-400 mb-1">Payment Successful!</h3>
            <p className="text-white/50 text-sm mb-1">{selectedOrder?.tableNo} · ₹{grandTotal}</p>
            <p className="text-xs text-white/30">{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}</p>
            <div className="flex gap-2 mt-6 w-full">
              <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold flex items-center justify-center gap-2"><Printer className="h-4 w-4" /> Print</button>
              <button onClick={() => downloadInvoice(false)} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold flex items-center justify-center gap-2"><Download className="h-4 w-4" /> PDF</button>
            </div>
            <button onClick={() => { setSelectedOrder(null); setPaid(false); setBillItems([]); }} className="mt-2 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold">New Bill</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div>
                <p className="font-bold">{selectedOrder?.tableNo}</p>
                <p className="text-xs text-white/40">{selectedOrder?.id} · {selectedOrder?.guests} guests</p>
              </div>
              <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs hover:bg-white/5"><Printer className="h-3.5 w-3.5" /> KOT</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Items */}
              <div className="space-y-2">
                {billItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-white/5 rounded-lg p-0.5">
                      <button onClick={() => setBillItems(p => p.map((it, j) => j === i ? { ...it, qty: Math.max(0, it.qty - 1) } : it).filter(it => it.qty > 0))} className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center hover:bg-white/20"><Minus className="h-3 w-3" /></button>
                      <span className="w-5 text-center text-xs font-bold">{item.qty}</span>
                      <button onClick={() => setBillItems(p => p.map((it, j) => j === i ? { ...it, qty: it.qty + 1 } : it))} className="h-6 w-6 rounded-md bg-amber-500 flex items-center justify-center hover:bg-amber-400"><Plus className="h-3 w-3" /></button>
                    </div>
                    <span className="flex-1 text-sm">{item.name}</span>
                    <span className="text-amber-400 font-semibold text-sm">₹{r2(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>

              {/* Discount */}
              <div>
                <p className="text-xs text-white/40 mb-2">Discount</p>
                <div className="flex gap-2">
                  {[0, 5, 10, 15, 20].map(d => (
                    <button key={d} onClick={() => setDiscount(d)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${discount === d ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/50"}`}>
                      {d === 0 ? "None" : `${d}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tip */}
              <div>
                <p className="text-xs text-white/40 mb-2">Tip</p>
                <div className="flex gap-2">
                  {[0, 20, 50, 100].map(t => (
                    <button key={t} onClick={() => setTip(t)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${tip === t ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/50"}`}>
                      {t === 0 ? "None" : `₹${t}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split */}
              <div>
                <p className="text-xs text-white/40 mb-2">Split Bill</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSplitCount(Math.max(1, splitCount - 1))} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                  <span className="flex-1 text-center text-sm">{splitCount === 1 ? "No split" : `${splitCount} ways`}</span>
                  <button onClick={() => setSplitCount(Math.min(10, splitCount + 1))} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                </div>
              </div>

              {/* Bill Summary */}
              <div className="rounded-xl bg-white/5 p-3 space-y-1.5 text-xs">
                {[
                  ["Subtotal", `₹${subtotal}`],
                  ["GST (5%)", `₹${gst}`],
                  discount > 0 && [`Discount (${discount}%)`, `-₹${discountAmt}`],
                  tip > 0 && ["Tip", `₹${tip}`],
                ].filter(Boolean).map((row: any) => (
                  <div key={row[0]} className="flex justify-between text-white/50">
                    <span>{row[0]}</span>
                    <span>{row[1]}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-1.5 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-amber-400">₹{grandTotal}</span>
                </div>
                {splitCount > 1 && (
                  <div className="text-center text-emerald-400 font-semibold pt-1 border-t border-white/10">
                    ₹{perPerson} / person
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <p className="text-xs text-white/40 mb-2">Payment Method</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${paymentMethod === m.id ? `${m.bg} border-current ${m.color}` : "border-white/10 bg-white/5 text-white/40"}`}>
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
                    className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500/40 placeholder:text-white/30"
                  />
                )}
              </div>
            </div>

            {/* Pay Button */}
            <div className="p-4 border-t border-white/5 space-y-2">
              <PermissionGate permission="view_orders">
              <button onClick={handlePay} disabled={paying} className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 font-bold text-base shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all">
                {paying ? "Processing…" : <>Collect ₹{grandTotal.toLocaleString()} <CheckCircle className="h-5 w-5" /></>}
              </button>
              </PermissionGate>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="flex-1 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-semibold flex items-center justify-center gap-1"><Printer className="h-3.5 w-3.5" /> Print Bill</button>
                <button onClick={() => downloadInvoice(true)} className="flex-1 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-semibold flex items-center justify-center gap-1"><Download className="h-3.5 w-3.5" /> GST Invoice</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bill payment detail — click a recent bill to see how the payment was made */}
      {billDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setBillDetail(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111827] text-white" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="font-bold flex items-center gap-2"><Receipt className="h-5 w-5 text-amber-400" /> Payment details</h3>
              <button onClick={() => setBillDetail(null)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="text-center py-2">
                <p className="text-3xl font-extrabold text-amber-400">₹{Number(billDetail.amount).toLocaleString("en-IN")}</p>
                <p className="text-xs text-white/40 mt-1">{billDetail.id} · {billDetail.table}</p>
              </div>
              {[
                ["Payment method", String(billDetail.method || "—").toUpperCase()],
                ["Reference (UPI/UTR)", billDetail.reference || "—"],
                ["Collected by", billDetail.collectedBy || "—"],
                ["Collected from", billDetail.collectedFrom || "Cashier POS"],
                ["Time", billDetail.time || "—"],
                ["Status", billDetail.status || "paid"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-white/5 pb-2">
                  <span className="text-white/40">{k}</span>
                  <span className="font-medium text-right break-all">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
