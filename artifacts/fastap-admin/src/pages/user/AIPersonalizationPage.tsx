import { useState, useEffect, useCallback } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError } from "@/components/user/GuestApiState";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import { AI_FEATURES } from "@/lib/aiPersonalizationCatalog";
import {
  ChevronLeft, Sparkles, TrendingUp, Utensils, Gift, Salad,
  BarChart3, ShoppingCart, CheckCircle, Brain, ArrowRight,
} from "lucide-react";
import { GuestIcon } from "@/components/user/GuestIcon";

type Tab = "menu" | "predict" | "combos" | "upsell" | "dietary" | "spending";

const FEATURE_TAB: Record<number, Tab> = {
  0: "menu", 1: "predict", 2: "combos", 3: "upsell", 4: "dietary", 5: "spending",
};

const TAB_ICONS: Record<Tab, typeof Sparkles> = {
  menu: Sparkles, predict: Brain, combos: Utensils, upsell: TrendingUp, dietary: Salad, spending: BarChart3,
};

export default function AIPersonalizationPage() {
  const [, navigate] = useAppLocation();
  const { venue, user, dietaryFilter, favorites, addToCart, cart } = useUser();

  const [tab, setTab] = useState<Tab>("menu");
  const [engine, setEngine] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const loadEngine = useCallback(async () => {
    if (!venue.restaurantId) {
      setApiError("Restaurant not loaded.");
      setEngine(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setApiError(null);
    const body = {
      restaurantId: venue.restaurantId,
      dietaryFilter,
      cartCourses: [...new Set(cart.map(c => c.course))],
      cartItemIds: cart.map(c => parseInt(c.menuItemId, 10)).filter(n => !Number.isNaN(n)),
      cartItemNames: cart.map(c => c.name),
      favorites: favorites.map(f => f.name),
    };

    try {
      const res = await publicApi.ai.engine(body);
      setEngine(res);
    } catch {
      setApiError("Could not load AI personalization.");
      setEngine(null);
    } finally {
      setLoading(false);
    }
  }, [venue.restaurantId, dietaryFilter, cart, favorites]);

  useEffect(() => { loadEngine(); }, [loadEngine]);

  function addItem(item: { name: string; price?: number; menuItemId?: number }) {
    addToCart({
      menuItemId: String(item.menuItemId ?? item.name),
      name: item.name,
      price: item.price ?? 0,
      quantity: 1,
      customizations: ["AI recommended"],
      addons: [],
      course: "main",
    });
    setToast(`${item.name} added to cart`);
    setTimeout(() => setToast(null), 2500);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "menu", label: "For You" },
    { id: "predict", label: "Predictions" },
    { id: "combos", label: "Combos" },
    { id: "upsell", label: "Upsells" },
    { id: "dietary", label: "Dietary" },
    { id: "spending", label: "Spending" },
  ];

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-24">
      <div className="px-4 pt-2">
        <button type="button" onClick={() => navigate("/user/future-ai")} className="w-full text-left guest-card p-3 flex items-center gap-2 text-sm text-primary border-primary">
          <Brain className="h-4 w-4" /> Explore Future AI Roadmap <ArrowRight className="h-4 w-4 ml-auto" />
        </button>
      </div>
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">AI Personalization Engine</p>
            <h1 className="text-base font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Smart Dining AI
            </h1>
          </div>
        </div>

        <div className="mx-4 mb-3 rounded-xl border border-primary p-3">
          <p className="text-xs text-primary">
            {user?.name ? `Hi ${user.name.split(" ")[0]} — ` : ""}6 AI features powered by your taste, orders & diet ({dietaryFilter})
          </p>
        </div>

        {toast && (
          <div className="mx-4 mb-2 rounded-lg border border-success-border bg-success-subtle px-3 py-2 text-xs text-success flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> {toast}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {tabs.map(t => {
            const Icon = TAB_ICONS[t.id];
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium ${
                  tab === t.id ? "bg-muted border border-primary text-primary" : "bg-muted border border-border text-muted-foreground"
                }`}>
                <Icon className="h-3 w-3" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <GuestLoading label="Analyzing your preferences…" />
      ) : apiError ? (
        <GuestError message={apiError} onRetry={loadEngine} />
      ) : (
        <div className="px-4 pt-2 space-y-4">
          {/* All 6 features overview */}
          <div className="grid grid-cols-2 gap-2">
            {AI_FEATURES.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setTab(FEATURE_TAB[i])}
                className={`rounded-xl border p-3 text-left transition-all ${
                  tab === FEATURE_TAB[i] ? "border-primary bg-muted" : "border-border bg-muted hover:border-primary"
                }`}
              >
                <GuestIcon id={f.id} className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold mt-1">{f.label}</p>
                <p className="text-2xs text-muted-foreground line-clamp-2 mt-0.5">{f.desc}</p>
              </button>
            ))}
          </div>

          {/* Personalized Menu */}
          {tab === "menu" && (
            <>
              <p className="text-sm text-muted-foreground">{AI_FEATURES[0].desc}</p>
              <div className="space-y-2">
                {(engine?.personalizedMenu ?? []).map((item: any) => (
                  <div key={item.menuItemId} className="rounded-xl bg-muted border border-border p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-sm font-semibold text-primary">
                      {item.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.price > 0 && <p className="text-primary font-semibold">₹{item.price}</p>}
                      <button onClick={() => addItem(item)} className="text-xs text-primary mt-1">Add</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Favorite Item Prediction */}
          {tab === "predict" && (
            <>
              <p className="text-sm text-muted-foreground">{AI_FEATURES[1].desc}</p>
              <div className="space-y-2">
                {(engine?.favoritePredictions ?? []).map((item: any) => (
                  <div key={item.menuItemId} className="rounded-xl bg-muted border border-border p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.reason}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary">{item.confidence}% match</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${item.confidence}%` }} />
                    </div>
                    <button onClick={() => addItem(item)} className="mt-2 text-xs text-primary flex items-center gap-1">
                      Try it <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Smart Combo Recommendations */}
          {tab === "combos" && (
            <>
              <p className="text-sm text-muted-foreground">{AI_FEATURES[2].desc}</p>
              <div className="space-y-3">
                {/*
                  A combo is a suggested set of dishes, priced from the menu.

                  It used to advertise "Save 20%" against a struck-through original, and
                  "Add combo" then pushed each dish into the cart at its full menu price.
                  Nothing anywhere applies `savePercent`: no coupon is issued, the order
                  route prices every line from `menu_items`, and the bill comes to the
                  original. The guest agreed to ₹88 and paid ₹110, and found out at the
                  till. The saving is not shown because the product cannot honour it —
                  the grouping itself is still worth having.
                */}
                {(engine?.comboRecommendations ?? []).map((combo: any) => {
                  const lines = combo.items ?? [];
                  const menuTotal = lines.reduce((sum: number, i: any) => sum + Number(i.price ?? 0), 0);
                  return (
                    <div key={combo.id} className="guest-card p-4">
                      <div className="mb-2 min-w-0">
                        <h3 className="font-semibold">{combo.name}</h3>
                        <p className="text-xs text-muted-foreground">{combo.reason}</p>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-0.5 mb-3">
                        {lines.map((i: any) => (
                          <li key={i.menuItemId} className="flex justify-between gap-3">
                            <span className="truncate">{i.name}</span>
                            <span className="tabular-nums shrink-0">₹{i.price}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex justify-between items-center gap-3 border-t border-border pt-2">
                        <div>
                          <span className="text-lg font-semibold tabular-nums">₹{menuTotal}</span>
                          <span className="text-xs text-muted-foreground ml-2">menu price</span>
                        </div>
                        <button onClick={() => lines.forEach((i: any) => addItem(i))}
                          className="guest-btn-secondary text-xs px-3">
                          Add all
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* AI Upselling */}
          {tab === "upsell" && (
            <>
              <p className="text-sm text-muted-foreground">{AI_FEATURES[3].desc}</p>
              <div className="space-y-2">
                {(engine?.upsells ?? []).map((u: any, i: number) => (
                  <div key={i} className="rounded-xl border border-primary p-4 flex items-center gap-3">
                    <Gift className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.reason}</p>
                      <span className="text-2xs text-primary capitalize">{u.type?.replace("_", " ")}</span>
                    </div>
                    <button onClick={() => addItem(u)} className="shrink-0 px-3 py-2 rounded-xl bg-muted text-primary text-xs font-semibold">
                      + ₹{u.price ?? u.uplift ?? "—"}
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate("/user/cart")} className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground">
                View cart upsells →
              </button>
            </>
          )}

          {/* AI Dietary Suggestions */}
          {tab === "dietary" && (
            <>
              <p className="text-sm text-muted-foreground">{AI_FEATURES[4].desc}</p>
              <div className="rounded-xl bg-success-subtle border border-success-border p-4 mb-3">
                <p className="text-sm text-success">{engine?.dietarySuggestions?.aiTip ?? engine?.dietarySuggestions?.tip}</p>
                <p className="text-xs text-muted-foreground mt-1">Filter: {engine?.dietarySuggestions?.filter ?? dietaryFilter} · {engine?.dietarySuggestions?.matchCount ?? 0} matches</p>
              </div>
              <div className="space-y-2">
                {(engine?.dietarySuggestions?.suggestions ?? []).map((item: any) => (
                  <div key={item.menuItemId} className="rounded-xl bg-muted border border-border p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                      {item.dietaryTags?.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {item.dietaryTags.slice(0, 3).map((t: string) => (
                            <span key={t} className="text-2xs bg-success-subtle text-success px-1.5 py-0.5 rounded">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => addItem(item)} className="text-xs text-success">Add ₹{item.price ?? "—"}</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* AI Spending Analysis */}
          {tab === "spending" && (
            <>
              <p className="text-sm text-muted-foreground">{AI_FEATURES[5].desc}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Spend", value: `₹${(engine?.spendingAnalysis?.totalSpend ?? 0).toLocaleString()}`, color: "text-primary" },
                  { label: "Avg Order", value: `₹${engine?.spendingAnalysis?.avgOrderValue ?? 0}`, color: "text-primary" },
                  { label: "Orders", value: engine?.spendingAnalysis?.orderCount ?? 0, color: "text-info" },
                  { label: "Trend", value: engine?.spendingAnalysis?.monthlyTrend ?? "—", color: "text-success" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-muted border border-border p-4 text-center">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-muted border border-border p-4">
                <p className="text-sm font-semibold mb-3">Category Breakdown</p>
                {(engine?.spendingAnalysis?.categoryBreakdown ?? []).map((c: any) => (
                  <div key={c.category} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>{c.category}</span>
                      <span>{c.percent}% · ₹{c.amount?.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${c.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-muted border border-primary p-4">
                <p className="text-sm font-semibold mb-2">AI Insights</p>
                <ul className="space-y-2">
                  {(engine?.spendingAnalysis?.insights ?? []).map((ins: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> {ins}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-primary mt-3">Suggested budget per visit: ₹{engine?.spendingAnalysis?.suggestedBudget ?? 500}</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="guest-bottom-bar">
        <button onClick={() => navigate("/user/menu")} className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 font-semibold flex items-center justify-center gap-2">
          <ShoppingCart className="h-4 w-4" /> Browse Personalized Menu
        </button>
      </div>
    </div>
  );
}
