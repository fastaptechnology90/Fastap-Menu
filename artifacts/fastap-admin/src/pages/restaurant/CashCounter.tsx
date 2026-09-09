import { useState, useEffect, useCallback } from "react";
import { Banknote, Lock, Unlock, AlertTriangle, Plus, Minus, CheckCircle, Clock, TrendingUp, X } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { finance as financeApi } from "@/lib/api";
import { PermissionGate } from "@/components/restaurant/PermissionGate";
import { RevenueByDate } from "@/components/restaurant/RevenueByDate";
import { toast } from "@/hooks/use-toast";

// Start every count from zero so the cashier physically counts the drawer — no pre-filled fake amounts.
const DEFAULT_DENOMINATION = [
  { note: "₹2000", qty: 0, value: 0 },
  { note: "₹500", qty: 0, value: 0 },
  { note: "₹200", qty: 0, value: 0 },
  { note: "₹100", qty: 0, value: 0 },
  { note: "₹50", qty: 0, value: 0 },
  { note: "₹20", qty: 0, value: 0 },
  { note: "₹10", qty: 0, value: 0 },
  { note: "Coins", qty: 0, value: 0 },
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
      toast({ title: "Shift opened", description: `Opening float ₹${(parseFloat(openBalance) || 0).toLocaleString()}.` });
      setShowOpen(false);
      await loadShifts();
    } catch (e: any) {
      toast({ title: "Could not open shift", description: e?.message || "Please try again.", variant: "destructive" });
    }
  }

  async function handleCloseShift() {
    if (!restaurantId || !activeShift) return;
    setClosing(true);
    try {
      await financeApi.closeShift(restaurantId, parseInt(activeShift.id, 10), {
        closingBalance: totalDeclared,
        notes: Math.abs(mismatch) > 50 ? `Mismatch: ₹${mismatch}` : undefined,
      });
      toast({ title: "Shift closed", description: `Declared ₹${totalDeclared.toLocaleString()}${Math.abs(mismatch) > 50 ? ` · mismatch ₹${mismatch}` : ""}.` });
      setShowClose(false);
      await loadShifts();
    } catch (e: any) {
      toast({ title: "Could not close shift", description: e?.message || "Please try again.", variant: "destructive" });
    }
    finally { setClosing(false); }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Cash Counter</h1>
          <p className="text-xs text-muted-foreground">Shift management & cash tracking</p>
        </div>
        <div className="flex gap-2">
          {activeShift ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-subtle text-success text-xs font-semibold">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Shift Open · {activeShift.cashier}
              </div>
              <button onClick={() => setShowClose(true)} className="flex items-center gap-2 bg-danger-subtle hover-elevate text-danger font-semibold px-4 py-2 rounded-lg text-sm transition-colors border border-danger-border">
                <Lock className="h-4 w-4" /> Close Shift
              </button>
            </>
          ) : (
            <button onClick={() => setShowOpen(true)} className="flex items-center gap-2 bg-success-subtle hover-elevate text-success font-semibold px-4 py-2 rounded-lg text-sm transition-colors border border-success-border">
              <Unlock className="h-4 w-4" /> Open Shift
            </button>
          )}
        </div>
      </div>

      <RevenueByDate restaurantId={restaurantId} title="Cash + Total revenue" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Opening Balance", value: `₹${(activeShift?.openingBalance ?? 0).toLocaleString()}`, icon: Unlock, color: "text-info", bg: "bg-info-subtle" },
          { label: "Cash Sales", value: `₹${currentSales.toLocaleString()}`, icon: TrendingUp, color: "text-success", bg: "bg-success-subtle" },
          { label: "Refunds", value: `₹${currentRefunds.toLocaleString()}`, icon: Minus, color: "text-warning", bg: "bg-warning-subtle" },
          { label: "Expected Closing", value: `₹${expected.toLocaleString()}`, icon: Banknote, color: "text-primary", bg: "bg-primary/10" },
        ].map(s => (
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {(["shift", "transactions", "denominations"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "shift" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-4 text-foreground">Current Shift Summary</h2>
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
                <div key={r.label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className="text-sm font-semibold">{r.value}</span>
                </div>
              ))}
            </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No active shift. Open a shift to start tracking cash.</p>
            )}
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-4 text-foreground">Past Shifts</h2>
            {allShifts.filter(s => s.status === "closed").map(s => (
              <div key={s.id} className="p-3 rounded-lg bg-muted border border-border mb-2">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold">{s.cashier}</p>
                    <p className="text-xs text-muted-foreground">{s.opened} to {s.closed}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold">Closed</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted rounded-lg p-2"><p className="text-xs text-muted-foreground">Sales</p><p className="text-sm font-semibold text-success">₹{s.sales.toLocaleString()}</p></div>
                  <div className="bg-muted rounded-lg p-2"><p className="text-xs text-muted-foreground">Refunds</p><p className="text-sm font-semibold text-warning">₹{s.refunds.toLocaleString()}</p></div>
                  <div className={`rounded-lg p-2 ${s.closingBalance! > s.expectedBalance ? "bg-danger-subtle" : "bg-success-subtle"}`}>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className={`text-sm font-semibold ${s.closingBalance! > s.expectedBalance ? "text-danger" : "text-success"}`}>₹{s.closingBalance?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
            {allShifts.filter(s => s.status === "closed").length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No closed shifts yet</p>
            )}
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold">Cash Transactions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Current shift only</p>
          </div>
          <div className="divide-y divide-border">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.type === "sale" ? "bg-success-subtle text-success" : t.type === "refund" ? "bg-warning-subtle text-warning" : "bg-danger-subtle text-danger"}`}>
                  {t.type === "sale" ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold capitalize">{t.type}</p>
                  <p className="text-xs text-muted-foreground">{t.note}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${t.amount > 0 ? "text-success" : "text-danger"}`}>{t.amount > 0 ? "+" : ""}₹{Math.abs(t.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{t.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "denominations" && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Cash Declaration</h2>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${Math.abs(mismatch) < 50 ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}>
              {Math.abs(mismatch) < 50 ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {mismatch >= 0 ? "+" : ""}₹{mismatch.toLocaleString()} vs expected
            </div>
          </div>
          <div className="space-y-2 mb-4">
            {denom.map((d, i) => (
              <div key={d.note} className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                <span className="text-sm font-semibold w-16 text-primary">{d.note}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateDenom(i, -1)} className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center hover-elevate transition-colors"><Minus className="h-3 w-3" /></button>
                  <span className="text-sm font-semibold w-8 text-center">{d.qty}</span>
                  <button onClick={() => updateDenom(i, 1)} className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center hover-elevate transition-colors"><Plus className="h-3 w-3" /></button>
                </div>
                <span className="ml-auto text-sm font-semibold text-muted-foreground">= ₹{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
            <span className="text-sm font-semibold text-primary">Total Declared</span>
            <span className="text-lg font-semibold text-primary">₹{totalDeclared.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showClose && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Close Shift</h2>
              <button onClick={() => setShowClose(false)} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover-elevate"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 mb-5">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Expected Closing Balance</p>
                <p className="text-2xl font-semibold text-primary">₹{expected.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Declared Cash</p>
                <p className="text-2xl font-semibold text-foreground">₹{totalDeclared.toLocaleString()}</p>
              </div>
              {Math.abs(mismatch) > 50 && (
                <div className="flex items-center gap-2 p-3 bg-danger-subtle border border-danger-border rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                  <p className="text-xs text-danger">Cash mismatch of ₹{Math.abs(mismatch)} detected. A report will be generated.</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowClose(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-semibold hover-elevate transition-colors">Cancel</button>
              <PermissionGate permission="view_wallet">
              <button onClick={handleCloseShift} disabled={closing} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">{closing ? "Closing…" : "Confirm & Close"}</button>
              </PermissionGate>
            </div>
          </div>
        </div>
      )}

      {showOpen && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Open Shift</h2>
              <button onClick={() => setShowOpen(false)} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover-elevate"><X className="h-4 w-4" /></button>
            </div>
            <label className="text-xs text-muted-foreground block mb-1">Opening float (₹)</label>
            <input type="number" value={openBalance} onChange={e => setOpenBalance(e.target.value)} className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm mb-4 focus:outline-none focus:border-primary/40" />
            <div className="flex gap-3">
              <button onClick={() => setShowOpen(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-semibold">Cancel</button>
              <PermissionGate permission="view_wallet">
              <button onClick={handleOpenShift} className="flex-1 py-2.5 rounded-lg bg-success text-background font-semibold text-sm">Open Shift</button>
              </PermissionGate>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
