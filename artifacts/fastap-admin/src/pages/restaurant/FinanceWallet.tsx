import { useState, useEffect } from "react";
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, AlertCircle, Download, CreditCard, Banknote, DollarSign, BarChart3, BookOpen } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { finance as financeApi } from "@/lib/api";
import { publicationEmptyMessage } from "@/lib/restaurantPublication";
import type { SettlementRow, OnlineTxnRow, CashLedgerRow } from "@/lib/restaurant-types";

type Tab = "overview" | "wallet" | "cash-ledger" | "settlements" | "reports";

const TYPE_CFG: Record<string, { icon: string; color: string }> = {
  upi:  { icon: "📱", color: "text-blue-400" },
  card: { icon: "💳", color: "text-violet-400" },
  cash: { icon: "💵", color: "text-emerald-400" },
  wallet: { icon: "👛", color: "text-amber-400" },
};

export default function FinanceWallet() {
  const { restaurantId, restaurant, isRestaurantPublished } = useRestaurant();
  const [tab, setTab] = useState<Tab>("overview");
  const [walletData, setWalletData] = useState({ onlineBalance: 0, pendingSettlement: 0, lockedBalance: 0, reserveBalance: 0, totalCashSales: 0, totalOnlineSales: 0, taxCollected: 0, pendingRefunds: 0 });
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [onlineTxns, setOnlineTxns] = useState<OnlineTxnRow[]>([]);
  const [cashLedger, setCashLedger] = useState<CashLedgerRow[]>([]);
  const [pnl, setPnl] = useState({ revenue: 0, cogs: 0, grossProfit: 0, staffCost: 0, utilities: 0, rent: 0, marketing: 0, misc: 0, netProfit: 0, margin: 0 });
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!restaurantId) return;
    setExporting(true);
    try { await financeApi.exportCsv(restaurantId); } catch {} finally { setExporting(false); }
  }

  useEffect(() => {
    if (!restaurantId) return;
    if (!isRestaurantPublished) {
      setWalletData({ onlineBalance: 0, pendingSettlement: 0, lockedBalance: 0, reserveBalance: 0, totalCashSales: 0, totalOnlineSales: 0, taxCollected: 0, pendingRefunds: 0 });
      setSettlements([]);
      setOnlineTxns([]);
      setCashLedger([]);
      setPnl({ revenue: 0, cogs: 0, grossProfit: 0, staffCost: 0, utilities: 0, rent: 0, marketing: 0, misc: 0, netProfit: 0, margin: 0 });
      return;
    }
    financeApi.wallet(restaurantId).then((data) => {
      if (!data) return;
      setWalletData({
        onlineBalance: data.onlineBalance ?? 0,
        pendingSettlement: data.pendingSettlement ?? 0,
        lockedBalance: data.lockedBalance ?? 0,
        reserveBalance: data.reserveBalance ?? 0,
        totalCashSales: data.totalCashSales ?? 0,
        totalOnlineSales: data.totalOnlineSales ?? 0,
        taxCollected: data.taxCollected ?? 0,
        pendingRefunds: data.pendingRefunds ?? data.refundAmount ?? 0,
      });
      if (Array.isArray(data.settlements)) setSettlements(data.settlements);
      if (Array.isArray(data.onlineTxns)) setOnlineTxns(data.onlineTxns);
      if (Array.isArray(data.cashLedger)) setCashLedger(data.cashLedger);
      if (data.pnl) {
        const revenue = data.pnl.revenue ?? 0;
        setPnl(prev => ({
          ...prev,
          revenue,
          grossProfit: revenue - prev.cogs,
          netProfit: data.pnl.netProfit ?? 0,
          margin: data.pnl.margin ?? 0,
        }));
      }
    }).catch(() => {});
  }, [restaurantId, isRestaurantPublished]);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Finance & Wallet</h1>
          <p className="text-xs text-white/40">Fastap wallet, settlements, P&L & cash ledger</p>
        </div>
        <button onClick={handleExport} disabled={exporting || !isRestaurantPublished} className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white/70 font-bold px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-50">
          <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export"}
        </button>
      </div>

      {!isRestaurantPublished && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
          <p className="text-sm font-semibold text-amber-200">Finance analytics unavailable</p>
          <p className="text-xs text-white/50 mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      {/* Wallet Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Online Wallet", value: `₹${walletData.onlineBalance.toLocaleString()}`, icon: Wallet, color: "text-emerald-400", bg: "bg-emerald-500/10", desc: "Gateway received" },
          { label: "Pending Settlement", value: `₹${walletData.pendingSettlement.toLocaleString()}`, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10", desc: "Awaiting transfer" },
          { label: "Locked Balance", value: `₹${walletData.lockedBalance.toLocaleString()}`, icon: AlertCircle, color: "text-orange-400", bg: "bg-orange-500/10", desc: "Refund/chargeback hold" },
          { label: "Cash Sales (MTD)", value: `₹${walletData.totalCashSales.toLocaleString()}`, icon: Banknote, color: "text-blue-400", bg: "bg-blue-500/10", desc: "Cash ledger total" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-xs text-white/40">{s.label}</p>
            </div>
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/30 mt-0.5">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 overflow-x-auto w-fit">
        {[
          { id: "overview", label: "P&L", icon: BarChart3 },
          { id: "wallet", label: "Online Txns", icon: Wallet },
          { id: "cash-ledger", label: "Cash Ledger", icon: Banknote },
          { id: "settlements", label: "Settlements", icon: CheckCircle },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-amber-500 text-black" : "text-white/50 hover:text-white"}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h2 className="text-sm font-bold mb-4 text-white/70">Profit & Loss (MTD)</h2>
            <div className="space-y-2">
              {[
                { label: "Gross Revenue", value: pnl.revenue, type: "revenue" },
                { label: "Cost of Goods Sold", value: -pnl.cogs, type: "expense" },
                { label: "Gross Profit", value: pnl.grossProfit, type: "profit", bold: true },
                { label: "Staff Cost", value: -pnl.staffCost, type: "expense" },
                { label: "Utilities", value: -pnl.utilities, type: "expense" },
                { label: "Rent", value: -pnl.rent, type: "expense" },
                { label: "Marketing", value: -pnl.marketing, type: "expense" },
                { label: "Miscellaneous", value: -pnl.misc, type: "expense" },
              ].map(r => (
                <div key={r.label} className={`flex justify-between items-center py-2 border-b border-white/5 last:border-0 ${r.bold ? "font-bold" : ""}`}>
                  <span className={`text-sm ${r.bold ? "text-white" : "text-white/50"}`}>{r.label}</span>
                  <span className={`text-sm font-semibold ${r.type === "revenue" || r.type === "profit" ? "text-emerald-400" : "text-red-400"}`}>
                    {r.value > 0 ? "+" : ""}₹{Math.abs(r.value).toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center py-3 border-t-2 border-amber-500/30 mt-2">
                <span className="text-base font-extrabold text-amber-400">Net Profit</span>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-emerald-400">₹{pnl.netProfit.toLocaleString()}</p>
                  <p className="text-xs text-emerald-400/70">{pnl.margin}% margin</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h2 className="text-sm font-bold mb-4 text-white/70">Revenue Split</h2>
            <div className="space-y-3">
              {[
                { label: "Online Revenue (UPI/Card/NFC)", value: walletData.totalOnlineSales, percent: Math.round((walletData.totalOnlineSales / (walletData.totalOnlineSales + walletData.totalCashSales || 1)) * 100), color: "bg-blue-500" },
                { label: "Cash Revenue", value: walletData.totalCashSales, percent: Math.round((walletData.totalCashSales / (walletData.totalOnlineSales + walletData.totalCashSales || 1)) * 100), color: "bg-emerald-500" },
              ].map(r => (
                <div key={r.label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">{r.label}</span>
                    <span className="font-bold">₹{r.value.toLocaleString()} ({r.percent}%)</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.percent}%` }} />
                  </div>
                </div>
              ))}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Total Revenue", value: `₹${(walletData.totalOnlineSales + walletData.totalCashSales).toLocaleString()}`, color: "text-white" },
                  { label: "Net Profit", value: `₹${pnl.netProfit.toLocaleString()}`, color: "text-emerald-400" },
                  { label: "Tax Collected", value: `₹${walletData.taxCollected.toLocaleString()}`, color: "text-yellow-400" },
                  { label: "Pending Refunds", value: `₹${walletData.pendingRefunds.toLocaleString()}`, color: "text-orange-400" },
                ].map(f => (
                  <div key={f.label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-white/40">{f.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${f.color}`}>{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "wallet" && (
        <div className="bg-[#0e1520] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-bold">Online Payment Transactions</h2>
            <p className="text-xs text-white/40 mt-0.5">Gateway · UTR · Net payout tracking</p>
          </div>
          <div className="divide-y divide-white/5">
            {onlineTxns.map(t => (
              <div key={t.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl shrink-0">{TYPE_CFG[t.type]?.icon || "💰"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold capitalize">{t.type.toUpperCase()} Payment</p>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${t.status === "success" ? "bg-emerald-500/15 text-emerald-400" : "bg-orange-500/15 text-orange-400"}`}>{t.status}</span>
                    </div>
                    <p className="text-xs text-white/40 font-mono mt-0.5">{t.utr} · {t.time}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${t.net > 0 ? "text-emerald-400" : "text-red-400"}`}>{t.net > 0 ? "+" : ""}₹{Math.abs(t.net).toLocaleString()}</p>
                    <p className="text-xs text-white/30">Tax ₹{t.tax} · Fee ₹{t.commission}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "cash-ledger" && (
        <div className="bg-[#0e1520] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-bold">Cash Ledger</h2>
            <p className="text-xs text-white/40 mt-0.5">Separate from online wallet — cash-only tracking</p>
          </div>
          <div className="divide-y divide-white/5">
            {cashLedger.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${entry.amount > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                  {entry.amount > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold capitalize">{entry.type}</p>
                  <p className="text-xs text-white/40">{entry.note} · {entry.date}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${entry.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>{entry.amount > 0 ? "+" : ""}₹{Math.abs(entry.amount).toLocaleString()}</p>
                  <p className="text-xs text-white/30">Bal: ₹{entry.balance.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "settlements" && (
        <div className="space-y-3">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-300">Pending Settlement</p>
              <p className="text-xs text-amber-400/70">₹{walletData.pendingSettlement.toLocaleString()} — estimated transfer pending</p>
            </div>
          </div>
          {settlements.map(s => (
            <div key={s.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${s.status === "completed" ? "bg-emerald-500/15" : "bg-yellow-500/15"}`}>
                {s.status === "completed" ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Clock className="h-5 w-5 text-yellow-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{s.id}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === "completed" ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"}`}>{s.status}</span>
                </div>
                <p className="text-xs text-white/40 mt-0.5">{s.bank} · {s.mode} · UTR: <span className="font-mono">{s.utr}</span></p>
                <p className="text-xs text-white/30 mt-0.5">{s.date}</p>
              </div>
              <p className="text-base font-extrabold text-emerald-400 shrink-0">₹{s.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
