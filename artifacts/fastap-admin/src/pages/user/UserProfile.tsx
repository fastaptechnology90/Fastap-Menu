import { useState, useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { GuestHeader } from "@/components/user/GuestUI";
import { useGuestBack } from "@/hooks/useGuestBack";
import { useGuestNavigate } from "@/hooks/useGuestNavigate";
import { publicApi } from "@/lib/api";
import {
  ChevronLeft, ChevronRight, Wallet, Star, Gift, Crown,
  History, Heart, LogOut, Plus, ArrowUpRight, ArrowDownLeft,
  Bell, Shield, Globe, Headphones, Award, Zap, Brain, Wifi, Smartphone, Monitor, Film,
} from "lucide-react";

const TIER_CONFIG = {
  silver: { label: "Silver", color: "from-slate-400 to-slate-300", icon: "🥈", nextTier: "Gold", nextAt: 2000, perks: ["5% cashback", "Priority queue", "Birthday reward"] },
  gold: { label: "Gold", color: "from-yellow-500 to-amber-400", icon: "🥇", nextTier: "Platinum", nextAt: 5000, perks: ["10% cashback", "Free delivery", "Monthly voucher", "VIP seating"] },
  platinum: { label: "Platinum", color: "from-violet-400 to-purple-300", icon: "💎", nextTier: "Diamond", nextAt: 12000, perks: ["15% cashback", "Chef's table", "Concierge service", "Free dessert"] },
  diamond: { label: "Diamond", color: "from-cyan-400 to-blue-400", icon: "💠", nextTier: "VIP Elite", nextAt: 25000, perks: ["20% cashback", "Private dining", "Personal chef", "Unlimited upgrades"] },
  "vip-elite": { label: "VIP Elite", color: "from-orange-400 to-rose-400", icon: "👑", nextTier: null, nextAt: null, perks: ["25% cashback", "All perks unlocked", "Dedicated manager", "Complimentary stays"] },
};

type OrderHistoryRow = {
  id: string;
  restaurant: string;
  items: string;
  date: string;
  total: number;
  status: string;
  rawItems?: unknown[];
};

type WalletTxRow = {
  type: string;
  label: string;
  amount: number;
  date: string;
  icon: typeof Gift;
};

type Tab = "overview" | "wallet" | "orders" | "settings";

export default function UserProfile() {
  const [, navigate] = useAppLocation();
  const goGuest = useGuestNavigate();
  const goBack = useGuestBack();
  const { user, setUser, refreshUser, reorderFromOrder, favorites, repeatFavorite, venue } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmt, setRechargeAmt] = useState("");
  const [ordersHistory, setOrdersHistory] = useState<OrderHistoryRow[]>([]);
  const [walletTx, setWalletTx] = useState<WalletTxRow[]>([]);

  useEffect(() => {
    publicApi.myOrders().then(list => {
      setOrdersHistory(list.map((o: { id: number; items?: { name: string }[]; createdAt: string; total?: number; status: string; restaurantName?: string }) => ({
        id: `ORD-${o.id}`,
        restaurant: o.restaurantName ?? venue.restaurantName,
        items: (Array.isArray(o.items) ? o.items : []).map(i => i.name).join(", "),
        date: new Date(o.createdAt).toLocaleString(),
        total: parseFloat(String(o.total ?? 0)),
        status: o.status,
        rawItems: o.items,
      })));
    }).catch(() => setOrdersHistory([]));
    publicApi.wallet().then(w => {
      setWalletTx((w.transactions ?? []).map((t: { amount: number; description?: string; type: string; createdAt: string }) => ({
        type: parseFloat(String(t.amount)) >= 0 ? "credit" : "debit",
        label: t.description || t.type,
        amount: Math.abs(parseFloat(String(t.amount))),
        date: new Date(t.createdAt).toLocaleDateString(),
        icon: t.type === "recharge" ? Plus : Gift,
      })));
    }).catch(() => setWalletTx([]));
  }, [user, venue.restaurantName]);

  if (!user) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-white pb-24">
        <GuestHeader title="My profile" onBack={goBack} />
        <div className="px-4 py-12 text-center">
          <p className="text-white/50 text-sm mb-6">Sign in to view your profile, orders, and wallet.</p>
          <button type="button" onClick={() => navigate("/user/auth")} className="guest-btn-primary px-8 py-3 text-sm">
            Guest Sign In
          </button>
        </div>
      </div>
    );
  }

  const profile = user;
  const tierCfg = TIER_CONFIG[profile.tier];
  const progressToNext = tierCfg.nextAt ? Math.min(100, (profile.points / tierCfg.nextAt) * 100) : 100;

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <GuestHeader title="My profile" subtitle={`${(profile as { guestTypeLabel?: string }).guestTypeLabel ?? "Guest"} · ${profile.mobile}`} onBack={goBack} />

      {/* Loyalty Card */}
      <div className={`mx-4 mt-4 rounded-2xl bg-gradient-to-br ${tierCfg.color} p-5 text-white relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-white/10 translate-y-6 -translate-x-4" />
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/70 text-xs mb-0.5">Loyalty member</p>
              <h2 className="text-xl font-extrabold">{profile.name}</h2>
              <p className="text-white/70 text-sm">{profile.mobile}</p>
            </div>
            <div className="text-4xl">{tierCfg.icon}</div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Crown className="h-4 w-4 text-white/80" />
            <span className="text-sm font-bold uppercase tracking-wider">{tierCfg.label} Member</span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>{profile.points.toLocaleString()} points</span>
              {tierCfg.nextAt && <span>{(tierCfg.nextAt - profile.points).toLocaleString()} to {tierCfg.nextTier}</span>}
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${progressToNext}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mx-4 mt-3 grid grid-cols-3 gap-3">
        {[
          { label: "Loyalty Points", value: profile.points.toLocaleString(), icon: Star, color: "text-yellow-400" },
          { label: "Wallet Balance", value: `₹${profile.walletBalance}`, icon: Wallet, color: "text-emerald-400" },
          { label: "Total Orders", value: profile.totalOrders, icon: History, color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="guest-card p-3 text-center">
            <s.icon className={`h-5 w-5 ${s.color} mx-auto mb-1`} />
            <p className="text-base font-extrabold">{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mx-4 mt-4 flex gap-1 bg-white/5 p-1 rounded-xl">
        {(["overview", "wallet", "orders", "settings"] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${activeTab === tab ? "bg-orange-500 text-white shadow" : "text-white/50 hover:text-white"}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="mx-4 mt-4 space-y-4">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* Membership Perks */}
            <div className="guest-card p-4">
              <p className="font-display text-sm font-semibold mb-3">{tierCfg.label} Member Perks</p>
              <div className="space-y-2">
                {tierCfg.perks.map(perk => (
                  <div key={perk} className="flex items-center gap-2 text-sm text-white/70">
                    <Zap className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                    {perk}
                  </div>
                ))}
              </div>
              {tierCfg.nextTier && (
                <div className="mt-3 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                  <p className="text-xs text-orange-300">Earn {(tierCfg.nextAt! - profile.points).toLocaleString()} more points to reach <strong>{tierCfg.nextTier}</strong></p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="guest-card divide-y divide-white/5 overflow-hidden p-0">
              {[
                { icon: Brain, label: "AI Personalization", sub: "Menu, combos, dietary & spending AI", action: () => goGuest("/user/ai") },
                { icon: Star, label: "Loyalty & Membership", sub: "Tiers, points & birthday rewards", action: () => goGuest("/user/loyalty") },
                { icon: Wallet, label: "Customer Wallet", sub: "Recharge, cashback & transfer", action: () => goGuest("/user/wallet") },
                { icon: Heart, label: "Browse Menu", sub: "Explore dishes & place an order", action: () => goGuest("/user/menu") },
                { icon: Bell, label: "Orders & Tracking", sub: "View order history & live status", action: () => setActiveTab("orders") },
                { icon: Headphones, label: "Live Support", sub: "Chat, WhatsApp, voice, tickets & emergency", action: () => goGuest("/user/support") },
                { icon: Globe, label: "Language & Accessibility", sub: "Hindi, English, regional languages & a11y", action: () => goGuest("/user/language") },
                { icon: Wifi, label: "Offline & Low Internet", sub: "Cached menu, order sync & data saver", action: () => goGuest("/user/offline") },
                { icon: Smartphone, label: "PWA App Experience", sub: "Install app, push notifications & shortcuts", action: () => goGuest("/user/pwa") },
                { icon: Monitor, label: "Smart Kiosk & Self Order", sub: "Self order, checkout, NFC, QR & tokens", action: () => goGuest("/user/kiosk") },
                { icon: Film, label: "Digital Experience", sub: "Live offers, videos, promos, themes & FX", action: () => goGuest("/user/experience") },
                { icon: Star, label: "Social & Reviews", sub: "Ratings, reviews, photos, share & referrals", action: () => goGuest("/user/reviews") },
              ].map(item => (
                <button key={item.label} onClick={item.action} className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-all">
                  <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center">
                    <item.icon className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-white/30">{item.sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/20" />
                </button>
              ))}
            </div>

            <button onClick={async () => { await publicApi.auth.logout().catch(() => {}); setUser(null); navigate("/user/auth"); }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/10 transition-all">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </>
        )}

        {/* Wallet Tab */}
        {activeTab === "wallet" && (
          <>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-600/20 to-teal-600/10 border border-emerald-500/30 p-5 text-center">
              <p className="text-xs text-white/50 mb-1">Total Balance</p>
              <p className="text-4xl font-extrabold text-emerald-400">₹{(profile.walletTotal ?? profile.walletBalance + profile.cashbackBalance).toLocaleString()}</p>
              <div className="flex justify-center gap-4 mt-3 text-xs text-white/50 flex-wrap">
                <span>Recharge: ₹{profile.walletBalances?.main ?? profile.walletBalance}</span>
                <span>Cashback: ₹{profile.walletBalances?.cashback ?? profile.cashbackBalance}</span>
                {profile.walletBalances && (
                  <>
                    <span>Refund: ₹{profile.walletBalances.refund}</span>
                    <span>Reward: ₹{profile.walletBalances.reward}</span>
                    <span>Gift: ₹{profile.walletBalances.gift}</span>
                    <span>Membership: ₹{profile.walletBalances.membership}</span>
                  </>
                )}
              </div>
            </div>

            <button onClick={() => goGuest("/user/loyalty")} className="w-full py-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-semibold hover:bg-amber-500/30">
              Open Loyalty Hub — Tiers, Points & Rewards
            </button>

            <button onClick={() => goGuest("/user/wallet")} className="w-full py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/30">
              Open Full Wallet — Recharge, Transfer & Cashback
            </button>

            <button onClick={() => goGuest("/user/ai")} className="w-full py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30">
              Open AI Hub — Personalized Menu, Combos & Spending Insights
            </button>

            {/* Recharge */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
              <p className="text-sm font-semibold mb-3">Recharge Wallet</p>
              <div className="flex gap-2 mb-3">
                {[100, 200, 500, 1000].map(amt => (
                  <button key={amt} onClick={() => setRechargeAmt(String(amt))} className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${rechargeAmt === String(amt) ? "bg-orange-500/20 border-orange-500/40 text-orange-300" : "border-white/10 bg-white/5 text-white/50"}`}>
                    ₹{amt}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500/40"
                  placeholder="Custom amount"
                  value={rechargeAmt}
                  onChange={e => setRechargeAmt(e.target.value)}
                />
                <button
                  onClick={async () => {
                    const amt = parseFloat(rechargeAmt);
                    if (!amt) return;
                    await publicApi.rechargeWallet(amt).catch(() => {});
                    await refreshUser();
                    setRechargeAmt("");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30"
                >
                  Add Money
                </button>
              </div>
            </div>

            {/* Transactions */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/8 divide-y divide-white/5">
              <div className="p-4"><p className="text-sm font-semibold">Recent Transactions</p></div>
              {walletTx.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${t.type === "credit" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                    <t.icon className={`h-4 w-4 ${t.type === "credit" ? "text-emerald-400" : "text-red-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{t.label}</p>
                    <p className="text-xs text-white/30">{t.date}</p>
                  </div>
                  <span className={`text-sm font-bold ${t.type === "credit" ? "text-emerald-400" : "text-red-400"}`}>
                    {t.type === "credit" ? "+" : "-"}₹{t.amount}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/8 divide-y divide-white/5">
            <div className="p-4"><p className="text-sm font-semibold">Order History</p></div>
            {ordersHistory.length === 0 && (
              <p className="p-6 text-center text-sm text-white/40">No orders yet. Place one from the menu.</p>
            )}
            {ordersHistory.map(order => (
              <div key={order.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{order.restaurant}</p>
                    <p className="text-xs text-white/40 mt-0.5">{order.items}</p>
                    <p className="text-xs text-white/30 mt-0.5">{order.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-400">₹{order.total}</p>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">{order.status}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => goGuest(`/user/order/${order.id.replace(/^ORD-/, "")}`)}
                  className="text-xs text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-all"
                >
                  Track Live
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const numericId = parseInt(order.id.replace(/^ORD-/, ""), 10);
                    if (!Number.isNaN(numericId)) {
                      try {
                        const created = await publicApi.reorder(numericId);
                        navigate(`/user/order/${created.id}`);
                        return;
                      } catch { /* fall through to cart reorder */ }
                    }
                    if (order.rawItems?.length) {
                      reorderFromOrder({
                        id: order.id,
                        restaurantName: order.restaurant,
                        items: (order.rawItems as any[]).map((i, idx) => ({
                          id: String(i.id ?? idx),
                          menuItemId: String(i.menuItemId ?? i.id),
                          name: i.name,
                          price: parseFloat(String(i.price ?? 0)),
                          quantity: i.quantity ?? 1,
                          customizations: i.customizations ?? [],
                          addons: i.addons ?? [],
                          course: i.course ?? "main",
                        })),
                        status: "delivered",
                        total: order.total,
                        tableNo: "",
                        placedAt: new Date(order.date),
                        estimatedTime: 20,
                      });
                      navigate("/user/cart");
                    } else navigate("/user/menu");
                  }}
                  className="text-xs text-orange-400 border border-orange-500/30 px-3 py-1.5 rounded-lg hover:bg-orange-500/10 transition-all"
                >
                  One-click Reorder
                </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/8 divide-y divide-white/5">
            {[
              { icon: Shield, label: "Privacy & Security", sub: "Device management, sessions", action: () => goGuest("/user/security") },
              { icon: Brain, label: "Future AI Roadmap", sub: "Voice ordering, virtual waiter & more", action: () => goGuest("/user/future-ai") },
              { icon: Bell, label: "Notification Preferences", sub: "Push, SMS, WhatsApp", action: () => goGuest("/user/pwa") },
              { icon: Globe, label: "Language & Region", sub: "English · India (IST)", action: () => goGuest("/user/language") },
            ].map(item => (
              <button key={item.label} onClick={"action" in item ? item.action : undefined} className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-all">
                <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-orange-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-white/30">{item.sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/20" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
