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
  Plus, Search, CheckCircle, XCircle, ChefHat, Truck, Printer, Phone, AlertCircle,
  X, Loader2, ArrowRightLeft, Split, Merge, ClipboardList, StickyNote, AlertTriangle,
  UtensilsCrossed, ShoppingBag, Hotel, Bike, ChevronLeft, Minus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────────
   Order Management

   The list a waiter works from. Three things it has to do standing up:
   filter fast, open a tab without losing the list, and reach void / comp /
   refund / move / split / merge / print without going hunting.

   So: one toolbar that wraps rather than scrolls away, a card grid that packs
   to whatever width is left rather than to the viewport, and a detail pane that
   is a real second column from 1024px (a tablet in landscape) with its primary
   action pinned to the bottom of it.
   ──────────────────────────────────────────────────────────────────────────── */

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
    return <span className="rounded-md bg-muted px-1.5 py-0.5 text-2xs font-semibold uppercase text-muted-foreground">Unpaid</span>;
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
  return <span className={`rounded-md px-1.5 py-0.5 text-2xs font-semibold uppercase ${cls}`}>{label}</span>;
}

function getElapsed(date: Date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

const money = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const DEFAULT_STATUS = STATUS_CFG.new;

const STATUS_TABS = ["all", "new", "accepted", "preparing", "ready", "served", "billed", "cancelled"] as const;
const TYPE_TABS = ["all", "dine-in", "takeaway", "delivery", "room-service"] as const;

export default function OrderManagement() {
  const { liveOrders, updateOrderStatus, restaurantId, refreshOrders, refreshTables, tables, currentStaff } = useRestaurant();
  const { confirm, confirmDialog } = useConfirm();
  const [filter, setFilter] = useState<"all" | LiveOrder["status"]>("all");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_TABS)[number]>("all");
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
  const activeCount = liveOrders.filter(o => !["billed", "cancelled"].includes(o.status)).length;
  const filtersOn = filter !== "all" || typeFilter !== "all" || search.trim().length > 0;

  const detailCfg = selectedOrder ? (STATUS_CFG[selectedOrder.status] ?? DEFAULT_STATUS) : DEFAULT_STATUS;
  const selectField = "min-h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const ghostBtn = "flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold hover-elevate active-elevate-2 disabled:opacity-40";

  return (
    <div className="flex h-full min-h-0">
      {/* ── Left: the list ───────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
              <p className="text-xs text-muted-foreground">
                {activeCount} in flight · {tabGroups.length} shown
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNewOrderForm(true)}
              className="flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-primary-border bg-primary px-4 text-sm font-semibold text-primary-foreground hover-elevate active-elevate-2"
            >
              <Plus className="h-4 w-4" aria-hidden /> New order
            </button>
          </div>

          {/* One toolbar. Status on the top line because it is what gets used
              most; search and type below it, both wrapping rather than pushing
              the page sideways. */}
          <div className="mt-3 flex min-w-0 max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1 no-scrollbar">
            {STATUS_TABS.map(s => {
              const on = filter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  aria-pressed={on}
                  className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors hover-elevate active-elevate-2 ${
                    on ? "border-primary-border bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {s === "all" ? "All" : STATUS_CFG[s].label}
                  <span className={`text-2xs tabular-nums ${on ? "opacity-80" : "text-muted-foreground"}`}>{counts[s]}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                className="min-h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder="Table, order, waiter, guest, room"
                aria-label="Search orders"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">
              {TYPE_TABS.map(t => {
                const on = typeFilter === t;
                const TabIcon = TYPE_ICON[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    aria-pressed={on}
                    title={t === "all" ? "All order types" : t.replace("-", " ")}
                    className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold capitalize transition-colors hover-elevate active-elevate-2 ${
                      on ? "border-primary-border bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {TabIcon ? <TabIcon className="h-4 w-4" aria-hidden /> : null}
                    <span className={t === "all" ? "" : "hidden sm:inline"}>{t === "all" ? "All types" : t.replace("-", " ")}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
          {tabGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-16 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <ClipboardList className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="text-base font-semibold">{filtersOn ? "Nothing matches those filters" : "No orders yet today"}</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {filtersOn
                  ? "Widen the status or type filter, or clear the search."
                  : "Orders placed at a table, from a room or through the guest menu land here."}
              </p>
              {filtersOn && (
                <button
                  type="button"
                  onClick={() => { setFilter("all"); setTypeFilter("all"); setSearch(""); }}
                  className="mt-4 inline-flex min-h-10 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold hover-elevate active-elevate-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            /* Packs to the width actually left over once the detail pane is
               open, rather than to the viewport — the pane changes the column
               count, and a breakpoint cannot see that. */
            <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
              {tabGroups.map(order => {
                const cfg = STATUS_CFG[order.status] ?? DEFAULT_STATUS;
                const elapsed = Math.floor((Date.now() - new Date(order.placedAt).getTime()) / 60000);
                const isUrgent = elapsed > 25 && !["served", "billed", "cancelled"].includes(order.status);
                const TypeIcon = TYPE_ICON[order.type];
                const open = selectedOrder?.id === order.id;
                return (
                  <li
                    key={order.id}
                    className={`flex flex-col overflow-hidden rounded-md border ${
                      open ? "border-primary-border bg-primary/5"
                        : isUrgent ? "border-danger-border bg-danger-subtle"
                        : "border-border bg-card"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      aria-expanded={open}
                      className="flex-1 p-3 text-left transition-colors hover-elevate active-elevate-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {TypeIcon ? <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                            <span className="truncate text-base font-semibold leading-tight">{order.tableNo}</span>
                            <span className="shrink-0 text-2xs text-muted-foreground">#{order.id}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {order.customerName || order.waiter} · {order.guests} guests
                          </p>
                          {order.customerPhone && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" aria-hidden />{order.customerPhone}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-block rounded-pill px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          <p className={`mt-1 text-2xs tabular-nums ${isUrgent ? "font-semibold text-danger" : "text-muted-foreground"}`}>{getElapsed(order.placedAt)}</p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {payMethodBadge(order.paymentMethod)}
                        {order.roomNumber && <span className="rounded-md bg-info-subtle px-1.5 py-0.5 text-2xs font-semibold text-info">Room {order.roomNumber}</span>}
                        {order.roundCount > 1 && <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-2xs font-semibold text-primary">{order.roundCount} rounds</span>}
                      </div>

                      <ul className="mt-2.5 space-y-1">
                        {order.items.slice(0, 3).map((item, i) => {
                          const { removes, prefs } = splitCustomizations(item.customizations);
                          const adds = Array.isArray(item.addons) ? item.addons.map(a => a.name) : [];
                          return (
                            <li key={i} className="text-xs">
                              <span className="flex items-center justify-between gap-2">
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className={`h-1.5 w-1.5 shrink-0 rounded-pill ${item.status === "ready" ? "bg-success" : item.status === "preparing" ? "bg-info" : "bg-muted-foreground/40"}`} aria-hidden />
                                  <span className="truncate">{item.qty}× {item.name}</span>
                                </span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                  {money(item.subtotal && item.subtotal > 0 ? item.subtotal : item.price * item.qty)}
                                </span>
                              </span>
                              {adds.length > 0 && <span className="ml-3.5 block truncate text-2xs text-success">Add: {adds.join(", ")}</span>}
                              {removes.length > 0 && <span className="ml-3.5 block truncate text-2xs text-danger">No: {removes.join(", ")}</span>}
                              {prefs.length > 0 && <span className="ml-3.5 block truncate text-2xs text-info">{prefs.join(", ")}</span>}
                            </li>
                          );
                        })}
                        {order.items.length > 3 && <li className="text-2xs text-muted-foreground">+{order.items.length - 3} more</li>}
                      </ul>

                      {order.specialReq && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-md border border-warning-border bg-warning-subtle px-2 py-1.5 text-2xs text-warning">
                          <AlertCircle className="mt-px h-3 w-3 shrink-0" aria-hidden />
                          <span className="min-w-0">{order.specialReq}</span>
                        </p>
                      )}
                    </button>

                    {/* Quick actions live outside the card button — nesting them
                        inside would be invalid markup and unreachable by keyboard. */}
                    <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                      <span className="text-base font-semibold tabular-nums">{money(order.total)}</span>
                      <span className="flex gap-1.5">
                        {order.status === "new" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => advanceTab(order, "accepted")}
                              className="flex min-h-9 items-center gap-1 rounded-md border border-success-border bg-success-subtle px-2.5 text-xs font-semibold text-success hover-elevate active-elevate-2"
                            >
                              <CheckCircle className="h-3.5 w-3.5" aria-hidden /> Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelTab(order)}
                              aria-label={`Cancel order ${order.id}`}
                              className="flex h-9 w-9 items-center justify-center rounded-md border border-danger-border bg-danger-subtle text-danger hover-elevate active-elevate-2"
                            >
                              <XCircle className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </>
                        ) : cfg.next ? (
                          <button
                            type="button"
                            onClick={() => advanceTab(order, cfg.next!)}
                            className="flex min-h-9 items-center gap-1 rounded-md border border-primary-border bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover-elevate active-elevate-2"
                          >
                            {cfg.next === "preparing" ? <ChefHat className="h-3.5 w-3.5" aria-hidden />
                              : cfg.next === "served" ? <Truck className="h-3.5 w-3.5" aria-hidden />
                              : <CheckCircle className="h-3.5 w-3.5" aria-hidden />}
                            {STATUS_CFG[cfg.next].label}
                          </button>
                        ) : null}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Right: the open tab ──────────────────────────────────────────────
          A real second column from 1024px, so opening an order no longer costs
          you the list. Below that it is a sheet, and its primary action sits in
          a pinned footer rather than at the end of a long scroll. */}
      {selectedOrder && (
        <button
          type="button"
          aria-label="Close order details"
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
        />
      )}
      <aside
        className={`${selectedOrder ? "flex" : "hidden lg:flex"} fixed inset-y-0 right-0 z-40 w-full max-w-md flex-col border-l border-border bg-card lg:static lg:z-auto lg:w-[21rem] lg:max-w-none xl:w-[24rem]`}
        aria-label="Order details"
      >
        {!selectedOrder ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <ClipboardList className="mb-4 h-12 w-12" aria-hidden />
            <p className="text-sm font-semibold text-foreground">No order open</p>
            <p className="mt-1 text-sm">Pick an order on the left to see its lines, adjust it, or move the tab.</p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{selectedOrder.tableNo}</p>
                <p className="text-xs text-muted-foreground">
                  #{selectedOrder.id} · {getElapsed(selectedOrder.placedAt)}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`rounded-pill px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${detailCfg.bg} ${detailCfg.color}`}>{detailCfg.label}</span>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close order details"
                  className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover-elevate"
                >
                  <span className="lg:hidden"><ChevronLeft className="h-5 w-5" aria-hidden /></span>
                  <span className="hidden lg:block"><X className="h-5 w-5" aria-hidden /></span>
                </button>
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 custom-scrollbar">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-border bg-background p-3 text-xs">
                {([
                  ["Type", <span key="t" className="capitalize">{selectedOrder.type.replace("-", " ")}</span>],
                  ["Guests", String(selectedOrder.guests)],
                  ["Customer", selectedOrder.customerName || "—"],
                  ["Mobile", selectedOrder.customerPhone || "—"],
                  ...(selectedOrder.roomNumber ? [["Room", selectedOrder.roomNumber]] : []),
                  ["Payment", payMethodBadge(selectedOrder.paymentMethod)],
                  ...(selectedOrder.paymentStatus ? [["Pay status", <span key="p" className="capitalize">{selectedOrder.paymentStatus}</span>]] : []),
                ] as [string, React.ReactNode][]).map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 truncate">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* Full payment breakdown — how it was paid (UPI id / UTR), by whom and from which panel */}
              {(selectedOrder.upiId || selectedOrder.utr || selectedOrder.collectedBy || selectedOrder.collectedFrom) && (
                <section className="rounded-md border border-success-border bg-success-subtle p-3">
                  <h2 className="text-2xs font-semibold uppercase tracking-wide text-success">Payment received</h2>
                  <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {([
                      ...(selectedOrder.upiId ? [["UPI ID", selectedOrder.upiId]] : []),
                      ...(selectedOrder.utr ? [["UTR / ref", selectedOrder.utr]] : []),
                      ...(selectedOrder.collectedBy ? [["Collected by", selectedOrder.collectedBy]] : []),
                      ...(selectedOrder.collectedFrom ? [["From panel", selectedOrder.collectedFrom]] : []),
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-2xs text-muted-foreground">{k}</dt>
                        <dd className="break-all">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {selectedOrder.specialReq && (
                <p className="flex items-start gap-1.5 rounded-md border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning">
                  <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0">{selectedOrder.specialReq}</span>
                </p>
              )}

              <section>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Lines</h2>
                  {singleRound && selectedOrder.items.length > 1 && (
                    <p className="text-2xs text-muted-foreground">Tick to split onto a new bill</p>
                  )}
                </div>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {selectedOrder.items.map((item, i) => {
                    const adjusted = item.voided || item.comped;
                    const { removes, prefs } = splitCustomizations(item.customizations);
                    return (
                      <li key={i} className="p-2.5">
                        <div className="flex items-start justify-between gap-2.5">
                          {singleRound && !adjusted && (
                            <input
                              type="checkbox"
                              aria-label={`Move ${item.name} to a separate bill`}
                              checked={splitPicks.includes(i)}
                              onChange={e => setSplitPicks(p => e.target.checked ? [...p, i] : p.filter(x => x !== i))}
                              className="mt-1 h-4 w-4 shrink-0 accent-primary"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`flex flex-wrap items-center gap-1.5 text-sm font-medium ${adjusted ? "text-muted-foreground line-through" : ""}`}>
                              {item.qty}× {item.name}
                              {item.variant && <span className="rounded-md bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">{item.variant}</span>}
                            </p>
                            <AdjustedLineNote voided={item.voided} comped={item.comped} reason={item.adjustReason} by={item.adjustedBy} />
                            {Array.isArray(item.addons) && item.addons.length > 0 && (
                              <p className="mt-0.5 text-xs text-success">Add: {item.addons.map(a => `${a.name}${a.price ? ` (₹${a.price})` : ""}`).join(", ")}</p>
                            )}
                            {removes.length > 0 && <p className="mt-0.5 text-xs text-danger">No: {removes.join(", ")}</p>}
                            {prefs.length > 0 && <p className="mt-0.5 text-xs text-info">{prefs.join(" · ")}</p>}
                            {item.notes && (
                              <p className="mt-0.5 flex items-start gap-1 text-xs text-warning">
                                <StickyNote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {item.notes}
                              </p>
                            )}
                            <p className={`mt-0.5 text-2xs capitalize ${item.status === "ready" ? "text-success" : item.status === "preparing" ? "text-info" : "text-muted-foreground"}`}>{item.status}</p>
                          </div>
                          <span className={`shrink-0 text-sm font-semibold tabular-nums ${adjusted ? "text-muted-foreground line-through" : ""}`}>
                            {money(item.subtotal && item.subtotal > 0 ? item.subtotal : item.price * item.qty)}
                          </span>
                        </div>
                        <LineAdjustControls
                          disabled={adjusted || !singleRound || selectedOrder.status === "cancelled"}
                          disabledHint={!adjusted && !singleRound ? "Open a single round to void or comp its lines." : undefined}
                          onAdjust={(kind, reason) => adjustLine(i, item.name, kind, reason)}
                          className="mt-2"
                        />
                      </li>
                    );
                  })}
                  <li className="flex items-baseline justify-between gap-2 bg-background p-2.5">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-lg font-semibold tabular-nums">{money(selectedOrder.total)}</span>
                  </li>
                </ul>
              </section>

              {singleRound && (
                <AdjustmentHistory restaurantId={restaurantId} orderId={selectedOrderId} refreshKey={adjustSeq} />
              )}

              {/* A multi-round tab still gets a ticket and a bill — only per-line adjusting
                  is ambiguous there, not printing. */}
              <PrintControls restaurantId={restaurantId} orderId={selectedOrderId} />

              {/* ── Floor operations: move the tab, split the bill, merge two tabs ── */}
              {singleRound && !["billed", "cancelled"].includes(selectedOrder.status) && (
                <section className="space-y-2.5 rounded-md border border-border p-3">
                  <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Floor</h2>

                  <div className="flex gap-2">
                    <select
                      value={moveTarget}
                      onChange={e => setMoveTarget(e.target.value)}
                      aria-label="Move this tab to another table"
                      className={selectField}
                    >
                      <option value="">Move tab to…</option>
                      {tables
                        .filter(t => t.number !== selectedOrder.tableNo)
                        .map(t => <option key={t.id} value={t.number}>{t.number} · {t.status}</option>)}
                    </select>
                    <button type="button" onClick={moveTab} disabled={!moveTarget || floorBusy} className={ghostBtn}>
                      <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden /> Move
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={splitTab}
                    disabled={splitPicks.length === 0 || splitPicks.length === selectedOrder.items.length || floorBusy}
                    className={`${ghostBtn} w-full`}
                  >
                    <Split className="h-3.5 w-3.5" aria-hidden />
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
                      className={selectField}
                    >
                      <option value="">Merge another tab in…</option>
                      {liveOrders
                        .filter(o => o.id !== selectedOrder.id && !["billed", "cancelled"].includes(o.status) && o.paymentStatus !== "paid")
                        .map(o => <option key={o.id} value={o.id}>{o.tableNo} · #{o.id} · ₹{o.total}</option>)}
                    </select>
                    <button type="button" onClick={mergeTab} disabled={!mergeFrom || floorBusy} className={ghostBtn}>
                      <Merge className="h-3.5 w-3.5" aria-hidden /> Merge
                    </button>
                  </div>
                </section>
              )}

              {singleRound && (selectedOrder.paymentStatus === "paid" || selectedOrder.status === "billed") && (
                <RefundControls outstanding={selectedOrder.total} onRefund={refundOrder} />
              )}
            </div>

            {/* Pinned: the one thing this order needs next, plus print and cancel. */}
            <div className="shrink-0 space-y-2 border-t border-border p-4">
              {detailCfg.next && (
                <button
                  type="button"
                  onClick={() => { advanceTab(selectedOrder, detailCfg.next!); setSelectedOrder(null); }}
                  className="min-h-12 w-full rounded-md border border-primary-border bg-primary text-sm font-semibold text-primary-foreground hover-elevate active-elevate-2"
                >
                  Mark as {STATUS_CFG[detailCfg.next].label}
                </button>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs font-semibold hover-elevate active-elevate-2"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden /> Print KOT
                </button>
                {selectedOrder.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => { cancelTab(selectedOrder); setSelectedOrder(null); }}
                    className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-danger-border bg-card text-xs font-semibold text-danger hover-elevate active-elevate-2"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden />
                    Cancel{(selectedOrder.roundCount ?? 1) > 1 ? ` all ${selectedOrder.roundCount}` : ""}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ── New order ────────────────────────────────────────────────────── */}
      {newOrderForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New order"
            className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-md border border-border bg-card sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-md"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">New order</h2>
              <button
                type="button"
                onClick={() => setNewOrderForm(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover-elevate"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">Table / counter</span>
                  <input className={selectField} placeholder="Counter" value={newOrder.tableName} onChange={e => setNewOrder(o => ({ ...o, tableName: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">Customer</span>
                  <input className={selectField} placeholder="Walk-in" value={newOrder.customerName} onChange={e => setNewOrder(o => ({ ...o, customerName: e.target.value }))} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Type</span>
                <select className={selectField} value={newOrder.type} onChange={e => setNewOrder(o => ({ ...o, type: e.target.value }))}>
                  <option value="dine_in">Dine-in</option>
                  <option value="takeaway">Takeaway</option>
                  <option value="delivery">Delivery</option>
                  <option value="room_service">Room service</option>
                </select>
              </label>

              <div className="flex gap-2">
                <select className={selectField} value={linePick} onChange={e => setLinePick(e.target.value)} aria-label="Add a dish">
                  <option value="">Add a dish…</option>
                  {menuItems.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name} — ₹{m.discountedPrice || m.price}</option>
                  ))}
                </select>
                <button type="button" onClick={addLine} disabled={!linePick} className={ghostBtn}>Add</button>
              </div>

              {newOrder.lines.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {newOrder.lines.map(line => {
                    const mi = menuItemById(line.menuItemId);
                    const unit = parseFloat(String(mi?.discountedPrice || mi?.price || 0));
                    return (
                      <li key={line.menuItemId} className="flex items-center gap-2 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-sm">{mi?.name ?? "Item"}</span>
                        <button
                          type="button"
                          onClick={() => setLineQty(line.menuItemId, line.qty - 1)}
                          aria-label={`One fewer ${mi?.name ?? "item"}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover-elevate active-elevate-2"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <span className="w-6 shrink-0 text-center text-sm tabular-nums">{line.qty}</span>
                        <button
                          type="button"
                          onClick={() => setLineQty(line.menuItemId, line.qty + 1)}
                          aria-label={`One more ${mi?.name ?? "item"}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover-elevate active-elevate-2"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <span className="w-16 shrink-0 text-right text-sm tabular-nums text-muted-foreground">₹{(unit * line.qty).toFixed(2)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="shrink-0 border-t border-border p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Subtotal</span>
                <span className="text-xl font-semibold tabular-nums">₹{newOrderTotal.toFixed(2)}</span>
              </div>
              <button
                type="button"
                disabled={creating || newOrder.lines.length === 0}
                onClick={submitNewOrder}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-primary-border bg-primary text-sm font-semibold text-primary-foreground hover-elevate active-elevate-2 disabled:opacity-50"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {newOrder.lines.length > 0 ? `Create order · ${newOrder.lines.length} item${newOrder.lines.length > 1 ? "s" : ""}` : "Create order"}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
