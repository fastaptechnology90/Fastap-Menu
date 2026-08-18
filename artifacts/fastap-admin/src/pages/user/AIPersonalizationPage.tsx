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
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <div className="px-4 pt-2">
        <button type="button" onClick={() => navigate("/user/future-ai")} className="w-full text-left guest-card p-3 flex items-center gap-2 text-sm text-violet-300 border-violet-500/30">
          <Brain className="h-4 w-4" /> Explore Future AI Roadmap <ArrowRight className="h-4 w-4 ml-auto" />
        </button>
      </div>
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-white/40">AI Personalization Engine</p>
            <h1 className="text-base font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-400" /> Smart Dining AI
            </h1>
          </div>
        </div>

        <div className="mx-4 mb-3 rounded-xl bg-gradient-to-r from-violet-600/20 to-fuchsia-600/15 border border-violet-500/30 p-3">
          <p className="text-xs text-violet-200">
            {user?.name ? `Hi ${user.name.split(" ")[0]} — ` : ""}6 AI features powered by your taste, orders & diet ({dietaryFilter})
          </p>
        </div>

        {toast && (
          <div className="mx-4 mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> {toast}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {tabs.map(t => {
            const Icon = TAB_ICONS[t.id];
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium ${
                  tab === t.id ? "bg-violet-500/25 border border-violet-500/40 text-violet-200" : "bg-white/5 border border-white/10 text-white/60"
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
                  tab === FEATURE_TAB[i] ? "border-violet-500/40 bg-violet-500/10" : "border-white/10 bg-white/5 hover:border-violet-500/25"
                }`}
              >
                <span className="text-lg">{f.icon}</span>
                <p className="text-xs font-semibold mt-1">{f.label}</p>
                <p className="text-[10px] text-white/40 line-clamp-2 mt-0.5">{f.desc}</p>
              </button>
            ))}
          </div>

          {/* Personalized Menu */}
          {tab === "menu" && (
            <>
              <p className="text-sm text-white/50">{AI_FEATURES[0].desc}</p>
              <div className="space-y-2">
                {(engine?.personalizedMenu ?? []).map((item: any) => (
                  <div key={item.menuItemId} className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300">
                      {item.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-white/40 truncate">{item.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.price > 0 && <p className="text-orange-400 font-bold">₹{item.price}</p>}
                      <button onClick={() => addItem(item)} className="text-xs text-violet-300 mt-1">Add</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Favorite Item Prediction */}
          {tab === "predict" && (
            <>
              <p className="text-sm text-white/50">{AI_FEATURES[1].desc}</p>
              <div className="space-y-2">
                {(engine?.favoritePredictions ?? []).map((item: any) => (
                  <div key={item.menuItemId} className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-white/40">{item.reason}</p>
                      </div>
                      <span className="text-sm font-bold text-fuchsia-400">{item.confidence}% match</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-fuchsia-500 rounded-full" style={{ width: `${item.confidence}%` }} />
                    </div>
                    <button onClick={() => addItem(item)} className="mt-2 text-xs text-fuchsia-300 flex items-center gap-1">
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
              <p className="text-sm text-white/50">{AI_FEATURES[2].desc}</p>
              <div className="space-y-3">
                {(engine?.comboRecommendations ?? []).map((combo: any) => (
                  <div key={combo.id} className={`rounded-xl border p-4 ${combo.recommended ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/5"}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{combo.name}</h3>
                        <p className="text-xs text-white/40">{combo.reason}</p>
                      </div>
                      {combo.savePercent > 0 && (
                        <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">Save {combo.savePercent}%</span>
                      )}
                    </div>
                    <ul className="text-xs text-white/60 space-y-0.5 mb-2">
                      {(combo.items ?? []).map((i: any) => <li key={i.menuItemId}>• {i.name}</li>)}
                    </ul>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-lg font-bold text-orange-400">₹{combo.totalPrice}</span>
                        {combo.originalPrice > combo.totalPrice && (
                          <span className="text-xs text-white/40 line-through ml-2">₹{combo.originalPrice}</span>
                        )}
                      </div>
                      {combo.recommended && (
                        <button onClick={() => (combo.items ?? []).forEach((i: any) => addItem(i))}
                          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                          Add combo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* AI Upselling */}
          {tab === "upsell" && (
            <>
              <p className="text-sm text-white/50">{AI_FEATURES[3].desc}</p>
              <div className="space-y-2">
                {(engine?.upsells ?? []).map((u: any, i: number) => (
                  <div key={i} className="rounded-xl bg-gradient-to-r from-violet-600/10 to-orange-600/10 border border-violet-500/20 p-4 flex items-center gap-3">
                    <Gift className="h-5 w-5 text-violet-400 shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-xs text-white/50">{u.reason}</p>
                      <span className="text-[10px] text-violet-300 capitalize">{u.type?.replace("_", " ")}</span>
                    </div>
                    <button onClick={() => addItem(u)} className="shrink-0 px-3 py-2 rounded-xl bg-violet-500/20 text-violet-300 text-xs font-semibold">
                      + ₹{u.price ?? u.uplift ?? "—"}
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate("/user/cart")} className="w-full py-3 rounded-xl border border-white/10 text-sm text-white/60">
                View cart upsells →
              </button>
            </>
          )}

          {/* AI Dietary Suggestions */}
          {tab === "dietary" && (
            <>
              <p className="text-sm text-white/50">{AI_FEATURES[4].desc}</p>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4 mb-3">
                <p className="text-sm text-emerald-200">{engine?.dietarySuggestions?.aiTip ?? engine?.dietarySuggestions?.tip}</p>
                <p className="text-xs text-white/40 mt-1">Filter: {engine?.dietarySuggestions?.filter ?? dietaryFilter} · {engine?.dietarySuggestions?.matchCount ?? 0} matches</p>
              </div>
              <div className="space-y-2">
                {(engine?.dietarySuggestions?.suggestions ?? []).map((item: any) => (
                  <div key={item.menuItemId} className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-white/40">{item.reason}</p>
                      {item.dietaryTags?.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {item.dietaryTags.slice(0, 3).map((t: string) => (
                            <span key={t} className="text-[10px] bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => addItem(item)} className="text-xs text-emerald-300">Add ₹{item.price ?? "—"}</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* AI Spending Analysis */}
          {tab === "spending" && (
            <>
              <p className="text-sm text-white/50">{AI_FEATURES[5].desc}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Spend", value: `₹${(engine?.spendingAnalysis?.totalSpend ?? 0).toLocaleString()}`, color: "text-orange-400" },
                  { label: "Avg Order", value: `₹${engine?.spendingAnalysis?.avgOrderValue ?? 0}`, color: "text-violet-400" },
                  { label: "Orders", value: engine?.spendingAnalysis?.orderCount ?? 0, color: "text-blue-400" },
                  { label: "Trend", value: engine?.spendingAnalysis?.monthlyTrend ?? "—", color: "text-emerald-400" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                    <p className="text-xs text-white/40">{s.label}</p>
                    <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-sm font-semibold mb-3">Category Breakdown</p>
                {(engine?.spendingAnalysis?.categoryBreakdown ?? []).map((c: any) => (
                  <div key={c.category} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>{c.category}</span>
                      <span>{c.percent}% · ₹{c.amount?.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${c.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-violet-500/10 border border-violet-500/25 p-4">
                <p className="text-sm font-semibold mb-2">AI Insights</p>
                <ul className="space-y-2">
                  {(engine?.spendingAnalysis?.insights ?? []).map((ins: string, i: number) => (
                    <li key={i} className="text-xs text-white/70 flex gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" /> {ins}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-violet-300 mt-3">Suggested budget per visit: ₹{engine?.spendingAnalysis?.suggestedBudget ?? 500}</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="guest-bottom-bar">
        <button onClick={() => navigate("/user/menu")} className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-600 font-semibold flex items-center justify-center gap-2">
          <ShoppingCart className="h-4 w-4" /> Browse Personalized Menu
        </button>
      </div>
    </div>
  );
}
