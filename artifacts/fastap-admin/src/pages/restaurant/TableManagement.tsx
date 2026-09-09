import { useState, useEffect, useCallback } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { tables as tablesApi, staff as staffApi, floorOps, planLimitMessage } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import {
  Plus, RefreshCw, Clock, Users, X, Edit2, Trash2, Star, Lock,
  Unlock, Link2, Unlink, ChevronRight, CheckCircle2, Settings,
  LayoutGrid, List, ArrowRight, GitMerge, Copy, MapPin, ArrowRightLeft,
  Check, Wrench, UtensilsCrossed, ConciergeBell, Brush, IndianRupee
} from "lucide-react";

const STATUS_CFG = {
  free:         { label: "Free",         bg: "bg-success-subtle", border: "border-success-border", text: "text-success",  dot: "bg-success",             icon: Check },
  occupied:     { label: "Occupied",     bg: "bg-warning-subtle",  border: "border-warning-border",  text: "text-warning",   dot: "bg-warning animate-pulse", icon: Users },
  reserved:     { label: "Reserved",     bg: "bg-info-subtle",    border: "border-info-border",    text: "text-info",     dot: "bg-info",                icon: Clock },
  cleaning:     { label: "Cleaning",     bg: "bg-warning-subtle",  border: "border-warning-border",  text: "text-warning",   dot: "bg-warning animate-pulse", icon: Brush },
  blocked:      { label: "Locked",       bg: "bg-danger-subtle",     border: "border-danger-border",     text: "text-danger",      dot: "bg-danger",                 icon: X },
  billing:      { label: "Billing",      bg: "bg-muted",  border: "border-border",  text: "text-muted-foreground",   dot: "bg-muted animate-pulse", icon: IndianRupee },
  maintenance:  { label: "Maintenance",  bg: "bg-muted",    border: "border-border",    text: "text-muted-foreground",     dot: "bg-muted",                icon: Wrench },
  vip_occupied: { label: "VIP Occupied", bg: "bg-muted",  border: "border-border",  text: "text-muted-foreground",   dot: "bg-muted animate-pulse", icon: Star },
  waiting_food: { label: "Waiting for Food", bg: "bg-primary/15", border: "border-primary/40", text: "text-primary", dot: "bg-primary animate-pulse", icon: UtensilsCrossed },
  under_service: { label: "Under Service", bg: "bg-info-subtle", border: "border-info-border", text: "text-info", dot: "bg-info animate-pulse", icon: ConciergeBell },
} as const;

type TableStatus = keyof typeof STATUS_CFG;

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

const COLOR_OPTIONS = [
  { label: "Default", value: null },
  { label: "Amber",   value: "#f59e0b" },
  { label: "Emerald", value: "#10b981" },
  { label: "Blue",    value: "#3b82f6" },
  { label: "Violet",  value: "#8b5cf6" },
  { label: "Rose",    value: "#f43f5e" },
  { label: "Cyan",    value: "#06b6d4" },
];

