import { useState, useEffect, useCallback } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError, GuestEmpty } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import { POINTS_REDEEM_RATE, type MembershipTierId } from "@/lib/loyaltyMembershipCatalog";
import {
  Crown, Star, Gift, Cake, Heart, Wallet, Utensils,
  CheckCircle2, TrendingUp, History, Lock,
} from "lucide-react";

type Tab = "tiers" | "rewards" | "history" | "profile";

/** A tier as the server describes it. Perks are deliberately not part of this. */
type ApiTier = { id: string; label: string; minPoints: number; cashbackPercent: number };

export default function LoyaltyMembershipPage() {
  const [, navigate] = useAppLocation();
  const { user, refreshUser } = useUser();

  const { toast: pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("tiers");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      setApiError("Could not load your loyalty account.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Tiers come from the server, and carry only what the product can actually deliver.
   *
   * This screen used to render MEMBERSHIP_TIERS from `lib/loyaltyMembershipCatalog.ts`,
   * which promised each tier a list of perks — "Private dining", "Personal chef",
   * "Chef's table access", "Concierge service", "Dedicated manager", "Complimentary
   * stays", "VIP seating", "Free delivery", "Priority queue". Not one of those exists
   * anywhere in the product or the database, and no venue had agreed to any of them, so
   * a diner reading their Diamond card was being promised a personal chef by software.
   * `GET /public/me/loyalty` returns the tier ladder as id, label, threshold and
   * cashback rate — the three things that are real — and those are what is shown.
   */
  const tiers: ApiTier[] = Array.isArray(data?.tiers) ? data.tiers : [];
  const tier = (data?.tier ?? user?.tier ?? "silver") as MembershipTierId;
  const tierCfg = tiers.find(t => t.id === tier) ?? tiers[0] ?? null;
  const points: number = data?.points ?? user?.points ?? 0;
  const progress = data?.progress ?? { percent: 0, remaining: 0, nextTier: null };
  const rewards = data?.rewards;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions: any[] = data?.transactions ?? [];
  const redeemRate: number = rewards?.points?.redeemRate ?? POINTS_REDEEM_RATE;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleRedeem() {
    const pts = parseInt(redeemPoints, 10);
    if (!pts || pts < redeemRate) return;
    setSubmitting(true);
    try {
      const res = await publicApi.redeemLoyaltyPoints(pts);
      showToast(`Redeemed ${pts} pts for ₹${res.diningCreditsAdded} of dining credit`);
      await refreshUser();
      await load();
    } catch {
      pushToast({ title: "Could not redeem", description: "Those points were not redeemed. Try again in a moment.", variant: "destructive" });
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
      showToast(`₹${res.reward} of dining credit claimed`);
      await load();
    } catch {
      pushToast({ title: "Could not claim", description: "That reward was not claimed. Try again in a moment.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function saveProfile() {
    setSubmitting(true);
    try {
      await publicApi.updateLoyaltyProfile({ birthday, anniversary });
      showToast("Dates saved");
      await load();
    } catch {
      pushToast({ title: "Could not save", description: "Your dates were not saved.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const TABS: { id: Tab; label: string; icon: typeof Crown }[] = [
    { id: "tiers", label: "Tiers", icon: Crown },
    { id: "rewards", label: "Rewards", icon: Gift },
    { id: "history", label: "History", icon: History },
    { id: "profile", label: "Dates", icon: Cake },
  ];

  return (
    <div className="guest-page thin-scroll min-h-screen pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Loyalty</p>
            <h1 className="text-base font-semibold truncate">{tierCfg?.label ?? "Member"}</h1>
          </div>
          <Crown className="h-5 w-5 text-primary shrink-0" />
        </div>

        {/* Member card — was a per-tier gradient (slate, amber, violet, cyan, rose). */}
        <div className="mx-4 mb-3 guest-card p-4">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{user?.name ?? "Guest"}</p>
              <p className="text-2xl font-semibold tabular-nums">{points.toLocaleString("en-IN")} pts</p>
              {tierCfg && <p className="text-sm text-muted-foreground">{tierCfg.cashbackPercent}% cashback on orders</p>}
            </div>
            <span className="guest-pill shrink-0">{tierCfg?.label ?? "—"}</span>
          </div>
          {progress.nextTier && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{progress.percent}% to {progress.nextTier}</span>
                <span className="tabular-nums">{progress.remaining.toLocaleString("en-IN")} pts to go</span>
              </div>
              <div
                className="h-2 rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
                aria-label={`Progress to ${progress.nextTier}`}
              >
                <div className="h-full bg-primary rounded-full transition-[width]" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          )}
        </div>

        {toast && (
          <div role="status" className="mx-4 mb-2 rounded-md border border-success-border bg-success-subtle px-3 py-2 text-xs text-success flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {toast}
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
              className={`guest-pill ${tab === t.id ? "guest-pill-active" : ""}`}>
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
          tiers.length === 0 ? (
            <GuestEmpty icon={Crown} title="No tiers set up" message="This venue has not published a loyalty ladder yet." />
          ) : (
            <div className="space-y-3">
              {tiers.map(t => {
                const isCurrent = t.id === tier;
                const isUnlocked = points >= t.minPoints;
                return (
                  <div key={t.id} className={`guest-card p-4 ${isCurrent ? "ring-1 ring-primary" : !isUnlocked ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{t.label}</h3>
                          {isCurrent && <span className="guest-pill guest-pill-active text-2xs px-2 py-0.5">Your tier</span>}
                          {isUnlocked && !isCurrent && <span className="guest-pill text-2xs px-2 py-0.5">Reached</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                          {t.minPoints.toLocaleString("en-IN")}+ points · {t.cashbackPercent}% cashback on every order
                        </p>
                      </div>
                      {!isUnlocked && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Cashback lands in your cashback wallet. Birthday and anniversary credits are on the Rewards tab.
              </p>
            </div>
          )
        )}

        {!loading && !apiError && tab === "rewards" && (
          <div className="space-y-3">
            {/* Cashback */}
            <div className="guest-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Wallet className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h3 className="font-medium">Cashback</h3>
                  <p className="text-xs text-muted-foreground">Earned back on every order, into your cashback wallet</p>
                </div>
              </div>
              <p className="text-2xl font-semibold tabular-nums">₹{rewards?.cashback?.balance ?? user?.cashbackBalance ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Earning {rewards?.cashback?.rate ?? tierCfg?.cashbackPercent ?? 0}% at your tier</p>
              <button onClick={() => navigate("/user/wallet")} className="guest-btn-secondary mt-3 px-4 text-xs">View wallet</button>
            </div>

            {/* Reward points */}
            <div className="guest-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Star className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h3 className="font-medium">Reward points</h3>
                  <p className="text-xs text-muted-foreground">Redeem for dining credit</p>
                </div>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{points.toLocaleString("en-IN")} pts</p>
              <p className="text-xs text-muted-foreground mt-1">{redeemRate} points = ₹1 dining credit</p>
              <div className="flex gap-2 mt-3">
                <label htmlFor="redeem-pts" className="sr-only">Points to redeem</label>
                <input id="redeem-pts" type="number" inputMode="numeric" value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)}
                  className="guest-input flex-1" placeholder="Points to redeem" />
                <button onClick={handleRedeem} disabled={submitting || parseInt(redeemPoints, 10) > points}
                  className="guest-btn-primary px-4 text-sm disabled:opacity-50">
                  Redeem
                </button>
              </div>
              {redeemPoints && parseInt(redeemPoints, 10) >= redeemRate && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  ₹{Math.floor(parseInt(redeemPoints, 10) / redeemRate)} of dining credit
                  {parseInt(redeemPoints, 10) > points && " — more points than you have"}
                </p>
              )}
            </div>

            {/* Dining credits */}
            <div className="guest-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Utensils className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h3 className="font-medium">Dining credit</h3>
                  <p className="text-xs text-muted-foreground">Spends against food and drink</p>
                </div>
              </div>
              <p className="text-2xl font-semibold tabular-nums">₹{rewards?.diningCredits?.balance ?? 0}</p>
              <button onClick={() => navigate("/user/menu")} className="guest-btn-secondary mt-3 px-4 text-xs">Open the menu</button>
            </div>

            {/* Birthday — the "+ a dessert" this used to promise came from nowhere. */}
            <div className="guest-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Cake className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h3 className="font-medium">Birthday credit</h3>
                  <p className="text-xs text-muted-foreground">Once a year, in your birthday month</p>
                </div>
              </div>
              <p className="text-lg font-semibold tabular-nums">₹{rewards?.birthday?.value ?? 0} dining credit</p>
              {rewards?.birthday?.eligible ? (
                <button onClick={() => handleClaim("birthday")} disabled={submitting} className="guest-btn-primary mt-3 w-full py-2.5 text-sm">
                  Claim birthday credit
                </button>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">
                  {rewards?.birthday?.claimed ? "Already claimed this year" : "Available in your birthday month — set the date on the Dates tab"}
                </p>
              )}
            </div>

            {/* Anniversary */}
            <div className="guest-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Heart className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h3 className="font-medium">Anniversary credit</h3>
                  <p className="text-xs text-muted-foreground">Once a year, in your anniversary month</p>
                </div>
              </div>
              <p className="text-lg font-semibold tabular-nums">₹{rewards?.anniversary?.value ?? 0} dining credit</p>
              {rewards?.anniversary?.eligible ? (
                <button onClick={() => handleClaim("anniversary")} disabled={submitting} className="guest-btn-primary mt-3 w-full py-2.5 text-sm">
                  Claim anniversary credit
                </button>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">
                  {rewards?.anniversary?.claimed ? "Already claimed this year" : "Available in your anniversary month — set the date on the Dates tab"}
                </p>
              )}
            </div>
          </div>
        )}

        {!loading && !apiError && tab === "history" && (
          transactions.length === 0 ? (
            <GuestEmpty
              icon={History}
              title="No loyalty activity yet"
              message="Points earned and redeemed will be listed here, with what each one was for."
            />
          ) : (
            <div className="guest-card divide-y divide-border">
              {transactions.map((t, i: number) => (
                <div key={t.id ?? i} className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    {t.type === "earn" ? <TrendingUp className="h-4 w-4 text-success" /> :
                     t.type === "redeem" ? <Star className="h-4 w-4 text-primary" /> :
                     <Gift className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{t.description ?? t.type}</p>
                    <p className="text-xs text-muted-foreground">{t.createdAt ? new Date(t.createdAt).toLocaleString() : "—"}</p>
                  </div>
                  {t.points != null && t.points !== 0 && (
                    <span className={`text-sm font-medium tabular-nums shrink-0 ${t.points > 0 ? "text-success" : "text-muted-foreground"}`}>
                      {t.points > 0 ? "+" : ""}{t.points} pts
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {!loading && !apiError && tab === "profile" && (
          <div className="guest-section-card space-y-4">
            <p className="text-sm font-medium">Set your dates to unlock the birthday and anniversary credits</p>
            <div>
              <label htmlFor="ly-birthday" className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Cake className="h-3 w-3" /> Birthday</label>
              <input id="ly-birthday" type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="guest-input [color-scheme:dark]" />
            </div>
            <div>
              <label htmlFor="ly-anniversary" className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Heart className="h-3 w-3" /> Anniversary</label>
              <input id="ly-anniversary" type="date" value={anniversary} onChange={e => setAnniversary(e.target.value)} className="guest-input [color-scheme:dark]" />
            </div>
            <button onClick={saveProfile} disabled={submitting} className="guest-btn-primary w-full py-3 disabled:opacity-50">
              Save dates
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
