import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet, X, CheckCircle, Search, Receipt, CreditCard, Smartphone, Banknote, Loader2, Clock, User } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { spa as spaApi } from "@/lib/api";
import { RevenueByDate } from "@/components/restaurant/RevenueByDate";

type PaymentMeta = { method?: string; amount?: number; upiId?: string; utr?: string; reference?: string; collectedBy?: string; collectedFrom?: string; collectedAt?: string };
type Booking = {
  id: number; serviceName: string; guestName: string; guestPhone?: string; therapist?: string;
  scheduledAt: string; duration: number; price: number; status: string; paymentStatus: string;
  bookingType: string; metadata?: { payment?: PaymentMeta } & Record<string, unknown>;
};

const fmt = (n: number | undefined) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const METHODS = [
  { key: "cash", label: "Cash", icon: Banknote },
  { key: "upi", label: "UPI", icon: Smartphone },
  { key: "card", label: "Card", icon: CreditCard },
];
const methodLabel = (m?: string) => METHODS.find(x => x.key === m)?.label || (m ? m.toUpperCase() : "—");

function fmtDateTime(v: string | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function SpaPayments() {
  const { restaurantId, currentStaff } = useRestaurant();
  const qc = useQueryClient();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [search, setSearch] = useState("");
  const [payFor, setPayFor] = useState<Booking | null>(null);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [form, setForm] = useState({ method: "cash", amount: "", upiId: "", utr: "", reference: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    if (!restaurantId) return;
    setLoading(true);
    spaApi.bookings(restaurantId)
      .then(d => setBookings(Array.isArray(d) ? d.map((b: any) => ({ ...b, price: parseFloat(String(b.price || 0)) })) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [restaurantId]);

  const isPaid = (b: Booking) => b.paymentStatus === "paid";
  const pending = bookings.filter(b => b.status !== "cancelled" && !isPaid(b));
  const paid = bookings.filter(isPaid);
  const pendingAmount = pending.reduce((s, b) => s + b.price, 0);
  const collectedTotal = paid.reduce((s, b) => s + b.price, 0);

  const list = (tab === "pending" ? pending : paid).filter(b =>
    !search || b.guestName?.toLowerCase().includes(search.toLowerCase()) || b.serviceName?.toLowerCase().includes(search.toLowerCase()),
  );

  function openPay(b: Booking) {
    setForm({ method: "cash", amount: String(b.price || ""), upiId: "", utr: "", reference: "" });
    setPayFor(b);
  }

  async function collect() {
    if (!restaurantId || !payFor || saving) return;
    setSaving(true);
    try {
      await spaApi.updateBooking(restaurantId, payFor.id, {
        paymentStatus: "paid",
        payment: {
          method: form.method,
          amount: Number(form.amount || payFor.price),
          upiId: form.method === "upi" ? (form.upiId || undefined) : undefined,
          utr: form.utr || undefined,
          reference: form.reference || undefined,
          collectedBy: currentStaff?.name || "Spa",
          collectedFrom: payFor.guestName,
        },
      });
      setPayFor(null);
      load();
      // Refresh the shared revenue widget immediately (don't wait for the poll).
      qc.invalidateQueries({ queryKey: ["restaurant-revenue"] });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  const stats = [
    { label: "Collected (paid)", value: fmt(collectedTotal), color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Pending amount", value: fmt(pendingAmount), color: "text-rose-400", bg: "bg-rose-500/10" },
    { label: "Pending bills", value: String(pending.length), color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Total bookings", value: String(bookings.length), color: "text-cyan-400", bg: "bg-cyan-500/10" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5 text-white">
      <div>
        <h1 className="text-xl font-extrabold flex items-center gap-2"><Wallet className="h-5 w-5 text-amber-400" /> Spa Payments</h1>
        <p className="text-xs text-white/40">Collect payments for spa bookings, and view history and details.</p>
      </div>

      <RevenueByDate restaurantId={restaurantId} title="Spa Revenue" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
          {([["pending", `Pending (${pending.length})`], ["history", `Paid (${paid.length})`]] as [typeof tab, string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-amber-500 text-black" : "text-white/50 hover:text-white"}`}>{l}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guest or service…" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/40"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-white/8 p-10 text-center text-white/40">
          {tab === "pending" ? "No pending payments — everything is collected 🎉" : "No paid bookings yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(b => {
            const pay = b.metadata?.payment;
            return (
              <div key={b.id} onClick={() => tab === "history" && setDetail(b)}
                className={`bg-[#0e1520] border border-white/8 rounded-2xl p-4 flex items-center gap-3 ${tab === "history" ? "cursor-pointer hover:border-amber-500/30" : ""} transition-colors`}>
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0"><Receipt className="h-5 w-5 text-amber-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold truncate">{b.serviceName}</p>
                    {isPaid(b)
                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">PAID · {methodLabel(pay?.method)}</span>
                      : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">PENDING</span>}
                  </div>
                  <p className="text-xs text-white/40 flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{b.guestName || "Guest"}</span>
                    {b.therapist && <span>· {b.therapist}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateTime(b.scheduledAt)}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-extrabold text-amber-400">{fmt(b.price)}</p>
                  {tab === "pending"
                    ? <button onClick={e => { e.stopPropagation(); openPay(b); }} className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Collect</button>
                    : <p className="text-[11px] text-white/30 mt-0.5">by {pay?.collectedBy || "—"}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Collect payment modal */}
      {payFor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPayFor(null)}>
          <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h3 className="font-bold flex items-center gap-2"><Wallet className="h-5 w-5 text-emerald-400" /> Collect payment</h3>
                <p className="text-xs text-white/40 mt-0.5">{payFor.serviceName} · {payFor.guestName}</p>
              </div>
              <button onClick={() => setPayFor(null)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Payment method</label>
                <div className="grid grid-cols-3 gap-2">
                  {METHODS.map(m => {
                    const Ic = m.icon;
                    return (
                      <button key={m.key} onClick={() => setForm(p => ({ ...p, method: m.key }))}
                        className={`py-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${form.method === m.key ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/50"}`}>
                        <Ic className="h-4 w-4" /> {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Amount (₹)</label>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              </div>
              {form.method === "upi" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">UPI ID</label>
                    <input value={form.upiId} onChange={e => setForm(p => ({ ...p, upiId: e.target.value }))} placeholder="guest@upi" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">UTR / Ref</label>
                    <input value={form.utr} onChange={e => setForm(p => ({ ...p, utr: e.target.value }))} placeholder="UTR number" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                  </div>
                </div>
              )}
              {form.method === "card" && (
                <div>
                  <label className="block text-xs text-white/40 mb-1">Card / Ref number</label>
                  <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="Last 4 digits / approval code" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setPayFor(null)} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold">Cancel</button>
                <button onClick={collect} disabled={saving} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Mark paid — {fmt(Number(form.amount || payFor.price))}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment detail modal */}
      {detail && (() => {
        const pay = detail.metadata?.payment;
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetail(null)}>
            <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-white/10" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h3 className="font-bold flex items-center gap-2"><Receipt className="h-5 w-5 text-emerald-400" /> Payment detail</h3>
                <button onClick={() => setDetail(null)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
              </div>
              <div className="p-5 space-y-2 text-sm">
                {[
                  ["Service", detail.serviceName],
                  ["Guest", detail.guestName],
                  ["Therapist", detail.therapist || "—"],
                  ["Amount", fmt(pay?.amount ?? detail.price)],
                  ["Method", methodLabel(pay?.method)],
                  ["UPI ID", pay?.upiId || "—"],
                  ["UTR / Ref", pay?.utr || pay?.reference || "—"],
                  ["Collected by", pay?.collectedBy || "—"],
                  ["Collected at", fmtDateTime(pay?.collectedAt)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-white/5 pb-2">
                    <span className="text-white/40">{k}</span><span className="font-medium text-right break-all">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
