import { useState, useEffect, useCallback } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { tables as tablesApi, staff as staffApi } from "@/lib/api";
import {
  Plus, RefreshCw, Clock, Users, X, Edit2, Trash2, Star, Lock,
  Unlock, Link2, Unlink, ChevronRight, CheckCircle2, Settings,
  LayoutGrid, List, ArrowRight, GitMerge, Copy, MapPin
} from "lucide-react";

const STATUS_CFG = {
  free:         { label: "Free",         bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-400",  dot: "bg-emerald-400",             icon: "✓" },
  occupied:     { label: "Occupied",     bg: "bg-orange-500/15",  border: "border-orange-500/40",  text: "text-orange-400",   dot: "bg-orange-400 animate-pulse", icon: "●" },
  reserved:     { label: "Reserved",     bg: "bg-blue-500/15",    border: "border-blue-500/40",    text: "text-blue-400",     dot: "bg-blue-400",                icon: "R" },
  cleaning:     { label: "Cleaning",     bg: "bg-yellow-500/15",  border: "border-yellow-500/40",  text: "text-yellow-400",   dot: "bg-yellow-400 animate-pulse", icon: "~" },
  blocked:      { label: "Locked",       bg: "bg-red-500/15",     border: "border-red-500/40",     text: "text-red-400",      dot: "bg-red-400",                 icon: "✕" },
  billing:      { label: "Billing",      bg: "bg-violet-500/15",  border: "border-violet-500/40",  text: "text-violet-400",   dot: "bg-violet-400 animate-pulse", icon: "₹" },
  maintenance:  { label: "Maintenance",  bg: "bg-gray-500/15",    border: "border-gray-500/40",    text: "text-gray-400",     dot: "bg-gray-400",                icon: "⚙" },
  vip_occupied: { label: "VIP Occupied", bg: "bg-purple-500/15",  border: "border-purple-500/40",  text: "text-purple-400",   dot: "bg-purple-400 animate-pulse", icon: "★" },
  waiting_food: { label: "Waiting for Food", bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400", dot: "bg-amber-400 animate-pulse", icon: "🍽" },
  under_service: { label: "Under Service", bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-400", dot: "bg-cyan-400 animate-pulse", icon: "🛎" },
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="font-bold text-lg">{table ? "Edit Table" : "Add New Table"}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Table Name / Number *</label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. T-11, Table 5, VIP-1"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Zone / Section *</label>
            <select
              value={form.zone}
              onChange={e => setForm(p => ({ ...p, zone: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 text-white"
            >
              {allZones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Seating Capacity</label>
            <input
              type="number" min={1} max={50}
              value={form.capacity}
              onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) || 4 }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Color Code</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={String(c.value)}
                  onClick={() => setForm(p => ({ ...p, colorCode: c.value }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.colorCode === c.value ? "border-white/50 opacity-100" : "border-white/10 opacity-50 hover:opacity-80"}`}
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${form.isVip ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/5 border-white/10 text-white/50"}`}
            >
              <Star className="h-4 w-4" /> VIP Table
            </button>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-white/5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-white/60 hover:border-white/20">
            Cancel
          </button>
          <button
            onClick={() => { if (form.name.trim()) onSave(form); }}
            disabled={!form.name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-all disabled:opacity-40"
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
}

function ActionModal({ table, allTables, staffList, onClose, onStatusChange, onEdit, onDelete, onMerge, onUnmerge, onVipToggle }: ActionModalProps) {
  const cfg = STATUS_CFG[table.status] || STATUS_CFG.free;
  const [tab, setTab] = useState<"status" | "assign" | "merge" | "move">("status");
  const [guests, setGuests] = useState(table.currentGuestCount || 0);
  const [waiter, setWaiter] = useState(table.currentWaiterName || "");
  const [mergeTarget, setMergeTarget] = useState<number | null>(null);
  const waiters = staffList.filter(s => s.role === "waiter" || s.role === "manager");
  const mergeable = allTables.filter(t => t.id !== table.id && t.status === "free" && !t.mergedInto);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
            <div>
              <h3 className="font-bold">{table.name}</h3>
              <p className="text-xs text-white/40">{table.zone || "Main Hall"} · {table.capacity} seats{table.isVip ? " · ⭐ VIP" : ""}</p>
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
        </div>

        <div className={`px-4 py-2.5 ${cfg.bg} border-b ${cfg.border} flex items-center justify-between`}>
          <span className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</span>
          <div className="flex items-center gap-2 text-xs text-white/40">
            {table.currentGuestCount > 0 && <span><Users className="h-3 w-3 inline mr-1" />{table.currentGuestCount} guests</span>}
            {table.occupiedSince && <span><Clock className="h-3 w-3 inline mr-1" />{elapsed(table.occupiedSince)}</span>}
          </div>
        </div>

        <div className="flex border-b border-white/5 text-xs">
          {(["status", "assign", "merge", "move"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 font-semibold capitalize transition-all ${tab === t ? "text-amber-400 border-b-2 border-amber-400" : "text-white/40 hover:text-white/60"}`}>
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
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-30 ${c.bg} ${c.border} ${c.text}`}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/5 pt-3 mt-1 space-y-2">
                <div>
                  <p className="text-xs text-white/40 mb-1.5">Guest count</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setGuests(g => Math.max(0, g - 1))} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/60 flex items-center justify-center">-</button>
                    <span className="flex-1 text-center font-bold">{guests}</span>
                    <button onClick={() => setGuests(g => Math.min(table.capacity, g + 1))} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/60 flex items-center justify-center">+</button>
                  </div>
                </div>
                <button
                  onClick={() => onStatusChange(table.status, { currentGuestCount: guests })}
                  className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/60 hover:text-white"
                >
                  Save guest count
                </button>
              </div>
            </div>
          )}

          {tab === "assign" && (
            <div className="space-y-3">
              <p className="text-xs text-white/40">Assign waiter to this table</p>
              <select
                value={waiter}
                onChange={e => setWaiter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white"
              >
                <option value="">-- Unassign --</option>
                {waiters.map(s => <option key={s.id} value={s.name}>{s.name} ({s.role})</option>)}
              </select>
              <button
                onClick={() => onStatusChange(table.status, { currentWaiterName: waiter || null })}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-all"
              >
                Assign Waiter
              </button>
              <div className="border-t border-white/5 pt-3 space-y-2">
                <button
                  onClick={onVipToggle}
                  className={`w-full flex items-center gap-2 justify-center py-2.5 rounded-xl border text-sm font-semibold transition-all ${table.isVip ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"}`}
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
                  <p className="text-xs text-yellow-400/80">This table is merged into another table.</p>
                  <button onClick={onUnmerge} className="w-full flex items-center gap-2 justify-center py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 text-sm font-semibold">
                    <Unlink className="h-4 w-4" /> Unmerge Tables
                  </button>
                </div>
              ) : table.name.includes("+") ? (
                <div className="space-y-3">
                  <p className="text-xs text-yellow-400/80">This is a merged table ({table.name}).</p>
                  <button onClick={onUnmerge} className="w-full flex items-center gap-2 justify-center py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 text-sm font-semibold">
                    <Unlink className="h-4 w-4" /> Split / Unmerge
                  </button>
                </div>
              ) : mergeable.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-4">No free tables available to merge with</p>
              ) : (
                <>
                  <p className="text-xs text-white/40">Select a free table to merge with <strong className="text-white">{table.name}</strong></p>
                  <div className="space-y-1.5">
                    {mergeable.map(t => (
                      <button key={t.id} onClick={() => setMergeTarget(mergeTarget === t.id ? null : t.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all ${mergeTarget === t.id ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/5 border-white/10 text-white/70 hover:border-white/20"}`}>
                        <span>{t.name}</span>
                        <span className="text-xs text-white/40">{t.zone} · {t.capacity} seats</span>
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={!mergeTarget}
                    onClick={() => mergeTarget && onMerge(mergeTarget)}
                    className="w-full flex items-center gap-2 justify-center py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-all disabled:opacity-40"
                  >
                    <GitMerge className="h-4 w-4" /> Merge Tables
                  </button>
                </>
              )}
            </div>
          )}

          {tab === "move" && (
            <div className="space-y-3">
              <p className="text-xs text-white/40">Move <strong className="text-white">{table.name}</strong> to a different zone</p>
              <div className="space-y-1.5">
                {PREDEFINED_ZONES.map(zone => (
                  <button key={zone} onClick={() => { /* handled by parent via onEdit with new zone */ }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all ${table.zone === zone ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/5 border-white/10 text-white/70 hover:border-white/20"}`}>
                    <span>{zone}</span>
                    {table.zone === zone && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-white/5">
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/60 hover:text-white transition-all">
            <Edit2 className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-xs font-semibold text-white/50 hover:border-white/20">
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
    } catch { }
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
    } catch { } finally { setSaving(false); }
  }

  async function handleSaveTable(data: any) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      if (addEditModal.table) {
        const updated = await tablesApi.update(restaurantId, addEditModal.table.id, data);
        setTableRows(prev => prev.map(t => t.id === updated.id ? mapRow(updated) : t));
      } else {
        const created = await tablesApi.create(restaurantId, data);
        setTableRows(prev => [...prev, mapRow(created)]);
      }
      setAddEditModal({ open: false, table: null });
    } catch { } finally { setSaving(false); }
  }

  async function handleDelete(table: TableRow) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await tablesApi.delete(restaurantId, table.id);
      setTableRows(prev => prev.filter(t => t.id !== table.id));
      setDeleteConfirm(null);
      setActionModal(null);
    } catch { } finally { setSaving(false); }
  }

  async function handleMerge(primaryTable: TableRow, secondaryId: number) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const result = await tablesApi.merge(restaurantId, { primaryId: primaryTable.id, secondaryIds: [secondaryId] });
      await load();
      setActionModal(null);
    } catch { } finally { setSaving(false); }
  }

  async function handleUnmerge(table: TableRow) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await tablesApi.unmerge(restaurantId, table.id);
      await load();
      setActionModal(null);
    } catch { } finally { setSaving(false); }
  }

  async function handleVipToggle(table: TableRow) {
    if (!restaurantId) return;
    const updated = await tablesApi.updateStatus(restaurantId, table.id, { isVip: !table.isVip });
    setTableRows(prev => prev.map(t => t.id === updated.id ? mapRow(updated) : t));
    setActionModal(prev => prev ? mapRow(updated) : null);
  }

  const total = tableRows.filter(t => t.isActive).length;
  const freeCount = summary.free ?? 0;
  const occupiedCount = summary.occupied ?? 0;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Table Management</h1>
          <p className="text-xs text-white/40">{total} tables · {occupiedCount} occupied · {freeCount} free</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(v => v === "grid" ? "list" : "grid")}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm transition-all">
            {viewMode === "grid" ? <List className="h-4 w-4 text-white/50" /> : <LayoutGrid className="h-4 w-4 text-white/50" />}
          </button>
          <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm transition-all">
            <RefreshCw className={`h-4 w-4 text-amber-400 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setAddEditModal({ open: true, table: null })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-all">
            <Plus className="h-4 w-4" /> Add Table
          </button>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {(Object.entries(STATUS_CFG) as [TableStatus, typeof STATUS_CFG["free"]][]).map(([status, cfg]) => (
          <button key={status} onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            className={`rounded-xl p-2.5 border text-center transition-all ${statusFilter === status ? `${cfg.bg} ${cfg.border}` : "border-white/8 bg-white/[0.03] hover:border-white/15"}`}>
            <div className={`text-xl font-extrabold ${cfg.text}`}>{summary[status] || 0}</div>
            <div className="text-[10px] text-white/40 mt-0.5 leading-tight">{cfg.label}</div>
          </button>
        ))}
      </div>

      {/* Zone Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {zones.map(z => (
          <button key={z} onClick={() => setSelectedZone(z)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${selectedZone === z ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}>
            {z}
            {z !== "All" && <span className="ml-1.5 opacity-60">{tableRows.filter(t => t.zone === z && t.isActive).length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-white/30">Loading tables...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <LayoutGrid className="h-10 w-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No tables found</p>
          <button onClick={() => setAddEditModal({ open: true, table: null })}
            className="mt-4 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-semibold">
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
                className={`rounded-2xl border p-4 text-left transition-all hover:scale-[1.02] hover:shadow-lg ${cfg.bg} ${cfg.border} relative`}
                style={table.colorCode ? { borderColor: `${table.colorCode}50`, background: `${table.colorCode}10` } : undefined}>
                {table.isVip && (
                  <div className="absolute top-2 right-2">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  </div>
                )}
                {table.mergedInto && (
                  <div className="absolute top-2 left-2">
                    <Link2 className="h-3 w-3 text-violet-400" />
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-extrabold text-base leading-tight">{table.name}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{table.zone || "Main Hall"}</p>
                  </div>
                  <div className={`h-2 w-2 rounded-full mt-1 ${cfg.dot}`} />
                </div>

                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users className="h-3 w-3 text-white/30" />
                  <span className="text-xs text-white/50">
                    {table.currentGuestCount > 0 ? `${table.currentGuestCount}/` : ""}{table.capacity}
                  </span>
                </div>

                {table.occupiedSince && (
                  <div className="flex items-center gap-1 text-[10px] text-white/40 mb-1.5">
                    <Clock className="h-3 w-3" />{elapsed(table.occupiedSince)}
                  </div>
                )}

                {table.currentCustomerName && (
                  <p className="text-[10px] text-white/70 font-medium truncate mb-1">{table.currentCustomerName}</p>
                )}

                {table.activeOrder?.total && (
                  <p className="text-xs font-bold text-white/90 mb-0.5">₹{parseFloat(table.activeOrder.total).toFixed(0)}</p>
                )}

                {table.activeOrder?.itemsPreview && (
                  <p className="text-[10px] text-white/40 truncate mb-1">{table.activeOrder.itemsPreview}{table.activeOrder.itemCount > 1 ? ` +${table.activeOrder.itemCount - 1}` : ""}</p>
                )}

                {table.currentWaiterName && (
                  <p className="text-[10px] text-white/50 truncate mb-1">{table.currentWaiterName}</p>
                )}

                <div className={`text-[10px] font-semibold mt-1 ${cfg.text}`}>{cfg.label}</div>
              </button>
            );
          })}
          {/* Add Table Card */}
          <button onClick={() => setAddEditModal({ open: true, table: null })}
            className="rounded-2xl border border-dashed border-white/15 p-4 flex flex-col items-center justify-center gap-2 hover:border-white/30 hover:bg-white/[0.02] transition-all min-h-[120px]">
            <Plus className="h-6 w-6 text-white/20" />
            <span className="text-xs text-white/20">Add Table</span>
          </button>
        </div>
      ) : (
        /* List View */
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5">
              <tr className="text-white/40 text-xs">
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
            <tbody className="divide-y divide-white/5">
              {visible.map(table => {
                const cfg = STATUS_CFG[table.status] || STATUS_CFG.free;
                return (
                  <tr key={table.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                        <span className="font-semibold">{table.name}</span>
                        {table.isVip && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">{table.zone || "—"}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">
                      {table.currentGuestCount > 0 ? `${table.currentGuestCount}/` : ""}{table.capacity}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">{table.currentCustomerName || "—"}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{table.activeOrder?.total ? `₹${parseFloat(table.activeOrder.total).toFixed(0)}` : "—"}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{table.currentWaiterName || "—"}</td>
                    <td className="px-4 py-3 text-white/40 text-xs">{table.occupiedSince ? elapsed(table.occupiedSince) : "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setActionModal(table)} className="text-white/30 hover:text-white transition-colors">
                        <Settings className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-white/10 p-6 shadow-2xl">
            <Trash2 className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <h3 className="font-bold text-center mb-1">Delete Table?</h3>
            <p className="text-xs text-white/40 text-center mb-5">
              Are you sure you want to delete <strong className="text-white">{deleteConfirm.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-white/60">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-bold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
