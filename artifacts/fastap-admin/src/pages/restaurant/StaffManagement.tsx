import { useState, useEffect, useCallback } from "react";
import { useRestaurant, type StaffRole } from "@/contexts/RestaurantContext";
import { staff as staffApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface StaffMember { id: string; name: string; role: StaffRole; email: string; mobile: string; avatar?: string; status: "active" | "on-break" | "offline"; shift: string; joinDate: string; performance: number; tablesAssigned?: string[]; }
import {
  Plus, Search, Phone, Mail, Star, Clock, Shield, Edit2, X, Save,
  CheckCircle, AlertCircle, TrendingUp, Calendar, Trash2
} from "lucide-react";

const ROLE_CONFIG: Record<StaffRole, { label: string; icon: string; color: string }> = {
  owner:        { label: "Owner",          icon: "👑", color: "text-yellow-400" },
  manager:      { label: "Manager",        icon: "🏢", color: "text-violet-400" },
  cashier:      { label: "Cashier",        icon: "💳", color: "text-blue-400" },
  waiter:       { label: "Waiter",         icon: "🍽️", color: "text-orange-400" },
  kitchen:      { label: "Kitchen Staff",  icon: "🍳", color: "text-amber-400" },
  chef:         { label: "Chef",           icon: "👨‍🍳", color: "text-amber-400" },
  housekeeping: { label: "Housekeeping",   icon: "🧹", color: "text-teal-400" },
  reception:    { label: "Reception",      icon: "🛎️", color: "text-pink-400" },
  spa:          { label: "Spa Staff",      icon: "💆", color: "text-rose-400" },
  bar:          { label: "Bar Staff",      icon: "🍹", color: "text-indigo-400" },
  finance:      { label: "Finance",        icon: "📊", color: "text-green-400" },
  hr:           { label: "HR",             icon: "👥", color: "text-cyan-400" },
  franchise:    { label: "Franchise",      icon: "🏪", color: "text-purple-400" },
};
const DEFAULT_ROLE_CFG = { label: "Staff", icon: "👤", color: "text-white/60" };
const roleCfgOf = (r: StaffRole) => ROLE_CONFIG[r] ?? DEFAULT_ROLE_CFG;

export default function StaffManagement() {
  const { restaurantId, restaurant } = useRestaurant();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const mapStaff = (s: any): StaffMember => ({
    ...s,
    id: String(s.id),
    role: (s.role || "waiter") as StaffRole,
    mobile: s.mobile || s.phone || "",
    status: (s.isActive ? "active" : "offline") as "active" | "on-break" | "offline",
    shift: s.shift || "Morning",
    joinDate: s.createdAt?.split("T")[0] || s.joinDate?.split?.("T")[0] || "",
    performance: 90, // NOTE: not sourced from API — no per-staff performance metric exists yet
  });

  const loadStaff = useCallback(() => {
    if (!restaurantId) return;
    setLoading(true);
    staffApi.list(restaurantId)
      .then(data => setStaff(Array.isArray(data) ? data.map(mapStaff) : []))
      .catch(() => {})
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
  const [editForm, setEditForm] = useState({ name: "", email: "", mobile: "", role: "waiter" as StaffRole, active: true, password: "", shift: "Morning (7AM-3PM)" });
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
    setEditForm({ name: s.name, email: s.email, mobile: s.mobile, role: s.role, active: s.status !== "offline", password: "", shift: s.shift || "Morning (7AM-3PM)" });
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
    if (!window.confirm(`Remove ${selected.name}? This cannot be undone.`)) return;
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
        performance: 0,
      }]);
      setAddMode(false);
      setAddForm({ name: "", email: "", mobile: "", role: "waiter", password: "" });
      toast({ title: "Staff added", description: `${created.name} can now log in.` });
    } catch (e: any) {
      toast({ title: "Could not add staff", description: e?.message || "Please check the details and try again.", variant: "destructive" });
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
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Staff Management</h1>
          <p className="text-xs text-white/40">{staff.filter(s => s.status === "active").length} active · {staff.filter(s => s.status === "on-break").length} on break · {staff.filter(s => s.status === "offline").length} offline</p>
        </div>
        <button onClick={() => setAddMode(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Staff", value: staff.length, icon: "👥", color: "text-blue-400", bg: "from-blue-500/15" },
          { label: "On Duty", value: staff.filter(s => s.status === "active").length, icon: "✅", color: "text-emerald-400", bg: "from-emerald-500/15" },
          { label: "On Break", value: staff.filter(s => s.status === "on-break").length, icon: "☕", color: "text-yellow-400", bg: "from-yellow-500/15" },
          { label: "Avg Performance", value: `${Math.round(staff.reduce((s, m) => s + m.performance, 0) / staff.length)}%`, icon: "⭐", color: "text-amber-400", bg: "from-amber-500/15" },
        ].map(card => (
          <div key={card.label} className={`rounded-2xl bg-gradient-to-br ${card.bg} to-transparent border border-white/8 p-4`}>
            <div className="text-2xl mb-1">{card.icon}</div>
            <p className={`text-2xl font-extrabold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {(["list", "schedule", "attendance"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? "bg-amber-500 text-white" : "text-white/50 hover:text-white"}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Staff List Tab */}
      {activeTab === "list" && (
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30 w-56" placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/40 text-white" value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}>
              <option value="all">All Roles</option>
              {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            {(["all", "active", "on-break", "offline"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${statusFilter === s ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/50"}`}>
                {s === "all" ? "All" : s === "active" ? "🟢 Active" : s === "on-break" ? "🟡 Break" : "⚫ Offline"}
              </button>
            ))}
          </div>

          {/* Staff Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(member => {
              const roleCfg = roleCfgOf(member.role);
              return (
                <div key={member.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 hover:border-amber-500/20 transition-all cursor-pointer" onClick={() => setSelected(member)}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                        {roleCfg.icon}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0b1120] ${member.status === "active" ? "bg-emerald-400" : member.status === "on-break" ? "bg-yellow-400" : "bg-white/20"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{member.name}</p>
                      <p className={`text-xs font-medium ${roleCfg.color}`}>{roleCfg.label}</p>
                      <p className="text-xs text-white/30 mt-0.5">Since {new Date(member.joinDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${member.status === "active" ? "bg-emerald-500/20 text-emerald-400" : member.status === "on-break" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/30"}`}>
                      {member.status === "on-break" ? "On Break" : member.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-white/50 mb-3">
                    <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" /><span className="truncate">{member.email}</span></div>
                    <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /><span>{member.mobile}</span></div>
                    <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" /><span>{member.shift} Shift</span></div>
                    <div className="flex items-center gap-1.5"><Star className="h-3 w-3 text-yellow-400" /><span>{member.performance}% performance</span></div>
                  </div>

                  {/* Performance Bar */}
                  <div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${member.performance}%` }} />
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
        <p className="text-xs text-white/40 flex items-center gap-1">Weekly shift roster. Tap the <Edit2 className="h-3 w-3 inline text-amber-400" /> pencil next to a staff member to change their shift/schedule.</p>
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <div className="grid grid-cols-8 text-xs text-white/40 border-b border-white/5 bg-white/[0.02]">
            <div className="px-4 py-3 font-medium">Staff</div>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
              <div key={d} className="px-2 py-3 font-medium text-center">{d}</div>
            ))}
          </div>
          {staff.map(s => {
            const roleCfg = roleCfgOf(s.role);
            return (
              <div key={s.id} className="grid grid-cols-8 border-b border-white/5 hover:bg-white/3 transition-all">
                <div className="px-4 py-3 flex items-center gap-2">
                  <span className="text-base">{roleCfg.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.name.split(" ")[0]}</p>
                    <p className="text-xs text-white/30">{roleCfg.label}</p>
                  </div>
                  <button onClick={() => openEditFor(s)} title="Edit shift / schedule" className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-amber-400 hover:bg-amber-500/15 transition-all">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => {
                  const isOff = d === "Sun" && s.role !== "waiter";
                  const shift = s.shift.split(" ")[0];
                  return (
                    <div key={d} className="px-1 py-3 flex items-center justify-center">
                      {isOff ? (
                        <span className="text-xs text-white/20 bg-white/5 px-1.5 py-0.5 rounded">Off</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{shift}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <div className="rounded-2xl border border-white/8 p-8 text-center">
          <Calendar className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <h3 className="font-bold text-white/80">No attendance records yet</h3>
          <p className="text-sm text-white/40 mt-2 max-w-md mx-auto">
            GPS check-in and attendance tracking will appear here once staff start clocking in. Staff roster data is loaded from your account ({staff.length} members).
          </p>
        </div>
      )}

      {/* Add Staff Modal */}
      {addMode && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Add Staff Member</h3>
              <button onClick={() => setAddMode(false)}><X className="h-5 w-5 text-white/40" /></button>
            </div>
            {[
              { key: "name", label: "Full Name", type: "text" },
              { key: "email", label: "Email", type: "email" },
              { key: "mobile", label: "Mobile", type: "tel" },
              { key: "password", label: "Login Password", type: "password" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-white/40">{f.label}</label>
                <input
                  type={f.type}
                  value={(addForm as any)[f.key]}
                  onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/40"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-white/40">Role</label>
              <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value as StaffRole }))} className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
                {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <button onClick={submitAddStaff} disabled={saving || !addForm.name || !addForm.email || addForm.password.length < 6} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-sm disabled:opacity-40">
              {saving ? "Creating…" : "Create Staff"}
            </button>
          </div>
        </div>
      )}

      {/* Staff Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-bold">Staff Profile</h3>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">
                  {roleCfgOf(selected.role).icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selected.name}</h2>
                  <p className={`font-semibold ${roleCfgOf(selected.role).color}`}>{roleCfgOf(selected.role).label}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${selected.status === "active" ? "bg-emerald-500/20 text-emerald-400" : selected.status === "on-break" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/30"}`}>
                    {selected.status}
                  </span>
                </div>
              </div>
              {[
                ["Email", selected.email], ["Mobile", selected.mobile],
                ["Shift", selected.shift], ["Join Date", new Date(selected.joinDate).toLocaleDateString("en-IN")],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-xs text-white/40">{l}</span>
                  <span className="text-sm text-white/80">{v}</span>
                </div>
              ))}
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/40">Performance Score</span>
                  <span className="text-amber-400 font-bold">{selected.performance}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${selected.performance}%` }} />
                </div>
              </div>
              {selected.tablesAssigned && selected.tablesAssigned.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 mb-2">Assigned Tables</p>
                  <div className="flex gap-2 flex-wrap">
                    {selected.tablesAssigned.map(t => (
                      <span key={t} className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-semibold">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={deleteStaff} disabled={deleting} className="py-3 px-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40" title="Remove staff">
                  <Trash2 className="h-4 w-4" /> {deleting ? "Removing…" : "Remove"}
                </button>
                <button onClick={() => setSelected(null)} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold">Close</button>
                <button onClick={openEditStaff} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold flex items-center justify-center gap-2">
                  <Edit2 className="h-4 w-4" /> Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editMode && selected && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><Edit2 className="h-4 w-4" /> Edit {selected.name}</h3>
              <button onClick={() => setEditMode(false)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            {[
              { key: "name", label: "Full Name", type: "text" },
              { key: "email", label: "Email", type: "email" },
              { key: "mobile", label: "Mobile", type: "tel" },
              { key: "password", label: "New Password (leave blank to keep current)", type: "password" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-white/40">{f.label}</label>
                <input
                  type={f.type}
                  value={(editForm as any)[f.key]}
                  onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/40"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-white/40">Role</label>
              <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value as StaffRole }))} className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
                {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40">Shift (by time)</label>
              <select value={editForm.shift} onChange={e => setEditForm(p => ({ ...p, shift: e.target.value }))} className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                {/* keep whatever was stored even if it's an old plain label */}
                {editForm.shift && !SHIFTS.includes(editForm.shift) && <option value={editForm.shift}>{editForm.shift}</option>}
              </select>
              <p className="text-[10px] text-white/30 mt-1">HR can reassign a staff member's shift here — it drives the weekly schedule.</p>
            </div>
            <div>
              <label className="text-xs text-white/40">Status</label>
              <div className="flex gap-2 mt-1">
                {[{ v: true, l: "🟢 Active" }, { v: false, l: "⚫ Offline" }].map(o => (
                  <button key={String(o.v)} onClick={() => setEditForm(p => ({ ...p, active: o.v }))} className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${editForm.active === o.v ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/50"}`}>{o.l}</button>
                ))}
              </div>
            </div>
            <button onClick={submitEditStaff} disabled={editSaving || !editForm.name || !editForm.email || (editForm.password.length > 0 && editForm.password.length < 6)} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              <Save className="h-4 w-4" /> {editSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
