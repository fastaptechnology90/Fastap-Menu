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
  Receipt, CalendarDays, Hourglass, Flower2, Martini, PartyPopper,
} from "lucide-react";

/**
 * Tier names only.
 *
 * This map used to carry a perk list and a points threshold for each tier — and both
 * were invented, and both disagreed with the server. It told a Diamond member they had
 * a "Personal chef" and "Unlimited upgrades", and that Diamond began at 25,000 points
 * while `/user/loyalty` and `GET /public/me/loyalty` both said 2,500. Two screens, two
 * ladders, neither the venue's. The real ladder is loaded below.
 */
const TIER_LABEL: Record<string, string> = {
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
  "vip-elite": "VIP Elite",
};

type LoyaltyLadder = {
  tier?: string;
  points?: number;
  cashbackPercent?: number;
  progress?: { percent: number; remaining: number; nextTier: string | null };
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
  const [rechargeError, setRechargeError] = useState("");
  const [ordersHistory, setOrdersHistory] = useState<OrderHistoryRow[]>([]);
  const [walletTx, setWalletTx] = useState<WalletTxRow[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [recharging, setRecharging] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [ladder, setLadder] = useState<LoyaltyLadder | null>(null);

  // The tier ladder is the server's, not a constant in this file.
  useEffect(() => {
    if (!user) return;
    publicApi.loyalty().then(setLadder).catch(() => setLadder(null));
  }, [user]);

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
      setHistoryError("");
    }).catch(e => {
      // A failed request used to be indistinguishable from an empty history, so a
      // regular customer was told in the venue's own voice that they had never ordered.
      setOrdersHistory([]);
      setHistoryError(e instanceof Error ? e.message : "We could not load your orders.");
    });
    publicApi.wallet().then(w => {
      setWalletTx((w.transactions ?? []).map((t: { amount: number; description?: string; type: string; createdAt: string }) => ({
        type: parseFloat(String(t.amount)) >= 0 ? "credit" : "debit",
        label: t.description || t.type,
        amount: Math.abs(parseFloat(String(t.amount))),
        date: new Date(t.createdAt).toLocaleDateString(),
        icon: t.type === "recharge" ? Plus : Gift,
      })));
      setWalletError("");
    }).catch(e => {
      setWalletTx([]);
      setWalletError(e instanceof Error ? e.message : "We could not load your wallet.");
    });
  }, [user, venue.restaurantName]);

  if (!user) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-foreground pb-24">
        <GuestHeader title="My profile" onBack={goBack} />
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground text-sm mb-6">Sign in to view your profile, orders, and wallet.</p>
          <button type="button" onClick={() => navigate("/user/auth")} className="guest-btn-primary px-8 py-3 text-sm">
            Guest Sign In
          </button>
        </div>
      </div>
    );
  }

  const profile = user;
  // The tier string comes straight from the API. Indexing a fixed map with it and then
  // reading .color/.icon/.perks white-screened the whole profile for any tier name the
  // map does not know.
  const tierLabel = TIER_LABEL[profile.tier] ?? profile.tier ?? "Member";
  const ladderProgress = ladder?.progress ?? null;

  return (
    <div className="guest-page thin-scroll min-h-screen pb-24">
      <GuestHeader title="My profile" subtitle={`${(profile as { guestTypeLabel?: string }).guestTypeLabel ?? "Guest"} · ${profile.mobile}`} onBack={goBack} />

      {/* Loyalty card — was a per-tier gradient with two decorative blobs. */}
      <div className="mx-4 mt-4 guest-card p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Loyalty member</p>
            <h2 className="text-xl font-semibold truncate">{profile.name}</h2>
            <p className="text-sm text-muted-foreground">{profile.mobile}</p>
          </div>
          <span className="guest-pill shrink-0"><Crown className="h-3.5 w-3.5" /> {tierLabel}</span>
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span className="tabular-nums">{profile.points.toLocaleString("en-IN")} points</span>
            {ladderProgress?.nextTier && (
              <span className="tabular-nums">{ladderProgress.remaining.toLocaleString("en-IN")} to {ladderProgress.nextTier}</span>
            )}
          </div>
          <div
            className="h-2 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ladderProgress?.percent ?? 100}
            aria-label={ladderProgress?.nextTier ? `Progress to ${ladderProgress.nextTier}` : "Top tier reached"}
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${ladderProgress?.percent ?? 100}%` }} />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mx-4 mt-3 grid grid-cols-3 gap-3">
        {[
          { label: "Loyalty Points", value: profile.points.toLocaleString(), icon: Star, color: "text-warning" },
          { label: "Wallet Balance", value: `₹${profile.walletBalance}`, icon: Wallet, color: "text-success" },
          { label: "Total Orders", value: profile.totalOrders, icon: History, color: "text-info" },
        ].map(s => (
          <div key={s.label} className="guest-card p-3 text-center">
            <s.icon className={`h-5 w-5 ${s.color} mx-auto mb-1`} />
            <p className="text-base font-semibold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mx-4 mt-4 flex gap-1 bg-muted p-1 rounded-xl">
        {(["overview", "wallet", "orders", "settings"] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${activeTab === tab ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-primary-foreground"}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="mx-4 mt-4 space-y-4">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* What the tier actually gets you. The perk list this replaced promised a
                personal chef, concierge service and complimentary stays. */}
            <div className="guest-card p-4">
              <p className="text-sm font-semibold mb-3">Your {tierLabel} tier</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                {ladder?.cashbackPercent != null
                  ? `${ladder.cashbackPercent}% cashback on every order, into your cashback wallet`
                  : "Cashback on every order, into your cashback wallet"}
              </div>
              {ladderProgress?.nextTier && (
                <p className="text-xs text-muted-foreground mt-3">
                  {ladderProgress.remaining.toLocaleString("en-IN")} more points to reach <strong className="text-foreground">{ladderProgress.nextTier}</strong>
                </p>
              )}
              <button type="button" onClick={() => goGuest("/user/loyalty")} className="guest-btn-secondary mt-3 px-4 text-xs">
                See the full ladder
              </button>
            </div>

            {/* Quick Actions */}
            <div className="guest-card divide-y divide-border overflow-hidden p-0">
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
                // These six pages existed with no way in: the only links to them lived in
                // a service sheet on the menu that nothing ever opened, so the running
                // bill, reservations, the queue, the spa, the bar and events were all
                // dead ends unless the guest typed the URL.
                { icon: Receipt, label: "Table Bill & Service", sub: "Running bill, split it, call a waiter", action: () => goGuest("/user/dining") },
                { icon: CalendarDays, label: "Book a Table", sub: "Reserve a table, or a room, spa or event slot", action: () => goGuest("/user/reserve") },
                { icon: Hourglass, label: "Join the Queue", sub: "Take a token and track your place", action: () => goGuest("/user/queue") },
                { icon: Flower2, label: "Spa & Wellness", sub: "Treatments, therapists & memberships", action: () => goGuest("/user/spa") },
                { icon: Martini, label: "Bar & Nightlife", sub: "Happy hour, tables, lounges & DJ nights", action: () => goGuest("/user/bar") },
                { icon: PartyPopper, label: "Events & Banquets", sub: "Halls, catering, decor & quotations", action: () => goGuest("/user/events") },
              ].map(item => (
                <button key={item.label} onClick={item.action} className="w-full flex items-center gap-3 p-4 hover:bg-muted transition-all">
                  <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>

            {/* Sign-out clears this device even if the server call fails — leaving
                the session on screen would be worse than a stale server session. */}
            <button onClick={async () => { await publicApi.auth.logout().catch(() => undefined); setUser(null); navigate("/user/auth"); }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-danger-border text-danger text-sm font-semibold hover:bg-danger-subtle transition-all">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </>
        )}

        {/* Wallet Tab */}
        {activeTab === "wallet" && (
          <>
            <div className="rounded-2xl border border-success-border p-5 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
              <p className="text-4xl font-semibold text-success">₹{(profile.walletTotal ?? profile.walletBalance + profile.cashbackBalance).toLocaleString()}</p>
              <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
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

            <button onClick={() => goGuest("/user/loyalty")} className="w-full py-3 rounded-xl bg-warning-subtle border border-warning-border text-warning text-sm font-semibold hover:bg-warning-subtle">
              Open Loyalty Hub — Tiers, Points & Rewards
            </button>

            <button onClick={() => goGuest("/user/wallet")} className="w-full py-3 rounded-xl bg-success-subtle border border-success-border text-success text-sm font-semibold hover:bg-success-subtle">
              Open Full Wallet — Recharge, Transfer & Cashback
            </button>

            <button onClick={() => goGuest("/user/ai")} className="w-full py-3 rounded-xl bg-muted border border-primary text-primary text-sm font-semibold hover:bg-muted">
              Open AI Hub — Personalized Menu, Combos & Spending Insights
            </button>

            {/* Recharge */}
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold mb-3">Recharge Wallet</p>
              <div className="flex gap-2 mb-3">
                {[100, 200, 500, 1000].map(amt => (
                  <button key={amt} onClick={() => setRechargeAmt(String(amt))} className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${rechargeAmt === String(amt) ? "bg-muted border-primary text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                    ₹{amt}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                  placeholder="Custom amount"
                  value={rechargeAmt}
                  onChange={e => setRechargeAmt(e.target.value)}
                />
                <button
                  disabled={recharging}
                  onClick={async () => {
                    const amt = parseFloat(rechargeAmt);
                    // A blank or non-numeric amount used to return in silence, so the
                    // button looked broken. It is also re-entrant: two taps were two
                    // real top-ups.
                    if (!Number.isFinite(amt) || amt <= 0) {
                      setRechargeError("Enter an amount to add.");
                      return;
                    }
                    if (recharging) return;
                    setRecharging(true);
                    try {
                      // Clearing the field on a failed top-up reads as success.
                      await publicApi.rechargeWallet(amt);
                    } catch (e) {
                      setRechargeError(e instanceof Error ? e.message : "The top-up did not go through. You have not been charged.");
                      return;
                    } finally {
                      setRecharging(false);
                    }
                    setRechargeError("");
                    await refreshUser();
                    setRechargeAmt("");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-success-subtle border border-success-border text-success text-sm font-semibold hover:bg-success-subtle disabled:opacity-50"
                >
                  {recharging ? "Adding…" : "Add Money"}
                </button>
              </div>
              {rechargeError && <p role="alert" className="mt-2 text-xs text-danger">{rechargeError}</p>}
            </div>

            {/* Transactions */}
            <div className="rounded-2xl bg-card border border-border divide-y divide-border">
              <div className="p-4"><p className="text-sm font-semibold">Recent Transactions</p></div>
              {walletTx.length === 0 && (
                walletError
                  ? <p role="alert" className="p-6 text-center text-sm text-danger">{walletError}</p>
                  : <p className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
              )}
              {walletTx.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${t.type === "credit" ? "bg-success-subtle" : "bg-danger-subtle"}`}>
                    <t.icon className={`h-4 w-4 ${t.type === "credit" ? "text-success" : "text-danger"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <span className={`text-sm font-semibold ${t.type === "credit" ? "text-success" : "text-danger"}`}>
                    {t.type === "credit" ? "+" : "-"}₹{t.amount}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="rounded-2xl bg-card border border-border divide-y divide-border">
            <div className="p-4"><p className="text-sm font-semibold">Order History</p></div>
            {ordersHistory.length === 0 && (
              historyError
                ? <p role="alert" className="p-6 text-center text-sm text-danger">{historyError} Pull down to refresh, or try again in a moment.</p>
                : <p className="p-6 text-center text-sm text-muted-foreground">No orders yet. Place one from the menu.</p>
            )}
            {ordersHistory.map(order => (
              <div key={order.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{order.restaurant}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{order.items}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{order.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">₹{order.total}</p>
                    <span className="text-xs bg-success-subtle text-success px-2 py-0.5 rounded-full">{order.status}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => goGuest(`/user/order/${order.id.replace(/^ORD-/, "")}`)}
                  className="text-xs text-success border border-success-border px-3 py-1.5 rounded-lg hover:bg-success-subtle transition-all"
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
                  className="text-xs text-primary border border-primary px-3 py-1.5 rounded-lg hover:bg-muted transition-all"
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
          <div className="rounded-2xl bg-card border border-border divide-y divide-border">
            {[
              { icon: Shield, label: "Privacy & Security", sub: "Device management, sessions", action: () => goGuest("/user/security") },
              { icon: Brain, label: "Future AI Roadmap", sub: "Voice ordering, virtual waiter & more", action: () => goGuest("/user/future-ai") },
              { icon: Bell, label: "Notification Preferences", sub: "Push, SMS, WhatsApp", action: () => goGuest("/user/pwa") },
              { icon: Globe, label: "Language & Region", sub: "English · India (IST)", action: () => goGuest("/user/language") },
            ].map(item => (
              <button key={item.label} onClick={"action" in item ? item.action : undefined} className="w-full flex items-center gap-3 p-4 hover:bg-muted transition-all">
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
