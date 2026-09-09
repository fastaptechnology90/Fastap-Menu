import { useState, useEffect, useMemo } from "react";
import { useRestaurant, type LiveOrder } from "@/contexts/RestaurantContext";
import { orders as ordersApi, menu as menuApi, orderAdjustments, floorOps } from "@/lib/api";
import { splitCustomizations } from "@/lib/orderItemExtras";
import { toast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { PrintControls } from "@/components/restaurant/PrintControls";
import {
  AdjustedLineNote, AdjustmentHistory, LineAdjustControls, RefundControls,
  type AdjustKind,
} from "@/components/restaurant/BillAdjustments";
import {
  Plus, Filter, Search, CheckCircle, XCircle, Clock, ChefHat,
  Truck, RefreshCw, Eye, Printer, Phone, AlertCircle, X, Loader2,
  ArrowRightLeft, Split, Merge, Wallet, ClipboardList, StickyNote, AlertTriangle, UtensilsCrossed, ShoppingBag, Hotel, Bike } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STATUS_CFG: Record<LiveOrder["status"], { label: string; color: string; bg: string; next?: LiveOrder["status"] }> = {
  new: { label: "New", color: "text-warning", bg: "bg-warning-subtle", next: "accepted" },
  accepted: { label: "Accepted", color: "text-info", bg: "bg-info-subtle", next: "preparing" },
  preparing: { label: "Preparing", color: "text-muted-foreground", bg: "bg-muted", next: "ready" },
  ready: { label: "Ready", color: "text-success", bg: "bg-success-subtle", next: "served" },
  served: { label: "Served", color: "text-success", bg: "bg-success-subtle", next: "billed" },
  billed: { label: "Billed", color: "text-muted-foreground", bg: "bg-muted" },
  cancelled: { label: "Cancelled", color: "text-danger", bg: "bg-danger-subtle" },
};

const TYPE_ICON: Record<string, LucideIcon> = {
  "dine-in": UtensilsCrossed, "takeaway": ShoppingBag, "room-service": Hotel, "delivery": Bike,
};

// How the payment was made — colour-coded so the owner can track UPI vs cash vs room bill.
const PAY_LABEL: Record<string, string> = {
  upi: "UPI", cash: "Cash", card: "Card", netbanking: "Netbanking",
  wallet: "Wallet", nfc: "NFC", room_bill: "Room Bill", aggregator: "Aggregator",
};
function payMethodBadge(mode?: string) {
  // No method yet means nobody has collected — the waiter asks the guest at the
  // table and picks it then. Falling back to "Cash" here labelled every brand-new
  // order as paid by cash the moment it was placed.
  if (!mode) {
    return <span className="text-2xs font-semibold px-1.5 py-0.5 rounded uppercase bg-muted text-muted-foreground">Unpaid</span>;
  }
  const m = mode.toLowerCase();
  const label = PAY_LABEL[m] || ((m.includes("gateway") || m.includes("online") || m.includes("razor")) ? "Gateway" : (mode || "Cash"));
  const cls = m === "upi" ? "bg-success-subtle text-success"
    : m === "cash" ? "bg-primary/15 text-primary"
    : m === "card" ? "bg-info-subtle text-info"
    : m === "wallet" ? "bg-muted text-muted-foreground"
    : m === "nfc" ? "bg-success-subtle text-success"
    : (m.includes("gateway") || m.includes("online") || m.includes("razor")) ? "bg-muted text-muted-foreground"
    : m === "room_bill" ? "bg-info-subtle text-info"
    : m === "aggregator" ? "bg-muted text-muted-foreground"
    : "bg-muted text-muted-foreground";
  return <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded uppercase ${cls}`}>{label}</span>;
}

function getElapsed(date: Date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

const DEFAULT_STATUS = STATUS_CFG.new;

export default function OrderManagement() {
  const { liveOrders, updateOrderStatus, restaurantId, refreshOrders, refreshTables, tables, currentStaff } = useRestaurant();
  const { confirm, confirmDialog } = useConfirm();
  const [filter, setFilter] = useState<"all" | LiveOrder["status"]>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "dine-in" | "takeaway" | "room-service" | "delivery">("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<(LiveOrder & { tabOrders?: LiveOrder[]; roundCount?: number }) | null>(null);
  const [newOrderForm, setNewOrderForm] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  // A table of four ordering six dishes used to mean six separate orders, six KOTs and
  // six bills, because this form took one menu item and one quantity.
  type NewOrderLine = { menuItemId: string; qty: number };
  const emptyNewOrder = { tableName: "", type: "dine_in", customerName: "", lines: [] as NewOrderLine[] };
  const [newOrder, setNewOrder] = useState(emptyNewOrder);
  const [linePick, setLinePick] = useState("");

  function addLine() {
    if (!linePick) return;
    setNewOrder(o => {
      const existing = o.lines.find(l => l.menuItemId === linePick);
      return existing
        ? { ...o, lines: o.lines.map(l => l.menuItemId === linePick ? { ...l, qty: l.qty + 1 } : l) }
        : { ...o, lines: [...o.lines, { menuItemId: linePick, qty: 1 }] };
    });
    setLinePick("");
  }

  function setLineQty(menuItemId: string, qty: number) {
    setNewOrder(o => qty < 1
      ? { ...o, lines: o.lines.filter(l => l.menuItemId !== menuItemId) }
      : { ...o, lines: o.lines.map(l => l.menuItemId === menuItemId ? { ...l, qty } : l) });
  }

  function menuItemById(id: string) {
    return menuItems.find((m: any) => String(m.id) === id);
  }

  const newOrderTotal = newOrder.lines.reduce((sum, l) => {
    const mi = menuItemById(l.menuItemId);
    return sum + (parseFloat(String(mi?.discountedPrice || mi?.price || 0)) * l.qty);
  }, 0);

  useEffect(() => {
    if (!newOrderForm || !restaurantId) return;
    menuApi.items(restaurantId).then(setMenuItems).catch(() => setMenuItems([]));
  }, [newOrderForm, restaurantId]);

  async function submitNewOrder() {
    if (!restaurantId || newOrder.lines.length === 0) return;
    setCreating(true);
    try {
      await ordersApi.create({
        restaurantId,
        tableName: newOrder.tableName || "Counter",
        customerName: newOrder.customerName || "Walk-in",
        type: newOrder.type,
        items: newOrder.lines.map(l => ({ menuItemId: parseInt(l.menuItemId, 10), quantity: l.qty })),
        // No method here — the waiter picks how the guest actually pays when collecting.
        metadata: { source: "restaurant_panel", waiter: currentStaff?.name },
      });
      setNewOrderForm(false);
      setNewOrder(emptyNewOrder);
      setLinePick("");
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

  // Group a table's SEPARATE orders into ONE combined tab card (all items + combined total)
  // for the owner / live view — while the kitchen app keeps each round separate (own buttons).
  // The status shown is the least-advanced active round; actions advance just those laggards.
  const STATUS_RANK: Record<LiveOrder["status"], number> = {
    new: 0, accepted: 1, preparing: 2, ready: 3, served: 4, billed: 5, cancelled: 9,
  };
  type TabOrder = LiveOrder & { tabOrders: LiveOrder[]; roundCount: number };
  const tabGroups: TabOrder[] = useMemo(() => {
    const map = new Map<string, LiveOrder[]>();
    for (const o of filtered) {
      const key = String(o.tabId ?? o.id);
      const arr = map.get(key);
      if (arr) arr.push(o); else map.set(key, [o]);
    }
    return [...map.values()].map(group => {
      if (group.length === 1) return { ...group[0], tabOrders: group, roundCount: 1 };
      const sorted = [...group].sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
      const active = sorted.filter(o => o.status !== "cancelled");
      const rep = (active.length ? active : sorted).reduce((m, o) => STATUS_RANK[o.status] < STATUS_RANK[m.status] ? o : m);
      return {
        ...sorted[0],
        items: sorted.flatMap(o => o.items),
        // Round the summed total to paise — plain float addition leaves noise like 366.45000000000005.
        total: Math.round(sorted.reduce((s, o) => s + o.total, 0) * 100) / 100,
        status: rep.status,
        tabOrders: sorted,
        roundCount: sorted.length,
      };
    });
  }, [filtered]);

  // Advance only the laggard rounds sitting at the tab's current (least-advanced) stage.
  function advanceTab(tab: LiveOrder & { tabOrders?: LiveOrder[] }, target: LiveOrder["status"]) {
    const orders = tab.tabOrders ?? [tab];
    const active = orders.filter(o => o.status !== "cancelled");
    const repRank = active.length ? Math.min(...active.map(o => STATUS_RANK[o.status])) : 0;
    orders.filter(o => STATUS_RANK[o.status] === repRank).forEach(o => updateOrderStatus(o.id, target));
  }
  // Cancel EVERY round of the tab (not just the first order) so a multi-round tab fully cancels.
  function cancelTab(tab: LiveOrder & { tabOrders?: LiveOrder[] }) {
    const orders = tab.tabOrders ?? [tab];
    orders.filter(o => o.status !== "cancelled").forEach(o => updateOrderStatus(o.id, "cancelled"));
  }

  // ── Bill adjustments and floor operations on the open order ────────────────
  const [adjustSeq, setAdjustSeq] = useState(0);
  const [splitPicks, setSplitPicks] = useState<number[]>([]);
  const [moveTarget, setMoveTarget] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");
  const [floorBusy, setFloorBusy] = useState(false);

  // A tab built from several rounds shows a flattened item list, so a line's position
  // here does not identify a line on any one order. Only offer line-level actions when
  // the tab is a single order and the two line-ups genuinely match.
  const singleRound = (selectedOrder?.roundCount ?? 1) === 1;
  const selectedOrderId = selectedOrder ? parseInt(selectedOrder.id, 10) : NaN;

  useEffect(() => {
    setSplitPicks([]);
    setMoveTarget("");
    setMergeFrom("");
  }, [selectedOrder?.id]);

  /** Patch the panel from the order the server returned, so the change is visible at once. */
  function applyServerOrder(updated: any) {
    if (!updated || !Array.isArray(updated.items)) return;
    setSelectedOrder(prev => prev && ({
      ...prev,
      total: parseFloat(String(updated.total ?? prev.total)) || 0,
      paymentStatus: updated.paymentStatus ?? prev.paymentStatus,
      items: updated.items.map((i: any) => ({
        name: String(i.name ?? "Item"),
        qty: Number(i.quantity ?? i.qty ?? 1) || 1,
        price: Number(i.price ?? 0),
        subtotal: Number(i.subtotal ?? 0),
        status: "pending" as const,
        variant: i.variant || undefined,
        addons: Array.isArray(i.addons) ? i.addons.map((a: any) => ({ name: String(a?.name ?? a), price: Number(a?.price) || 0 })) : undefined,
        customizations: Array.isArray(i.customizations) ? i.customizations.map(String) : undefined,
        notes: i.notes || undefined,
        voided: i.voided === true,
        comped: i.comped === true,
        adjustReason: i.voidReason || i.compReason || undefined,
        adjustedBy: i.voidedBy || i.compedBy || undefined,
      })),
    }));
    setAdjustSeq(s => s + 1);
  }

  async function adjustLine(itemIndex: number, name: string, kind: AdjustKind, reason: string) {
    if (!restaurantId || Number.isNaN(selectedOrderId)) return;
    try {
      const call = kind === "void" ? orderAdjustments.voidItem : orderAdjustments.compItem;
      applyServerOrder(await call(restaurantId, selectedOrderId, { itemIndex, reason }));
      toast({ title: kind === "void" ? `${name} voided` : `${name} comped`, description: `Recorded against this bill: ${reason}` });
      refreshOrders().catch(() => { /* the panel already shows the corrected bill */ });
    } catch (e: any) {
      toast({
        title: kind === "void" ? "Could not void that line" : "Could not comp that line",
        description: e?.message ?? "The server rejected it. Nothing was changed on the bill.",
        variant: "destructive",
      });
    }
  }

  async function refundOrder(reason: string, amount?: number) {
    if (!restaurantId || Number.isNaN(selectedOrderId)) return;
    try {
      const res = await orderAdjustments.refund(restaurantId, selectedOrderId, { amount, reason });
      applyServerOrder(res.order);
      toast({ title: res.full ? "Bill refunded in full" : `₹${res.refunded.toFixed(2)} refunded`, description: `Reason recorded: ${reason}` });
      refreshOrders().catch(() => { /* the refund itself already went through */ });
    } catch (e: any) {
      toast({ title: "Refund not processed", description: e?.message ?? "The server rejected it. No money has been returned.", variant: "destructive" });
    }
  }

  async function moveTab() {
    if (!restaurantId || Number.isNaN(selectedOrderId) || !moveTarget) return;
    setFloorBusy(true);
    try {
      const res = await floorOps.moveTable(restaurantId, selectedOrderId, { tableName: moveTarget });
      toast({ title: `Moved to ${res.movedTo}`, description: res.movedFrom ? `${res.movedFrom} is now free.` : undefined });
      setMoveTarget("");
      await Promise.all([refreshOrders(), refreshTables()]);
      setSelectedOrder(null);
    } catch (e: any) {
      // A 409 names the table that is already taken — that message is the whole answer,
      // so it goes to the user verbatim rather than being flattened into "failed".
      toast({ title: "Could not move this tab", description: e?.message ?? "The server rejected the move.", variant: "destructive" });
    } finally {
      setFloorBusy(false);
    }
  }

  async function splitTab() {
    if (!restaurantId || Number.isNaN(selectedOrderId) || splitPicks.length === 0) return;
    setFloorBusy(true);
    try {
      const res = await floorOps.split(restaurantId, selectedOrderId, splitPicks);
      toast({
        title: `Split into order ${res.split.id}`,
        description: `${splitPicks.length} line${splitPicks.length > 1 ? "s" : ""} moved onto a separate bill at the same table.`,
      });
      setSplitPicks([]);
      await refreshOrders();
      setSelectedOrder(null);
    } catch (e: any) {
      toast({ title: "Could not split this bill", description: e?.message ?? "The server rejected the split.", variant: "destructive" });
    } finally {
      setFloorBusy(false);
    }
  }

  async function mergeTab() {
    if (!restaurantId || Number.isNaN(selectedOrderId) || !mergeFrom) return;
    const source = liveOrders.find(o => o.id === mergeFrom);
    const ok = await confirm({
      title: `Merge ${source?.tableNo ?? `order ${mergeFrom}`} into this bill?`,
      description: "Its items move onto this order and the original is cancelled so it cannot be billed twice. Its table is released.",
      confirmLabel: "Merge tabs",
      destructive: true,
    });
    if (!ok) return;
    setFloorBusy(true);
    try {
      const res = await floorOps.merge(restaurantId, { intoOrderId: selectedOrderId, fromOrderIds: [parseInt(mergeFrom, 10)] });
      toast({ title: "Tabs merged", description: `Order ${res.mergedFrom.join(", ")} is now part of this bill.` });
      setMergeFrom("");
      await Promise.all([refreshOrders(), refreshTables()]);
      setSelectedOrder(null);
    } catch (e: any) {
      toast({ title: "Could not merge these tabs", description: e?.message ?? "The server rejected the merge.", variant: "destructive" });
    } finally {
      setFloorBusy(false);
    }
  }

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
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl font-semibold">Order Management</h1>
            <p className="text-xs text-muted-foreground">{liveOrders.filter(o => !["billed", "cancelled"].includes(o.status)).length} active orders</p>
          </div>
          <button onClick={() => setNewOrderForm(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-semibold transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> New Order
          </button>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {(["all", "new", "accepted", "preparing", "ready", "served", "billed", "cancelled"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filter === s ? `${s !== "all" ? STATUS_CFG[s as LiveOrder["status"]]?.bg : "bg-primary/20"} border-primary/40 text-foreground` : "border-border bg-muted text-muted-foreground hover:border-border"}`}
            >
              {s === "all" ? "All" : STATUS_CFG[s as LiveOrder["status"]]?.label}
              <span className={`h-4 min-w-4 px-1 rounded-full text-xs font-semibold flex items-center justify-center ${filter === s ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"}`}>
                {counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Type Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"
              placeholder="Search order ID, table, waiter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(["all", "dine-in", "takeaway", "room-service"] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`shrink-0 px-2.5 py-2 rounded-lg text-xs border transition-colors ${typeFilter === t ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                {t === "all" ? "All" : (() => { const TabIcon = TYPE_ICON[t]; return <span className="inline-flex items-center gap-1.5">{TabIcon ? <TabIcon className="h-3.5 w-3.5" /> : null}<span className="capitalize">{t.replace("-", " ")}</span></span>; })()}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {tabGroups.map(order => {
            const cfg = STATUS_CFG[order.status] ?? DEFAULT_STATUS;
            const elapsed = Math.floor((Date.now() - new Date(order.placedAt).getTime()) / 60000);
            const isUrgent = elapsed > 25 && !["served", "billed", "cancelled"].includes(order.status);
            return (
              <div
                key={order.id}
                className={`rounded-lg border p-4 cursor-pointer hover:border-primary/30 transition-colors ${isUrgent ? "border-danger-border bg-danger-subtle" : "border-border bg-card"}`}
                onClick={() => setSelectedOrder(order)}
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(() => { const TypeIcon = TYPE_ICON[order.type]; return TypeIcon ? <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null; })()}
                      <span className="font-semibold text-sm">{order.tableNo}</span>
                      {order.roomNumber && <span className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-info-subtle text-info">Room {order.roomNumber}</span>}
                      {payMethodBadge(order.paymentMethod)}
                      <span className="text-xs text-muted-foreground">{order.id}</span>
                      {order.roundCount > 1 && (
                        <span className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">{order.roundCount} rounds</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{order.customerName || order.waiter} · {order.guests} guests</p>
                    {order.customerPhone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{order.customerPhone}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    <p className={`text-xs mt-1 ${isUrgent ? "text-danger font-semibold" : "text-muted-foreground"}`}>{getElapsed(order.placedAt)}</p>
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
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.status === "ready" ? "bg-success" : item.status === "preparing" ? "bg-info animate-pulse" : "bg-muted"}`} />
                            <span className="text-foreground truncate">{item.qty}× {item.name}</span>
                          </div>
                          <span className="text-muted-foreground shrink-0">₹{item.subtotal && item.subtotal > 0 ? item.subtotal : item.price * item.qty}</span>
                        </div>
                        {adds.length > 0 && <p className="text-2xs text-success ml-3.5 truncate">Add: {adds.join(", ")}</p>}
                        {removes.length > 0 && <p className="text-2xs text-danger ml-3.5 truncate">Remove: {removes.join(", ")}</p>}
                        {prefs.length > 0 && <p className="text-2xs text-info ml-3.5 truncate">{prefs.join(", ")}</p>}
                      </div>
                    );
                  })}
                  {order.items.length > 3 && <p className="text-xs text-muted-foreground">+{order.items.length - 3} more items</p>}
                </div>

                {order.specialReq && (
                  <div className="flex items-center gap-1.5 text-xs text-warning bg-warning-subtle rounded-lg px-2 py-1 mb-3">
                    <AlertCircle className="h-3 w-3" />
                    {order.specialReq}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-border">
                  <span className="font-semibold text-primary">₹{order.total}</span>
                  <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                    {order.status === "new" && (
                      <>
                        <button onClick={() => advanceTab(order, "accepted")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate border border-success-border">
                          <CheckCircle className="h-3 w-3" /> Accept
                        </button>
                        <button onClick={() => cancelTab(order)} className="px-2.5 py-1.5 rounded-lg bg-danger-subtle text-danger text-xs font-semibold hover-elevate border border-danger-border">
                          <XCircle className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    {cfg.next && order.status !== "new" && (
                      <button onClick={() => advanceTab(order, cfg.next!)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-semibold hover:bg-primary/30 border border-primary/30">
                        {cfg.next === "preparing" ? <ChefHat className="h-3 w-3" /> : cfg.next === "ready" ? <CheckCircle className="h-3 w-3" /> : cfg.next === "served" ? <Truck className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                        {STATUS_CFG[cfg.next!]?.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {tabGroups.length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="font-semibold">No orders found</p>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Panel */}
      {selectedOrder && (() => {
        const detailCfg = STATUS_CFG[selectedOrder.status] ?? DEFAULT_STATUS;
        return (
        <>
        {/* Below xl this was `hidden`, so tapping an order on a tablet did nothing at
            all. It now opens as a sheet over the list, and remains the fixed sidebar on
            a desktop. */}
        <button
          type="button"
          aria-label="Close order details"
          onClick={() => setSelectedOrder(null)}
          className="xl:hidden fixed inset-0 z-30 bg-foreground/40"
        />
        <div className="flex fixed inset-y-0 right-0 z-40 w-full max-w-md xl:static xl:z-auto xl:w-80 xl:max-w-none border-l border-border flex-col bg-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold">Order Details</h3>
            <button onClick={() => setSelectedOrder(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close order details"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="rounded-lg bg-muted p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold">{selectedOrder.tableNo}</p>
                  <p className="text-xs text-muted-foreground">{selectedOrder.id}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${detailCfg.bg} ${detailCfg.color}`}>
                  {detailCfg.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Type: <span className="text-foreground capitalize">{selectedOrder.type}</span></div>
                <div>Guests: <span className="text-foreground">{selectedOrder.guests}</span></div>
                <div>Customer: <span className="text-foreground">{selectedOrder.customerName || "—"}</span></div>
                <div>Mobile: <span className="text-foreground">{selectedOrder.customerPhone || "—"}</span></div>
                <div>Table: <span className="text-foreground">{selectedOrder.tableNo}</span></div>
                {selectedOrder.roomNumber && <div>Room: <span className="text-foreground">{selectedOrder.roomNumber}</span></div>}
                <div className="flex items-center gap-1.5">Payment: {payMethodBadge(selectedOrder.paymentMethod)}</div>
                {selectedOrder.paymentStatus && <div>Pay status: <span className="text-foreground capitalize">{selectedOrder.paymentStatus}</span></div>}
                <div>Time: <span className="text-foreground">{getElapsed(selectedOrder.placedAt)}</span></div>
              </div>

              {/* Full payment breakdown — how it was paid (UPI id / UTR), by whom and from which panel */}
              {(selectedOrder.upiId || selectedOrder.utr || selectedOrder.collectedBy || selectedOrder.collectedFrom) && (
                <div className="mt-3 rounded-lg border border-border bg-card p-3 space-y-1.5">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-success">Payment received</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {selectedOrder.upiId && <div>UPI ID: <span className="text-foreground break-all">{selectedOrder.upiId}</span></div>}
                    {selectedOrder.utr && <div>UTR / Ref: <span className="text-foreground break-all">{selectedOrder.utr}</span></div>}
                    {selectedOrder.collectedBy && <div>Collected by: <span className="text-foreground">{selectedOrder.collectedBy}</span></div>}
                    {selectedOrder.collectedFrom && <div>From panel: <span className="text-foreground">{selectedOrder.collectedFrom}</span></div>}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Items</p>
                {singleRound && selectedOrder.items.length > 1 && (
                  <span className="text-2xs text-muted-foreground">Tick lines to split them onto a separate bill</span>
                )}
              </div>
              {selectedOrder.items.map((item, i) => {
                const adjusted = item.voided || item.comped;
                return (
                <div key={i} className="py-2 border-b border-border">
                  <div className="flex justify-between items-start gap-3">
                    {singleRound && !adjusted && (
                      <input
                        type="checkbox"
                        aria-label={`Move ${item.name} to a separate bill`}
                        checked={splitPicks.includes(i)}
                        onChange={e => setSplitPicks(p => e.target.checked ? [...p, i] : p.filter(x => x !== i))}
                        className="mt-1 h-3.5 w-3.5 shrink-0 accent-primary"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium flex items-center gap-2 flex-wrap ${adjusted ? "line-through text-muted-foreground" : ""}`}>
                        {item.qty}× {item.name}
                        {item.variant && <span className="text-2xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.variant}</span>}
                      </p>
                      <AdjustedLineNote voided={item.voided} comped={item.comped} reason={item.adjustReason} by={item.adjustedBy} />
                      {Array.isArray(item.addons) && item.addons.length > 0 && (
                        <p className="text-xs text-success mt-0.5">Add: {item.addons.map(a => `${a.name}${a.price ? ` (₹${a.price})` : ""}`).join(", ")}</p>
                      )}
                      {(() => { const { removes, prefs } = splitCustomizations(item.customizations); return (<>
                        {removes.length > 0 && <p className="text-xs text-danger mt-0.5">Remove: {removes.join(", ")}</p>}
                        {prefs.length > 0 && <p className="text-xs text-info mt-0.5">{prefs.join(" · ")}</p>}
                      </>); })()}
                      {item.notes && <p className="text-xs text-warning mt-0.5"><StickyNote className="h-3 w-3 inline mb-0.5" /> {item.notes}</p>}
                      <span className={`text-xs ${item.status === "ready" ? "text-success" : item.status === "preparing" ? "text-info" : "text-muted-foreground"}`}>{item.status}</span>
                    </div>
                    <span className={`font-semibold shrink-0 ${adjusted ? "line-through text-muted-foreground" : "text-primary"}`}>₹{item.subtotal && item.subtotal > 0 ? item.subtotal : item.price * item.qty}</span>
                  </div>
                  <LineAdjustControls
                    disabled={adjusted || !singleRound || selectedOrder.status === "cancelled"}
                    disabledHint={!adjusted && !singleRound ? "Open a single round to void or comp its lines." : undefined}
                    onAdjust={(kind, reason) => adjustLine(i, item.name, kind, reason)}
                    className="mt-1.5"
                  />
                </div>
                );
              })}
              <div className="flex justify-between font-semibold mt-2 pt-2">
                <span>Total</span>
                <span className="text-primary">₹{selectedOrder.total}</span>
              </div>
            </div>

            {singleRound && (
              <AdjustmentHistory restaurantId={restaurantId} orderId={selectedOrderId} refreshKey={adjustSeq} />
            )}

            {/* A multi-round tab still gets a ticket and a bill — only per-line adjusting
                is ambiguous there, not printing. */}
            <PrintControls restaurantId={restaurantId} orderId={selectedOrderId} />

            {/* ── Floor operations: move the tab, split the bill, merge two tabs ── */}
            {singleRound && !["billed", "cancelled"].includes(selectedOrder.status) && (
              <div className="space-y-2.5 rounded-lg border border-border bg-card p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Floor</p>

                <div className="flex gap-2">
                  <select
                    value={moveTarget}
                    onChange={e => setMoveTarget(e.target.value)}
                    aria-label="Move this tab to another table"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-2 py-1.5 text-xs"
                  >
                    <option value="">Move tab to…</option>
                    {tables
                      .filter(t => t.number !== selectedOrder.tableNo)
                      .map(t => <option key={t.id} value={t.number}>{t.number} · {t.status}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={moveTab}
                    disabled={!moveTarget || floorBusy}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-semibold hover-elevate disabled:opacity-40"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Move
                  </button>
                </div>

                <button
                  type="button"
                  onClick={splitTab}
                  disabled={splitPicks.length === 0 || splitPicks.length === selectedOrder.items.length || floorBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted py-1.5 text-xs font-semibold hover-elevate disabled:opacity-40"
                >
                  <Split className="h-3.5 w-3.5" />
                  {splitPicks.length === 0
                    ? "Split — tick lines above first"
                    : splitPicks.length === selectedOrder.items.length
                      ? "Leave at least one line on this bill"
                      : `Split ${splitPicks.length} line${splitPicks.length > 1 ? "s" : ""} onto a new bill`}
                </button>

                <div className="flex gap-2">
                  <select
                    value={mergeFrom}
                    onChange={e => setMergeFrom(e.target.value)}
                    aria-label="Merge another open tab into this one"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-2 py-1.5 text-xs"
                  >
                    <option value="">Merge another tab in…</option>
                    {liveOrders
                      .filter(o => o.id !== selectedOrder.id && !["billed", "cancelled"].includes(o.status) && o.paymentStatus !== "paid")
                      .map(o => <option key={o.id} value={o.id}>{o.tableNo} · #{o.id} · ₹{o.total}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={mergeTab}
                    disabled={!mergeFrom || floorBusy}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-semibold hover-elevate disabled:opacity-40"
                  >
                    <Merge className="h-3.5 w-3.5" /> Merge
                  </button>
                </div>
              </div>
            )}

            {singleRound && (selectedOrder.paymentStatus === "paid" || selectedOrder.status === "billed") && (
              <RefundControls outstanding={selectedOrder.total} onRefund={refundOrder} />
            )}

            {selectedOrder.specialReq && (
              <div className="rounded-lg bg-warning-subtle border border-warning-border p-3 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5 inline mb-0.5" /> {selectedOrder.specialReq}
              </div>
            )}

            <div className="space-y-2">
              {detailCfg.next && (
                <button
                  onClick={() => { advanceTab(selectedOrder, detailCfg.next!); setSelectedOrder(null); }}
                  className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 font-semibold text-sm"
                >
                  Mark as {STATUS_CFG[detailCfg.next!]?.label ?? detailCfg.next}
                </button>
              )}
              <button onClick={() => window.print()} className="w-full py-2.5 rounded-lg border border-border hover:bg-muted text-sm font-semibold flex items-center justify-center gap-2">
                <Printer className="h-4 w-4" /> Print KOT
              </button>
              {selectedOrder.status !== "cancelled" && (
                <button onClick={() => { cancelTab(selectedOrder); setSelectedOrder(null); }} className="w-full py-2.5 rounded-lg border border-danger-border text-danger hover:bg-danger-subtle text-sm font-semibold">
                  Cancel Order{(selectedOrder.roundCount ?? 1) > 1 ? ` · all ${selectedOrder.roundCount} rounds` : ""}
                </button>
              )}
            </div>
          </div>
        </div>
        </>
        );
      })()}

      {newOrderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-card border border-border p-6 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">New Order</h3>
              <button onClick={() => setNewOrderForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm" placeholder="Table / Counter" value={newOrder.tableName} onChange={e => setNewOrder(o => ({ ...o, tableName: e.target.value }))} />
              <input className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm" placeholder="Customer name" value={newOrder.customerName} onChange={e => setNewOrder(o => ({ ...o, customerName: e.target.value }))} />
              <select
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm"
                value={newOrder.type}
                onChange={e => setNewOrder(o => ({ ...o, type: e.target.value }))}
              >
                <option value="dine_in">Dine-in</option>
                <option value="takeaway">Takeaway</option>
                <option value="delivery">Delivery</option>
                <option value="room_service">Room service</option>
              </select>

              <div className="flex gap-2">
                <select
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm"
                  value={linePick}
                  onChange={e => setLinePick(e.target.value)}
                >
                  <option value="">Add a dish…</option>
                  {menuItems.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name} — ₹{m.discountedPrice || m.price}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addLine}
                  disabled={!linePick}
                  className="px-4 rounded-lg bg-muted hover-elevate disabled:opacity-40 text-sm font-semibold"
                >
                  Add
                </button>
              </div>

              {newOrder.lines.length > 0 && (
                <div className="rounded-lg border border-border divide-y divide-border">
                  {newOrder.lines.map(line => {
                    const mi = menuItemById(line.menuItemId);
                    const unit = parseFloat(String(mi?.discountedPrice || mi?.price || 0));
                    return (
                      <div key={line.menuItemId} className="flex items-center gap-2 px-3 py-2">
                        <span className="flex-1 text-sm truncate">{mi?.name ?? "Item"}</span>
                        <button type="button" onClick={() => setLineQty(line.menuItemId, line.qty - 1)}
                          className="h-7 w-7 rounded-lg bg-muted hover-elevate text-sm" aria-label="Reduce quantity">−</button>
                        <span className="w-6 text-center text-sm tabular-nums">{line.qty}</span>
                        <button type="button" onClick={() => setLineQty(line.menuItemId, line.qty + 1)}
                          className="h-7 w-7 rounded-lg bg-muted hover-elevate text-sm" aria-label="Increase quantity">+</button>
                        <span className="w-16 text-right text-sm tabular-nums text-muted-foreground">₹{(unit * line.qty).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between px-3 py-2 text-sm font-semibold">
                    <span>Subtotal</span>
                    <span className="tabular-nums">₹{newOrderTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
            <button disabled={creating || newOrder.lines.length === 0} onClick={submitNewOrder} className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {newOrder.lines.length > 0 ? `Create Order · ${newOrder.lines.length} item${newOrder.lines.length > 1 ? "s" : ""}` : "Create Order"}
            </button>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
