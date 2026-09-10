import { useState, useEffect, useCallback } from "react";
import { useRestaurant, type StaffRole } from "@/contexts/RestaurantContext";
import { staff as staffApi, planLimitMessage } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { AttendancePanel } from "@/components/restaurant/AttendancePanel";
import { fmtINR } from "@/lib/format";

interface StaffMember { id: string; name: string; role: StaffRole; email: string; mobile: string; avatar?: string; status: "active" | "on-break" | "offline"; shift: string; joinDate: string; ordersServed: number; salesTotal: number; avgOrderValue: number; tipsCollected: number; tablesAssigned?: string[]; weeklySchedule?: Record<string, string>; }

// HR day-wise roster building blocks
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_SHIFTS = ["Morning", "Afternoon", "Night", "Split", "Off"];
const SHIFT_STYLE: Record<string, string> = {
  Morning: "text-primary bg-primary/10",
  Afternoon: "text-info bg-info-subtle",
  Night: "text-muted-foreground bg-muted",
  Split: "text-success bg-success-subtle",
  Off: "text-muted-foreground bg-muted",
};
// When a day has no explicit setting, derive a sensible default from the base shift
// (Sunday is the weekly off for everyone except waiters).
function defaultDayShift(s: { shift?: string; role?: string }, day: string): string {
  if (day === "Sun" && s.role !== "waiter") return "Off";
  return (s.shift || "Morning").split(" ")[0];
}
function buildWeekly(s: StaffMember): Record<string, string> {
  const ws = s.weeklySchedule || {};
  const out: Record<string, string> = {};
  for (const d of DAYS) out[d] = ws[d] || defaultDayShift(s, d);
  return out;
}
import {
  Plus, Search, Phone, Mail, Star, Clock, Shield, Edit2, X, Save,
  CheckCircle, AlertCircle, TrendingUp, Trash2, Crown, Building2, CreditCard, UtensilsCrossed, ChefHat, Brush, ConciergeBell, Flower2, Martini, ChartColumn, Users, Store, User, CircleCheck, Coffee, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ROLE_CONFIG: Record<StaffRole, { label: string; icon: LucideIcon; color: string }> = {
  owner:        { label: "Owner",          icon: Crown, color: "text-warning" },
  manager:      { label: "Manager",        icon: Building2, color: "text-muted-foreground" },
  cashier:      { label: "Cashier",        icon: CreditCard, color: "text-info" },
  waiter:       { label: "Waiter",         icon: UtensilsCrossed, color: "text-warning" },
  kitchen:      { label: "Kitchen Staff",  icon: ChefHat, color: "text-primary" },
  chef:         { label: "Chef",           icon: ChefHat, color: "text-primary" },
  housekeeping: { label: "Housekeeping",   icon: Brush, color: "text-success" },
  reception:    { label: "Reception",      icon: ConciergeBell, color: "text-muted-foreground" },
  spa:          { label: "Spa Staff",      icon: Flower2, color: "text-danger" },
  bar:          { label: "Bar Staff",      icon: Martini, color: "text-info" },
  finance:      { label: "Finance",        icon: ChartColumn, color: "text-success" },
  hr:           { label: "HR",             icon: Users, color: "text-info" },
  franchise:    { label: "Franchise",      icon: Store, color: "text-muted-foreground" },
};
const DEFAULT_ROLE_CFG = { label: "Staff", icon: User, color: "text-muted-foreground" };
const roleCfgOf = (r: StaffRole) => ROLE_CONFIG[r] ?? DEFAULT_ROLE_CFG;

export default function StaffManagement() {
  const { restaurantId, restaurant } = useRestaurant();
  const { confirm, confirmDialog } = useConfirm();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  // The bars below are a share of the busiest person's takings, so a floor where nobody
  // has served anything shows empty bars rather than a divide-by-zero.
  const topSales = staff.reduce((m, p) => Math.max(m, p.salesTotal), 0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mapStaff = (s: any): StaffMember => ({
    ...s,
    id: String(s.id),
    role: (s.role || "waiter") as StaffRole,
    mobile: s.mobile || s.phone || "",
    status: (s.isActive ? "active" : "offline") as "active" | "on-break" | "offline",
    shift: s.shift || "Morning",
    weeklySchedule: (s.weeklySchedule && typeof s.weeklySchedule === "object") ? s.weeklySchedule : {},
    joinDate: s.createdAt?.split("T")[0] || s.joinDate?.split?.("T")[0] || "",
    // Every staff member used to be shown as "90% performance". Nothing measured it, so
    // it was the same number for the best and worst person on the floor. What the server
    // does measure is what they served, so that is what the screen shows.
    ordersServed: Number(s.ordersServed ?? 0),
    salesTotal: Number(s.salesTotal ?? 0),
    avgOrderValue: Number(s.avgOrderValue ?? 0),
    tipsCollected: Number(s.tipsCollected ?? 0),
  });

  const loadStaff = useCallback(() => {
    if (!restaurantId) return;
    setLoading(true);
    staffApi.list(restaurantId)
      // An empty roster and an unreachable server used to look identical.
      .then(data => { setStaff(Array.isArray(data) ? data.map(mapStaff) : []); setLoadError(null); })
      .catch(e => setLoadError(e instanceof Error ? e.message : "Could not reach the server."))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => { loadStaff(); }, [loadStaff]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | StaffRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | StaffMember["status"]>("all");
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", mobile: "", role: "waiter" as StaffRole, password: "" });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "schedule" | "attendance">("list");
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", mobile: "", role: "waiter" as StaffRole, active: true, password: "", shift: "Morning (7AM-3PM)", weeklySchedule: {} as Record<string, string> });
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function openEditStaff() {
    if (!selected) return;
    openEditFor(selected);
  }

  // Open the edit modal directly for a given staff member (used by the Schedule tab's
  // per-row Edit button so HR can change that person's shift/schedule in one click).
  function openEditFor(s: StaffMember) {
    setSelected(s);
    setEditForm({ name: s.name, email: s.email, mobile: s.mobile, role: s.role, active: s.status !== "offline", password: "", shift: s.shift || "Morning (7AM-3PM)", weeklySchedule: buildWeekly(s) });
    setEditMode(true);
  }

  async function submitEditStaff() {
    if (!restaurantId || !selected || !editForm.name || !editForm.email) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.mobile,
        role: editForm.role,
        isActive: editForm.active,
        shift: editForm.shift,
        weeklySchedule: editForm.weeklySchedule,
      };
      if (editForm.password) body.password = editForm.password;
      await staffApi.update(restaurantId, parseInt(selected.id, 10), body);
      toast({ title: "Profile updated", description: `${editForm.name}'s details were saved.` });
      setEditMode(false);
      setSelected(null);
      loadStaff();
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message || "Could not update staff member.", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteStaff() {
    if (!restaurantId || !selected) return;
    const ok = await confirm({
      title: `Remove ${selected.name}?`,
      description: `${selected.name} loses access to the staff app immediately. Their past orders and shifts are kept, but the account cannot be restored.`,
      destructive: true,
      confirmLabel: "Remove from team",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await staffApi.delete(restaurantId, parseInt(selected.id, 10));
      toast({ title: "Staff removed", description: `${selected.name} was removed from your team.` });
      setEditMode(false);
      setSelected(null);
      loadStaff();
    } catch (e: any) {
      toast({ title: "Remove failed", description: e?.message || "Could not remove staff member.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function submitAddStaff() {
    if (!restaurantId || !addForm.name || !addForm.email || !addForm.password) return;
    setSaving(true);
    try {
      const created = await staffApi.create(restaurantId, {
        name: addForm.name,
        email: addForm.email,
        phone: addForm.mobile,
        role: addForm.role,
        password: addForm.password,
      });
      setStaff(prev => [...prev, {
        id: String(created.id),
        name: created.name,
        role: (created.role || "waiter") as StaffRole,
        email: created.email,
        mobile: created.phone || addForm.mobile,
        status: "active",
        shift: "Morning",
        joinDate: new Date().toISOString().split("T")[0],
        ordersServed: 0, salesTotal: 0, avgOrderValue: 0, tipsCollected: 0,
      }]);
      setAddMode(false);
      setAddForm({ name: "", email: "", mobile: "", role: "waiter", password: "" });
      toast({ title: "Staff added", description: `${created.name} can now log in.` });
    } catch (e: any) {
      // A plan cap is a 402 naming the allowance and the current count — an owner needs
      // that, not a "please check the details" that sends them re-typing a valid form.
      toast({ ...planLimitMessage(e, "Could not add staff"), variant: "destructive" });
    }
    finally { setSaving(false); }
  }

  const filtered = staff.filter(s => {
    const searchMatch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const roleMatch = roleFilter === "all" || s.role === roleFilter;
    const statusMatch = statusFilter === "all" || s.status === statusFilter;
    return searchMatch && roleMatch && statusMatch;
  });

  const SHIFTS = ["Morning (7AM-3PM)", "Afternoon (3PM-11PM)", "Night (11PM-7AM)", "Split (10AM-2PM, 6PM-10PM)"];

  return (
    <div className="min-w-0 space-y-5">
      {/* Header — RestaurantLayout already pads the page */}
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Staff Management</h1>
          <p className="text-xs text-muted-foreground">{staff.filter(s => s.status === "active").length} active · {staff.filter(s => s.status === "on-break").length} on break · {staff.filter(s => s.status === "offline").length} offline</p>
        </div>
        <button onClick={() => setAddMode(true)} className="flex min-h-10 w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-semibold shadow-sm transition-colors sm:w-auto">
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Staff", value: staff.length, icon: Users, color: "text-info", bg: "bg-info-subtle/40" },
          { label: "On Duty", value: staff.filter(s => s.status === "active").length, icon: CircleCheck, color: "text-success", bg: "bg-success-subtle/40" },
          { label: "On Break", value: staff.filter(s => s.status === "on-break").length, icon: Coffee, color: "text-warning", bg: "bg-warning-subtle/40" },
          { label: "Orders Served", value: staff.reduce((s, m) => s + m.ordersServed, 0), icon: Receipt, color: "text-primary", bg: "bg-primary/10" },
        ].map(card => (
          <div key={card.label} className={`rounded-lg ${card.bg} border border-border p-3 sm:p-4`}>
            <card.icon className={`h-5 w-5 mb-2 ${card.color}`} />
            <p className={`text-xl sm:text-2xl font-semibold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain bg-muted p-1 rounded-lg no-scrollbar">
        {(["list", "schedule", "attendance"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Staff List Tab */}
      {activeTab === "list" && (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 w-full sm:flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input className="min-h-10 w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground" placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="min-h-10 w-full sm:w-auto bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/40 text-foreground" value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}>
              <option value="all">All Roles</option>
              {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain no-scrollbar">
              {(["all", "active", "on-break", "offline"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`min-h-10 shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${statusFilter === s ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                  {s === "all" ? "All" : s === "active" ? "Active" : s === "on-break" ? "Break" : "Offline"}
                </button>
              ))}
            </div>
          </div>

          {loadError && (
            <div role="alert" className="rounded-lg border border-danger-border bg-danger-subtle p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-danger">We could not load your team.</p>
                <p className="text-xs text-danger">{loadError} This is not an empty roster.</p>
              </div>
              <button onClick={loadStaff} className="shrink-0 min-h-10 px-3 py-2 rounded-lg bg-danger-subtle text-danger text-xs font-semibold">Try again</button>
            </div>
          )}

          {!loading && !loadError && filtered.length === 0 && (
            <EmptyState
              title={staff.length === 0 ? "No staff added yet" : "No one matches this filter"}
              description={staff.length === 0 ? "Add your first team member so they can sign in to the staff app." : "Try a different role or status."}
            />
          )}

          {/* Staff Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(member => {
              const roleCfg = roleCfgOf(member.role);
              return (
                <div key={member.id} className="rounded-lg border border-border bg-card p-4 hover:border-primary/20 transition-colors cursor-pointer" onClick={() => setSelected(member)}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="relative">
                      <div className={`h-12 w-12 rounded-lg bg-muted flex items-center justify-center ${roleCfg.color}`}>
                        <roleCfg.icon className="h-6 w-6" />
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${member.status === "active" ? "bg-success" : member.status === "on-break" ? "bg-warning" : "bg-muted"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{member.name}</p>
                      <p className={`text-xs font-medium ${roleCfg.color}`}>{roleCfg.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Since {new Date(member.joinDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${member.status === "active" ? "bg-success-subtle text-success" : member.status === "on-break" ? "bg-warning-subtle text-warning" : "bg-muted text-muted-foreground"}`}>
                      {member.status === "on-break" ? "On Break" : member.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" /><span className="truncate">{member.email}</span></div>
                    <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /><span>{member.mobile}</span></div>
                    <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" /><span>{member.shift} Shift</span></div>
                    <div className="flex items-center gap-1.5"><Star className="h-3 w-3 text-warning" /><span>{member.ordersServed > 0 ? `${member.ordersServed} orders · ${fmtINR(member.salesTotal)}` : "No orders yet"}</span></div>
                  </div>

                  {/* Share of the busiest person's takings — a relative bar, not a score. */}
                  <div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-colors" style={{ width: `${topSales > 0 ? Math.round((member.salesTotal / topSales) * 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Schedule Tab */}
      {activeTab === "schedule" && (
        <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground flex items-center gap-1">Day-wise roster. Click the <Edit2 className="h-3 w-3 inline text-primary" /> pencil next to any staff member to set a different shift per day (e.g. Monday Night).</p>
          <div className="flex items-center gap-2 flex-wrap">
            {DAY_SHIFTS.map(sh => <span key={sh} className={`text-2xs font-semibold px-1.5 py-0.5 rounded ${SHIFT_STYLE[sh]}`}>{sh}</span>)}
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-border">
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
          <div className="grid min-w-[640px] grid-cols-8 text-xs text-muted-foreground border-b border-border bg-card">
            <div className="px-4 py-3 font-medium">Staff</div>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
              <div key={d} className="px-2 py-3 font-medium text-center">{d}</div>
            ))}
          </div>
          {staff.map(s => {
            const roleCfg = roleCfgOf(s.role);
            return (
              <div key={s.id} className="grid min-w-[640px] grid-cols-8 border-b border-border hover-elevate transition-colors">
                <div className="px-4 py-3 flex items-center gap-2">
                  <roleCfg.icon className={`h-4 w-4 shrink-0 ${roleCfg.color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.name.split(" ")[0]}</p>
                    <p className="text-xs text-muted-foreground">{roleCfg.label}</p>
                  </div>
                  <button onClick={() => openEditFor(s)} title="Edit shift / schedule" className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg text-primary hover:bg-primary/15 transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {(() => { const wk = buildWeekly(s); return DAYS.map(d => {
                  const sh = wk[d];
                  return (
                    <div key={d} className="px-1 py-3 flex items-center justify-center">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${SHIFT_STYLE[sh] || "text-primary bg-primary/10"}`}>{sh}</span>
                    </div>
                  );
                }); })()}
              </div>
            );
          })}
          </div>
        </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <AttendancePanel restaurantId={restaurantId} staff={staff} />
      )}

      {/* Add Staff Modal */}
      {addMode && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-card rounded-t-lg sm:rounded-lg border border-border p-5 space-y-4 max-h-[calc(100dvh-0.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Add Staff Member</h3>
              <button type="button" className="flex h-10 w-10 items-center justify-center" onClick={() => setAddMode(false)} aria-label="Close"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            {[
              { key: "name", label: "Full Name", type: "text" },
              { key: "email", label: "Email", type: "email" },
              { key: "mobile", label: "Mobile", type: "tel" },
              { key: "password", label: "Login Password", type: "password" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <input
                  type={f.type}
                  value={(addForm as any)[f.key]}
                  onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value as StaffRole }))} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <button type="button" onClick={submitAddStaff} disabled={saving || !addForm.name || !addForm.email || addForm.password.length < 6} className="min-h-11 w-full rounded-lg bg-primary py-3 text-sm font-semibold hover:bg-primary/90 disabled:opacity-40">
              {saving ? "Creating…" : "Create Staff"}
            </button>
          </div>
        </div>
      )}

      {/* Staff Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-0.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-lg border border-border bg-card sm:max-h-[90vh] sm:rounded-lg">
            <div className="flex items-center justify-between border-b border-border p-4 sm:p-5">
              <h3 className="font-semibold">Staff Profile</h3>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg" onClick={() => setSelected(null)} aria-label="Close"><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-4">
                <div className={`h-16 w-16 rounded-lg bg-muted flex items-center justify-center ${roleCfgOf(selected.role).color}`}>
                  {(() => { const RoleIcon = roleCfgOf(selected.role).icon; return <RoleIcon className="h-8 w-8" />; })()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{selected.name}</h2>
                  <p className={`font-semibold ${roleCfgOf(selected.role).color}`}>{roleCfgOf(selected.role).label}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${selected.status === "active" ? "bg-success-subtle text-success" : selected.status === "on-break" ? "bg-warning-subtle text-warning" : "bg-muted text-muted-foreground"}`}>
                    {selected.status}
                  </span>
                </div>
              </div>
              {[
                ["Email", selected.email], ["Mobile", selected.mobile],
                ["Shift", selected.shift], ["Join Date", new Date(selected.joinDate).toLocaleDateString("en-IN")],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-2 border-b border-border">
                  <span className="text-xs text-muted-foreground">{l}</span>
                  <span className="text-sm text-foreground">{v}</span>
                </div>
              ))}
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Sales on this floor</span>
                  <span className="text-primary font-semibold">{selected.ordersServed > 0 ? `${selected.ordersServed} orders · ${fmtINR(selected.salesTotal)}` : "No orders yet"}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-colors" style={{ width: `${topSales > 0 ? Math.round((selected.salesTotal / topSales) * 100) : 0}%` }} />
                </div>
              </div>
              {selected.tablesAssigned && selected.tablesAssigned.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Assigned Tables</p>
                  <div className="flex gap-2 flex-wrap">
                    {selected.tablesAssigned.map(t => (
                      <span key={t} className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-sm font-semibold">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={deleteStaff} disabled={deleting} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-danger-border bg-danger-subtle px-4 py-3 text-sm font-semibold text-danger hover-elevate disabled:opacity-40 sm:order-first" title="Remove staff">
                  <Trash2 className="h-4 w-4" /> {deleting ? "Removing…" : "Remove"}
                </button>
                <button type="button" onClick={() => setSelected(null)} className="min-h-11 flex-1 rounded-lg border border-border py-3 text-sm font-semibold hover:bg-muted">Close</button>
                <button type="button" onClick={openEditStaff} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold hover:bg-primary/90">
                  <Edit2 className="h-4 w-4" /> Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editMode && selected && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-0.5rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-t-lg border border-border bg-card p-4 sm:max-h-[90vh] sm:rounded-lg sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex min-w-0 items-center gap-2 font-semibold"><Edit2 className="h-4 w-4 shrink-0" /> <span className="truncate">Edit {selected.name}</span></h3>
              <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" onClick={() => setEditMode(false)} aria-label="Close"><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            {[
              { key: "name", label: "Full Name", type: "text" },
              { key: "email", label: "Email", type: "email" },
              { key: "mobile", label: "Mobile", type: "tel" },
              { key: "password", label: "New Password (leave blank to keep current)", type: "password" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <input
                  type={f.type}
                  value={(editForm as any)[f.key]}
                  onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value as StaffRole }))} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Shift (by time)</label>
              <select value={editForm.shift} onChange={e => setEditForm(p => ({ ...p, shift: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                {/* keep whatever was stored even if it's an old plain label */}
                {editForm.shift && !SHIFTS.includes(editForm.shift) && <option value={editForm.shift}>{editForm.shift}</option>}
              </select>
              <p className="mt-1 text-2xs text-muted-foreground">This is the base / default shift — used when a day has no specific setting.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Weekly schedule (day-wise)</label>
              <p className="text-2xs text-muted-foreground mb-1.5">Set a different shift for each day — e.g. Monday Night, Tuesday Morning. "Off" means a day off.</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {DAYS.map(d => (
                  <div key={d} className="flex items-center gap-2 bg-card border border-border rounded-lg px-2 py-1.5 min-w-0">
                    <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">{d}</span>
                    <select
                      value={editForm.weeklySchedule[d] || defaultDayShift({ shift: editForm.shift, role: editForm.role }, d)}
                      onChange={e => setEditForm(p => ({ ...p, weeklySchedule: { ...p.weeklySchedule, [d]: e.target.value } }))}
                      className={`flex-1 min-w-0 bg-transparent border border-border rounded-md px-1.5 py-1 text-xs font-semibold focus:outline-none ${SHIFT_STYLE[editForm.weeklySchedule[d]] || "text-foreground"}`}
                    >
                      {DAY_SHIFTS.map(sh => <option key={sh} value={sh} className="bg-card text-foreground">{sh}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button type="button" onClick={() => setEditForm(p => ({ ...p, weeklySchedule: Object.fromEntries(DAYS.map(d => [d, (p.shift || "Morning").split(" ")[0]])) }))} className="text-2xs px-2 py-1 rounded-lg border border-border text-muted-foreground hover:bg-muted">All days base shift</button>
                <button type="button" onClick={() => setEditForm(p => ({ ...p, weeklySchedule: Object.fromEntries(DAYS.map(d => [d, d === "Sun" ? "Off" : (p.shift || "Morning").split(" ")[0]])) }))} className="text-2xs px-2 py-1 rounded-lg border border-border text-muted-foreground hover:bg-muted">Sunday Off</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <div className="flex gap-2 mt-1">
                {[{ v: true, l: "Active" }, { v: false, l: "Offline" }].map(o => (
                  <button key={String(o.v)} onClick={() => setEditForm(p => ({ ...p, active: o.v }))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${editForm.active === o.v ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground"}`}>{o.l}</button>
                ))}
              </div>
            </div>
            <button onClick={submitEditStaff} disabled={editSaving || !editForm.name || !editForm.email || (editForm.password.length > 0 && editForm.password.length < 6)} className="w-full py-3 rounded-lg bg-primary hover:bg-primary/90 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              <Save className="h-4 w-4" /> {editSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
