import { useState, useEffect } from "react";
import { useRestaurant, type LiveOrder } from "@/contexts/RestaurantContext";
import { orders as ordersApi, menu as menuApi } from "@/lib/api";
import { splitCustomizations } from "@/lib/orderItemExtras";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Filter, Search, CheckCircle, XCircle, Clock, ChefHat,
  Truck, RefreshCw, Eye, Printer, Phone, AlertCircle, X, Loader2
} from "lucide-react";

const STATUS_CFG: Record<LiveOrder["status"], { label: string; color: string; bg: string; next?: LiveOrder["status"] }> = {
  new: { label: "New", color: "text-orange-400", bg: "bg-orange-500/20", next: "accepted" },
  accepted: { label: "Accepted", color: "text-blue-400", bg: "bg-blue-500/20", next: "preparing" },
  preparing: { label: "Preparing", color: "text-violet-400", bg: "bg-violet-500/20", next: "ready" },
  ready: { label: "Ready", color: "text-emerald-400", bg: "bg-emerald-500/20", next: "served" },
  served: { label: "Served", color: "text-teal-400", bg: "bg-teal-500/20", next: "billed" },
  billed: { label: "Billed", color: "text-white/50", bg: "bg-white/10" },
  cancelled: { label: "Cancelled", color: "text-red-400", bg: "bg-red-500/20" },
};

const TYPE_ICON: Record<string, string> = {
  "dine-in": "🍽️", "takeaway": "🛍️", "room-service": "🏨", "delivery": "🛵",
};

