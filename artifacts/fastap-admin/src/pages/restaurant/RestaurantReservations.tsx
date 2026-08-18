import { useState, useEffect } from "react";
import {
  Plus, Search, Calendar, Clock, Users, CheckCircle, XCircle,
  Phone, MessageSquare, X, Edit2, AlertCircle
} from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { reservations as reservationsApi } from "@/lib/api";

interface Reservation {
  id: string;
  guestName: string;
  mobile: string;
  email: string;
  date: string;
  time: string;
  guests: number;
  table?: string;
  section: string;
  status: "confirmed" | "pending" | "cancelled" | "seated" | "completed" | "no-show";
  special: string;
  type: "table" | "hall" | "pool" | "spa" | "event";
  deposit: number;
  createdAt: string;
}

const STATUS_CFG = {
  confirmed:  { label: "Confirmed",  color: "text-emerald-400", bg: "bg-emerald-500/20", icon: CheckCircle },
  pending:    { label: "Pending",    color: "text-yellow-400",  bg: "bg-yellow-500/20",  icon: AlertCircle },
  cancelled:  { label: "Cancelled", color: "text-red-400",     bg: "bg-red-500/20",     icon: XCircle },
  seated:     { label: "Seated",    color: "text-blue-400",    bg: "bg-blue-500/20",    icon: CheckCircle },
  completed:  { label: "Completed", color: "text-teal-400",    bg: "bg-teal-500/20",    icon: CheckCircle },
  "no-show":  { label: "No-Show",   color: "text-red-400",     bg: "bg-red-500/20",     icon: XCircle },
};

const TYPE_ICON: Record<Reservation["type"], string> = {
  table: "🍽️", hall: "🏛️", pool: "🏊", spa: "💆", event: "🎉"
};

