import { useState, useEffect, useCallback } from "react";
import { Banknote, Lock, Unlock, AlertTriangle, Plus, Minus, CheckCircle, Clock, TrendingUp, X } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { finance as financeApi } from "@/lib/api";
import { PermissionGate } from "@/components/restaurant/PermissionGate";

const DEFAULT_DENOMINATION = [
  { note: "₹2000", qty: 3, value: 6000 },
  { note: "₹500", qty: 8, value: 4000 },
  { note: "₹200", qty: 5, value: 1000 },
  { note: "₹100", qty: 12, value: 1200 },
  { note: "₹50", qty: 10, value: 500 },
  { note: "₹20", qty: 15, value: 300 },
  { note: "₹10", qty: 20, value: 200 },
  { note: "Coins", qty: 1, value: 50 },
];

type ShiftRow = { id: string; cashier: string; role: string; opened: string; closed: string | null; openingBalance: number; closingBalance: number | null; expectedBalance: number; sales: number; refunds: number; status: string };

export default function CashCounter() {
  const { restaurantId, currentStaff } = useRestaurant();
  const [activeShift, setActiveShift] = useState<ShiftRow | null>(null);
  const [allShifts, setAllShifts] = useState<ShiftRow[]>([]);
  const [transactions, setTransactions] = useState<{ id: string; type: string; amount: number; method: string; note: string; time: string }[]>([]);
  const [showClose, setShowClose] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [openBalance, setOpenBalance] = useState("5000");
  const [closing, setClosing] = useState(false);
  const [denom, setDenom] = useState(DEFAULT_DENOMINATION.map(d => ({ ...d })));
  const [tab, setTab] = useState<"shift" | "transactions" | "denominations">("shift");

  const mapShift = (s: any): ShiftRow => ({
    id: String(s.id),
    cashier: s.staffName || s.cashierName || "Cashier",
    role: s.staffRole || "Cashier",
    opened: s.openedAt ? new Date(s.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
    closed: s.closedAt ? new Date(s.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
    openingBalance: parseFloat(String(s.openingBalance || 0)),
    closingBalance: s.closingBalance != null ? parseFloat(String(s.closingBalance)) : null,
    expectedBalance: parseFloat(String(s.expectedBalance || s.openingBalance || 0)) + parseFloat(String(s.cashSales || 0)) - parseFloat(String(s.cashExpenses || 0)),
    sales: parseFloat(String(s.cashSales || s.totalSales || 0)),
    refunds: parseFloat(String(s.totalRefunds || 0)),
    status: s.status === "open" || (!s.closedAt && s.status !== "closed") ? "open" : "closed",
  });

  const loadShifts = useCallback(async () => {
    if (!restaurantId) return;
    const [shifts, txns] = await Promise.all([
      financeApi.cashShifts(restaurantId).catch(() => []),
      financeApi.transactions(restaurantId).catch(() => []),
    ]);
    if (Array.isArray(shifts) && shifts.length > 0) {
      const mapped = shifts.map(mapShift);
      setAllShifts(mapped);
      const openShift = mapped.find(s => s.status === "open");
      setActiveShift(openShift ?? null);
    } else {
      setAllShifts([]);
      setActiveShift(null);
    }
    if (Array.isArray(txns) && txns.length > 0) {
      setTransactions(txns.filter((t: any) => (t.paymentMethod || "cash") === "cash").map((t: any) => ({
        id: String(t.id),
        type: t.type === "expense" ? "expense" : t.type === "refund" ? "refund" : "sale",
        amount: parseFloat(String(t.amount || 0)) * (t.type === "expense" || t.type === "refund" ? -1 : 1),
        method: t.paymentMethod || "cash",
        note: t.description || "",
        time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
      })));
    }
  }, [restaurantId]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  const totalDeclared = denom.reduce((s, d) => s + d.value, 0);
  const expected = activeShift?.expectedBalance ?? activeShift?.openingBalance ?? 0;
  const mismatch = totalDeclared - expected;

  const currentSales = transactions.filter(t => t.type === "sale").reduce((s, t) => s + t.amount, 0);
  const currentRefunds = Math.abs(transactions.filter(t => t.type === "refund").reduce((s, t) => s + t.amount, 0));
  const currentExpenses = Math.abs(transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0));

  function updateDenom(idx: number, change: number) {
    setDenom(d => d.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(0, item.qty + change);
      return { ...item, qty: newQty, value: newQty * parseInt(item.note.replace(/[₹,A-Za-z]/g, "") || "10") };
    }));
  }

  async function handleOpenShift() {
    if (!restaurantId) return;
    try {
      await financeApi.openShift(restaurantId, {
        staffName: currentStaff?.name || "Cashier",
        staffRole: currentStaff?.role || "cashier",
        openingBalance: parseFloat(openBalance) || 0,
      });
      setShowOpen(false);
      await loadShifts();
    } catch (e) { console.error(e); }
  }

  async function handleCloseShift() {
    if (!restaurantId || !activeShift) return;
    setClosing(true);
    try {
      await financeApi.closeShift(restaurantId, parseInt(activeShift.id, 10), {
        closingBalance: totalDeclared,
        notes: Math.abs(mismatch) > 50 ? `Mismatch: ₹${mismatch}` : undefined,
      });
      setShowClose(false);
      await loadShifts();
    } catch (e) { console.error(e); }
    finally { setClosing(false); }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Cash Counter</h1>
          <p className="text-xs text-white/40">Shift management & cash tracking</p>
        </div>
        <div className="flex gap-2">
          {activeShift ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Shift Open · {activeShift.cashier}
              </div>
              <button onClick={() => setShowClose(true)} className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold px-4 py-2 rounded-xl text-sm transition-all border border-red-500/20">
                <Lock className="h-4 w-4" /> Close Shift
              </button>
            </>
          ) : (
            <button onClick={() => setShowOpen(true)} className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold px-4 py-2 rounded-xl text-sm transition-all border border-emerald-500/20">
              <Unlock className="h-4 w-4" /> Open Shift
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Opening Balance", value: `₹${(activeShift?.openingBalance ?? 0).toLocaleString()}`, icon: Unlock, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Cash Sales", value: `₹${currentSales.toLocaleString()}`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Refunds", value: `₹${currentRefunds.toLocaleString()}`, icon: Minus, color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Expected Closing", value: `₹${expected.toLocaleString()}`, icon: Banknote, color: "text-amber-400", bg: "bg-amber-500/10" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-white/40">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {(["shift", "transactions", "denominations"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t ? "bg-amber-500 text-black" : "text-white/50 hover:text-white"}`}>{t}</button>
        ))}
      </div>

      {tab === "shift" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
            <h2 className="text-sm font-bold mb-4 text-white/70">Current Shift Summary</h2>
            {activeShift ? (
            <div className="space-y-3">
              {[
                { label: "Cashier", value: activeShift.cashier },
                { label: "Shift Opened", value: activeShift.opened },
                { label: "Opening Balance", value: `₹${activeShift.openingBalance.toLocaleString()}` },
                { label: "Total Sales", value: `₹${currentSales.toLocaleString()}` },
                { label: "Total Refunds", value: `₹${currentRefunds.toLocaleString()}` },
                { label: "Expenses Paid", value: `₹${currentExpenses.toLocaleString()}` },
                { label: "Expected Closing", value: `₹${expected.toLocaleString()}` },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-white/50">{r.label}</span>
                  <span className="text-sm font-semibold">{r.value}</span>
                </div>
              ))}
            </div>
            ) : (
              <p className="text-sm text-white/40 text-center py-8">No active shift. Open a shift to start tracking cash.</p>
            )}
          </div>
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
            <h2 className="text-sm font-bold mb-4 text-white/70">Past Shifts</h2>
            {allShifts.filter(s => s.status === "closed").map(s => (
              <div key={s.id} className="p-3 rounded-xl bg-white/5 border border-white/5 mb-2">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold">{s.cashier}</p>
                    <p className="text-xs text-white/40">{s.opened} → {s.closed}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 text-xs font-semibold">Closed</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/5 rounded-lg p-2"><p className="text-xs text-white/40">Sales</p><p className="text-sm font-bold text-emerald-400">₹{s.sales.toLocaleString()}</p></div>
                  <div className="bg-white/5 rounded-lg p-2"><p className="text-xs text-white/40">Refunds</p><p className="text-sm font-bold text-orange-400">₹{s.refunds.toLocaleString()}</p></div>
                  <div className={`rounded-lg p-2 ${s.closingBalance! > s.expectedBalance ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                    <p className="text-xs text-white/40">Balance</p>
                    <p className={`text-sm font-bold ${s.closingBalance! > s.expectedBalance ? "text-red-400" : "text-emerald-400"}`}>₹{s.closingBalance?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
            {allShifts.filter(s => s.status === "closed").length === 0 && (
              <p className="text-sm text-white/30 text-center py-6">No closed shifts yet</p>
            )}
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <div className="bg-[#0e1520] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-bold">Cash Transactions</h2>
            <p className="text-xs text-white/40 mt-0.5">Current shift only</p>
          </div>
          <div className="divide-y divide-white/5">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.type === "sale" ? "bg-emerald-500/15 text-emerald-400" : t.type === "refund" ? "bg-orange-500/15 text-orange-400" : "bg-red-500/15 text-red-400"}`}>
                  {t.type === "sale" ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold capitalize">{t.type}</p>
                  <p className="text-xs text-white/40">{t.note}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${t.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>{t.amount > 0 ? "+" : ""}₹{Math.abs(t.amount).toLocaleString()}</p>
                  <p className="text-xs text-white/30">{t.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "denominations" && (
        <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold">Cash Declaration</h2>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold ${Math.abs(mismatch) < 50 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {Math.abs(mismatch) < 50 ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {mismatch >= 0 ? "+" : ""}₹{mismatch.toLocaleString()} vs expected
            </div>
          </div>
          <div className="space-y-2 mb-4">
            {denom.map((d, i) => (
              <div key={d.note} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/5">
                <span className="text-sm font-bold w-16 text-amber-400">{d.note}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateDenom(i, -1)} className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"><Minus className="h-3 w-3" /></button>
                  <span className="text-sm font-bold w-8 text-center">{d.qty}</span>
                  <button onClick={() => updateDenom(i, 1)} className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"><Plus className="h-3 w-3" /></button>
                </div>
                <span className="ml-auto text-sm font-semibold text-white/60">= ₹{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <span className="text-sm font-bold text-amber-400">Total Declared</span>
            <span className="text-lg font-extrabold text-amber-400">₹{totalDeclared.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showClose && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">Close Shift</h2>
              <button onClick={() => setShowClose(false)} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/15"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 mb-5">
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-xs text-white/40 mb-1">Expected Closing Balance</p>
                <p className="text-2xl font-extrabold text-amber-400">₹{expected.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-xs text-white/40 mb-1">Declared Cash</p>
                <p className="text-2xl font-extrabold text-white">₹{totalDeclared.toLocaleString()}</p>
              </div>
              {Math.abs(mismatch) > 50 && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">Cash mismatch of ₹{Math.abs(mismatch)} detected. A report will be generated.</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowClose(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-semibold hover:bg-white/10 transition-all">Cancel</button>
              <PermissionGate permission="view_wallet">
              <button onClick={handleCloseShift} disabled={closing} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-600 transition-all disabled:opacity-50">{closing ? "Closing…" : "Confirm & Close"}</button>
              </PermissionGate>
            </div>
          </div>
        </div>
      )}

      {showOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">Open Shift</h2>
              <button onClick={() => setShowOpen(false)} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/15"><X className="h-4 w-4" /></button>
            </div>
            <label className="text-xs text-white/40 block mb-1">Opening float (₹)</label>
            <input type="number" value={openBalance} onChange={e => setOpenBalance(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:border-amber-500/40" />
            <div className="flex gap-3">
              <button onClick={() => setShowOpen(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-semibold">Cancel</button>
              <PermissionGate permission="view_wallet">
              <button onClick={handleOpenShift} className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-sm">Open Shift</button>
              </PermissionGate>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
