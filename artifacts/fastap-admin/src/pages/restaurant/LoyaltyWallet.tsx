import { useState, useEffect } from "react";
import { Gift, Wallet, Star, Crown, Plus, Tag, CreditCard, Repeat, Users, TrendingUp, X } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { loyalty as loyaltyApi, customers as customersApi, promoCodesApi } from "@/lib/api";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { useToast } from "@/hooks/use-toast";

type Tab = "loyalty" | "wallet" | "coupons" | "gift-cards";

type MemberRow = { id: string; name: string; mobile: string; tier: string; points: number; walletBalance: number; cashback: number; visits: number; totalSpend: number };
type CouponRow = { code: string; discount: string; type: string; minOrder: number; maxDiscount: number; used: number; total: number; expiry: string; status: string };
type GiftCardRow = { code: string; amount: number; remaining: number; purchasedBy: string; status: string; expiry: string };
type WalletTxnRow = { type: string; desc: string; amount: number; date: string };

const TIER_CFG: Record<string, { label: string; icon: string; color: string; bg: string; pointsReq: string }> = {
  silver:      { label: "Silver",    icon: "🥈", color: "text-slate-300",  bg: "bg-slate-500/20",  pointsReq: "0 - 999 pts" },
  gold:        { label: "Gold",      icon: "🥇", color: "text-yellow-400", bg: "bg-yellow-500/20", pointsReq: "1000 - 2999 pts" },
  platinum:    { label: "Platinum",  icon: "💎", color: "text-violet-400", bg: "bg-violet-500/20", pointsReq: "3000 - 5999 pts" },
  "vip-elite": { label: "VIP Elite", icon: "👑", color: "text-orange-400", bg: "bg-orange-500/20", pointsReq: "6000+ pts" },
};


