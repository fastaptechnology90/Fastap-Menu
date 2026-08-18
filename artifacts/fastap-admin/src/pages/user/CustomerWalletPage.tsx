import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  WALLET_TYPES, RECHARGE_PRESETS, TRANSFER_RULES,
  walletTypeLabel, canTransfer, totalBalance,
  type WalletTypeId,
} from "@/lib/customerWalletCatalog";
import {
  ChevronLeft, Wallet, ArrowRightLeft, History, TrendingUp, Plus,
  CheckCircle, CreditCard, Smartphone, Building2, ChevronDown,
} from "lucide-react";

type Tab = "wallets" | "recharge" | "history" | "cashback" | "transfer";

function emptyBalances(): Record<WalletTypeId, number> {
  return Object.fromEntries(WALLET_TYPES.map(w => [w.id, 0])) as Record<WalletTypeId, number>;
}

const EMPTY_CASHBACK_SUMMARY = {
  totalEarned: 0,
  totalUsed: 0,
  pendingCashback: 0,
  thisMonthEarned: 0,
  recentEarned: [] as { orderId: string; amount: number; percent: number; date: string }[],
};

const COLOR_MAP: Record<string, string> = {
  emerald: "from-emerald-600/20 to-teal-600/10 border-emerald-500/30 text-emerald-400",
  amber: "from-amber-600/20 to-orange-600/10 border-amber-500/30 text-amber-400",
  blue: "from-blue-600/20 to-cyan-600/10 border-blue-500/30 text-blue-400",
  violet: "from-violet-600/20 to-purple-600/10 border-violet-500/30 text-violet-400",
  pink: "from-pink-600/20 to-rose-600/10 border-pink-500/30 text-pink-400",
  orange: "from-orange-600/20 to-amber-600/10 border-orange-500/30 text-orange-400",
};

