import { useState, useEffect } from "react";
import { Sparkles, Wand2, Image, TrendingUp, Brain, BarChart3, MessageSquare, Star, Zap, ChevronRight, Loader, CheckCircle } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { aiApi, feedbackApi } from "@/lib/api";
import { publicationEmptyMessage } from "@/lib/restaurantPublication";
import { EmptyState } from "@/components/restaurant/EmptyState";

type Tab = "menu-gen" | "copilot" | "operations" | "feedback";

type Insight = { title: string; desc: string; type: string; icon?: string };
type Prediction = { metric: string; value: string; change: string; trend: string };
type Review = { platform: string; rating: number; text: string; sentiment: string; date: string };
type MenuOpt = { action: string; item: string; reason: string; urgency: string };

export default function AIFeatures() {
  const { restaurantId, restaurant, isRestaurantPublished } = useRestaurant();
  const [tab, setTab] = useState<Tab>("menu-gen");
  const [dishName, setDishName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any>(null);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [menuOpts, setMenuOpts] = useState<MenuOpt[]>([]);

  useEffect(() => {
    if (!restaurantId) return;
    if (!isRestaurantPublished) {
      setInsights([]);
      setPredictions([]);
      setMenuOpts([]);
      setReviews([]);
      return;
    }
    aiApi.insights(restaurantId).then(d => {
      setInsights((d.insights ?? []).map((i: any) => ({ ...i, icon: i.type === "warning" ? "⚠️" : i.type === "opportunity" ? "🎯" : "📊" })));
      setPredictions(d.predictions ?? []);
      setMenuOpts(d.menuOptimizations ?? []);
    }).catch(() => {});
    feedbackApi.list(restaurantId).then(rows => {
      if (Array.isArray(rows) && rows.length > 0) {
        setReviews(rows.map((f: any) => ({
          platform: f.source || "In-App",
          rating: f.rating ?? 4,
          text: f.comment || "",
          sentiment: (f.rating ?? 4) >= 4 ? "positive" : (f.rating ?? 4) <= 2 ? "negative" : "mixed",
          date: f.createdAt ? new Date(f.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—",
        })));
      }
    }).catch(() => {});
  }, [restaurantId, isRestaurantPublished]);

  async function generateDish() {
    if (!dishName || !restaurantId) return;
    setGenerating(true);
    try {
      const data = await aiApi.generateMenu(restaurantId, dishName);
      setGenerated(data);
    } catch {
      setGenerated(null);
    } finally {
      setGenerating(false);
    }
  }

  async function askCopilot() {
    if (!question || !restaurantId) return;
    const q = question;
    setQuestion("");
    try {
      const data = await aiApi.copilot(restaurantId, q);
      setAnswers(prev => [...prev, { q, a: data.answer }]);
    } catch {
      setAnswers(prev => [...prev, { q, a: "Unable to fetch AI response. Check your connection." }]);
    }
  }

  const reviewList = reviews;
  const avgRating = reviewList.length ? (reviewList.reduce((s, r) => s + r.rating, 0) / reviewList.length).toFixed(1) : "—";
  const positivePct = reviewList.length ? Math.round(reviewList.filter(r => r.sentiment === "positive").length / reviewList.length * 100) : 0;
  const negativePct = reviewList.length ? Math.round(reviewList.filter(r => r.sentiment === "negative").length / reviewList.length * 100) : 0;

  const SENTIMENT_CFG: Record<string, string> = {
    positive: "text-emerald-400",
    negative: "text-red-400",
    mixed: "text-yellow-400",
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold">AI Features</h1>
          <p className="text-xs text-white/40">AI-powered menu, insights, operations & feedback</p>
        </div>
      </div>

      {!isRestaurantPublished && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
          <p className="text-sm font-semibold text-amber-200">AI insights unavailable</p>
          <p className="text-xs text-white/50 mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 overflow-x-auto">
        {[
          { id: "menu-gen", label: "Menu AI", icon: Wand2 },
          { id: "copilot", label: "Business Co-Pilot", icon: Brain },
          { id: "operations", label: "Operations AI", icon: BarChart3 },
          { id: "feedback", label: "Feedback AI", icon: MessageSquare },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-violet-500 text-white" : "text-white/50 hover:text-white"}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "menu-gen" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-bold">Generate Menu Item by Name</h2>
            </div>
            <div className="space-y-3">
              <input
                value={dishName}
                onChange={e => setDishName(e.target.value)}
                placeholder="Type dish name e.g. Butter Chicken, Masala Dosa..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
              />
              <button onClick={generateDish} disabled={!dishName || generating} className="w-full flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-40">
                {generating ? <><Loader className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate with AI</>}
              </button>
            </div>
            {generated && (
              <div className="mt-4 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-violet-400" />
                  <p className="text-sm font-bold text-violet-300">Generated: {generated.name}</p>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">{generated.description}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    { label: "Cuisine", value: generated.cuisine },
                    { label: "Category", value: generated.category },
                    { label: "Calories", value: `~${generated.calories} kcal` },
                    { label: "Suggested Price", value: `₹${generated.suggestedPrice}` },
                    { label: "Est. Margin", value: generated.margin },
                    { label: "Allergens", value: generated.allergens.join(", ") || "None" },
                  ].map(f => (
                    <div key={f.label} className="bg-white/5 rounded-lg p-2">
                      <p className="text-xs text-white/40">{f.label}</p>
                      <p className="text-xs font-semibold mt-0.5">{f.value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Ingredients</p>
                  <div className="flex flex-wrap gap-1">
                    {generated.ingredients.map((ing: string) => (
                      <span key={ing} className="px-2 py-0.5 bg-white/5 rounded-full text-xs text-white/60">{ing}</span>
                    ))}
                  </div>
                </div>
                <button className="w-full mt-2 py-2 rounded-xl bg-violet-500 text-white text-xs font-bold hover:bg-violet-600 transition-all">
                  Add to Menu
                </button>
              </div>
            )}
          </div>
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Image className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-bold">AI Marketing Assets</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Food Poster", icon: "🖼️", desc: "High-res print-ready poster" },
                { label: "Instagram Post", icon: "📸", desc: "1:1 square format" },
                { label: "Instagram Reel", icon: "🎬", desc: "15s promotional reel" },
                { label: "WhatsApp Banner", icon: "💬", desc: "Promotional message card" },
                { label: "Menu Card", icon: "📋", desc: "Digital menu card design" },
                { label: "Festival Offer", icon: "🎉", desc: "Seasonal campaign visual" },
              ].map(a => (
                <button key={a.label} className="p-3 bg-white/5 hover:bg-white/8 border border-white/5 hover:border-violet-500/30 rounded-xl text-left transition-all group">
                  <p className="text-xl mb-1">{a.icon}</p>
                  <p className="text-sm font-semibold group-hover:text-violet-300 transition-colors">{a.label}</p>
                  <p className="text-xs text-white/40">{a.desc}</p>
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">AI generates captions, hashtags & designs automatically</p>
            </div>
          </div>
        </div>
      )}

      {tab === "copilot" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-bold">AI Business Co-Pilot</h2>
            </div>
            <div className="flex-1 space-y-3 max-h-80 overflow-y-auto mb-4">
              {answers.length === 0 && (
                <div className="text-center py-8">
                  <Brain className="h-8 w-8 text-violet-400/50 mx-auto mb-2" />
                  <p className="text-sm text-white/30">Ask anything about your restaurant business</p>
                </div>
              )}
              {answers.map((a, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-end"><div className="bg-amber-500/20 border border-amber-500/20 rounded-2xl rounded-tr-sm px-3 py-2 max-w-xs"><p className="text-sm text-amber-200">{a.q}</p></div></div>
                  <div className="flex justify-start"><div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl rounded-tl-sm px-3 py-2 max-w-sm"><p className="text-sm text-white/80 leading-relaxed">{a.a}</p></div></div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && askCopilot()} placeholder="Ask: Top profitable items, Branch performance..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50" />
              <button onClick={askCopilot} className="px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 transition-all">Ask</button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {["Top profitable items?", "Underperforming branches?", "Today's predictions?"].map(q => (
                <button key={q} onClick={() => { setQuestion(q); }} className="px-3 py-1 rounded-full bg-white/5 text-white/40 text-xs hover:bg-white/10 hover:text-white/70 transition-all">{q}</button>
              ))}
            </div>
          </div>
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-bold">AI Insights</h2>
            </div>
            <div className="space-y-3">
              {insights.length === 0 && <EmptyState title="No insights yet" description="Insights appear once you have menu items and orders." />}
              {insights.map(ins => (
                <div key={ins.title} className={`p-3 rounded-xl border flex items-start gap-3 ${ins.type === "opportunity" ? "bg-emerald-500/8 border-emerald-500/15" : ins.type === "warning" ? "bg-yellow-500/8 border-yellow-500/15" : ins.type === "alert" ? "bg-red-500/8 border-red-500/15" : "bg-blue-500/8 border-blue-500/15"}`}>
                  <span className="text-base shrink-0">{ins.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{ins.title}</p>
                    <p className="text-xs text-white/50 leading-relaxed mt-0.5">{ins.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "operations" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-bold">AI Predictions — Today</h2>
            </div>
            <div className="space-y-3">
              {predictions.length === 0 && <EmptyState title="No predictions yet" description="Predictions are computed from your order history." />}
              {predictions.map(p => (
                <div key={p.metric} className={`flex items-center gap-3 p-3 rounded-xl border ${p.trend === "alert" ? "bg-red-500/8 border-red-500/15" : p.trend === "up" ? "bg-emerald-500/8 border-emerald-500/15" : "bg-white/3 border-white/5"}`}>
                  <div className="flex-1">
                    <p className="text-xs text-white/40">{p.metric}</p>
                    <p className="text-sm font-bold mt-0.5">{p.value}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.trend === "alert" ? "bg-red-500/20 text-red-400" : p.trend === "up" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/50"}`}>{p.change}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-bold">AI Menu Optimization</h2>
            </div>
            <div className="space-y-3">
              {menuOpts.length === 0 && <EmptyState title="No optimization suggestions" description="Add menu items and process orders to get recommendations." />}
              {menuOpts.map(r => (
                <div key={r.item} className="flex items-start gap-3 p-3 bg-white/3 border border-white/5 rounded-xl">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 mt-0.5 ${r.urgency === "high" ? "bg-red-500/20 text-red-400" : r.urgency === "medium" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"}`}>{r.action}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{r.item}</p>
                    <p className="text-xs text-white/40 mt-0.5">{r.reason}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/20 shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "feedback" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Avg Rating", value: `${avgRating}★`, color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Positive", value: `${positivePct}%`, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Negative", value: `${negativePct}%`, color: "text-red-400", bg: "bg-red-500/10" },
              { label: "Total Reviews", value: String(reviewList.length), color: "text-blue-400", bg: "bg-blue-500/10" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border border-white/5 rounded-2xl p-4 text-center`}>
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-white/40 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h2 className="text-sm font-bold mb-4">Recent Reviews</h2>
            <div className="space-y-3">
              {reviewList.length === 0 && <EmptyState title="No reviews yet" description="Customer feedback will appear here." />}
              {reviewList.map((r, i) => (
                <div key={i} className="p-3 bg-white/3 border border-white/5 rounded-xl">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs font-semibold">{r.platform}</span>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className={`h-3 w-3 ${j < Math.floor(r.rating) ? "text-amber-400 fill-amber-400" : "text-white/20"}`} />
                      ))}
                    </div>
                    <span className={`text-xs font-semibold ml-auto ${SENTIMENT_CFG[r.sentiment]}`}>{r.sentiment}</span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{r.text}</p>
                  <p className="text-xs text-white/30 mt-1">{r.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
