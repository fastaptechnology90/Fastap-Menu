import { useState, useEffect, useCallback } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  MEMBERSHIP_TIERS, REWARD_TYPES, tierConfig, progressToNextTier,
  POINTS_REDEEM_RATE, pointsToDiningCredit, type MembershipTierId,
} from "@/lib/loyaltyMembershipCatalog";
import {
  ChevronLeft, Crown, Star, Gift, Cake, Heart, Wallet, Utensils,
  CheckCircle, TrendingUp, History, Sparkles,
} from "lucide-react";

type Tab = "tiers" | "rewards" | "history" | "profile";

export default function LoyaltyMembershipPage() {
  const [, navigate] = useAppLocation();
  const { user, refreshUser } = useUser();

  const { toast: pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("tiers");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [redeemPoints, setRedeemPoints] = useState("200");
  const [birthday, setBirthday] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await publicApi.loyalty();
      setData(res);
      setBirthday(res.birthday ?? "");
      setAnniversary(res.anniversary ?? "");
    } catch {
      setApiError("Could not load loyalty data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tier = (data?.tier ?? user?.tier ?? "gold") as MembershipTierId;
  const tierCfg = tierConfig(tier);
  const points = data?.points ?? user?.points ?? 0;
  const progress = data?.progress ?? progressToNextTier(points, tier);
  const rewards = data?.rewards;
  const transactions = data?.transactions ?? [];

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleRedeem() {
    const pts = parseInt(redeemPoints, 10);
    if (!pts || pts < POINTS_REDEEM_RATE) return;
    setSubmitting(true);
    try {
      const res = await publicApi.redeemLoyaltyPoints(pts);
      showToast(`Redeemed ${pts} pts → ₹${res.diningCreditsAdded} dining credit`);
      await refreshUser();
      await load();
    } catch {
      pushToast({ title: "Error", description: "Could not redeem points.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaim(type: "birthday" | "anniversary") {
    setSubmitting(true);
    try {
      const res = type === "birthday"
        ? await publicApi.claimBirthdayReward()
        : await publicApi.claimAnniversaryReward();
      showToast(`₹${res.reward} dining credit claimed!`);
      await load();
    } catch {
      pushToast({ title: "Error", description: "Could not claim reward.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function saveProfile() {
    setSubmitting(true);
    try {
      await publicApi.updateLoyaltyProfile({ birthday, anniversary });
      showToast("Profile updated");
      await load();
    } catch {
      pushToast({ title: "Error", description: "Could not save profile.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Crown }[] = [
    { id: "tiers", label: "Tiers", icon: Crown },
    { id: "rewards", label: "Rewards", icon: Gift },
    { id: "history", label: "History", icon: History },
    { id: "profile", label: "Dates", icon: Cake },
  ];

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-white/40">Loyalty & Membership</p>
            <h1 className="text-base font-bold">{tierCfg.label} Member</h1>
          </div>
          <span className="text-2xl">{tierCfg.icon}</span>
        </div>

        {/* Member card */}
        <div className={`mx-4 mb-3 rounded-2xl bg-gradient-to-br ${tierCfg.color} p-4 relative overflow-hidden`}>
          <div className="relative">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/70 text-xs">{user?.name ?? "Guest Member"}</p>
                <p className="text-xl font-extrabold">{points.toLocaleString()} pts</p>
                <p className="text-sm text-white/80">{tierCfg.cashbackPercent}% cashback rate</p>
              </div>
              <Crown className="h-8 w-8 text-white/80" />
            </div>
            {progress.nextTier && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-white/70 mb-1">
                  <span>{progress.percent}% to {progress.nextTier}</span>
                  <span>{progress.remaining.toLocaleString()} pts left</span>
                </div>
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-white/90 rounded-full transition-all" style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {toast && (
          <div className="mx-4 mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> {toast}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium ${
                tab === t.id ? "bg-amber-500/20 border border-amber-500/40 text-amber-200" : "bg-white/5 border border-white/10 text-white/60"
              }`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 space-y-4">
        {loading && <GuestLoading label="Loading loyalty…" />}
        {!loading && apiError && (
          <GuestError message={apiError} onRetry={load} />
        )}
        {!loading && !apiError && tab === "tiers" && (
          <div className="space-y-3">
            {MEMBERSHIP_TIERS.map(t => {
              const isCurrent = t.id === tier;
              const isUnlocked = points >= t.minPoints;
              return (
                <div key={t.id} className={`rounded-xl border p-4 ${isCurrent ? "border-amber-500/50 bg-amber-500/10" : isUnlocked ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-60"}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{t.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{t.label}</h3>
                        {isCurrent && <span className="text-[10px] bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full">Current</span>}
                        {isUnlocked && !isCurrent && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">Unlocked</span>}
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">{t.minPoints.toLocaleString()}+ points · {t.cashbackPercent}% cashback</p>
                      <ul className="mt-2 space-y-1">
                        {t.perks.map(p => (
                          <li key={p} className="text-xs text-white/60 flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-amber-400 shrink-0" /> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* All 5 Reward Types */}
        {!loading && !apiError && tab === "rewards" && (
          <div className="space-y-3">
            {/* Cashback */}
            <div className="rounded-xl bg-gradient-to-br from-amber-600/15 to-orange-600/10 border border-amber-500/25 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Wallet className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="font-semibold">Cashback</h3>
                  <p className="text-xs text-white/50">{REWARD_TYPES[0].desc}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-amber-400">₹{rewards?.cashback?.balance ?? user?.cashbackBalance ?? 0}</p>
              <p className="text-xs text-white/40 mt-1">Earning {rewards?.cashback?.rate ?? tierCfg.cashbackPercent}% on orders</p>
              <button onClick={() => navigate("/user/wallet")} className="mt-2 text-xs text-amber-300 underline">View cashback wallet →</button>
            </div>

            {/* Reward Points */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <div>
                  <h3 className="font-semibold">Reward Points</h3>
                  <p className="text-xs text-white/50">{REWARD_TYPES[1].desc}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-yellow-400">{points.toLocaleString()} pts</p>
              <p className="text-xs text-white/40 mt-1">{POINTS_REDEEM_RATE} points = ₹1 dining credit</p>
              <div className="flex gap-2 mt-3">
                <input type="number" value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" placeholder="Points to redeem" />
                <button onClick={handleRedeem} disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-sm font-semibold disabled:opacity-50">
                  Redeem
                </button>
              </div>
              {redeemPoints && parseInt(redeemPoints) >= POINTS_REDEEM_RATE && (
                <p className="text-xs text-yellow-300/80 mt-1">→ ₹{pointsToDiningCredit(parseInt(redeemPoints))} dining credit</p>
              )}
            </div>

            {/* Dining Credits */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Utensils className="h-5 w-5 text-orange-400" />
                <div>
                  <h3 className="font-semibold">Dining Credits</h3>
                  <p className="text-xs text-white/50">{REWARD_TYPES[2].desc}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-orange-400">₹{rewards?.diningCredits?.balance ?? 0}</p>
              <button onClick={() => navigate("/user/menu")} className="mt-2 text-xs text-orange-300 underline">Use credits on menu →</button>
            </div>

            {/* Birthday Rewards */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Cake className="h-5 w-5 text-pink-400" />
                <div>
                  <h3 className="font-semibold">Birthday Rewards</h3>
                  <p className="text-xs text-white/50">{REWARD_TYPES[3].desc}</p>
                </div>
              </div>
              <p className="text-lg font-bold text-pink-400">₹{rewards?.birthday?.value ?? 500} dining credit + dessert</p>
              {rewards?.birthday?.eligible ? (
                <button onClick={() => handleClaim("birthday")} disabled={submitting}
                  className="mt-3 w-full py-2.5 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-300 text-sm font-semibold">
                  Claim Birthday Reward 🎂
                </button>
              ) : (
                <p className="text-xs text-white/40 mt-2">
                  {rewards?.birthday?.claimed ? "Claimed this year ✓" : "Available in your birthday month — set date in Profile tab"}
                </p>
              )}
            </div>

            {/* Anniversary Rewards */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Heart className="h-5 w-5 text-rose-400" />
                <div>
                  <h3 className="font-semibold">Anniversary Rewards</h3>
                  <p className="text-xs text-white/50">{REWARD_TYPES[4].desc}</p>
                </div>
              </div>
              <p className="text-lg font-bold text-rose-400">₹{rewards?.anniversary?.value ?? 750} credit + complimentary dessert</p>
              {rewards?.anniversary?.eligible ? (
                <button onClick={() => handleClaim("anniversary")} disabled={submitting}
                  className="mt-3 w-full py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-sm font-semibold">
                  Claim Anniversary Reward 💑
                </button>
              ) : (
                <p className="text-xs text-white/40 mt-2">
                  {rewards?.anniversary?.claimed ? "Claimed this year ✓" : "Available in your anniversary month — set date in Profile tab"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Transaction History */}
        {!loading && !apiError && tab === "history" && (
          <div className="rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5">
            {transactions.length === 0 ? (
              <p className="p-6 text-center text-sm text-white/40">No loyalty activity yet</p>
            ) : transactions.map((t: any, i: number) => (
              <div key={t.id ?? i} className="flex items-center gap-3 p-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  t.type === "earn" ? "bg-emerald-500/10" : t.type === "redeem" ? "bg-yellow-500/10" : "bg-pink-500/10"
                }`}>
                  {t.type === "earn" ? <TrendingUp className="h-4 w-4 text-emerald-400" /> :
                   t.type === "redeem" ? <Star className="h-4 w-4 text-yellow-400" /> :
                   <Gift className="h-4 w-4 text-pink-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{t.description ?? t.type}</p>
                  <p className="text-xs text-white/40">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
                {t.points != null && t.points !== 0 && (
                  <span className={`text-sm font-bold ${t.points > 0 ? "text-emerald-400" : "text-yellow-400"}`}>
                    {t.points > 0 ? "+" : ""}{t.points} pts
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Birthday & Anniversary profile */}
        {!loading && !apiError && tab === "profile" && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-4">
            <p className="text-sm font-semibold">Set dates to unlock birthday & anniversary rewards</p>
            <div>
              <label className="text-xs text-white/40 flex items-center gap-1"><Cake className="h-3 w-3" /> Birthday</label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-white/40 flex items-center gap-1"><Heart className="h-3 w-3" /> Anniversary</label>
              <input type="date" value={anniversary} onChange={e => setAnniversary(e.target.value)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <button onClick={saveProfile} disabled={submitting}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 font-semibold disabled:opacity-50">
              Save Dates
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
