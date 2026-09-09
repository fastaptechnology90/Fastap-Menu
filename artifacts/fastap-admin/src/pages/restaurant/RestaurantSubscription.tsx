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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="restaurant-panel min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <PanelLogo panel="restaurant" size="lg" />
            <div>
              <p className="text-xs uppercase tracking-wider text-primary">Subscription required</p>
              <h1 className="text-2xl font-semibold">{restaurant.name || "Your restaurant"}</h1>
              <p className="text-sm text-muted-foreground">Choose a plan to unlock the restaurant panel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logoutStaff().then(() => navigate("/restaurant/login"))}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        <div className="mb-8 rounded-lg border border-primary/20 bg-primary/10 p-5">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold text-primary">Panel access is locked until you subscribe</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed in as <span className="text-foreground">{currentStaff.name}</span> ({currentStaff.role}).
                {!canSubscribe && " Contact an owner or manager to complete checkout."}
              </p>
            </div>
          </div>
        </div>

        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-success-border bg-success-subtle px-4 py-3 text-sm text-success">
            <CheckCircle className="h-4 w-4" /> {success}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted p-10 text-center text-muted-foreground">
            No subscription plans are available right now. Please contact support.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map(plan => {
              const featured = plan.id === "pro";
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-lg border p-6 ${
                    featured ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-primary-foreground">
                      <Sparkles className="h-3 w-3" /> Popular
                    </span>
                  )}
                  <div className="mb-4 flex items-center gap-2">
                    <Crown className={`h-5 w-5 ${featured ? "text-primary" : "text-muted-foreground"}`} />
                    <h2 className="text-xl font-semibold">{plan.name}</h2>
                  </div>
                  <p className="text-3xl font-semibold">
                    {fmtINRFull(plan.price)}
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </p>
                  {plan.trialDays > 0 && (
                    <p className="mt-1 text-xs text-success">{plan.trialDays}-day free trial included</p>
                  )}
                  <ul className="my-5 flex-1 space-y-2 text-sm text-foreground">
                    {(plan.features as string[]).slice(0, 8).map(feature => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mb-4 text-2xs text-muted-foreground">
                    Up to {plan.maxBranches} branch(es) · {plan.maxStaff} staff · {plan.maxItems} menu items
                  </p>
                  <button
                    type="button"
                    disabled={!canSubscribe || submitting === plan.id}
                    onClick={() => handleSubscribe(plan.id)}
                    className={`w-full rounded-lg py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      featured
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-foreground hover-elevate"
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

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Already subscribed on another device?{" "}
          <button type="button" onClick={() => refreshSubscription()} className="text-primary hover:underline">
            Refresh status
          </button>
          {" · "}
          <Link href="/restaurant/login" className="text-primary hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
