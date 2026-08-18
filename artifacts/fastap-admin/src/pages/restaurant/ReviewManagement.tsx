import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Star, MessageSquare, ThumbsUp, ThumbsDown, Minus, Send, RefreshCw, Filter, Globe, ExternalLink, Reply } from "lucide-react";

const API_BASE = "/api";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const SOURCE_ICONS: Record<string, { label: string; color: string; bg: string }> = {
  google: { label: "Google", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  zomato: { label: "Zomato", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  swiggy: { label: "Swiggy", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  internal: { label: "In-App", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/30" },
  guest: { label: "Guest", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/30" },
};

const SENTIMENT_CFG: Record<string, { icon: any; color: string; bg: string }> = {
  positive: { icon: ThumbsUp, color: "text-green-400", bg: "bg-green-500/10" },
  negative: { icon: ThumbsDown, color: "text-red-400", bg: "bg-red-500/10" },
  neutral: { icon: Minus, color: "text-yellow-400", bg: "bg-yellow-500/10" },
};

function Stars({ rating }: { rating: number }) {
  return <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? "text-yellow-400 fill-yellow-400" : "text-slate-600"}`} />)}</div>;
}

export default function ReviewManagement() {
  const { restaurantId } = useRestaurant();
  const [data, setData] = useState<any>({ reviews: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [replied, setReplied] = useState("all");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    if (!restaurantId) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (source !== "all") params.set("source", source);
    if (sentiment !== "all") params.set("sentiment", sentiment);
    if (replied !== "all") params.set("replied", replied);
    apiFetch(`/restaurants/${restaurantId}/reviews?${params}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [restaurantId, source, sentiment, replied]);

  async function handleReply(reviewId: number) {
    if (!restaurantId || !replyText.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/restaurants/${restaurantId}/reviews/${reviewId}/reply`, { method: "POST", body: JSON.stringify({ reply: replyText }) });
      setReplyText(""); setReplyingTo(null);
      load();
    } catch {}
    setSending(false);
  }

  const stats = data.stats || {};

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-lg"><Star className="h-6 w-6 text-violet-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Review Management</h1>
            <p className="text-slate-400 text-sm">Monitor and respond to customer reviews</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Reviews", value: stats.total || 0, color: "text-white" },
          { label: "Avg Rating", value: `${stats.averageRating || "0"}★`, color: "text-yellow-400" },
          { label: "Positive", value: stats.positive || 0, color: "text-green-400" },
          { label: "Negative", value: stats.negative || 0, color: "text-red-400" },
          { label: "Replied", value: stats.replied || 0, color: "text-violet-400" },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Source:</span>
          {["all", "google", "zomato", "swiggy", "internal"].map(s => (
            <button key={s} onClick={() => setSource(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${source === s ? "bg-violet-600 text-white" : "bg-slate-700/50 text-slate-400 hover:text-white"}`}>{s === "all" ? "All" : SOURCE_ICONS[s]?.label || s}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Sentiment:</span>
          {["all", "positive", "negative", "neutral"].map(s => (
            <button key={s} onClick={() => setSentiment(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${sentiment === s ? "bg-violet-600 text-white" : "bg-slate-700/50 text-slate-400 hover:text-white"}`}>{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Status:</span>
          {[["all", "All"], ["false", "Pending"], ["true", "Replied"]].map(([v, l]) => (
            <button key={v} onClick={() => setReplied(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${replied === v ? "bg-violet-600 text-white" : "bg-slate-700/50 text-slate-400 hover:text-white"}`}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" /></div>
      ) : (
        <div className="space-y-4">
          {data.reviews.map((review: any) => {
            const src = SOURCE_ICONS[review.source] || SOURCE_ICONS.internal;
            const sent = SENTIMENT_CFG[review.sentiment] || SENTIMENT_CFG.neutral;
            const SentIcon = sent.icon;
            return (
              <div key={review.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${src.bg} ${src.color}`}>{src.label}</span>
                      <span className={`p-1 rounded-lg ${sent.bg}`}><SentIcon className={`h-3 w-3 ${sent.color}`} /></span>
                      <Stars rating={review.rating} />
                      {review.replied && <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">Replied</span>}
                    </div>
                    <p className="text-slate-200 text-sm leading-relaxed">{review.text}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-400">{review.reviewer}</span>
                      <span>•</span>
                      <span>{new Date(review.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                    {review.replied && review.reply && (
                      <div className="mt-3 pl-3 border-l-2 border-violet-500/40">
                        <div className="text-xs text-violet-400 font-medium mb-1 flex items-center gap-1"><Reply className="h-3 w-3" /> Your Reply</div>
                        <p className="text-xs text-slate-300">{review.reply}</p>
                      </div>
                    )}
                  </div>
                </div>

                {!review.replied && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    {replyingTo === review.id ? (
                      <div className="space-y-2">
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none resize-none" placeholder="Write a professional reply..." />
                        <div className="flex gap-2">
                          <button onClick={() => { setReplyingTo(null); setReplyText(""); }} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 transition-colors">Cancel</button>
                          <button onClick={() => handleReply(review.id)} disabled={sending || !replyText.trim()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs disabled:opacity-50 transition-colors">
                            <Send className="h-3 w-3" /> {sending ? "Sending..." : "Send Reply"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setReplyingTo(review.id); setReplyText(""); }} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                        <MessageSquare className="h-3.5 w-3.5" /> Reply to Review
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {data.reviews.length === 0 && <div className="text-center text-slate-400 py-16"><Star className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No reviews found</p></div>}
        </div>
      )}
    </div>
  );
}
