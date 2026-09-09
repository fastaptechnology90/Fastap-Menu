import { useState, useEffect } from "react";
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, AlertCircle, Download, CreditCard, Banknote, DollarSign, BarChart3, BookOpen, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { finance as financeApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { RevenueByDate } from "@/components/restaurant/RevenueByDate";
import { publicationEmptyMessage } from "@/lib/restaurantPublication";
import type { SettlementRow, OnlineTxnRow, CashLedgerRow } from "@/lib/restaurant-types";

type Tab = "overview" | "wallet" | "cash-ledger" | "settlements" | "reports";

const TYPE_CFG: Record<string, { icon: LucideIcon; color: string }> = {
  upi:  { icon: Smartphone, color: "text-info" },
  card: { icon: CreditCard, color: "text-muted-foreground" },
  cash: { icon: Banknote, color: "text-success" },
  wallet: { icon: Wallet, color: "text-primary" },
};

export default function FinanceWallet() {
  const { restaurantId, restaurant, isRestaurantPublished } = useRestaurant();
  const [tab, setTab] = useState<Tab>("overview");
  const [walletData, setWalletData] = useState({ onlineBalance: 0, pendingSettlement: 0, lockedBalance: 0, reserveBalance: 0, totalCashSales: 0, totalOnlineSales: 0, taxCollected: 0, pendingRefunds: 0 });
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [onlineTxns, setOnlineTxns] = useState<OnlineTxnRow[]>([]);
  const [selTxn, setSelTxn] = useState<OnlineTxnRow | null>(null);
  const [cashLedger, setCashLedger] = useState<CashLedgerRow[]>([]);
  const [pnl, setPnl] = useState({ revenue: 0, cogs: 0, grossProfit: 0, staffCost: 0, utilities: 0, rent: 0, marketing: 0, misc: 0, netProfit: 0, margin: 0 });
  // True only when the finance API actually returns an expense breakdown; otherwise the expense lines are shown as "—" instead of a fabricated ₹0.
  const [expensesTracked, setExpensesTracked] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!restaurantId) return;
    setExporting(true);
    try { await financeApi.exportCsv(restaurantId); } catch {} finally { setExporting(false); }
  }

  useEffect(() => {
    if (!restaurantId) return;
    // Always fetch — the API is the source of truth and already returns zeros for a genuinely
    // unpublished restaurant. (Gating here on the context flag showed ₹0 whenever that flag
    // was briefly stale after login, even though the data was available.)
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
        const p: any = data.pnl;
        const revenue = p.revenue ?? 0;
        // Read expense lines from the API if it provides them; otherwise they stay 0 (not fabricated).
        const cogs = p.cogs ?? p.costOfGoodsSold ?? 0;
        const staffCost = p.staffCost ?? p.staff ?? 0;
        const utilities = p.utilities ?? 0;
        const rent = p.rent ?? 0;
        const marketing = p.marketing ?? 0;
        const misc = p.misc ?? p.miscellaneous ?? 0;
        setPnl({
          revenue,
          cogs,
          staffCost,
          utilities,
          rent,
          marketing,
          misc,
          grossProfit: p.grossProfit ?? (revenue - cogs),
          netProfit: p.netProfit ?? 0,
          margin: p.margin ?? 0,
        });
        const expenseKeys = ["cogs", "costOfGoodsSold", "staffCost", "staff", "utilities", "rent", "marketing", "misc", "miscellaneous"];
        setExpensesTracked(expenseKeys.some(k => p[k] != null) || [cogs, staffCost, utilities, rent, marketing, misc].some(v => v > 0));
      }
      // Zeroed money figures are indistinguishable from a quiet day, so say when
      // they are actually missing.
    }).catch(e => toast({ title: "Could not load your profit and loss figures", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
  }, [restaurantId, isRestaurantPublished]);

  // Do we actually have finance data? Drives the "unavailable" banner instead of the
  // (sometimes stale) context flag, so a published restaurant never shows the banner.
  const hasFinanceData = walletData.totalOnlineSales > 0 || walletData.totalCashSales > 0 || onlineTxns.length > 0 || pnl.revenue > 0;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Finance & Wallet</h1>
          <p className="text-xs text-muted-foreground">Fastap wallet, settlements, P&L & cash ledger</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 bg-muted hover-elevate text-foreground font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
          <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export"}
        </button>
      </div>

      <RevenueByDate restaurantId={restaurantId} title="Revenue" />

      {!isRestaurantPublished && !hasFinanceData && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <p className="text-sm font-semibold text-primary">Finance analytics unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      {/* Wallet Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Online Wallet", value: `₹${walletData.onlineBalance.toLocaleString()}`, icon: Wallet, color: "text-success", bg: "bg-success-subtle", desc: "Gateway received" },
          { label: "Pending Settlement", value: `₹${walletData.pendingSettlement.toLocaleString()}`, icon: Clock, color: "text-warning", bg: "bg-warning-subtle", desc: "Awaiting transfer" },
          { label: "Locked Balance", value: `₹${walletData.lockedBalance.toLocaleString()}`, icon: AlertCircle, color: "text-warning", bg: "bg-warning-subtle", desc: "Refund/chargeback hold" },
          { label: "Cash Sales (MTD)", value: `₹${walletData.totalCashSales.toLocaleString()}`, icon: Banknote, color: "text-info", bg: "bg-info-subtle", desc: "Cash ledger total" },
        ].map(s => (
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto w-fit">
        {[
          { id: "overview", label: "P&L", icon: BarChart3 },
          { id: "wallet", label: "Online Txns", icon: Wallet },
          { id: "cash-ledger", label: "Cash Ledger", icon: Banknote },
          { id: "settlements", label: "Settlements", icon: CheckCircle },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-1 text-foreground">Profit & Loss (MTD)</h2>
            {!expensesTracked && (
              <p className="text-xs text-muted-foreground mb-3">Expense breakdown (COGS, staff, rent…) isn't returned by the finance API yet — showing revenue &amp; net profit only.</p>
            )}
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
                <div key={r.label} className={`flex justify-between items-center py-2 border-b border-border last:border-0 ${r.bold ? "font-semibold" : ""}`}>
                  <span className={`text-sm ${r.bold ? "text-foreground" : "text-muted-foreground"}`}>{r.label}</span>
                  {r.type === "expense" && r.value === 0 && !expensesTracked ? (
                    <span className="text-sm font-semibold text-muted-foreground" title="Not provided by the finance API">—</span>
                  ) : (
                    <span className={`text-sm font-semibold ${r.type === "revenue" || r.type === "profit" ? "text-success" : "text-danger"}`}>
                      {r.value > 0 ? "+" : ""}₹{Math.abs(r.value).toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
              <div className="flex justify-between items-center py-3 border-t-2 border-primary/30 mt-2">
                <span className="text-base font-semibold text-primary">Net Profit</span>
                <div className="text-right">
                  <p className="text-lg font-semibold text-success">₹{pnl.netProfit.toLocaleString()}</p>
                  <p className="text-xs text-success">{pnl.margin}% margin</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-4 text-foreground">Revenue Split</h2>
            <div className="space-y-3">
              {[
                { label: "Online Revenue (UPI/Card/NFC)", value: walletData.totalOnlineSales, percent: Math.round((walletData.totalOnlineSales / (walletData.totalOnlineSales + walletData.totalCashSales || 1)) * 100), color: "bg-info" },
                { label: "Cash Revenue", value: walletData.totalCashSales, percent: Math.round((walletData.totalCashSales / (walletData.totalOnlineSales + walletData.totalCashSales || 1)) * 100), color: "bg-success" },
              ].map(r => (
                <div key={r.label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-semibold">₹{r.value.toLocaleString()} ({r.percent}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.percent}%` }} />
                  </div>
                </div>
              ))}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Total Revenue", value: `₹${(walletData.totalOnlineSales + walletData.totalCashSales).toLocaleString()}`, color: "text-foreground" },
                  { label: "Net Profit", value: `₹${pnl.netProfit.toLocaleString()}`, color: "text-success" },
                  { label: "Tax Collected", value: `₹${walletData.taxCollected.toLocaleString()}`, color: "text-warning" },
                  { label: "Pending Refunds", value: `₹${walletData.pendingRefunds.toLocaleString()}`, color: "text-warning" },
                ].map(f => (
                  <div key={f.label} className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className={`text-sm font-semibold mt-0.5 ${f.color}`}>{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "wallet" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold">Online Payment Transactions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Gateway · UTR · Net payout tracking</p>
          </div>
          <div className="divide-y divide-border">
            {onlineTxns.map(t => (
              <div key={t.id} onClick={() => setSelTxn(t)} className="px-4 py-3 cursor-pointer hover:bg-muted transition-colors" title="Click for payment details">
                <div className="flex items-center gap-3">
                  {(() => { const MethodIcon = TYPE_CFG[t.type]?.icon || Wallet; return <MethodIcon className={`h-5 w-5 shrink-0 ${TYPE_CFG[t.type]?.color || "text-muted-foreground"}`} />; })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold capitalize">{t.type.toUpperCase()} Payment</p>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${t.status === "success" ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning"}`}>{t.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.utr} · {t.time}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${t.net > 0 ? "text-success" : "text-danger"}`}>{t.net > 0 ? "+" : ""}₹{Math.abs(t.net).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Tax ₹{t.tax} · Fee ₹{t.commission}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "cash-ledger" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold">Cash Ledger</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Separate from online wallet — cash-only tracking</p>
          </div>
          <div className="divide-y divide-border">
            {cashLedger.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${entry.amount > 0 ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}>
                  {entry.amount > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold capitalize">{entry.type}</p>
                  <p className="text-xs text-muted-foreground">{entry.note} · {entry.date}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${entry.amount > 0 ? "text-success" : "text-danger"}`}>{entry.amount > 0 ? "+" : ""}₹{Math.abs(entry.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Bal: ₹{entry.balance.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "settlements" && (
        <div className="space-y-3">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-primary">Pending Settlement</p>
              <p className="text-xs text-primary">₹{walletData.pendingSettlement.toLocaleString()} — estimated transfer pending</p>
            </div>
          </div>
          {settlements.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${s.status === "completed" ? "bg-success-subtle" : "bg-warning-subtle"}`}>
                {s.status === "completed" ? <CheckCircle className="h-5 w-5 text-success" /> : <Clock className="h-5 w-5 text-warning" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{s.id}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === "completed" ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning"}`}>{s.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{s.bank} · {s.mode} · UTR: <span className="font-mono">{s.utr}</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.date}</p>
              </div>
              <p className="text-base font-semibold text-success shrink-0">₹{s.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {selTxn && (
        <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelTxn(null)}>
          <div className="w-full max-w-sm bg-card rounded-lg border border-border text-foreground max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Payment details</h3>
              <button onClick={() => setSelTxn(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="text-center py-2">
                <p className="text-3xl font-semibold text-primary">₹{Number(selTxn.amount).toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{selTxn.id}</p>
              </div>
              {[
                ["Payment method", String(selTxn.type || "—").toUpperCase()],
                ["UPI ID", selTxn.upiId || "—"],
                ["UTR / Reference", selTxn.utr || "—"],
                ["Collected by", selTxn.collectedBy || "—"],
                ["From panel", selTxn.collectedFrom || "—"],
                ["Customer", selTxn.customerName || "—"],
                ["Table / Room", selTxn.tableName || "—"],
                ["Gateway", selTxn.gateway || "—"],
                ["Net payout", `₹${Number(selTxn.net).toLocaleString("en-IN")}`],
                ["Commission", `₹${Number(selTxn.commission).toLocaleString("en-IN")}`],
                ["Time", selTxn.time || "—"],
                ["Status", selTxn.status || "—"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b border-border pb-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-right break-all">{v as string}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