function elapsed(since: string | null) {
  if (!since) return "";
  const mins = Math.floor((Date.now() - new Date(since).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface AddEditModalProps {
  table: TableRow | null;
  onClose: () => void;
  onSave: (data: any) => void;
  existingZones: string[];
}

function AddEditModal({ table, onClose, onSave, existingZones }: AddEditModalProps) {
  const allZones = Array.from(new Set([...PREDEFINED_ZONES, ...existingZones]));
  const [form, setForm] = useState({
    name: table?.name ?? "",
    zone: table?.zone ?? "Main Hall",
    capacity: table?.capacity ?? 4,
    isVip: table?.isVip ?? false,
    colorCode: table?.colorCode ?? null as string | null,
  });

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-lg border border-border overflow-hidden shadow-xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-lg">{table ? "Edit Table" : "Add New Table"}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Table Name / Number *</label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. T-11, Table 5, VIP-1"
              className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Zone / Section *</label>
            <select
              value={form.zone}
              onChange={e => setForm(p => ({ ...p, zone: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 text-foreground"
            >
              {allZones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Seating Capacity</label>
            <input
              type="number" min={1} max={50}
              value={form.capacity}
              onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) || 4 }))}
              className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Color Code</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={String(c.value)}
                  onClick={() => setForm(p => ({ ...p, colorCode: c.value }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${form.colorCode === c.value ? "border-border opacity-100" : "border-border opacity-50 hover:opacity-80"}`}
                  style={{ borderColor: c.value ?? undefined, background: c.value ? `${c.value}20` : undefined, color: c.value ?? "inherit" }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setForm(p => ({ ...p, isVip: !p.isVip }))}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${form.isVip ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground"}`}
            >
              <Star className="h-4 w-4" /> VIP Table
            </button>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:border-border">
            Cancel
          </button>
          <button
            onClick={() => { if (form.name.trim()) onSave(form); }}
            disabled={!form.name.trim()}
            className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors disabled:opacity-40"
          >
            {table ? "Save Changes" : "Add Table"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActionModalProps {
  table: TableRow;
  allTables: TableRow[];
  staffList: any[];
  onClose: () => void;
  onStatusChange: (status: TableStatus, extra?: any) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMerge: (secondaryId: number) => void;
  onUnmerge: () => void;
  onVipToggle: () => void;
  onMove: (zone: string) => void;
  /** Move the running tab onto another table. The floor moves; the furniture does not. */
  onMoveTab: (targetTableName: string) => void;
  /** Pull another table's tab onto this one — two tables pushed together. */
  onMergeTab: (fromTable: TableRow) => void;
  busy?: boolean;
}

function ActionModal({ table, allTables, staffList, onClose, onStatusChange, onEdit, onDelete, onMerge, onUnmerge, onVipToggle, onMove, onMoveTab, onMergeTab, busy }: ActionModalProps) {
  const cfg = STATUS_CFG[table.status] || STATUS_CFG.free;
  const [tab, setTab] = useState<"status" | "assign" | "merge" | "move" | "order">("status");
  const [guests, setGuests] = useState(table.currentGuestCount || 0);
  const [waiter, setWaiter] = useState(table.currentWaiterName || "");
  const [mergeTarget, setMergeTarget] = useState<number | null>(null);
  const waiters = staffList.filter(s => s.role === "waiter" || s.role === "manager");
  const mergeable = allTables.filter(t => t.id !== table.id && t.status === "free" && !t.mergedInto);
  const otherTabs = allTables.filter(t => t.id !== table.id && t.activeOrder?.id);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card rounded-lg border border-border overflow-hidden shadow-xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
            <div>
              <h3 className="font-semibold">{table.name}</h3>
              <p className="text-xs text-muted-foreground">{table.zone || "Main Hall"} · {table.capacity} seats{table.isVip ? " · VIP" : ""}</p>
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
        </div>

        <div className={`px-4 py-2.5 ${cfg.bg} border-b ${cfg.border} flex items-center justify-between`}>
          <span className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {table.currentGuestCount > 0 && <span><Users className="h-3 w-3 inline mr-1" />{table.currentGuestCount} guests</span>}
            {table.occupiedSince && <span><Clock className="h-3 w-3 inline mr-1" />{elapsed(table.occupiedSince)}</span>}
          </div>
        </div>

        <div className="flex border-b border-border text-xs">
          {(["status", "assign", "merge", "move", "order"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 font-semibold capitalize transition-colors ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-4 max-h-72 overflow-y-auto">
          {tab === "status" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(STATUS_CFG) as [TableStatus, typeof STATUS_CFG["free"]][]).map(([s, c]) => (
                  <button key={s} onClick={() => onStatusChange(s)}
                    disabled={s === table.status}
                    className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-30 ${c.bg} ${c.border} ${c.text}`}>
                    <c.icon className="h-3.5 w-3.5" />{c.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-border pt-3 mt-1 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Guest count</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setGuests(g => Math.max(0, g - 1))} className="w-8 h-8 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center">-</button>
                    <span className="flex-1 text-center font-semibold">{guests}</span>
                    <button onClick={() => setGuests(g => Math.min(table.capacity, g + 1))} className="w-8 h-8 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center">+</button>
                  </div>
                </div>
                <button
                  onClick={() => onStatusChange(table.status, { currentGuestCount: guests })}
                  className="w-full py-2 rounded-lg bg-muted border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Save guest count
                </button>
              </div>
            </div>
          )}

          {tab === "assign" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Assign waiter to this table</p>
              <select
                value={waiter}
                onChange={e => setWaiter(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground"
              >
                <option value="">-- Unassign --</option>
                {waiters.map(s => <option key={s.id} value={s.name}>{s.name} ({s.role})</option>)}
              </select>
              <button
                onClick={() => onStatusChange(table.status, { currentWaiterName: waiter || null })}
                className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
              >
                Assign Waiter
              </button>
              <div className="border-t border-border pt-3 space-y-2">
                <button
                  onClick={onVipToggle}
                  className={`w-full flex items-center gap-2 justify-center py-2.5 rounded-lg border text-sm font-semibold transition-colors ${table.isVip ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground hover:border-border"}`}
                >
                  <Star className="h-4 w-4" /> {table.isVip ? "Remove VIP" : "Mark as VIP"}
                </button>
              </div>
            </div>
          )}

          {tab === "merge" && (
            <div className="space-y-3">
              {table.mergedInto ? (
                <div className="space-y-3">
                  <p className="text-xs text-warning">This table is merged into another table.</p>
                  <button onClick={onUnmerge} className="w-full flex items-center gap-2 justify-center py-2.5 rounded-lg bg-warning-subtle border border-warning-border text-warning text-sm font-semibold">
                    <Unlink className="h-4 w-4" /> Unmerge Tables
                  </button>
                </div>
              ) : table.name.includes("+") ? (
                <div className="space-y-3">
                  <p className="text-xs text-warning">This is a merged table ({table.name}).</p>
                  <button onClick={onUnmerge} className="w-full flex items-center gap-2 justify-center py-2.5 rounded-lg bg-warning-subtle border border-warning-border text-warning text-sm font-semibold">
                    <Unlink className="h-4 w-4" /> Split / Unmerge
                  </button>
                </div>
              ) : mergeable.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No free tables available to merge with</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Select a free table to merge with <strong className="text-foreground">{table.name}</strong></p>
                  <div className="space-y-1.5">
                    {mergeable.map(t => (
                      <button key={t.id} onClick={() => setMergeTarget(mergeTarget === t.id ? null : t.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${mergeTarget === t.id ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted border-border text-foreground hover:border-border"}`}>
                        <span>{t.name}</span>
                        <span className="text-xs text-muted-foreground">{t.zone} · {t.capacity} seats</span>
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={!mergeTarget}
                    onClick={() => mergeTarget && onMerge(mergeTarget)}
                    className="w-full flex items-center gap-2 justify-center py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    <GitMerge className="h-4 w-4" /> Merge Tables
                  </button>
                </>
              )}
            </div>
          )}

          {tab === "move" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Move <strong className="text-foreground">{table.name}</strong> to a different zone</p>
              <div className="space-y-1.5">
                {PREDEFINED_ZONES.map(zone => (
                  <button key={zone} onClick={() => { if (table.zone !== zone) onMove(zone); }}
                    disabled={table.zone === zone}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors disabled:cursor-default ${table.zone === zone ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted border-border text-foreground hover:border-border"}`}>
                    <span>{zone}</span>
                    {table.zone === zone && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "order" && (
            <div className="space-y-3">
              {!table.activeOrder?.id ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No running tab on {table.name}. Move and merge become available once a party is seated and has ordered.
                </p>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Order #{table.activeOrder.id}</span>
                      <span className="font-semibold text-primary">
                        {table.activeOrder.total ? `₹${parseFloat(table.activeOrder.total).toFixed(2)}` : "—"}
                      </span>
                    </div>
                    {table.activeOrder.itemsPreview && (
                      <p className="mt-1 truncate text-2xs text-muted-foreground">{table.activeOrder.itemsPreview}</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs text-muted-foreground">Move this tab to another table</p>
                    <div className="space-y-1.5">
                      {allTables.filter(t => t.id !== table.id && t.isActive).map(t => (
                        <button key={t.id} type="button" disabled={busy} onClick={() => onMoveTab(t.name)}
                          className="flex w-full items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground transition-colors hover:border-border disabled:opacity-40">
                          <span className="flex items-center gap-2"><ArrowRightLeft className="h-3.5 w-3.5" /> {t.name}</span>
                          <span className={`text-xs ${t.activeOrder?.id ? "text-warning" : "text-muted-foreground"}`}>
                            {t.activeOrder?.id ? "has a tab" : (STATUS_CFG[t.status]?.label ?? t.status)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="mb-1.5 text-xs text-muted-foreground">Pull another table's tab onto {table.name}</p>
                    {otherTabs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No other table has a running tab.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {otherTabs.map(t => (
                          <button key={t.id} type="button" disabled={busy} onClick={() => onMergeTab(t)}
                            className="flex w-full items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground transition-colors hover:border-border disabled:opacity-40">
                            <span className="flex items-center gap-2"><GitMerge className="h-3.5 w-3.5" /> {t.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {t.activeOrder?.total ? `₹${parseFloat(t.activeOrder.total).toFixed(0)}` : `#${t.activeOrder?.id}`}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-border">
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <Edit2 className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-danger-subtle border border-danger-border text-xs font-semibold text-danger hover-elevate transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:border-border">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TableManagement() {
  const { restaurantId } = useRestaurant();
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedZone, setSelectedZone] = useState("All");
  const [statusFilter, setStatusFilter] = useState<TableStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [addEditModal, setAddEditModal] = useState<{ open: boolean; table: TableRow | null }>({ open: false, table: null });
  const [actionModal, setActionModal] = useState<TableRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TableRow | null>(null);

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

  const zones = ["All", ...Array.from(new Set(tableRows.filter(t => t.zone).map(t => t.zone!)))];

  const visible = tableRows.filter(t => {
    if (!t.isActive && !t.mergedInto) return true;
    if (!t.isActive && t.mergedInto) return false;
    const zoneMatch = selectedZone === "All" || t.zone === selectedZone;
    const statusMatch = statusFilter === "all" || t.status === statusFilter;
    return zoneMatch && statusMatch;
  });

  const summary = Object.fromEntries(
    (Object.keys(STATUS_CFG) as TableStatus[]).map(s => [s, tableRows.filter(t => t.status === s && t.isActive).length])
  ) as Record<TableStatus, number>;

  async function handleStatusChange(table: TableRow, status: TableStatus, extra: any = {}) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const updated = await tablesApi.updateStatus(restaurantId, table.id, { status, ...extra });
      setTableRows(prev => prev.map(t => t.id === updated.id ? mapRow(updated) : t));
      setActionModal(null);
      toast({ title: `${table.name} updated` });
    } catch (e: any) {
      toast({ title: "Failed to update table", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleMoveZone(table: TableRow, zone: string) {
    if (!restaurantId || table.zone === zone) return;
    setSaving(true);
    try {
      const updated = await tablesApi.update(restaurantId, table.id, { zone });
      const mapped = mapRow(updated);
      setTableRows(prev => prev.map(t => t.id === mapped.id ? mapped : t));
      setActionModal(prev => prev ? mapped : null);
      toast({ title: `Moved ${table.name} to ${zone}` });
    } catch (e: any) {
      toast({ title: "Failed to move table", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleSaveTable(data: any) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      if (addEditModal.table) {
        const updated = await tablesApi.update(restaurantId, addEditModal.table.id, data);
        setTableRows(prev => prev.map(t => t.id === updated.id ? mapRow(updated) : t));
        toast({ title: "Table updated" });
      } else {
        const created = await tablesApi.create(restaurantId, data);
        setTableRows(prev => [...prev, mapRow(created)]);
        toast({ title: "Table added" });
      }
      setAddEditModal({ open: false, table: null });
    } catch (e: any) {
      // A plan cap comes back as a 402 naming the allowance — say that, not "failed".
      toast({ ...planLimitMessage(e, "Failed to save table"), variant: "destructive" });
    } finally { setSaving(false); }
  }

  /** Move a running tab onto another table. The old table is released by the server. */
  async function handleMoveTab(table: TableRow, targetTableName: string) {
    const orderId = table.activeOrder?.id;
    if (!restaurantId || !orderId) return;
    setSaving(true);
    try {
      const res = await floorOps.moveTable(restaurantId, orderId, { tableName: targetTableName });
      toast({ title: `Tab moved to ${res.movedTo}`, description: res.movedFrom ? `${res.movedFrom} is now free.` : undefined });
      await load();
      setActionModal(null);
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
      await load();
      setActionModal(null);
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
      setActionModal(null);
      toast({ title: `${table.name} deleted` });
    } catch (e: any) {
      toast({ title: "Failed to delete table", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleMerge(primaryTable: TableRow, secondaryId: number) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await tablesApi.merge(restaurantId, { primaryId: primaryTable.id, secondaryIds: [secondaryId] });
      await load();
      setActionModal(null);
      toast({ title: "Tables merged" });
    } catch (e: any) {
      toast({ title: "Failed to merge tables", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleUnmerge(table: TableRow) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await tablesApi.unmerge(restaurantId, table.id);
      await load();
      setActionModal(null);
      toast({ title: "Tables unmerged" });
    } catch (e: any) {
      toast({ title: "Failed to unmerge tables", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleVipToggle(table: TableRow) {
    if (!restaurantId) return;
    try {
      const updated = await tablesApi.updateStatus(restaurantId, table.id, { isVip: !table.isVip });
      setTableRows(prev => prev.map(t => t.id === updated.id ? mapRow(updated) : t));
      setActionModal(prev => prev ? mapRow(updated) : null);
      toast({ title: table.isVip ? "VIP removed" : "Marked as VIP" });
    } catch (e: any) {
      toast({ title: "Failed to update VIP status", description: e?.message, variant: "destructive" });
    }
  }

  const total = tableRows.filter(t => t.isActive).length;
  const freeCount = summary.free ?? 0;
  const occupiedCount = summary.occupied ?? 0;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Table Management</h1>
          <p className="text-xs text-muted-foreground">{total} tables · {occupiedCount} occupied · {freeCount} free</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(v => v === "grid" ? "list" : "grid")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted hover-elevate text-sm transition-colors">
            {viewMode === "grid" ? <List className="h-4 w-4 text-muted-foreground" /> : <LayoutGrid className="h-4 w-4 text-muted-foreground" />}
          </button>
          <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted hover-elevate text-sm transition-colors">
            <RefreshCw className={`h-4 w-4 text-primary ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setAddEditModal({ open: true, table: null })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors">
            <Plus className="h-4 w-4" /> Add Table
          </button>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {(Object.entries(STATUS_CFG) as [TableStatus, typeof STATUS_CFG["free"]][]).map(([status, cfg]) => (
          <button key={status} onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            className={`rounded-lg p-2.5 border text-center transition-colors ${statusFilter === status ? `${cfg.bg} ${cfg.border}` : "border-border bg-card hover:border-border"}`}>
            <div className={`text-xl font-semibold ${cfg.text}`}>{summary[status] || 0}</div>
            <div className="text-2xs text-muted-foreground mt-0.5 leading-tight">{cfg.label}</div>
          </button>
        ))}
      </div>

      {/* Zone Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {zones.map(z => (
          <button key={z} onClick={() => setSelectedZone(z)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${selectedZone === z ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground hover:border-border"}`}>
            {z}
            {z !== "All" && <span className="ml-1.5 opacity-60">{tableRows.filter(t => t.zone === z && t.isActive).length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading tables...</div>
      ) : loadError ? (
        <div role="alert" className="text-center py-16">
          <p className="text-sm font-semibold text-danger">We could not load your floor plan.</p>
          <p className="mt-1 text-xs text-danger">{loadError}</p>
          <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}
            className="mt-4 px-4 py-2 rounded-lg bg-danger-subtle border border-danger-border text-danger text-sm font-semibold">
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <LayoutGrid className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No tables found</p>
          <button onClick={() => setAddEditModal({ open: true, table: null })}
            className="mt-4 px-4 py-2 rounded-lg bg-primary/20 border border-primary/40 text-primary text-sm font-semibold">
            + Add First Table
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {visible.map(table => {
            const cfg = STATUS_CFG[table.status] || STATUS_CFG.free;
            const borderColor = table.colorCode ? `border-[${table.colorCode}]/50` : cfg.border;
            return (
              <button key={table.id} onClick={() => setActionModal(table)}
                className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted ${cfg.bg} ${cfg.border} relative`}
                style={table.colorCode ? { borderColor: `${table.colorCode}50`, background: `${table.colorCode}10` } : undefined}>
                {table.isVip && (
                  <div className="absolute top-2 right-2">
                    <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                  </div>
                )}
                {table.mergedInto && (
                  <div className="absolute top-2 left-2">
                    <Link2 className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-base leading-tight">{table.name}</p>
                    <p className="text-2xs text-muted-foreground mt-0.5">{table.zone || "Main Hall"}</p>
                  </div>
                  <div className={`h-2 w-2 rounded-full mt-1 ${cfg.dot}`} />
                </div>

                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {table.currentGuestCount > 0 ? `${table.currentGuestCount}/` : ""}{table.capacity}
                  </span>
                </div>

                {table.occupiedSince && (
                  <div className="flex items-center gap-1 text-2xs text-muted-foreground mb-1.5">
                    <Clock className="h-3 w-3" />{elapsed(table.occupiedSince)}
                  </div>
                )}

                {table.currentCustomerName && (
                  <p className="text-2xs text-foreground font-medium truncate mb-1">{table.currentCustomerName}</p>
                )}

                {table.activeOrder?.total && (
                  <p className="text-xs font-semibold text-foreground mb-0.5">₹{parseFloat(table.activeOrder.total).toFixed(0)}</p>
                )}

                {table.activeOrder?.itemsPreview && (
                  <p className="text-2xs text-muted-foreground truncate mb-1">{table.activeOrder.itemsPreview}{table.activeOrder.itemCount > 1 ? ` +${table.activeOrder.itemCount - 1}` : ""}</p>
                )}

                {table.currentWaiterName && (
                  <p className="text-2xs text-muted-foreground truncate mb-1">{table.currentWaiterName}</p>
                )}

                <div className={`text-2xs font-semibold mt-1 ${cfg.text}`}>{cfg.label}</div>
              </button>
            );
          })}
          {/* Add Table Card */}
          <button onClick={() => setAddEditModal({ open: true, table: null })}
            className="rounded-lg border border-dashed border-border p-4 flex flex-col items-center justify-center gap-2 hover:border-border hover:bg-card transition-colors min-h-[120px]">
            <Plus className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Add Table</span>
          </button>
        </div>
      ) : (
        /* List View */
        <div className="rounded-lg border border-border">
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-muted-foreground text-xs">
                  <th className="text-left px-4 py-3 font-semibold">Table</th>
                  <th className="text-left px-4 py-3 font-semibold">Zone</th>
                  <th className="text-left px-4 py-3 font-semibold">Capacity</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Guest</th>
                  <th className="text-left px-4 py-3 font-semibold">Bill</th>
                  <th className="text-left px-4 py-3 font-semibold">Waiter</th>
                  <th className="text-left px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(table => {
                  const cfg = STATUS_CFG[table.status] || STATUS_CFG.free;
                  return (
                    <tr key={table.id} className="hover:bg-card transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                          <span className="font-semibold">{table.name}</span>
                          {table.isVip && <Star className="h-3 w-3 text-primary fill-primary" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{table.zone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {table.currentGuestCount > 0 ? `${table.currentGuestCount}/` : ""}{table.capacity}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{table.currentCustomerName || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{table.activeOrder?.total ? `₹${parseFloat(table.activeOrder.total).toFixed(0)}` : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{table.currentWaiterName || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{table.occupiedSince ? elapsed(table.occupiedSince) : "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setActionModal(table)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Settings className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {addEditModal.open && (
        <AddEditModal
          table={addEditModal.table}
          onClose={() => setAddEditModal({ open: false, table: null })}
          onSave={handleSaveTable}
          existingZones={zones.filter(z => z !== "All")}
        />
      )}

      {actionModal && (
        <ActionModal
          table={actionModal}
          allTables={tableRows}
          staffList={staffList}
          onClose={() => setActionModal(null)}
          onStatusChange={(status, extra) => handleStatusChange(actionModal, status, extra)}
          onEdit={() => { setAddEditModal({ open: true, table: actionModal }); setActionModal(null); }}
          onDelete={() => { setDeleteConfirm(actionModal); setActionModal(null); }}
          onMerge={(secondaryId) => handleMerge(actionModal, secondaryId)}
          onUnmerge={() => handleUnmerge(actionModal)}
          onVipToggle={() => handleVipToggle(actionModal)}
          onMove={(zone) => handleMoveZone(actionModal, zone)}
          onMoveTab={(targetTableName) => handleMoveTab(actionModal, targetTableName)}
          onMergeTab={(fromTable) => handleMergeTabs(actionModal, fromTable)}
          busy={saving}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-lg border border-border p-6 shadow-xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <Trash2 className="h-8 w-8 text-danger mx-auto mb-3" />
            <h3 className="font-semibold text-center mb-1">Delete Table?</h3>
            <p className="text-xs text-muted-foreground text-center mb-5">
              Are you sure you want to delete <strong className="text-foreground">{deleteConfirm.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-muted-foreground">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 rounded-lg bg-danger-subtle border border-danger-border text-danger text-sm font-semibold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