export default function CustomerWalletPage() {
  const [, navigate] = useAppLocation();
  const { user, refreshUser } = useUser();

  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("wallets");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<WalletTypeId, number>>(emptyBalances());
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cashbackSummary, setCashbackSummary] = useState(EMPTY_CASHBACK_SUMMARY);
  const [historyFilter, setHistoryFilter] = useState<WalletTypeId | "all">("all");

  const [rechargeAmt, setRechargeAmt] = useState("");
  const [payMethod, setPayMethod] = useState("upi");
  const [transferFrom, setTransferFrom] = useState<WalletTypeId>("cashback");
  const [transferTo, setTransferTo] = useState<WalletTypeId>("main");
  const [transferAmt, setTransferAmt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const w = await publicApi.wallet();
      if (w.balances) setBalances(w.balances);
      else if (w.balance != null) {
        setBalances(prev => ({ ...prev, main: w.balance, cashback: w.cashback ?? prev.cashback }));
      }
      setTransactions(w.transactions ?? []);
      if (w.cashbackSummary) setCashbackSummary(w.cashbackSummary);
    } catch {
      setApiError("Could not load wallet data.");
      setBalances(emptyBalances());
      setTransactions([]);
      setCashbackSummary(EMPTY_CASHBACK_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  const filteredTx = useMemo(() => {
    if (historyFilter === "all") return transactions;
    return transactions.filter(t => (t.walletType ?? "main") === historyFilter);
  }, [transactions, historyFilter]);

  const transferTargets = useMemo(
    () => TRANSFER_RULES[transferFrom] ?? [],
    [transferFrom],
  );

  useEffect(() => {
    if (!transferTargets.includes(transferTo)) {
      setTransferTo(transferTargets[0] ?? "main");
    }
  }, [transferFrom, transferTargets, transferTo]);

  async function handleRecharge() {
    const amt = parseFloat(rechargeAmt);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    try {
      const res = await publicApi.rechargeWallet(amt, payMethod);
      if (res.balances) setBalances(res.balances);
      else setBalances(prev => ({ ...prev, main: prev.main + amt }));
      await refreshUser();
      await loadWallet();
      setSuccessMsg(`₹${amt} added to recharge wallet`);
      setRechargeAmt("");
    } catch {
      toast({ title: "Error", description: "Recharge failed. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  }

  async function handleTransfer() {
    const amt = parseFloat(transferAmt);
    if (!amt || amt <= 0 || !canTransfer(transferFrom, transferTo)) return;
    if (balances[transferFrom] < amt) return;
    setSubmitting(true);
    try {
      const res = await publicApi.walletTransfer({ from: transferFrom, to: transferTo, amount: amt });
      if (res.balances) setBalances(res.balances);
      await refreshUser();
      await loadWallet();
      setSuccessMsg(`₹${amt} transferred to ${walletTypeLabel(transferTo)}`);
      setTransferAmt("");
    } catch {
      toast({ title: "Error", description: "Transfer failed. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Wallet }[] = [
    { id: "wallets", label: "Wallets", icon: Wallet },
    { id: "recharge", label: "Recharge", icon: Plus },
    { id: "history", label: "History", icon: History },
    { id: "cashback", label: "Cashback", icon: TrendingUp },
    { id: "transfer", label: "Transfer", icon: ArrowRightLeft },
  ];

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-white/40">Customer Wallet</p>
            <h1 className="text-base font-bold">My Wallets</h1>
          </div>
        </div>

        <div className="mx-4 mb-3 rounded-2xl bg-gradient-to-br from-emerald-600/20 to-teal-600/10 border border-emerald-500/30 p-4 text-center">
          <p className="text-xs text-white/50">Total Balance</p>
          <p className="text-3xl font-extrabold text-emerald-400">₹{totalBalance(balances).toLocaleString()}</p>
          <p className="text-xs text-white/40 mt-1">{WALLET_TYPES.length} wallet types</p>
        </div>

        {successMsg && (
          <div className="mx-4 mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> {successMsg}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium ${
                tab === t.id ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-200" : "bg-white/5 border border-white/10 text-white/60"
              }`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 space-y-4">
        {loading && <GuestLoading label="Loading wallet…" />}
        {!loading && apiError && (
          <GuestError message={apiError} onRetry={loadWallet} />
        )}
        {!loading && !apiError && tab === "wallets" && (
          <div className="grid gap-3">
            {WALLET_TYPES.map(w => {
              const bal = balances[w.id];
              const grad = COLOR_MAP[w.color] ?? COLOR_MAP.emerald;
              return (
                <div key={w.id} className={`rounded-xl bg-gradient-to-br border p-4 ${grad.split(" ").slice(0, 3).join(" ")}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{w.icon}</span>
                      <div>
                        <h3 className="font-semibold">{w.label}</h3>
                        <p className="text-xs text-white/50 mt-0.5">{w.desc}</p>
                      </div>
                    </div>
                    <p className={`text-xl font-bold ${grad.split(" ").pop()}`}>₹{bal.toLocaleString()}</p>
                  </div>
                  {w.rechargeable && (
                    <button onClick={() => setTab("recharge")} className="mt-3 text-xs text-emerald-300 underline">
                      Recharge this wallet →
                    </button>
                  )}
                  {!w.rechargeable && bal > 0 && TRANSFER_RULES[w.id]?.includes("main") && (
                    <button onClick={() => { setTransferFrom(w.id); setTab("transfer"); }} className="mt-3 text-xs text-white/50 underline">
                      Transfer to recharge wallet →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Recharge */}
        {!loading && !apiError && tab === "recharge" && (
          <>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-sm font-semibold mb-1">Recharge Wallet</p>
              <p className="text-xs text-white/50 mb-4">Add money via UPI, card or net banking</p>
              <div className="flex gap-2 mb-3 flex-wrap">
                {RECHARGE_PRESETS.map(amt => (
                  <button key={amt} onClick={() => setRechargeAmt(String(amt))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border ${rechargeAmt === String(amt) ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "border-white/10 bg-white/5"}`}>
                    ₹{amt}
                  </button>
                ))}
              </div>
              <input type="number" placeholder="Custom amount" value={rechargeAmt} onChange={e => setRechargeAmt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm mb-3" />
              <p className="text-xs text-white/40 mb-2">Payment method</p>
              <div className="flex gap-2 mb-4">
                {[
                  { id: "upi", label: "UPI", icon: Smartphone },
                  { id: "card", label: "Card", icon: CreditCard },
                  { id: "netbanking", label: "Net Banking", icon: Building2 },
                ].map(m => (
                  <button key={m.id} onClick={() => setPayMethod(m.id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs ${payMethod === m.id ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}>
                    <m.icon className="h-4 w-4" /> {m.label}
                  </button>
                ))}
              </div>
              <button onClick={handleRecharge} disabled={submitting || !rechargeAmt}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold disabled:opacity-50">
                {submitting ? "Processing..." : `Add ₹${rechargeAmt || "0"} to Wallet`}
              </button>
            </div>
          </>
        )}

        {/* Transaction History */}
        {!loading && !apiError && tab === "history" && (
          <>
            <div className="flex items-center gap-2">
              <select value={historyFilter} onChange={e => setHistoryFilter(e.target.value as WalletTypeId | "all")}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm">
                <option value="all">All wallets</option>
                {WALLET_TYPES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
              <ChevronDown className="h-4 w-4 text-white/30 -ml-8 pointer-events-none" />
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5">
              {filteredTx.length === 0 ? (
                <p className="p-6 text-center text-sm text-white/40">No transactions yet</p>
              ) : filteredTx.map((t, i) => {
                const amt = parseFloat(String(t.amount));
                const isCredit = amt >= 0;
                return (
                  <div key={t.id ?? i} className="flex items-center gap-3 p-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isCredit ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                      <span className="text-lg">{WALLET_TYPES.find(w => w.id === (t.walletType ?? "main"))?.icon ?? "💳"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{t.description || t.type}</p>
                      <p className="text-xs text-white/40">
                        {walletTypeLabel((t.walletType ?? "main") as WalletTypeId)} · {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${isCredit ? "text-emerald-400" : "text-red-400"}`}>
                      {isCredit ? "+" : ""}₹{Math.abs(amt).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Cashback Tracking */}
        {!loading && !apiError && tab === "cashback" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Cashback Balance", value: balances.cashback, color: "text-amber-400" },
                { label: "Total Earned", value: cashbackSummary.totalEarned, color: "text-emerald-400" },
                { label: "Total Used", value: cashbackSummary.totalUsed, color: "text-red-400" },
                { label: "This Month", value: cashbackSummary.thisMonthEarned, color: "text-violet-400" },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                  <p className="text-xs text-white/40">{s.label}</p>
                  <p className={`text-xl font-bold mt-1 ${s.color}`}>₹{s.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
            {cashbackSummary.pendingCashback > 0 && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-200">
                ₹{cashbackSummary.pendingCashback} pending cashback from recent orders
              </div>
            )}
            <div className="rounded-xl bg-white/5 border border-white/10">
              <div className="p-4 border-b border-white/5">
                <p className="text-sm font-semibold">Recent Cashback Earned</p>
              </div>
              {(cashbackSummary.recentEarned ?? []).length === 0 ? (
                <p className="p-4 text-sm text-white/40">No cashback earned yet</p>
              ) : cashbackSummary.recentEarned.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm">{c.orderId}</p>
                    <p className="text-xs text-white/40">{new Date(c.date).toLocaleDateString()} · {c.percent}% cashback</p>
                  </div>
                  <span className="text-emerald-400 font-bold">+₹{c.amount}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Wallet Transfer */}
        {!loading && !apiError && tab === "transfer" && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-4">
            <p className="text-sm font-semibold">Transfer Between Wallets</p>
            <p className="text-xs text-white/50">Move balance between your wallet types</p>

            <div>
              <label className="text-xs text-white/40">From</label>
              <select value={transferFrom} onChange={e => setTransferFrom(e.target.value as WalletTypeId)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm">
                {WALLET_TYPES.filter(w => w.id !== "main" && (TRANSFER_RULES[w.id]?.length ?? 0) > 0).map(w => (
                  <option key={w.id} value={w.id}>{w.icon} {w.label} (₹{balances[w.id]})</option>
                ))}
                <option value="main">💳 Recharge Wallet (₹{balances.main})</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-white/40">To</label>
              <select value={transferTo} onChange={e => setTransferTo(e.target.value as WalletTypeId)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm">
                {transferTargets.map(id => {
                  const w = WALLET_TYPES.find(x => x.id === id)!;
                  return <option key={id} value={id}>{w.icon} {w.label}</option>;
                })}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/40">Amount (max ₹{balances[transferFrom]})</label>
              <input type="number" value={transferAmt} onChange={e => setTransferAmt(e.target.value)}
                max={balances[transferFrom]} placeholder="Enter amount"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            {!canTransfer(transferFrom, transferTo) && (
              <p className="text-xs text-red-400">This transfer is not allowed</p>
            )}

            <button onClick={handleTransfer}
              disabled={submitting || !transferAmt || !canTransfer(transferFrom, transferTo) || parseFloat(transferAmt) > balances[transferFrom]}
              className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-600 font-semibold disabled:opacity-50">
              {submitting ? "Transferring..." : `Transfer ₹${transferAmt || "0"}`}
            </button>

            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-white/40 mb-2">Allowed transfers</p>
              <ul className="text-xs text-white/50 space-y-1">
                <li>Cashback, Refund, Reward, Gift, Membership → Recharge wallet</li>
                <li>Reward → Gift wallet</li>
                <li>Recharge → other wallets (top-up credits)</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
