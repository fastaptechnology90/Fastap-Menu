import { useState, useEffect } from "react";
import {
  Plus, Search, Calendar, Clock, Users, CheckCircle, XCircle,
  Phone, MessageSquare, X, Edit2, AlertCircle, BedDouble, UtensilsCrossed, Landmark, Waves, Flower2, PartyPopper, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { reservations as reservationsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";

interface Reservation {
  id: string;
  guestName: string;
  mobile: string;
  email: string;
  date: string;
  time: string;
  guests: number;
  table?: string;
  room?: string;
  section: string;
  status: "confirmed" | "pending" | "cancelled" | "seated" | "completed" | "no-show";
  special: string;
  type: "table" | "hall" | "pool" | "spa" | "event";
  deposit: number;
  createdAt: string;
}

const STATUS_CFG = {
  confirmed:  { label: "Confirmed",  color: "text-success", bg: "bg-success-subtle", icon: CheckCircle },
  pending:    { label: "Pending",    color: "text-warning",  bg: "bg-warning-subtle",  icon: AlertCircle },
  cancelled:  { label: "Cancelled", color: "text-danger",     bg: "bg-danger-subtle",     icon: XCircle },
  seated:     { label: "Seated",    color: "text-info",    bg: "bg-info-subtle",    icon: CheckCircle },
  completed:  { label: "Completed", color: "text-success",    bg: "bg-success-subtle",    icon: CheckCircle },
  "no-show":  { label: "No-Show",   color: "text-danger",     bg: "bg-danger-subtle",     icon: XCircle },
};

const TYPE_ICON: Record<Reservation["type"], LucideIcon> = {
  table: UtensilsCrossed, hall: Landmark, pool: Waves, spa: Flower2, event: PartyPopper
};

export default function RestaurantReservations() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
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
        room: r.roomNumber || r.room || undefined,
        section: r.zone || r.section || "Main Hall",
        status: (r.status || "pending") as Reservation["status"],
        special: r.specialRequest || r.specialRequests || r.notes || "",
        type: (r.reservationType || "table") as Reservation["type"],
        deposit: parseFloat(String(r.depositAmount || 0)),
        createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "—",
      })) : []);
    } catch (e: any) {
      setReservations([]);
      toast({ variant: "destructive", title: "Could not load reservations", description: e?.message || "Failed to fetch reservations." });
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: Reservation["status"]) {
    if (!restaurantId) return;
    try {
      await reservationsApi.update(restaurantId, parseInt(id, 10), { status });
      await reload();
      setSelected(null);
      toast({ title: `Reservation ${status}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e?.message || "Could not update the reservation status." });
    }
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
        roomNumber: newRes.room || null,
        reservationType: newRes.type || "table",
        status: "pending",
        specialRequest: newRes.special,
        notes: newRes.special,
        depositAmount: newRes.deposit || 0,
      });
      setAddMode(false);
      setNewRes({ type: "table", status: "pending", guests: 2, section: "Indoor AC", deposit: 0 });
      await reload();
      toast({ title: "Reservation booked" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Booking failed", description: e?.message || "Could not create the reservation." });
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Reservations</h1>
          <p className="text-xs text-muted-foreground">{counts.confirmed} confirmed today · {counts.pending} pending confirmation</p>
        </div>
        <button onClick={() => setAddMode(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-semibold shadow-sm transition-colors">
          <Plus className="h-4 w-4" /> New Reservation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {(Object.entries(counts) as [string, number][]).map(([status, count]) => {
          const cfg = status !== "all" ? STATUS_CFG[status as Reservation["status"]] : null;
          return (
            <button key={status} onClick={() => setFilter(status as any)} className={`rounded-lg p-3 border text-center transition-colors ${filter === status ? `${cfg?.bg || "bg-primary/20"} border-primary/40` : "border-border bg-card hover:border-border"}`}>
              <p className={`text-xl font-semibold ${cfg?.color || "text-primary"}`}>{count}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{status}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground" placeholder="Search by name, ID, mobile..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Reservation Cards */}
      {filtered.length === 0 && (
        <EmptyState
          tone={reservations.length ? "search" : "empty"}
          title={reservations.length ? "No bookings match this filter" : "No bookings yet"}
          description={reservations.length ? "Try another status, date or search term." : "Bookings taken on the guest site and by phone both land here."}
        />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(res => {
          const cfg = STATUS_CFG[res.status as keyof typeof STATUS_CFG] || STATUS_CFG.pending;
          return (
            <div key={res.id} className="rounded-lg border border-border bg-card p-4 hover:border-primary/20 transition-colors cursor-pointer" onClick={() => setSelected(res)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center font-semibold text-primary text-lg">{res.guestName.charAt(0)}</div>
                  <div>
                    <p className="font-semibold text-sm">{res.guestName}</p>
                    <p className="text-xs text-muted-foreground">{res.id}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
              </div>

              <div className="flex items-center gap-2 mb-3 rounded-lg bg-info-subtle border border-info-border px-2.5 py-1.5">
                <BedDouble className="h-4 w-4 text-info shrink-0" />
                <span className="text-xs text-muted-foreground">Room</span>
                <span className="text-sm font-semibold text-info ml-auto">{res.room || "—"}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{res.date}</div>
                <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{res.time}</div>
                <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />{res.guests} guests</div>
                <div className="flex items-center gap-1.5">{(() => { const TypeIcon = TYPE_ICON[res.type] ?? UtensilsCrossed; return <TypeIcon className="h-3.5 w-3.5" />; })()}{res.section}</div>
              </div>

              {res.special && (
                <div className="text-xs text-primary bg-primary/10 rounded-lg px-2.5 py-1.5 mb-3">{res.special}</div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{res.mobile}</span>
                {res.deposit > 0 && <span className="text-success font-semibold">₹{res.deposit} deposit</span>}
              </div>

              {/* Quick Actions */}
              {(res.status === "confirmed" || res.status === "pending") && (
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
                  {res.status === "pending" && (
                    <button onClick={() => updateStatus(res.id, "confirmed")} className="flex-1 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate border border-success-border inline-flex items-center justify-center gap-1"><Check className="h-3.5 w-3.5" />Confirm</button>
                  )}
                  {res.status === "confirmed" && (
                    <button onClick={() => updateStatus(res.id, "seated")} className="flex-1 py-1.5 rounded-lg bg-info-subtle text-info text-xs font-semibold hover-elevate border border-info-border">Seat Guest</button>
                  )}
                  <button onClick={() => updateStatus(res.id, "cancelled")} className="py-1.5 px-3 rounded-lg bg-danger-subtle text-danger text-xs font-semibold hover-elevate border border-danger-border"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-lg border border-border max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold">Reservation Details</h3>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className={`rounded-lg p-3 ${(STATUS_CFG[selected.status as keyof typeof STATUS_CFG] || STATUS_CFG.pending).bg} border border-border`}>
                <p className={`text-sm font-semibold ${(STATUS_CFG[selected.status as keyof typeof STATUS_CFG] || STATUS_CFG.pending).color}`}>{(STATUS_CFG[selected.status as keyof typeof STATUS_CFG] || STATUS_CFG.pending).label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{selected.id} · Booked {selected.createdAt}</p>
              </div>
              {[
                ["Guest", selected.guestName], ["Mobile", selected.mobile],
                ["Date & Time", `${selected.date} at ${selected.time}`], ["Party Size", `${selected.guests} guests`],
                ["Room", selected.room || "—"], ["Section", selected.section], ["Type", selected.type],
                ["Special", selected.special || "None"], ["Deposit", selected.deposit > 0 ? `₹${selected.deposit}` : "None"],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-xs text-muted-foreground">{l}</span>
                  <span className="text-sm text-foreground">{v}</span>
                </div>
              ))}
              <div className="space-y-2 pt-2">
                {selected.status === "pending" && <button onClick={() => updateStatus(selected.id, "confirmed")} className="w-full py-2.5 rounded-lg bg-success hover:bg-success/90 font-semibold text-sm">Confirm Reservation</button>}
                {selected.status === "confirmed" && <button onClick={() => updateStatus(selected.id, "seated")} className="w-full py-2.5 rounded-lg bg-info hover:bg-info/90 font-semibold text-sm">Seat Guest Now</button>}
                {selected.status === "seated" && <button onClick={() => updateStatus(selected.id, "completed")} className="w-full py-2.5 rounded-lg bg-success hover:bg-success/90 font-semibold text-sm">Mark Completed</button>}
                {!["cancelled", "completed"].includes(selected.status) && (
                  <>
                    <button onClick={() => updateStatus(selected.id, "no-show")} className="w-full py-2.5 rounded-lg border border-warning-border text-warning hover:bg-warning-subtle font-semibold text-sm">Mark No-Show</button>
                    <button onClick={() => updateStatus(selected.id, "cancelled")} className="w-full py-2.5 rounded-lg border border-danger-border text-danger hover:bg-danger-subtle font-semibold text-sm">Cancel Reservation</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addMode && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold">New Reservation</h3>
              <button onClick={() => setAddMode(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* Guest details */}
              <div className="space-y-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-primary">Guest details</p>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Guest name <span className="text-danger">*</span></label>
                  <input type="text" placeholder="Full name" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground" value={newRes.guestName || ""} onChange={e => setNewRes({ ...newRes, guestName: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Mobile</label>
                    <input type="tel" inputMode="numeric" placeholder="10-digit number" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground" value={newRes.mobile || ""} onChange={e => setNewRes({ ...newRes, mobile: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Email</label>
                    <input type="email" placeholder="name@email.com" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground" value={newRes.email || ""} onChange={e => setNewRes({ ...newRes, email: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Booking details */}
              <div className="space-y-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-primary">Booking details</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Date <span className="text-danger">*</span></label>
                    <input type="date" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground [color-scheme:dark]" value={newRes.date || ""} onChange={e => setNewRes({ ...newRes, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Time <span className="text-danger">*</span></label>
                    <input type="time" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground [color-scheme:dark]" value={newRes.time || ""} onChange={e => setNewRes({ ...newRes, time: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Guests (people)</label>
                    <input type="number" min={1} placeholder="2" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground" value={newRes.guests || ""} onChange={e => setNewRes({ ...newRes, guests: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Room / Table no.</label>
                    <input type="text" placeholder="e.g. R-102 / T-12" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground" value={newRes.room || ""} onChange={e => setNewRes({ ...newRes, room: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Section</label>
                  <select className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground" value={newRes.section || ""} onChange={e => setNewRes({ ...newRes, section: e.target.value })}>
                    {["Indoor AC", "Premium Indoor", "Family Section", "Outdoor Garden", "Rooftop", "VIP Lounge", "Banquet Hall", "Spa"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Payment + notes */}
              <div className="space-y-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-primary">Payment &amp; notes</p>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Advance deposit (₹)</label>
                  <input type="number" min={0} placeholder="0" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground" value={newRes.deposit || ""} onChange={e => setNewRes({ ...newRes, deposit: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Special request</label>
                  <textarea rows={2} placeholder="Window seat, birthday setup, allergy note…" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground resize-none" value={newRes.special || ""} onChange={e => setNewRes({ ...newRes, special: e.target.value })} />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setAddMode(false)} className="flex-1 py-3 rounded-lg border border-border hover:bg-muted text-sm font-semibold">Cancel</button>
                <button onClick={handleAddRes} disabled={!newRes.guestName || !newRes.date || !newRes.time} className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold disabled:opacity-40">Book Now</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
