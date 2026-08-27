import { useState, useEffect, useCallback } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { roomService as roomApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { BedDouble, UserPlus, Users, CalendarDays, Wallet, X, CheckCircle, Loader2, LogOut, Phone } from "lucide-react";

type Folio = {
  room: { id: number; number: string; type: string; status: string; guestName: string | null; guestPhone: string | null; checkIn: string | null; checkOut: string | null; rate: number; guestCount: number; nights: number } | null;
  total: number; paid: number; balance: number; roomRent: number; servicesTotal: number; discount: number;
  lines?: { id: number; typeLabel: string; label: string; amount: number; status: string }[];
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isJustArrived(checkIn: string | null | undefined): boolean {
  if (!checkIn) return false;
  const t = new Date(checkIn).getTime();
  return !Number.isNaN(t) && Date.now() - t < 2 * 60 * 60 * 1000; // within 2 hours
}
function fmt(n: number) { return `₹${Number(n || 0).toLocaleString("en-IN")}`; }

export default function Reception() {
  const { restaurantId } = useRestaurant();
  const [rooms, setRooms] = useState<any[]>([]);
  const [folios, setFolios] = useState<Record<string, Folio>>({});
  const [loading, setLoading] = useState(true);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [payFor, setPayFor] = useState<Folio | null>(null);
  const [detailGuest, setDetailGuest] = useState<Folio | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ roomId: "", guestName: "", guestPhone: "", guestCount: "1", nights: "1", rate: "", advance: "" });

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const rs = await roomApi.rooms(restaurantId).catch(() => []);
      const list = Array.isArray(rs) ? rs : [];
      setRooms(list);
      const occupied = list.filter(r => r.status !== "vacant" && (r.guestName || r.status === "occupied"));
      const entries = await Promise.all(occupied.map(async r => {
        const f = await roomApi.folio(restaurantId, r.number).catch(() => null);
        return [r.number, f] as const;
      }));
      const map: Record<string, Folio> = {};
      for (const [num, f] of entries) if (f) map[num] = f;
      setFolios(map);
    } finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const vacantRooms = rooms.filter(r => r.status === "vacant");
  const occupiedFolios = Object.values(folios).filter(f => f.room);

  const totalGuests = occupiedFolios.reduce((s, f) => s + (f.room?.guestCount ?? 0), 0);
  const totalDue = occupiedFolios.reduce((s, f) => s + (f.balance ?? 0), 0);
  const arrivedToday = occupiedFolios.filter(f => isJustArrived(f.room?.checkIn)).length;

  async function submitWalkIn() {
    if (!restaurantId || !form.roomId || !form.guestName.trim()) { toast({ title: "Room & guest name required", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const nights = Math.max(1, parseInt(form.nights, 10) || 1);
      const checkIn = new Date();
      const checkOut = new Date(Date.now() + nights * 86400000);
      await roomApi.updateRoom(restaurantId, parseInt(form.roomId, 10), {
        status: "occupied",
        guestName: form.guestName.trim(),
        guestPhone: form.guestPhone.trim() || null,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        guestCount: parseInt(form.guestCount, 10) || 1,
        rate: parseFloat(form.rate) || 0,
        paid: parseFloat(form.advance) || 0,
      });
      toast({ title: "Guest checked in", description: `${form.guestName} — just arrived.` });
      setShowWalkIn(false);
      setForm({ roomId: "", guestName: "", guestPhone: "", guestCount: "1", nights: "1", rate: "", advance: "" });
      await load();
    } catch (e: any) {
      toast({ title: "Check-in failed", description: e?.message || "Try again", variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function submitPayment() {
    if (!restaurantId || !payFor?.room) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setBusy(true);
    try {
      await roomApi.recordPayment(restaurantId, payFor.room.number, amt);
      toast({ title: "Payment recorded", description: `${fmt(amt)} for Room ${payFor.room.number}.` });
      setPayFor(null); setPayAmount("");
      await load();
    } catch (e: any) {
      toast({ title: "Could not record payment", description: e?.message || "Try again", variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function checkout(roomNumber: string, guest: string) {
    if (!restaurantId) return;
    if (!confirm(`Check out ${guest} from Room ${roomNumber}? This settles the bill and frees the room.`)) return;
    setBusy(true);
    try {
      await roomApi.checkout(restaurantId, roomNumber);
      toast({ title: "Checked out", description: `Room ${roomNumber} is now free.` });
      await load();
    } catch (e: any) {
      toast({ title: "Checkout failed", description: e?.message || "Try again", variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Reception</h1>
          <p className="text-xs text-white/40">Guests, rooms & folios — check-in, payments and check-out</p>
        </div>
        <button onClick={() => setShowWalkIn(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
          <UserPlus className="h-4 w-4" /> New Guest (walk-in)
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "In-house guests", value: occupiedFolios.length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Total people", value: totalGuests, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Just arrived (2h)", value: arrivedToday, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Balance due", value: fmt(totalDue), color: "text-rose-400", bg: "bg-rose-500/10" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /></div>
      ) : occupiedFolios.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          <BedDouble className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No in-house guests right now. Use "New Guest (walk-in)" to check someone in.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {occupiedFolios.map(f => {
            const r = f.room!;
            return (
              <div key={r.number} onClick={() => setDetailGuest(f)} title="Click for full guest details" className="bg-[#0e1520] border border-white/8 rounded-2xl p-4 space-y-3 cursor-pointer hover:border-amber-500/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold truncate">{r.guestName || "Guest"}</p>
                      {isJustArrived(r.checkIn) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">JUST ARRIVED</span>}
                    </div>
                    {r.guestPhone && <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{r.guestPhone}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 text-cyan-300"><BedDouble className="h-4 w-4" /><span className="font-bold">Room {r.number}</span></div>
                    <p className="text-[11px] text-white/40 capitalize">{r.type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-white/60"><CalendarDays className="h-3.5 w-3.5 text-white/40" /> {r.nights} night{r.nights > 1 ? "s" : ""}</div>
                  <div className="flex items-center gap-1.5 text-white/60"><Users className="h-3.5 w-3.5 text-white/40" /> {r.guestCount} guest{r.guestCount > 1 ? "s" : ""}</div>
                </div>

                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Room rent ({r.nights}n @ {fmt(r.rate)})</span><span className="text-white/70">{fmt(f.roomRent)}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Services (food/spa/bar)</span><span className="text-white/70">{fmt(f.servicesTotal)}</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-1 font-bold"><span>Total bill</span><span className="text-white">{fmt(f.total)}</span></div>
                  <div className="flex justify-between text-emerald-400"><span>Paid</span><span>{fmt(f.paid)}</span></div>
                  <div className="flex justify-between font-bold text-rose-300"><span>Remaining</span><span>{fmt(f.balance)}</span></div>
                </div>

                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setPayFor(f); setPayAmount(String(f.balance || "")); }} className="flex-1 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 flex items-center justify-center gap-1">
                    <Wallet className="h-3.5 w-3.5" /> Record payment
                  </button>
                  <button onClick={() => checkout(r.number, r.guestName || "guest")} disabled={busy} className="flex-1 py-2 rounded-xl border border-white/10 text-white/60 text-xs font-bold hover:bg-white/5 flex items-center justify-center gap-1">
                    <LogOut className="h-3.5 w-3.5" /> Check out
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Walk-in modal */}
      {showWalkIn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowWalkIn(false)}>
          <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-bold flex items-center gap-2"><UserPlus className="h-5 w-5 text-amber-400" /> New guest (walk-in)</h3>
              <button onClick={() => setShowWalkIn(false)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-white/40 mb-1">Assign room <span className="text-red-400">*</span></label>
                <select value={form.roomId} onChange={e => { const rm = vacantRooms.find(r => String(r.id) === e.target.value); setForm(p => ({ ...p, roomId: e.target.value, rate: p.rate || String((rm?.roomControls?.billing?.rate) || "") })); }} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                  <option value="">-- Select a vacant room --</option>
                  {vacantRooms.map(r => <option key={r.id} value={r.id}>Room {r.number} · {r.type}</option>)}
                </select>
                {vacantRooms.length === 0 && <p className="text-[11px] text-amber-300 mt-1">No vacant rooms available right now.</p>}
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Guest name <span className="text-red-400">*</span></label>
                <input value={form.guestName} onChange={e => setForm(p => ({ ...p, guestName: e.target.value }))} placeholder="Full name" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Mobile</label>
                  <input value={form.guestPhone} onChange={e => setForm(p => ({ ...p, guestPhone: e.target.value }))} placeholder="10-digit" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">People</label>
                  <input type="number" min={1} value={form.guestCount} onChange={e => setForm(p => ({ ...p, guestCount: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Nights (days)</label>
                  <input type="number" min={1} value={form.nights} onChange={e => setForm(p => ({ ...p, nights: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Rate / night (₹)</label>
                  <input type="number" min={0} value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Advance paid (₹)</label>
                <input type="number" min={0} value={form.advance} onChange={e => setForm(p => ({ ...p, advance: e.target.value }))} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowWalkIn(false)} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold">Cancel</button>
                <button onClick={submitWalkIn} disabled={busy || !form.roomId || !form.guestName.trim()} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Check in
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record payment modal */}
      {payFor?.room && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPayFor(null)}>
          <div className="w-full max-w-xs bg-[#111827] rounded-2xl border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-bold">Record payment</h3>
              <button onClick={() => setPayFor(null)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-white/50">Room {payFor.room.number} · {payFor.room.guestName} · Remaining <span className="text-rose-300 font-bold">{fmt(payFor.balance)}</span></p>
              <input type="number" min={1} autoFocus value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Amount (₹)" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              <button onClick={submitPayment} disabled={busy} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full guest details */}
      {detailGuest?.room && (() => {
        const r = detailGuest.room; const f = detailGuest;
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailGuest(null)}>
            <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 text-white max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 p-5 border-b border-white/10">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base truncate">{r.guestName || "Guest"}</h3>
                    {isJustArrived(r.checkIn) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">JUST ARRIVED</span>}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">Room {r.number} · {r.type}</p>
                </div>
                <button onClick={() => setDetailGuest(null)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
              </div>

              <div className="p-5 space-y-4 text-sm">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400/80 mb-2">Guest details</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      ["Name", r.guestName || "—"],
                      ["Mobile", r.guestPhone || "—"],
                      ["Room", `${r.number} · ${r.type}`],
                      ["People", `${r.guestCount} guest${r.guestCount > 1 ? "s" : ""}`],
                      ["Nights", `${r.nights}`],
                      ["Rate / night", fmt(r.rate)],
                      ["Check-in", fmtDate(r.checkIn)],
                      ["Check-out", fmtDate(r.checkOut)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[11px] text-white/35">{k}</p>
                        <p className="font-medium break-all">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {Array.isArray(f.lines) && f.lines.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400/80 mb-2">Charges</p>
                    <div className="rounded-xl bg-white/[0.03] border border-white/5 divide-y divide-white/5">
                      {f.lines.map(l => (
                        <div key={l.id} className="flex justify-between gap-3 px-3 py-2 text-xs">
                          <span className="text-white/60 truncate">{l.label} <span className="text-white/30">· {l.typeLabel}</span></span>
                          <span className="text-white/80 shrink-0">{fmt(l.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Room rent ({r.nights}n @ {fmt(r.rate)})</span><span className="text-white/70">{fmt(f.roomRent)}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Services (food/spa/bar)</span><span className="text-white/70">{fmt(f.servicesTotal)}</span></div>
                  {f.discount > 0 && <div className="flex justify-between"><span className="text-white/40">Discount</span><span className="text-white/70">- {fmt(f.discount)}</span></div>}
                  <div className="flex justify-between border-t border-white/10 pt-1.5 font-bold text-sm"><span>Total bill</span><span className="text-white">{fmt(f.total)}</span></div>
                  <div className="flex justify-between text-emerald-400 font-semibold"><span>Paid</span><span>{fmt(f.paid)}</span></div>
                  <div className="flex justify-between font-bold text-rose-300"><span>Remaining</span><span>{fmt(f.balance)}</span></div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => { setPayFor(f); setPayAmount(String(f.balance || "")); setDetailGuest(null); }} className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-bold hover:bg-emerald-500/25 flex items-center justify-center gap-1"><Wallet className="h-4 w-4" /> Record payment</button>
                  <button onClick={() => { const num = r.number; const gn = r.guestName || "guest"; setDetailGuest(null); checkout(num, gn); }} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm font-bold hover:bg-white/5 flex items-center justify-center gap-1"><LogOut className="h-4 w-4" /> Check out</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