export default function LoyaltyWallet() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("loyalty");
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [walletTxns, setWalletTxns] = useState<WalletTxnRow[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCardRow[]>([]);
  const [newCoupon, setNewCoupon] = useState({ code: "", discountValue: "", minOrder: "", expiry: "" });
  const [program, setProgram] = useState<any>(null);
  const [pointsFor, setPointsFor] = useState<MemberRow | null>(null);
  const [pointsToAdd, setPointsToAdd] = useState("");
  const [savingPoints, setSavingPoints] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      customersApi.list(restaurantId).catch(() => []),
      promoCodesApi.list(restaurantId).catch(() => []),
      loyaltyApi.transactions(restaurantId).catch(() => []),
      loyaltyApi.giftCards(restaurantId).catch(() => []),
    ]).then(([custData, promoData, txnData, giftData]) => {
      if (Array.isArray(custData) && custData.length > 0) {
        setMembers(custData.map((m: any) => ({
          id: String(m.id),
          name: m.name || "Guest",
          mobile: m.phone || "",
          tier: m.segment === "vip" ? "vip-elite" : m.segment === "loyal" ? "platinum" : m.segment === "regular" ? "gold" : "silver",
          points: m.loyaltyPoints ?? 0,
          walletBalance: parseFloat(String(m.walletBalance ?? 0)),
          cashback: 0,
          visits: m.totalOrders ?? 0,
          totalSpend: parseFloat(String(m.totalSpend ?? 0)),
        })));
      }
      if (Array.isArray(promoData) && promoData.length > 0) {
        setCoupons(promoData.map((p: any) => ({
          code: p.code,
          discount: p.discountType === "percent" ? `${p.discountValue}% off` : p.discountType === "fixed" ? `₹${p.discountValue} off` : String(p.discountValue),
          type: p.discountType || "percent",
          minOrder: parseFloat(String(p.minOrderAmount ?? 0)),
          maxDiscount: parseFloat(String(p.maxDiscount ?? p.discountValue ?? 0)),
          used: p.usageCount ?? 0,
          total: p.usageLimit ?? 100,
          expiry: p.expiresAt ? new Date(p.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No expiry",
          status: p.status || (p.isActive ? "active" : "inactive"),
        })));
      }
      if (Array.isArray(txnData) && txnData.length > 0) {
        setWalletTxns(txnData.map((t: any) => ({
          type: t.type === "redeem" || parseFloat(String(t.points ?? 0)) < 0 ? "debit" : "credit",
          desc: t.customerName ? `${t.type} — ${t.customerName}` : String(t.type),
          amount: t.cashback ? parseFloat(String(t.cashback)) : (parseFloat(String(t.points ?? 0)) || 0),
          date: t.createdAt ? new Date(t.createdAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "—",
        })));
      }
      if (Array.isArray(giftData) && giftData.length > 0) setGiftCards(giftData);
    });
    loyaltyApi.program(restaurantId).then(p => setProgram(p)).catch(() => setProgram(null));
  }, [restaurantId]);

  const totalPoints = members.reduce((s, m) => s + m.points, 0);
  const totalWallet = members.reduce((s, m) => s + m.walletBalance, 0);
  const activeCoupons = coupons.filter(c => c.status === "active").length;
  const activeGiftCards = giftCards.filter(g => g.status === "active").length;

  async function handleCreateCoupon() {
    if (!restaurantId || !newCoupon.code) return;
    const val = parseFloat(newCoupon.discountValue) || 0;
    try {
      await promoCodesApi.create(restaurantId, {
        code: newCoupon.code.toUpperCase(),
        discountType: newCoupon.discountValue.includes("%") ? "percent" : "fixed",
        discountValue: val,
        minOrderAmount: parseFloat(newCoupon.minOrder) || 0,
        expiresAt: newCoupon.expiry || undefined,
      });
      const rows = await promoCodesApi.list(restaurantId);
      if (Array.isArray(rows)) {
        setCoupons(rows.map((p: any) => ({
          code: p.code,
          discount: p.discountType === "percent" ? `${p.discountValue}% off` : `₹${p.discountValue} off`,
          type: p.discountType || "percent",
          minOrder: parseFloat(String(p.minOrderAmount ?? 0)),
          maxDiscount: parseFloat(String(p.maxDiscount ?? p.discountValue ?? 0)),
          used: p.usageCount ?? 0,
          total: p.usageLimit ?? 100,
          expiry: p.expiresAt ? new Date(p.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No expiry",
          status: p.status || (p.isActive ? "active" : "inactive"),
        })));
      }
      setNewCoupon({ code: "", discountValue: "", minOrder: "", expiry: "" });
      setShowAdd(false);
      toast({ title: "Coupon created", description: `“${newCoupon.code.toUpperCase()}” is now available.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to create coupon", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  // Add loyalty points to a member — backed by PUT /customers/:id (loyaltyPoints)
  async function handleAddPoints() {
    if (!restaurantId || !pointsFor) return;
    const add = parseInt(pointsToAdd, 10);
    if (!add || Number.isNaN(add)) {
      toast({ title: "Enter a point value", description: "Type how many points to add (or a negative number to deduct).", variant: "destructive" });
      return;
    }
    const newTotal = Math.max(0, pointsFor.points + add);
    setSavingPoints(true);
    try {
      await customersApi.update(restaurantId, Number(pointsFor.id), { loyaltyPoints: newTotal });
      setMembers(prev => prev.map(m => m.id === pointsFor.id ? { ...m, points: newTotal } : m));
      setSelectedMember(prev => prev && prev.id === pointsFor.id ? { ...prev, points: newTotal } : prev);
      toast({ title: "Points updated", description: `${pointsFor.name} now has ${newTotal.toLocaleString()} pts.` });
      setPointsFor(null);
      setPointsToAdd("");
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to update points", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingPoints(false);
    }
  }

  // No per-member wallet-balance endpoint exists (customers PUT does not accept walletBalance).
  function handleAddWallet() {
    toast({
      title: "Wallet top-up unavailable",
      description: "There's no per-member wallet API yet. Guests recharge their own wallet from the customer app.",
    });
  }

  const filtered = members.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.mobile.includes(search)
  );

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Loyalty & Wallet</h1>
          <p className="text-xs text-white/40">Memberships, points, wallet & coupons</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
          <Plus className="h-4 w-4" /> New Coupon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Points Issued", value: totalPoints.toLocaleString(), icon: Star, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Total Wallet Balance", value: `₹${totalWallet.toLocaleString()}`, icon: Wallet, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Active Coupons", value: activeCoupons, icon: Tag, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Gift Cards Active", value: activeGiftCards, icon: Gift, color: "text-violet-400", bg: "bg-violet-500/10" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5" /></div>
            <div>
              <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-white/40">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 overflow-x-auto w-fit">
        {[
          { id: "loyalty", label: "Members", icon: Crown },
          { id: "wallet", label: "Wallet Ledger", icon: Wallet },
          { id: "coupons", label: "Coupons", icon: Tag },
          { id: "gift-cards", label: "Gift Cards", icon: Gift },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-amber-500 text-black" : "text-white/50 hover:text-white"}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "loyalty" && program && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold">
            <Star className="h-3.5 w-3.5 text-amber-400" />
            Loyalty Program
            <span className={`px-2 py-0.5 rounded-full font-semibold ${program.isEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"}`}>{program.isEnabled ? "Enabled" : "Disabled"}</span>
          </span>
          {program.type && <span className="text-white/50">Type: <span className="text-white/80 font-semibold capitalize">{String(program.type)}</span></span>}
          {program.pointsPerDollar != null && <span className="text-white/50">Earn <span className="text-amber-400 font-semibold">{Number(program.pointsPerDollar)}</span> pts / ₹</span>}
          {program.cashbackPercent != null && Number(program.cashbackPercent) > 0 && <span className="text-white/50">Cashback <span className="text-emerald-400 font-semibold">{Number(program.cashbackPercent)}%</span></span>}
          {program.expiryDays != null && Number(program.expiryDays) > 0 && <span className="text-white/50">Points expire in <span className="text-white/80 font-semibold">{Number(program.expiryDays)}d</span></span>}
        </div>
      )}

      {tab === "loyalty" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50" />
            {filtered.length === 0 ? <EmptyState title="No members yet" description="Customer loyalty data appears when guests register." /> : filtered.map(m => {
              const tier = TIER_CFG[m.tier];
              return (
                <button key={m.id} onClick={() => setSelectedMember(m)} className={`w-full text-left bg-[#0e1520] border rounded-2xl p-4 transition-all hover:border-white/15 ${selectedMember?.id === m.id ? "border-amber-500/40" : "border-white/5"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl ${tier.bg} flex items-center justify-center text-lg shrink-0`}>{tier.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{m.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tier.bg} ${tier.color}`}>{tier.label}</span>
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">{m.mobile}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-amber-400">{m.points.toLocaleString()} pts</p>
                      <p className="text-xs text-white/40">₹{m.walletBalance.toLocaleString()} wallet</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
            {selectedMember ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl ${TIER_CFG[selectedMember.tier].bg} flex items-center justify-center text-2xl`}>{TIER_CFG[selectedMember.tier].icon}</div>
                  <div>
                    <p className="text-sm font-bold">{selectedMember.name}</p>
                    <p className={`text-xs font-semibold ${TIER_CFG[selectedMember.tier].color}`}>{TIER_CFG[selectedMember.tier].label} Member</p>
                  </div>
                </div>
                {[
                  { label: "Reward Points", value: `${selectedMember.points.toLocaleString()} pts`, color: "text-amber-400" },
                  { label: "Wallet Balance", value: `₹${selectedMember.walletBalance.toLocaleString()}`, color: "text-blue-400" },
                  { label: "Total Cashback", value: `₹${selectedMember.cashback}`, color: "text-emerald-400" },
                  { label: "Total Visits", value: selectedMember.visits, color: "text-white" },
                  { label: "Total Spend", value: `₹${selectedMember.totalSpend.toLocaleString()}`, color: "text-white" },
                ].map(f => (
                  <div key={f.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <span className="text-xs text-white/40">{f.label}</span>
                    <span className={`text-sm font-semibold ${f.color}`}>{f.value}</span>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={() => { setPointsFor(selectedMember); setPointsToAdd(""); }} className="py-2 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-all">Add Points</button>
                  <button onClick={handleAddWallet} title="No per-member wallet API yet" className="py-2 rounded-xl bg-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/30 transition-all">Add Wallet</button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Crown className="h-8 w-8 text-amber-400/40 mx-auto mb-2" />
                <p className="text-sm text-white/30">Select a member to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "wallet" && (
        <div className="bg-[#0e1520] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-bold">Wallet Ledger</h2>
            <p className="text-xs text-white/40 mt-0.5">All wallet credits & debits</p>
          </div>
          <div className="divide-y divide-white/5">
            {walletTxns.length === 0 ? <EmptyState title="No wallet transactions" /> : walletTxns.map((txn, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${txn.type === "credit" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                  {txn.type === "credit" ? <Plus className="h-4 w-4" /> : <TrendingUp className="h-4 w-4 rotate-180" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{txn.desc}</p>
                  <p className="text-xs text-white/30">{txn.date}</p>
                </div>
                <p className={`text-sm font-bold ${txn.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>{txn.amount > 0 ? "+" : ""}₹{Math.abs(txn.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "coupons" && (
        <div className="space-y-3">
          {coupons.length === 0 ? <EmptyState title="No coupons" description="Create a promo code to get started." /> : coupons.map(c => (
            <div key={c.code} className={`bg-[#0e1520] border rounded-2xl p-4 ${c.status === "expired" ? "opacity-50 border-white/5" : "border-white/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center"><Tag className="h-5 w-5 text-emerald-400" /></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold font-mono">{c.code}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{c.status}</span>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">{c.discount} · Min order ₹{c.minOrder} · Expires {c.expiry}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-emerald-400">{c.used}/{c.total} used</p>
                  <div className="mt-1 h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(c.used / c.total) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "gift-cards" && (
        <div className="space-y-3">
          {giftCards.length === 0 ? <EmptyState title="No gift cards" /> : giftCards.map(g => (
            <div key={g.code} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0"><Gift className="h-6 w-6 text-violet-400" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold font-mono">{g.code}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${g.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}`}>{g.status}</span>
                </div>
                <p className="text-xs text-white/40 mt-0.5">Purchased by {g.purchasedBy} · Expires {g.expiry}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-violet-400">₹{g.remaining.toLocaleString()} left</p>
                <p className="text-xs text-white/30">of ₹{g.amount.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5"><h2 className="text-base font-bold">Create Coupon</h2><button onClick={() => setShowAdd(false)} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center"><X className="h-4 w-4" /></button></div>
            <div className="space-y-4">
              {[
                { label: "Coupon Code", key: "code" as const, placeholder: "e.g. FLAT20" },
                { label: "Discount Value", key: "discountValue" as const, placeholder: "e.g. 20 or 100" },
                { label: "Min Order Amount", key: "minOrder" as const, placeholder: "e.g. 500" },
                { label: "Expiry Date", key: "expiry" as const, placeholder: "YYYY-MM-DD" },
              ].map(f => (
                <div key={f.label}><label className="text-xs text-white/50 font-semibold uppercase tracking-wide mb-1.5 block">{f.label}</label><input value={newCoupon[f.key]} onChange={e => setNewCoupon(c => ({ ...c, [f.key]: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50" placeholder={f.placeholder} /></div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-semibold">Cancel</button>
                <button onClick={handleCreateCoupon} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm">Create Coupon</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pointsFor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Adjust Loyalty Points</h2>
              <button onClick={() => setPointsFor(null)} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-white/50 mb-4">{pointsFor.name} currently has <span className="text-amber-400 font-semibold">{pointsFor.points.toLocaleString()} pts</span>.</p>
            <label className="text-xs text-white/50 font-semibold uppercase tracking-wide mb-1.5 block">Points to add (use negative to deduct)</label>
            <input
              type="number"
              value={pointsToAdd}
              onChange={e => setPointsToAdd(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
              placeholder="e.g. 100 or -50"
            />
            {pointsToAdd && !Number.isNaN(parseInt(pointsToAdd, 10)) && (
              <p className="text-xs text-white/40 mt-2">New balance: <span className="text-amber-400 font-semibold">{Math.max(0, pointsFor.points + parseInt(pointsToAdd, 10)).toLocaleString()} pts</span></p>
            )}
            <div className="flex gap-3 pt-4">
              <button onClick={() => setPointsFor(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-semibold">Cancel</button>
              <button onClick={handleAddPoints} disabled={savingPoints || !pointsToAdd} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm disabled:opacity-40">{savingPoints ? "Saving…" : "Update Points"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