export default function RestaurantReservations() {
  const { restaurantId } = useRestaurant();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reload();
  }, [restaurantId]);
  const [filter, setFilter] = useState<"all" | Reservation["status"]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [newRes, setNewRes] = useState<Partial<Reservation>>({ type: "table", status: "pending", guests: 2, section: "Indoor AC", deposit: 0 });

  const filtered = reservations.filter(r => {
    const statusMatch = filter === "all" || r.status === filter;
    const searchMatch = !search || r.guestName.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase()) || r.mobile.includes(search);
    return statusMatch && searchMatch;
  });

  const counts = {
    all: reservations.length,
    confirmed: reservations.filter(r => r.status === "confirmed").length,
    pending: reservations.filter(r => r.status === "pending").length,
    seated: reservations.filter(r => r.status === "seated").length,
    completed: reservations.filter(r => r.status === "completed").length,
    cancelled: reservations.filter(r => r.status === "cancelled").length,
    "no-show": reservations.filter(r => r.status === "no-show").length,
  };

  async function reload() {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await reservationsApi.list(restaurantId);
      setReservations(Array.isArray(data) ? data.map((r: any) => ({
        id: String(r.id),
        guestName: r.guestName || r.customerName || "Guest",
        mobile: r.customerPhone || r.phone || r.mobile || "",
        email: r.customerEmail || r.email || "",
        date: r.date ? new Date(r.date).toLocaleDateString("en-IN") : "—",
        time: r.time || r.startTime || "—",
        guests: r.partySize || r.guestCount || r.guests || 1,
        table: r.tableId ? `T-${r.tableId}` : undefined,
        section: r.zone || r.section || "Main Hall",
        status: (r.status || "pending") as Reservation["status"],
        special: r.specialRequest || r.specialRequests || r.notes || "",
        type: (r.reservationType || "table") as Reservation["type"],
        deposit: parseFloat(String(r.depositAmount || 0)),
        createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "—",
      })) : []);
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: Reservation["status"]) {
    if (!restaurantId) return;
    try {
      await reservationsApi.update(restaurantId, parseInt(id, 10), { status });
      await reload();
    } catch {
      /* keep UI unchanged on error */
    }
    setSelected(null);
  }

  async function handleAddRes() {
    if (!restaurantId || !newRes.guestName || !newRes.date || !newRes.time) return;
    try {
      await reservationsApi.create(restaurantId, {
        customerName: newRes.guestName,
        customerPhone: newRes.mobile,
        customerEmail: newRes.email,
        date: newRes.date,
        time: newRes.time,
        guestCount: newRes.guests || 2,
        zone: newRes.section,
        reservationType: newRes.type || "table",
        status: "pending",
        specialRequest: newRes.special,
        notes: newRes.special,
      });
      setAddMode(false);
      setNewRes({ type: "table", status: "pending", guests: 2, section: "Indoor AC", deposit: 0 });
      await reload();
    } catch {
      /* error surfaced via empty reload */
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Reservations</h1>
          <p className="text-xs text-white/40">{counts.confirmed} confirmed today · {counts.pending} pending confirmation</p>
        </div>
        <button onClick={() => setAddMode(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="h-4 w-4" /> New Reservation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {(Object.entries(counts) as [string, number][]).map(([status, count]) => {
          const cfg = status !== "all" ? STATUS_CFG[status as Reservation["status"]] : null;
          return (
            <button key={status} onClick={() => setFilter(status as any)} className={`rounded-xl p-3 border text-center transition-all ${filter === status ? `${cfg?.bg || "bg-amber-500/20"} border-amber-500/40` : "border-white/8 bg-white/[0.03] hover:border-white/15"}`}>
              <p className={`text-xl font-extrabold ${cfg?.color || "text-amber-400"}`}>{count}</p>
              <p className="text-xs text-white/40 capitalize mt-0.5">{status}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" placeholder="Search by name, ID, mobile..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Reservation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(res => {
          const cfg = STATUS_CFG[res.status as keyof typeof STATUS_CFG] || STATUS_CFG.pending;
          return (
            <div key={res.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 hover:border-amber-500/20 transition-all cursor-pointer" onClick={() => setSelected(res)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-lg">{res.guestName.charAt(0)}</div>
                  <div>
                    <p className="font-semibold text-sm">{res.guestName}</p>
                    <p className="text-xs text-white/40">{res.id}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-white/50 mb-3">
                <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{res.date}</div>
                <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{res.time}</div>
                <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />{res.guests} guests</div>
                <div className="flex items-center gap-1.5">{TYPE_ICON[res.type]} {res.section}</div>
              </div>

              {res.special && (
                <div className="text-xs text-amber-300 bg-amber-500/10 rounded-lg px-2.5 py-1.5 mb-3">{res.special}</div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/30">{res.mobile}</span>
                {res.deposit > 0 && <span className="text-emerald-400 font-semibold">₹{res.deposit} deposit</span>}
              </div>

              {/* Quick Actions */}
              {(res.status === "confirmed" || res.status === "pending") && (
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-white/5" onClick={e => e.stopPropagation()}>
                  {res.status === "pending" && (
                    <button onClick={() => updateStatus(res.id, "confirmed")} className="flex-1 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 border border-emerald-500/30">✓ Confirm</button>
                  )}
                  {res.status === "confirmed" && (
                    <button onClick={() => updateStatus(res.id, "seated")} className="flex-1 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30 border border-blue-500/30">Seat Guest</button>
                  )}
                  <button onClick={() => updateStatus(res.id, "cancelled")} className="py-1.5 px-3 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 border border-red-500/30">✕</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-white/10">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-bold">Reservation Details</h3>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5 text-white/40" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className={`rounded-xl p-3 ${(STATUS_CFG[selected.status as keyof typeof STATUS_CFG] || STATUS_CFG.pending).bg} border border-white/10`}>
                <p className={`text-sm font-bold ${(STATUS_CFG[selected.status as keyof typeof STATUS_CFG] || STATUS_CFG.pending).color}`}>{(STATUS_CFG[selected.status as keyof typeof STATUS_CFG] || STATUS_CFG.pending).label}</p>
                <p className="text-xs text-white/50 mt-0.5">{selected.id} · Booked {selected.createdAt}</p>
              </div>
              {[
                ["Guest", selected.guestName], ["Mobile", selected.mobile],
                ["Date & Time", `${selected.date} at ${selected.time}`], ["Party Size", `${selected.guests} guests`],
                ["Section", selected.section], ["Type", selected.type],
                ["Special", selected.special || "None"], ["Deposit", selected.deposit > 0 ? `₹${selected.deposit}` : "None"],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-xs text-white/40">{l}</span>
                  <span className="text-sm text-white/80">{v}</span>
                </div>
              ))}
              <div className="space-y-2 pt-2">
                {selected.status === "pending" && <button onClick={() => updateStatus(selected.id, "confirmed")} className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-semibold text-sm">Confirm Reservation</button>}
                {selected.status === "confirmed" && <button onClick={() => updateStatus(selected.id, "seated")} className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 font-semibold text-sm">Seat Guest Now</button>}
                {selected.status === "seated" && <button onClick={() => updateStatus(selected.id, "completed")} className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 font-semibold text-sm">Mark Completed</button>}
                {!["cancelled", "completed"].includes(selected.status) && (
                  <>
                    <button onClick={() => updateStatus(selected.id, "no-show")} className="w-full py-2.5 rounded-xl border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 font-semibold text-sm">Mark No-Show</button>
                    <button onClick={() => updateStatus(selected.id, "cancelled")} className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 font-semibold text-sm">Cancel Reservation</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addMode && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-bold">New Reservation</h3>
              <button onClick={() => setAddMode(false)}><X className="h-5 w-5 text-white/40" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: "Guest Name*", field: "guestName", type: "text" },
                { label: "Mobile", field: "mobile", type: "text" },
                { label: "Email", field: "email", type: "email" },
                { label: "Date*", field: "date", type: "date" },
                { label: "Time*", field: "time", type: "time" },
                { label: "Guests", field: "guests", type: "number" },
                { label: "Deposit (₹)", field: "deposit", type: "number" },
                { label: "Special Request", field: "special", type: "text" },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-xs text-white/40 mb-1">{label}</label>
                  <input type={type} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white [color-scheme:dark]" value={(newRes as any)[field] || ""} onChange={e => setNewRes({ ...newRes, [field]: type === "number" ? Number(e.target.value) : e.target.value })} />
                </div>
              ))}
              <div>
                <label className="block text-xs text-white/40 mb-1">Section</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white" value={newRes.section || ""} onChange={e => setNewRes({ ...newRes, section: e.target.value })}>
                  {["Indoor AC", "Premium Indoor", "Family Section", "Outdoor Garden", "Rooftop", "VIP Lounge", "Banquet Hall", "Spa"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setAddMode(false)} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold">Cancel</button>
                <button onClick={handleAddRes} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold">Book Now</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
