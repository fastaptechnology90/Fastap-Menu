import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useRestaurantSSE } from "@/hooks/useRestaurantSSE";
import { tables as tablesApi, staff as staffApi, floorOps, planLimitMessage } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import {
  Plus, RefreshCw, Clock, Users, X, Edit2, Trash2, Star, Link2,
  CheckCircle2, LayoutGrid, ArrowRightLeft, GitMerge, Unlink,
  Check, Wrench, UtensilsCrossed, ConciergeBell, Brush, IndianRupee,
  Receipt, ChevronLeft, AlertTriangle,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────────
   Table Management — the floor map

   Read across the room, not down a list. The room is drawn zone by zone, so the
   grid reads the way the floor is actually laid out, and a table's colour is its
   state — free, occupied, reserved — before any word on it has been read.

   Acting on a table used to open a modal with five tabs stacked over the map,
   which is the wrong shape: you lose the floor the moment you touch a table, and
   the thing you most often want (open this table's bill) was not reachable at
   all. The map now keeps a detail pane beside it from 1024px — a floor tablet in
   landscape — and every operation on a table lives in one scroll of that pane
   with its primary action pinned to the bottom.
   ──────────────────────────────────────────────────────────────────────────── */

/* Every class is written out in full. Tailwind scans source text, so an
   interpolated name like `bg-${status}-subtle` is never emitted and the element
   ships invisible. */
const STATUS_CFG = {
  free:          { label: "Free",          bg: "bg-success-subtle", border: "border-success-border", text: "text-success",          dot: "bg-success",                icon: Check },
  occupied:      { label: "Occupied",      bg: "bg-warning-subtle", border: "border-warning-border", text: "text-warning",          dot: "bg-warning",                icon: Users },
  reserved:      { label: "Reserved",      bg: "bg-info-subtle",    border: "border-info-border",    text: "text-info",             dot: "bg-info",                   icon: Clock },
  cleaning:      { label: "Cleaning",      bg: "bg-warning-subtle", border: "border-warning-border", text: "text-warning",          dot: "bg-warning",                icon: Brush },
  blocked:       { label: "Locked",        bg: "bg-danger-subtle",  border: "border-danger-border",  text: "text-danger",           dot: "bg-danger",                 icon: X },
  billing:       { label: "Billing",       bg: "bg-primary/10",     border: "border-primary-border", text: "text-primary",          dot: "bg-primary",                icon: IndianRupee },
  maintenance:   { label: "Maintenance",   bg: "bg-muted",          border: "border-border",         text: "text-muted-foreground", dot: "bg-muted-foreground",       icon: Wrench },
  vip_occupied:  { label: "VIP occupied",  bg: "bg-warning-subtle", border: "border-warning-border", text: "text-warning",          dot: "bg-warning",                icon: Star },
  waiting_food:  { label: "Waiting food",  bg: "bg-primary/10",     border: "border-primary-border", text: "text-primary",          dot: "bg-primary",                icon: UtensilsCrossed },
  under_service: { label: "Under service", bg: "bg-info-subtle",    border: "border-info-border",    text: "text-info",             dot: "bg-info",                   icon: ConciergeBell },
} as const;

type TableStatus = keyof typeof STATUS_CFG;

const ALL_STATUSES = Object.keys(STATUS_CFG) as TableStatus[];

/** Always on the filter strip, count or no count — these three are the question
 *  the floor asks all night, and a chip that vanishes at zero is a chip you
 *  cannot use to check that it *is* zero. */
const ALWAYS_SHOWN: TableStatus[] = ["free", "occupied", "reserved"];

/** A table in one of these is holding a party, so it gets the occupied treatment
 *  (elapsed time, guest count and the running total) on its card. */
const SEATED: TableStatus[] = ["occupied", "vip_occupied", "waiting_food", "under_service", "billing"];

interface ActiveOrderInfo {
  id: number | null;
  customerName: string | null;
  total: string | null;
  itemsPreview: string;
  itemCount: number;
  status: string;
}

interface TableRow {
  id: number;
  name: string;
  zone: string | null;
  capacity: number;
  status: TableStatus;
  isVip: boolean;
  isActive: boolean;
  currentGuestCount: number;
  occupiedSince: string | null;
  currentWaiterName: string | null;
  currentCustomerName: string | null;
  colorCode: string | null;
  mergedInto: number | null;
  qrCodeUrl: string | null;
  activeOrder: ActiveOrderInfo | null;
}

const PREDEFINED_ZONES = [
  "Indoor AC", "Premium Indoor", "Family Section", "Outdoor Garden", "Rooftop", "VIP Lounge",
  "Outdoor", "Balcony", "Family Area",
  "Non-AC", "Smoking Zone", "Fine Dine", "Fast Dining", "Café Section",
  "Pool Side", "Spa Area", "Bar Area", "Lounge", "Beach Side", "Garden",
  "Banquet", "Conference Hall", "Rooftop Lounge", "Private Dining", "Main Hall",
];

const COLOR_OPTIONS: { label: string; value: string | null }[] = [
  { label: "None",    value: null },
  { label: "Amber",   value: "#f59e0b" },
  { label: "Emerald", value: "#10b981" },
  { label: "Blue",    value: "#3b82f6" },
  { label: "Violet",  value: "#8b5cf6" },
  { label: "Rose",    value: "#f43f5e" },
  { label: "Cyan",    value: "#06b6d4" },
];

const UNZONED = "Unzoned";

function elapsed(since: string | null) {
  if (!since) return "";
  const mins = Math.floor((Date.now() - new Date(since).getTime()) / 60000);
  if (mins < 0) return "0m";
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const money = (v: string | number | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—";
};

/* Shared control classes — one definition each, so a select in the detail pane
   and a select in the dialog are the same control. */
const field =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const ghostBtn =
  "flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 " +
  "text-sm font-semibold transition-colors hover-elevate active-elevate-2 disabled:opacity-40";
const primaryBtn =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-primary-border bg-primary " +
  "text-sm font-semibold text-primary-foreground transition-colors hover-elevate active-elevate-2 disabled:opacity-50";
const sectionTitle = "mb-2 text-xs uppercase tracking-wide text-muted-foreground";

/* ── Add / edit a table ──────────────────────────────────────────────────────
   Header and footer pinned, only the middle scrolls, so Save cannot be pushed
   off a 768px-tall tablet by a long zone list. */
function AddEditDialog({
  table, existingZones, busy, onClose, onSave,
}: {
  table: TableRow | null;
  existingZones: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (data: { name: string; zone: string; capacity: number; isVip: boolean; colorCode: string | null }) => void;
}) {
  const allZones = Array.from(new Set([...PREDEFINED_ZONES, ...existingZones]));
  const [form, setForm] = useState({
    name: table?.name ?? "",
    zone: table?.zone ?? "Main Hall",
    capacity: table?.capacity ?? 4,
    isVip: table?.isVip ?? false,
    colorCode: (table?.colorCode ?? null) as string | null,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={table ? "Edit table" : "Add a table"}
        className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-md border border-border bg-card sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-md"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{table ? `Edit ${table.name}` : "Add a table"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover-elevate"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar">
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted-foreground">Table name or number</span>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="T-11, Table 5, VIP-1"
              className={field}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Zone</span>
              <select value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} className={field}>
                {allZones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Seats</span>
              <input
                type="number"
                min={1}
                max={50}
                value={form.capacity}
                onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value, 10) || 4 }))}
                className={field}
              />
            </label>
          </div>

          <div>
            <span className={sectionTitle}>Colour tag</span>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_OPTIONS.map(c => {
                const on = form.colorCode === c.value;
                return (
                  <button
                    key={String(c.value)}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, colorCode: c.value }))}
                    aria-pressed={on}
                    className={`flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors hover-elevate active-elevate-2 ${
                      on ? "border-primary-border bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {/* The swatch carries the colour; the chip itself stays on the
                        token palette, so a venue's tag cannot make a control unreadable. */}
                    <span
                      className="h-3 w-3 shrink-0 rounded-pill border border-border"
                      style={c.value ? { background: c.value, borderColor: c.value } : undefined}
                      aria-hidden
                    />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, isVip: !p.isVip }))}
            aria-pressed={form.isVip}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors hover-elevate active-elevate-2 ${
              form.isVip ? "border-primary-border bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
            }`}
          >
            <Star className={`h-4 w-4 ${form.isVip ? "fill-primary" : ""}`} aria-hidden />
            {form.isVip ? "VIP table" : "Mark as VIP"}
          </button>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 rounded-md border border-border bg-card text-sm font-semibold hover-elevate active-elevate-2"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!form.name.trim() || busy}
            onClick={() => { if (form.name.trim()) onSave({ ...form, name: form.name.trim() }); }}
            className={`${primaryBtn} flex-1`}
          >
            {table ? "Save changes" : "Add table"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── One table on the map ────────────────────────────────────────────────── */
function TableCard({
  table, selected, onOpen,
}: {
  table: TableRow;
  selected: boolean;
  onOpen: () => void;
}) {
  const cfg = STATUS_CFG[table.status] ?? STATUS_CFG.free;
  const seated = SEATED.includes(table.status);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className={`relative flex min-h-[7.5rem] w-full flex-col overflow-hidden rounded-md border p-3 text-left transition-colors hover-elevate active-elevate-2 ${
        selected ? "border-primary-border bg-primary/10" : `${cfg.border} ${cfg.bg}`
      }`}
    >
      {/* The venue's own colour tag, kept to a hairline down the edge — it marks
          the table without competing with the status colour, which is the thing
          that has to read from across the room. */}
      {table.colorCode && (
        <span className="absolute inset-y-0 left-0 w-1" style={{ background: table.colorCode }} aria-hidden />
      )}

      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-lg font-semibold leading-tight">{table.name}</span>
          <span className="mt-0.5 block truncate text-2xs text-muted-foreground">
            {table.zone || UNZONED}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {table.mergedInto && <Link2 className="h-3 w-3 text-muted-foreground" aria-label="Merged" />}
          {table.isVip && <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-label="VIP" />}
          <span className={`h-2.5 w-2.5 rounded-pill ${cfg.dot}`} aria-hidden />
        </span>
      </div>

      <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="tabular-nums">
          {table.currentGuestCount > 0 ? `${table.currentGuestCount}/` : ""}{table.capacity}
        </span>
        {seated && table.occupiedSince && (
          <>
            <span aria-hidden>·</span>
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="tabular-nums">{elapsed(table.occupiedSince)}</span>
          </>
        )}
      </p>

      {table.currentCustomerName && (
        <p className="mt-1 truncate text-xs font-medium">{table.currentCustomerName}</p>
      )}

      {/* The running total is the number a floor manager scans for, so it is the
          second-largest thing on an occupied card. */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <span className={`text-2xs font-semibold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
        {table.activeOrder?.total != null && (
          <span className="shrink-0 text-base font-semibold tabular-nums">{money(table.activeOrder.total)}</span>
        )}
      </div>
    </button>
  );
}

export default function TableManagement() {
  const { restaurantId } = useRestaurant();
  const [, navigate] = useLocation();

  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedZone, setSelectedZone] = useState("All");
  const [statusFilter, setStatusFilter] = useState<TableStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [addEdit, setAddEdit] = useState<{ open: boolean; table: TableRow | null }>({ open: false, table: null });
  const [deleteConfirm, setDeleteConfirm] = useState<TableRow | null>(null);

  // Detail-pane working state, reset whenever a different table is opened.
  const [guests, setGuests] = useState(0);
  const [waiter, setWaiter] = useState("");
  const [zoneTarget, setZoneTarget] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [tabTarget, setTabTarget] = useState("");
  const [pullFrom, setPullFrom] = useState("");

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const [tData, sData] = await Promise.all([
        tablesApi.list(restaurantId),
        staffApi.list(restaurantId),
      ]);
      setTableRows(Array.isArray(tData) ? tData.map(mapRow) : []);
      setStaffList(Array.isArray(sData) ? sData : []);
      setLoadError(null);
    } catch (e) {
      // "No tables found" during an outage sends staff hunting for a floor plan
      // that was never deleted.
      setLoadError(e instanceof Error ? e.message : "Could not reach the server.");
    }
  }, [restaurantId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // This page keeps its own table rows (enriched with activeOrder) rather than
  // RestaurantContext.tables — so it must subscribe itself. Without that, a
  // settle that frees the cover in the DB left the floor map stuck on occupied
  // until someone hit Refresh.
  useRestaurantSSE((event) => {
    if (
      event === "new_order" ||
      event === "order_status" ||
      event === "order_updated" ||
      event === "order_paid" ||
      event === "table_cleared" ||
      event === "bill_requested"
    ) {
      load();
    }
  }, Boolean(restaurantId));

  useEffect(() => {
    if (!restaurantId) return;
    const interval = setInterval(() => { load(); }, 15_000);
    return () => clearInterval(interval);
  }, [restaurantId, load]);

  function mapRow(t: any): TableRow {
    const ao = t.activeOrder ?? null;
    return {
      id: t.id,
      name: t.name || `T-${t.id}`,
      zone: t.zone || null,
      capacity: t.capacity || 4,
      status: (t.status || "free") as TableStatus,
      isVip: t.isVip ?? t.is_vip ?? false,
      isActive: t.isActive ?? t.is_active ?? true,
      currentGuestCount: t.currentGuestCount ?? t.current_guest_count ?? 0,
      occupiedSince: t.occupiedSince ?? t.occupied_since ?? null,
      currentWaiterName: t.currentWaiterName ?? t.current_waiter_name ?? null,
      currentCustomerName: t.currentCustomerName ?? t.current_customer_name ?? ao?.customerName ?? null,
      colorCode: t.colorCode ?? t.color_code ?? null,
      mergedInto: t.mergedInto ?? t.merged_into ?? null,
      qrCodeUrl: t.qrCodeUrl ?? t.qr_code_url ?? null,
      activeOrder: ao ? {
        id: ao.id ?? null,
        customerName: ao.customerName ?? null,
        total: ao.total != null ? String(ao.total) : null,
        itemsPreview: ao.itemsPreview ?? "",
        itemCount: ao.itemCount ?? 0,
        status: ao.status ?? t.status,
      } : null,
    };
  }

  const selected = useMemo(
    () => tableRows.find(t => t.id === selectedId) ?? null,
    [tableRows, selectedId],
  );

  /** Opening a different table resets the pane's own controls, so a waiter name
   *  typed against T-3 cannot be applied to T-4. */
  function openTable(t: TableRow) {
    setSelectedId(t.id);
    setGuests(t.currentGuestCount || 0);
    setWaiter(t.currentWaiterName || "");
    setZoneTarget("");
    setMergeTarget("");
    setTabTarget("");
    setPullFrom("");
  }

  const zones = useMemo(
    () => Array.from(new Set(tableRows.filter(t => t.isActive).map(t => t.zone || UNZONED))).sort(),
    [tableRows],
  );

  const summary = useMemo(
    () => Object.fromEntries(
      ALL_STATUSES.map(s => [s, tableRows.filter(t => t.status === s && t.isActive).length]),
    ) as Record<TableStatus, number>,
    [tableRows],
  );

  /** Chips for the statuses this floor actually uses, plus the three that are
   *  always worth being able to check. */
  const statusChips = useMemo(
    () => ALL_STATUSES.filter(s => (summary[s] ?? 0) > 0 || ALWAYS_SHOWN.includes(s)),
    [summary],
  );

  const visible = useMemo(() => tableRows.filter(t => {
    if (!t.isActive) return false;
    if (t.mergedInto) return false;
    const zoneMatch = selectedZone === "All" || (t.zone || UNZONED) === selectedZone;
    const statusMatch = statusFilter === "all" || t.status === statusFilter;
    return zoneMatch && statusMatch;
  }), [tableRows, selectedZone, statusFilter]);

  /** The map is drawn zone by zone so it reads like the room rather than a wall
   *  of tiles. One zone selected collapses to that single group. */
  const groups = useMemo(() => {
    const byZone = new Map<string, TableRow[]>();
    for (const t of visible) {
      const z = t.zone || UNZONED;
      const list = byZone.get(z);
      if (list) list.push(t); else byZone.set(z, [t]);
    }
    return Array.from(byZone.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([zone, rows]) => ({ zone, rows: rows.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) }));
  }, [visible]);

  const activeTables = tableRows.filter(t => t.isActive && !t.mergedInto);
  const total = activeTables.length;
  const freeCount = summary.free ?? 0;
  const seatedCount = activeTables.filter(t => SEATED.includes(t.status)).length;
  const onTabs = activeTables.reduce((s, t) => s + Number(t.activeOrder?.total ?? 0), 0);
  const filtersOn = selectedZone !== "All" || statusFilter !== "all";

  const waiters = staffList.filter(s => s.role === "waiter" || s.role === "manager");

  async function handleStatusChange(table: TableRow, status: TableStatus, extra: any = {}) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const updated = await tablesApi.updateStatus(restaurantId, table.id, { status, ...extra });
      const mapped = mapRow(updated);
      setTableRows(prev => prev.map(t => (t.id === mapped.id ? mapped : t)));
      toast({ title: `${table.name} updated` });
    } catch (e: any) {
      toast({ title: "Could not update this table", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleMoveZone(table: TableRow, zone: string) {
    if (!restaurantId || !zone || table.zone === zone) return;
    setSaving(true);
    try {
      const updated = await tablesApi.update(restaurantId, table.id, { zone });
      const mapped = mapRow(updated);
      setTableRows(prev => prev.map(t => (t.id === mapped.id ? mapped : t)));
      setZoneTarget("");
      toast({ title: `Moved ${table.name} to ${zone}` });
    } catch (e: any) {
      toast({ title: "Could not move this table", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleSaveTable(data: any) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      if (addEdit.table) {
        const updated = await tablesApi.update(restaurantId, addEdit.table.id, data);
        const mapped = mapRow(updated);
        setTableRows(prev => prev.map(t => (t.id === mapped.id ? mapped : t)));
        toast({ title: "Table updated" });
      } else {
        const created = await tablesApi.create(restaurantId, data);
        setTableRows(prev => [...prev, mapRow(created)]);
        toast({ title: "Table added" });
      }
      setAddEdit({ open: false, table: null });
    } catch (e: any) {
      // A plan cap comes back as a 402 naming the allowance — say that, not "failed".
      toast({ ...planLimitMessage(e, "Could not save this table"), variant: "destructive" });
    } finally { setSaving(false); }
  }

  /** Move a running tab onto another table. The old table is released by the server. */
  async function handleMoveTab(table: TableRow, targetTableName: string) {
    const orderId = table.activeOrder?.id;
    if (!restaurantId || !orderId || !targetTableName) return;
    setSaving(true);
    try {
      const res = await floorOps.moveTable(restaurantId, orderId, { tableName: targetTableName });
      toast({ title: `Tab moved to ${res.movedTo}`, description: res.movedFrom ? `${res.movedFrom} is now free.` : undefined });
      setTabTarget("");
      await load();
    } catch (e: any) {
      // Moving onto a table that already has a tab comes back as a 409 naming that table.
      // That sentence is the entire answer, so it reaches the user unchanged.
      toast({ title: "Could not move this tab", description: e?.message ?? "The server rejected the move.", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleMergeTabs(table: TableRow, fromTable: TableRow) {
    const into = table.activeOrder?.id;
    const from = fromTable.activeOrder?.id;
    if (!restaurantId || !into || !from) return;
    setSaving(true);
    try {
      await floorOps.merge(restaurantId, { intoOrderId: into, fromOrderIds: [from] });
      toast({ title: `${fromTable.name} merged into ${table.name}`, description: `${fromTable.name} is now free and its items are on one bill.` });
      setPullFrom("");
      await load();
    } catch (e: any) {
      toast({ title: "Could not merge these tabs", description: e?.message ?? "The server rejected the merge.", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(table: TableRow) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await tablesApi.delete(restaurantId, table.id);
      setTableRows(prev => prev.filter(t => t.id !== table.id));
      setDeleteConfirm(null);
      setSelectedId(null);
      toast({ title: `${table.name} deleted` });
    } catch (e: any) {
      toast({ title: "Could not delete this table", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleMerge(primaryTable: TableRow, secondaryId: number) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await tablesApi.merge(restaurantId, { primaryId: primaryTable.id, secondaryIds: [secondaryId] });
      setMergeTarget("");
      await load();
      toast({ title: "Tables merged" });
    } catch (e: any) {
      toast({ title: "Could not merge these tables", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleUnmerge(table: TableRow) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await tablesApi.unmerge(restaurantId, table.id);
      await load();
      toast({ title: "Tables unmerged" });
    } catch (e: any) {
      toast({ title: "Could not unmerge these tables", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleVipToggle(table: TableRow) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const updated = await tablesApi.updateStatus(restaurantId, table.id, { isVip: !table.isVip });
      const mapped = mapRow(updated);
      setTableRows(prev => prev.map(t => (t.id === mapped.id ? mapped : t)));
      toast({ title: table.isVip ? "VIP removed" : "Marked as VIP" });
    } catch (e: any) {
      toast({ title: "Could not update VIP status", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  /** Take the running tab straight to the till, with the bill already open on it. */
  function openBill(table: TableRow) {
    const id = table.activeOrder?.id;
    if (!id) return;
    navigate(`/restaurant/billing?order=${id}`);
  }

  const refresh = () => { setLoading(true); load().finally(() => setLoading(false)); };

  const detailCfg = selected ? (STATUS_CFG[selected.status] ?? STATUS_CFG.free) : null;
  const mergeableTables = selected ? tableRows.filter(t => t.id !== selected.id && t.status === "free" && !t.mergedInto && t.isActive) : [];
  const moveTargets = selected ? tableRows.filter(t => t.id !== selected.id && t.isActive && !t.mergedInto) : [];
  const otherTabs = selected ? tableRows.filter(t => t.id !== selected.id && t.activeOrder?.id) : [];

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-x-hidden">
      {/* ── Left: the floor ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">Floor</h1>
              <p className="text-xs text-muted-foreground">
                <span className="tabular-nums">{total}</span> tables · <span className="tabular-nums">{seatedCount}</span> seated ·{" "}
                <span className="tabular-nums">{freeCount}</span> free
                {onTabs > 0 && <> · <span className="font-medium text-foreground tabular-nums">{money(onTabs)}</span> on open tabs</>}
              </p>
            </div>
            <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={refresh}
                aria-label="Reload the floor"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover-elevate active-elevate-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setAddEdit({ open: true, table: null })}
                className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-primary-border bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover-elevate active-elevate-2 sm:flex-none"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden /> Add table
              </button>
            </div>
          </div>

          {/* Status strip — the legend and the filter are the same control, so
              the colours on the map are always explained on screen. */}
          <div className="mt-3 flex min-w-0 max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              aria-pressed={statusFilter === "all"}
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors hover-elevate active-elevate-2 ${
                statusFilter === "all" ? "border-primary-border bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
              }`}
            >
              All
              <span className={`text-2xs tabular-nums ${statusFilter === "all" ? "opacity-80" : "text-muted-foreground"}`}>{total}</span>
            </button>
            {statusChips.map(s => {
              const cfg = STATUS_CFG[s];
              const on = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(on ? "all" : s)}
                  aria-pressed={on}
                  className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors hover-elevate active-elevate-2 ${
                    on ? "border-primary-border bg-primary text-primary-foreground" : `${cfg.border} ${cfg.bg} ${cfg.text}`
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-pill ${on ? "bg-primary-foreground" : cfg.dot}`} aria-hidden />
                  {cfg.label}
                  <span className="text-2xs tabular-nums opacity-80">{summary[s] ?? 0}</span>
                </button>
              );
            })}
          </div>

          {zones.length > 1 && (
            <div className="mt-2 flex min-w-0 max-w-full gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">
              {["All", ...zones].map(z => {
                const on = selectedZone === z;
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setSelectedZone(z)}
                    aria-pressed={on}
                    className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors hover-elevate active-elevate-2 ${
                      on ? "border-primary-border bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {z === "All" ? "All zones" : z}
                    {z !== "All" && (
                      <span className="text-2xs tabular-nums opacity-70">
                        {activeTables.filter(t => (t.zone || UNZONED) === z).length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="min-h-[7.5rem] animate-pulse rounded-md border border-border bg-muted" aria-hidden />
              ))}
              <p className="sr-only">Loading the floor plan</p>
            </div>
          ) : loadError ? (
            <div role="alert" className="flex flex-col items-center justify-center rounded-md border border-danger-border bg-danger-subtle px-6 py-14 text-center">
              <AlertTriangle className="mb-3 h-8 w-8 text-danger" aria-hidden />
              <h2 className="text-base font-semibold text-danger">We could not load your floor plan</h2>
              <p className="mt-1 max-w-sm text-sm text-danger">{loadError}</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">Nothing has been deleted — this is a connection problem.</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-4 inline-flex min-h-11 items-center rounded-md border border-danger-border bg-card px-4 text-sm font-semibold text-danger hover-elevate active-elevate-2"
              >
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-14 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <LayoutGrid className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="text-base font-semibold">{filtersOn ? "No table matches those filters" : "No tables on the floor yet"}</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {filtersOn
                  ? "Clear the zone or status filter to see the whole floor."
                  : "Add the tables in your dining room and each one gets its own QR code and running tab."}
              </p>
              <button
                type="button"
                onClick={() => (filtersOn ? (setSelectedZone("All"), setStatusFilter("all")) : setAddEdit({ open: true, table: null }))}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold hover-elevate active-elevate-2"
              >
                {filtersOn ? "Clear filters" : <><Plus className="h-4 w-4" aria-hidden /> Add the first table</>}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(g => (
                <section key={g.zone} aria-label={g.zone}>
                  <h2 className="mb-2 flex items-baseline gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    {g.zone}
                    <span className="tabular-nums">{g.rows.length}</span>
                  </h2>
                  {/* Packs to the width actually left over once the detail pane is
                      open, rather than to the viewport — the pane changes the
                      column count and a breakpoint cannot see that. */}
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
                    {g.rows.map(t => (
                      <TableCard key={t.id} table={t} selected={selectedId === t.id} onOpen={() => openTable(t)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: one table ─────────────────────────────────────────────────
          A real second column from 1024px, so touching a table no longer costs
          you the floor. Below that it is a sheet, and the primary action sits in
          a pinned footer rather than at the end of a long scroll. */}
      {selected && (
        <button
          type="button"
          aria-label="Close table details"
          onClick={() => setSelectedId(null)}
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
        />
      )}
      <aside
        className={`${selected ? "flex" : "hidden lg:flex"} fixed inset-y-0 right-0 z-40 w-full max-w-md flex-col border-l border-border bg-card lg:static lg:z-auto lg:w-[21rem] lg:max-w-none xl:w-[24rem]`}
        aria-label="Table details"
      >
        {!selected || !detailCfg ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <LayoutGrid className="mb-4 h-12 w-12" aria-hidden />
            <p className="text-sm font-semibold text-foreground">No table open</p>
            <p className="mt-1 text-sm">Tap a table on the floor to seat it, move its tab or open its bill.</p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-base font-semibold">
                  {selected.name}
                  {selected.isVip && <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" aria-label="VIP" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {selected.zone || UNZONED} · {selected.capacity} seats
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close table details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover-elevate"
              >
                <span className="lg:hidden"><ChevronLeft className="h-5 w-5" aria-hidden /></span>
                <span className="hidden lg:block"><X className="h-5 w-5" aria-hidden /></span>
              </button>
            </div>

            <div className={`flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 ${detailCfg.bg} ${detailCfg.border}`}>
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${detailCfg.text}`}>
                <detailCfg.icon className="h-4 w-4" aria-hidden />
                {detailCfg.label}
              </span>
              <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
                {selected.currentGuestCount > 0 && (
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" aria-hidden /><span className="tabular-nums">{selected.currentGuestCount}</span></span>
                )}
                {selected.occupiedSince && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden /><span className="tabular-nums">{elapsed(selected.occupiedSince)}</span></span>
                )}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 custom-scrollbar">
              {/* ── The running tab ─────────────────────────────────────── */}
              {selected.activeOrder?.id ? (
                <section className="rounded-md border border-primary-border bg-primary/10 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Order #{selected.activeOrder.id}
                    </span>
                    <span className="text-xl font-semibold tabular-nums">{money(selected.activeOrder.total)}</span>
                  </div>
                  {selected.activeOrder.itemsPreview && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selected.activeOrder.itemsPreview}
                      {selected.activeOrder.itemCount > 1 ? ` +${selected.activeOrder.itemCount - 1} more` : ""}
                    </p>
                  )}
                  {selected.currentCustomerName && (
                    <p className="mt-1 text-xs text-muted-foreground">{selected.currentCustomerName}</p>
                  )}
                </section>
              ) : (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  No running tab on {selected.name}. Moving and merging a tab become available once a party has ordered.
                </p>
              )}

              {/* ── Move the tab ────────────────────────────────────────── */}
              {selected.activeOrder?.id && (
                <section>
                  <h3 className={sectionTitle}>This tab</h3>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={tabTarget}
                        onChange={e => setTabTarget(e.target.value)}
                        aria-label="Move this tab to another table"
                        className={field}
                      >
                        <option value="">Move the tab to…</option>
                        {moveTargets.map(t => (
                          <option key={t.id} value={t.name}>
                            {t.name} · {t.activeOrder?.id ? "has a tab" : (STATUS_CFG[t.status]?.label ?? t.status)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleMoveTab(selected, tabTarget)}
                        disabled={!tabTarget || saving}
                        className={ghostBtn}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden /> Move
                      </button>
                    </div>

                    {otherTabs.length > 0 && (
                      <div className="flex gap-2">
                        <select
                          value={pullFrom}
                          onChange={e => setPullFrom(e.target.value)}
                          aria-label="Pull another table's tab onto this one"
                          className={field}
                        >
                          <option value="">Pull another tab in…</option>
                          {otherTabs.map(t => (
                            <option key={t.id} value={String(t.id)}>
                              {t.name} · {money(t.activeOrder?.total)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const from = otherTabs.find(t => String(t.id) === pullFrom);
                            if (from) handleMergeTabs(selected, from);
                          }}
                          disabled={!pullFrom || saving}
                          className={ghostBtn}
                        >
                          <GitMerge className="h-3.5 w-3.5" aria-hidden /> Merge
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ── Status ──────────────────────────────────────────────── */}
              <section>
                <h3 className={sectionTitle}>Set status</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_STATUSES.map(s => {
                    const cfg = STATUS_CFG[s];
                    const on = selected.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleStatusChange(selected, s)}
                        disabled={on || saving}
                        className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-colors hover-elevate active-elevate-2 disabled:opacity-100 ${
                          on ? "border-primary-border bg-primary text-primary-foreground" : `${cfg.border} ${cfg.bg} ${cfg.text}`
                        }`}
                      >
                        <cfg.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ── The party ───────────────────────────────────────────── */}
              <section>
                <h3 className={sectionTitle}>The party</h3>
                <div className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm">Guests</span>
                    <button
                      type="button"
                      aria-label="One fewer guest"
                      onClick={() => setGuests(g => Math.max(0, g - 1))}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover-elevate active-elevate-2"
                    >
                      <span aria-hidden>−</span>
                    </button>
                    <span className="w-8 shrink-0 text-center text-base font-semibold tabular-nums">{guests}</span>
                    <button
                      type="button"
                      aria-label="One more guest"
                      onClick={() => setGuests(g => Math.min(selected.capacity, g + 1))}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover-elevate active-elevate-2"
                    >
                      <span aria-hidden>+</span>
                    </button>
                  </div>

                  <select
                    value={waiter}
                    onChange={e => setWaiter(e.target.value)}
                    aria-label="Waiter looking after this table"
                    className={field}
                  >
                    <option value="">No waiter assigned</option>
                    {waiters.map(s => <option key={s.id} value={s.name}>{s.name} · {s.role}</option>)}
                  </select>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleStatusChange(selected, selected.status, {
                      currentGuestCount: guests,
                      currentWaiterName: waiter || null,
                    })}
                    className={`${ghostBtn} w-full`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Save guests and waiter
                  </button>
                </div>
              </section>

              {/* ── The furniture ───────────────────────────────────────── */}
              <section>
                <h3 className={sectionTitle}>The table itself</h3>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleVipToggle(selected)}
                    className={`${ghostBtn} w-full ${selected.isVip ? "border-primary-border bg-primary/10 text-primary" : "text-muted-foreground"}`}
                  >
                    <Star className={`h-3.5 w-3.5 ${selected.isVip ? "fill-primary" : ""}`} aria-hidden />
                    {selected.isVip ? "Remove VIP" : "Mark as VIP"}
                  </button>

                  <div className="flex gap-2">
                    <select
                      value={zoneTarget}
                      onChange={e => setZoneTarget(e.target.value)}
                      aria-label="Move this table to another zone"
                      className={field}
                    >
                      <option value="">Move to a zone…</option>
                      {Array.from(new Set([...PREDEFINED_ZONES, ...zones.filter(z => z !== UNZONED)]))
                        .filter(z => z !== selected.zone)
                        .map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleMoveZone(selected, zoneTarget)}
                      disabled={!zoneTarget || saving}
                      className={ghostBtn}
                    >
                      Move
                    </button>
                  </div>

                  {selected.mergedInto || selected.name.includes("+") ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleUnmerge(selected)}
                      className={`${ghostBtn} w-full border-warning-border bg-warning-subtle text-warning`}
                    >
                      <Unlink className="h-3.5 w-3.5" aria-hidden />
                      {selected.mergedInto ? "Unmerge from its primary table" : "Split this merged table"}
                    </button>
                  ) : mergeableTables.length > 0 ? (
                    <div className="flex gap-2">
                      <select
                        value={mergeTarget}
                        onChange={e => setMergeTarget(e.target.value)}
                        aria-label="Push a free table together with this one"
                        className={field}
                      >
                        <option value="">Push a free table together…</option>
                        {mergeableTables.map(t => (
                          <option key={t.id} value={String(t.id)}>{t.name} · {t.capacity} seats</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => { const id = parseInt(mergeTarget, 10); if (Number.isInteger(id)) handleMerge(selected, id); }}
                        disabled={!mergeTarget || saving}
                        className={ghostBtn}
                      >
                        <GitMerge className="h-3.5 w-3.5" aria-hidden /> Merge
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No free table to push this one together with.</p>
                  )}
                </div>
              </section>
            </div>

            {/* Pinned: what this table needs next, and the two destructive-ish
                operations kept small and out of the way of it. */}
            <div className="shrink-0 space-y-2 border-t border-border p-4">
              {selected.activeOrder?.id ? (
                <button type="button" onClick={() => openBill(selected)} className={primaryBtn}>
                  <Receipt className="h-4 w-4" aria-hidden /> Open bill · {money(selected.activeOrder.total)}
                </button>
              ) : selected.status === "free" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleStatusChange(selected, "occupied", { currentGuestCount: guests || 1, currentWaiterName: waiter || null })}
                  className={primaryBtn}
                >
                  <Users className="h-4 w-4" aria-hidden /> Seat this table
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleStatusChange(selected, "free", { currentGuestCount: 0, currentWaiterName: null })}
                  className={primaryBtn}
                >
                  <Check className="h-4 w-4" aria-hidden /> Free this table up
                </button>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddEdit({ open: true, table: selected })}
                  className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs font-semibold hover-elevate active-elevate-2"
                >
                  <Edit2 className="h-3.5 w-3.5" aria-hidden /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(selected)}
                  className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-danger-border bg-card text-xs font-semibold text-danger hover-elevate active-elevate-2"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      {addEdit.open && (
        <AddEditDialog
          table={addEdit.table}
          existingZones={zones.filter(z => z !== UNZONED)}
          busy={saving}
          onClose={() => setAddEdit({ open: false, table: null })}
          onSave={handleSaveTable}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete table"
            className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-md border border-border bg-card sm:max-h-[calc(100dvh-2rem)] sm:max-w-sm sm:rounded-md"
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-5 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill border border-danger-border bg-danger-subtle text-danger">
                <Trash2 className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="text-base font-semibold">Delete {deleteConfirm.name}?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                It comes off the floor plan and its QR code stops working. Past orders taken on this table are kept.
              </p>
              {deleteConfirm.activeOrder?.id && (
                <p className="mt-3 rounded-md border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning">
                  {deleteConfirm.name} still has a running tab worth {money(deleteConfirm.activeOrder.total)}. Settle or move it first.
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="min-h-12 flex-1 rounded-md border border-border bg-card text-sm font-semibold hover-elevate active-elevate-2"
              >
                Keep it
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleDelete(deleteConfirm)}
                className="min-h-12 flex-1 rounded-md border border-danger-border bg-danger-subtle text-sm font-semibold text-danger hover-elevate active-elevate-2 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
