import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { restaurantAuth, type SubscriptionPlan } from "@/lib/api";
import { fmtINRFull } from "@/lib/format";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { defaultPathForRole } from "@/config/restaurantLoginRoles";
import { CheckCircle, Crown, Loader2, LogOut, Shield, Sparkles } from "lucide-react";

export default function RestaurantSubscription() {
  const [, navigate] = useLocation();
  const {
    currentStaff,
    restaurant,
    authBootstrapping,
    hasActiveSubscription,
    canSubscribe,
    refreshSubscription,
    logoutStaff,
  } = useRestaurant();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (authBootstrapping) return;
    if (!currentStaff) {
      navigate("/restaurant/login");
      return;
    }
    if (hasActiveSubscription) {
      navigate(defaultPathForRole(currentStaff.role));
    }
  }, [authBootstrapping, currentStaff, hasActiveSubscription, navigate]);

  useEffect(() => {
    if (!currentStaff || hasActiveSubscription) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await restaurantAuth.subscription.plans();
        if (!cancelled) setPlans(Array.isArray(res.plans) ? res.plans : []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load plans");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentStaff, hasActiveSubscription]);

  async function handleSubscribe(planId: string) {
    if (!canSubscribe) {
      setError("Ask your owner or manager to purchase a subscription for this restaurant.");
      return;
    }
    setSubmitting(planId);
    setError("");
    setSuccess("");
    try {
      const res = await restaurantAuth.subscription.subscribe(planId);
      await refreshSubscription();
      if (res.subscription?.active) {
        setSuccess(`Subscribed to ${res.subscription.planName ?? planId}. Opening your panel…`);
        setTimeout(() => navigate(defaultPathForRole(currentStaff!.role)), 900);
      } else {
        setError("Subscription could not be activated. Please try again or contact support.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Subscription failed");
    } finally {
      setSubmitting(null);
    }
  }

  if (authBootstrapping || !currentStaff) {
    return (
      <div className="restaurant-panel flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="restaurant-panel min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <PanelLogo size={40} />
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-400/80">Subscription required</p>
              <h1 className="text-2xl font-bold">{restaurant.name || "Your restaurant"}</h1>
              <p className="text-sm text-white/50">Choose a plan to unlock the restaurant panel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logoutStaff().then(() => navigate("/restaurant/login"))}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-100">Panel access is locked until you subscribe</p>
              <p className="mt-1 text-sm text-white/60">
                Signed in as <span className="text-white">{currentStaff.name}</span> ({currentStaff.role}).
                {!canSubscribe && " Contact an owner or manager to complete checkout."}
              </p>
            </div>
          </div>
        </div>

        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle className="h-4 w-4" /> {success}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/50">
            No subscription plans are available right now. Please contact support.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map(plan => {
              const featured = plan.id === "pro";
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-6 ${
                    featured ? "border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent" : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                      <Sparkles className="h-3 w-3" /> Popular
                    </span>
                  )}
                  <div className="mb-4 flex items-center gap-2">
                    <Crown className={`h-5 w-5 ${featured ? "text-amber-400" : "text-white/40"}`} />
                    <h2 className="text-xl font-bold">{plan.name}</h2>
                  </div>
                  <p className="text-3xl font-black">
                    {fmtINRFull(plan.price)}
                    <span className="text-sm font-normal text-white/40">/month</span>
                  </p>
                  {plan.trialDays > 0 && (
                    <p className="mt-1 text-xs text-emerald-400">{plan.trialDays}-day free trial included</p>
                  )}
                  <ul className="my-5 flex-1 space-y-2 text-sm text-white/70">
                    {(plan.features as string[]).slice(0, 8).map(feature => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mb-4 text-[11px] text-white/35">
                    Up to {plan.maxBranches} branch(es) · {plan.maxStaff} staff · {plan.maxItems} menu items
                  </p>
                  <button
                    type="button"
                    disabled={!canSubscribe || submitting === plan.id}
                    onClick={() => handleSubscribe(plan.id)}
                    className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      featured
                        ? "bg-amber-500 text-black hover:bg-amber-400"
                        : "bg-white/10 text-white hover:bg-white/15"
                    }`}
                  >
                    {submitting === plan.id ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing…</span>
                    ) : canSubscribe ? (
                      `Subscribe to ${plan.name}`
                    ) : (
                      "Owner approval required"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-white/30">
          Already subscribed on another device?{" "}
          <button type="button" onClick={() => refreshSubscription()} className="text-amber-400 hover:underline">
            Refresh status
          </button>
          {" · "}
          <Link href="/restaurant/login" className="text-amber-400 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