// How the payment was made — colour-coded so the owner can track UPI vs cash vs room bill.
const PAY_LABEL: Record<string, string> = {
  upi: "UPI", cash: "Cash", card: "Card", netbanking: "Netbanking",
  wallet: "Wallet", room_bill: "Room Bill", aggregator: "Aggregator",
};
function payMethodBadge(mode?: string) {
  const m = (mode || "cash").toLowerCase();
  const label = PAY_LABEL[m] || ((m.includes("gateway") || m.includes("online") || m.includes("razor")) ? "Gateway" : (mode || "Cash"));
  const cls = m === "upi" ? "bg-emerald-500/15 text-emerald-400"
    : m === "cash" ? "bg-amber-500/15 text-amber-400"
    : m === "card" ? "bg-blue-500/15 text-blue-400"
    : (m.includes("gateway") || m.includes("online") || m.includes("razor")) ? "bg-violet-500/15 text-violet-400"
    : m === "room_bill" ? "bg-cyan-500/15 text-cyan-400"
    : m === "aggregator" ? "bg-pink-500/15 text-pink-400"
    : "bg-white/10 text-white/50";
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${cls}`}>{label}</span>;
}

function getElapsed(date: Date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

const DEFAULT_STATUS = STATUS_CFG.new;

export default function OrderManagement() {
  const { liveOrders, updateOrderStatus, restaurantId, refreshOrders, currentStaff } = useRestaurant();
  const [filter, setFilter] = useState<"all" | LiveOrder["status"]>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "dine-in" | "takeaway" | "room-service" | "delivery">("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<LiveOrder | null>(null);
  const [newOrderForm, setNewOrderForm] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [newOrder, setNewOrder] = useState({ tableName: "", type: "dine_in", customerName: "", menuItemId: "", qty: 1 });

  useEffect(() => {
    if (!newOrderForm || !restaurantId) return;
    menuApi.items(restaurantId).then(setMenuItems).catch(() => setMenuItems([]));
  }, [newOrderForm, restaurantId]);

  async function submitNewOrder() {
    if (!restaurantId || !newOrder.menuItemId) return;
    setCreating(true);
    try {
      await ordersApi.create({
        restaurantId,
        tableName: newOrder.tableName || "Counter",
        customerName: newOrder.customerName || "Walk-in",
        type: newOrder.type,
        items: [{ menuItemId: parseInt(newOrder.menuItemId, 10), quantity: newOrder.qty }],
        paymentMethod: "cash",
        metadata: { source: "restaurant_panel", waiter: currentStaff?.name },
      });
      setNewOrderForm(false);
      setNewOrder({ tableName: "", type: "dine_in", customerName: "", menuItemId: "", qty: 1 });
      await refreshOrders();
      toast({ title: "Order created" });
    } catch (e: any) {
      console.error(e);
      // Keep the modal open so the user can retry.
      toast({ title: "Failed to create order", description: e?.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  const filtered = liveOrders.filter(o => {
    const statusMatch = filter === "all" || o.status === filter;
    const typeMatch = typeFilter === "all" || o.type === typeFilter;
    const q = search.toLowerCase();
    const searchMatch = !search
      || String(o.id).toLowerCase().includes(q)
      || String(o.tableNo ?? "").toLowerCase().includes(q)
      || String(o.waiter ?? "").toLowerCase().includes(q)
      || String(o.customerName ?? "").toLowerCase().includes(q)
      || String(o.roomNumber ?? "").toLowerCase().includes(q)
      || String(o.paymentMethod ?? "").toLowerCase().includes(q);
    return statusMatch && typeMatch && searchMatch;
  });

  const counts = {
    all: liveOrders.length,
    new: liveOrders.filter(o => o.status === "new").length,
    accepted: liveOrders.filter(o => o.status === "accepted").length,
    preparing: liveOrders.filter(o => o.status === "preparing").length,
    ready: liveOrders.filter(o => o.status === "ready").length,
    served: liveOrders.filter(o => o.status === "served").length,
    billed: liveOrders.filter(o => o.status === "billed").length,
    cancelled: liveOrders.filter(o => o.status === "cancelled").length,
  };

  return (
    <div className="flex h-full">
      {/* Main */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold">Order Management</h1>
            <p className="text-xs text-white/40">{liveOrders.filter(o => !["billed", "cancelled"].includes(o.status)).length} active orders</p>
          </div>
          <button onClick={() => setNewOrderForm(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold transition-all shadow-lg shadow-amber-500/20">
            <Plus className="h-4 w-4" /> New Order
          </button>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {(["all", "new", "accepted", "preparing", "ready", "served", "billed", "cancelled"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filter === s ? `${s !== "all" ? STATUS_CFG[s as LiveOrder["status"]]?.bg : "bg-amber-500/20"} border-amber-500/40 text-white` : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}
            >
              {s === "all" ? "All" : STATUS_CFG[s as LiveOrder["status"]]?.label}
              <span className={`h-4 min-w-4 px-1 rounded-full text-xs font-bold flex items-center justify-center ${filter === s ? "bg-white/20 text-white" : "bg-white/10 text-white/40"}`}>
                {counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Type Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30"
              placeholder="Search order ID, table, waiter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(["all", "dine-in", "takeaway", "room-service"] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`shrink-0 px-2.5 py-2 rounded-xl text-xs border transition-all ${typeFilter === t ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/50"}`}>
                {t === "all" ? "All" : TYPE_ICON[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(order => {
            const cfg = STATUS_CFG[order.status] ?? DEFAULT_STATUS;
            const elapsed = Math.floor((Date.now() - new Date(order.placedAt).getTime()) / 60000);
            const isUrgent = elapsed > 25 && !["served", "billed", "cancelled"].includes(order.status);
            return (
              <div
                key={order.id}
                className={`rounded-2xl border p-4 cursor-pointer hover:border-amber-500/30 transition-all ${isUrgent ? "border-red-500/40 bg-red-500/5" : "border-white/8 bg-white/[0.03]"}`}
                onClick={() => setSelectedOrder(order)}
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base">{TYPE_ICON[order.type]}</span>
                      <span className="font-bold text-sm">{order.tableNo}</span>
                      {order.roomNumber && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">Room {order.roomNumber}</span>}
                      {payMethodBadge(order.paymentMethod)}
                      <span className="text-xs text-white/30">{order.id}</span>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{order.customerName || order.waiter} · {order.guests} guests</p>
                    {order.customerPhone && <p className="text-xs text-white/40 flex items-center gap-1"><Phone className="h-3 w-3" />{order.customerPhone}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    <p className={`text-xs mt-1 ${isUrgent ? "text-red-400 font-semibold" : "text-white/30"}`}>{getElapsed(order.placedAt)}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1.5 mb-3">
                  {order.items.slice(0, 3).map((item, i) => {
                    const { removes, prefs } = splitCustomizations(item.customizations);
                    const adds = Array.isArray(item.addons) ? item.addons.map(a => a.name) : [];
                    return (
                      <div key={i} className="text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.status === "ready" ? "bg-emerald-400" : item.status === "preparing" ? "bg-blue-400 animate-pulse" : "bg-white/20"}`} />
                            <span className="text-white/70 truncate">{item.qty}× {item.name}</span>
                          </div>
                          <span className="text-white/40 shrink-0">₹{item.subtotal && item.subtotal > 0 ? item.subtotal : item.price * item.qty}</span>
                        </div>
                        {adds.length > 0 && <p className="text-[10px] text-emerald-300/90 ml-3.5 truncate">➕ {adds.join(", ")}</p>}
                        {removes.length > 0 && <p className="text-[10px] text-rose-300/90 ml-3.5 truncate">➖ {removes.join(", ")}</p>}
                        {prefs.length > 0 && <p className="text-[10px] text-cyan-300/80 ml-3.5 truncate">⚡ {prefs.join(", ")}</p>}
                      </div>
                    );
                  })}
                  {order.items.length > 3 && <p className="text-xs text-white/30">+{order.items.length - 3} more items</p>}
                </div>

                {order.specialReq && (
                  <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-500/10 rounded-lg px-2 py-1 mb-3">
                    <AlertCircle className="h-3 w-3" />
                    {order.specialReq}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-white/8">
                  <span className="font-bold text-amber-400">₹{order.total}</span>
                  <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                    {order.status === "new" && (
                      <>
                        <button onClick={() => updateOrderStatus(order.id, "accepted")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 border border-emerald-500/30">
                          <CheckCircle className="h-3 w-3" /> Accept
                        </button>
                        <button onClick={() => updateOrderStatus(order.id, "cancelled")} className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 border border-red-500/30">
                          <XCircle className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    {cfg.next && order.status !== "new" && (
                      <button onClick={() => updateOrderStatus(order.id, cfg.next!)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 border border-amber-500/30">
                        {cfg.next === "preparing" ? <ChefHat className="h-3 w-3" /> : cfg.next === "ready" ? <CheckCircle className="h-3 w-3" /> : cfg.next === "served" ? <Truck className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                        {STATUS_CFG[cfg.next!]?.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-white/30">
              <div className="text-5xl mb-4">📋</div>
              <p className="font-semibold">No orders found</p>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Panel */}
      {selectedOrder && (() => {
        const detailCfg = STATUS_CFG[selectedOrder.status] ?? DEFAULT_STATUS;
        return (
        <div className="hidden xl:flex w-80 border-l border-white/5 flex-col bg-[#0e1520]">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h3 className="font-bold">Order Details</h3>
            <button onClick={() => setSelectedOrder(null)} className="text-white/40 hover:text-white">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="rounded-xl bg-white/5 p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold">{selectedOrder.tableNo}</p>
                  <p className="text-xs text-white/40">{selectedOrder.id}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${detailCfg.bg} ${detailCfg.color}`}>
                  {detailCfg.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-white/50">
                <div>Type: <span className="text-white capitalize">{selectedOrder.type}</span></div>
                <div>Guests: <span className="text-white">{selectedOrder.guests}</span></div>
                <div>Customer: <span className="text-white">{selectedOrder.customerName || "—"}</span></div>
                <div>Mobile: <span className="text-white">{selectedOrder.customerPhone || "—"}</span></div>
                <div>Table: <span className="text-white">{selectedOrder.tableNo}</span></div>
                {selectedOrder.roomNumber && <div>Room: <span className="text-white">{selectedOrder.roomNumber}</span></div>}
                <div className="flex items-center gap-1.5">Payment: {payMethodBadge(selectedOrder.paymentMethod)}</div>
                {selectedOrder.paymentStatus && <div>Pay status: <span className="text-white capitalize">{selectedOrder.paymentStatus}</span></div>}
                <div>Time: <span className="text-white">{getElapsed(selectedOrder.placedAt)}</span></div>
              </div>

              {/* Full payment breakdown — how it was paid (UPI id / UTR), by whom and from which panel */}
              {(selectedOrder.upiId || selectedOrder.utr || selectedOrder.collectedBy || selectedOrder.collectedFrom) && (
                <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-3 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80">Payment received</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-white/50">
                    {selectedOrder.upiId && <div>UPI ID: <span className="text-white break-all">{selectedOrder.upiId}</span></div>}
                    {selectedOrder.utr && <div>UTR / Ref: <span className="text-white break-all">{selectedOrder.utr}</span></div>}
                    {selectedOrder.collectedBy && <div>Collected by: <span className="text-white">{selectedOrder.collectedBy}</span></div>}
                    {selectedOrder.collectedFrom && <div>From panel: <span className="text-white">{selectedOrder.collectedFrom}</span></div>}
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Items</p>
              {selectedOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between items-start gap-3 py-2 border-b border-white/5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                      {item.qty}× {item.name}
                      {item.variant && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">{item.variant}</span>}
                    </p>
                    {Array.isArray(item.addons) && item.addons.length > 0 && (
                      <p className="text-xs text-emerald-300/90 mt-0.5">➕ Add: {item.addons.map(a => `${a.name}${a.price ? ` (₹${a.price})` : ""}`).join(", ")}</p>
                    )}
                    {(() => { const { removes, prefs } = splitCustomizations(item.customizations); return (<>
                      {removes.length > 0 && <p className="text-xs text-rose-300/90 mt-0.5">➖ Remove: {removes.join(", ")}</p>}
                      {prefs.length > 0 && <p className="text-xs text-cyan-300/80 mt-0.5">⚡ {prefs.join(" · ")}</p>}
                    </>); })()}
                    {item.notes && <p className="text-xs text-yellow-300/80 mt-0.5">📝 {item.notes}</p>}
                    <span className={`text-xs ${item.status === "ready" ? "text-emerald-400" : item.status === "preparing" ? "text-blue-400" : "text-white/30"}`}>{item.status}</span>
                  </div>
                  <span className="text-amber-400 font-semibold shrink-0">₹{item.subtotal && item.subtotal > 0 ? item.subtotal : item.price * item.qty}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold mt-2 pt-2">
                <span>Total</span>
                <span className="text-amber-400">₹{selectedOrder.total}</span>
              </div>
            </div>

            {selectedOrder.specialReq && (
              <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-300">
                ⚠️ {selectedOrder.specialReq}
              </div>
            )}

            <div className="space-y-2">
              {detailCfg.next && (
                <button
                  onClick={() => { updateOrderStatus(selectedOrder.id, detailCfg.next!); setSelectedOrder(null); }}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-semibold text-sm"
                >
                  Mark as {STATUS_CFG[detailCfg.next!]?.label ?? detailCfg.next}
                </button>
              )}
              <button onClick={() => window.print()} className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold flex items-center justify-center gap-2">
                <Printer className="h-4 w-4" /> Print KOT
              </button>
              {selectedOrder.status !== "cancelled" && (
                <button onClick={() => { updateOrderStatus(selectedOrder.id, "cancelled"); setSelectedOrder(null); }} className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm font-semibold">
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {newOrderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#121a26] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">New Order</h3>
              <button onClick={() => setNewOrderForm(false)} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" placeholder="Table / Counter" value={newOrder.tableName} onChange={e => setNewOrder(o => ({ ...o, tableName: e.target.value }))} />
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" placeholder="Customer name" value={newOrder.customerName} onChange={e => setNewOrder(o => ({ ...o, customerName: e.target.value }))} />
              <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" value={newOrder.menuItemId} onChange={e => setNewOrder(o => ({ ...o, menuItemId: e.target.value }))}>
                <option value="">Select menu item</option>
                {menuItems.map((m: any) => <option key={m.id} value={m.id}>{m.name} — ₹{m.discountedPrice || m.price}</option>)}
              </select>
              <input type="number" min={1} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" placeholder="Quantity" value={newOrder.qty} onChange={e => setNewOrder(o => ({ ...o, qty: parseInt(e.target.value, 10) || 1 }))} />
            </div>
            <button disabled={creating || !newOrder.menuItemId} onClick={submitNewOrder} className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
