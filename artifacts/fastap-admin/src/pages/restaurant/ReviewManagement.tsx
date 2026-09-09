import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Star, MessageSquare, ThumbsUp, ThumbsDown, Minus, Send, RefreshCw, Filter, Globe, ExternalLink, Reply, Monitor } from "lucide-react";

const API_BASE = "/api";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const SOURCE_ICONS: Record<string, { label: string; color: string; bg: string }> = {
  google: { label: "Google", color: "text-info", bg: "bg-info-subtle border-info-border" },
  zomato: { label: "Zomato", color: "text-danger", bg: "bg-danger-subtle border-danger-border" },
  swiggy: { label: "Swiggy", color: "text-warning", bg: "bg-warning-subtle border-warning-border" },
  internal: { label: "In-App", color: "text-muted-foreground", bg: "bg-muted border-border" },
  guest: { label: "Guest", color: "text-muted-foreground", bg: "bg-muted border-border" },
};

const SENTIMENT_CFG: Record<string, { icon: any; color: string; bg: string }> = {
  positive: { icon: ThumbsUp, color: "text-success", bg: "bg-success-subtle" },
  negative: { icon: ThumbsDown, color: "text-danger", bg: "bg-danger-subtle" },
  neutral: { icon: Minus, color: "text-warning", bg: "bg-warning-subtle" },
};

function Stars({ rating }: { rating: number }) {
  return <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? "text-warning fill-warning" : "text-muted-foreground"}`} />)}</div>;
}

export default function ReviewManagement() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
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
    apiFetch(`/restaurants/${restaurantId}/reviews?${params}`).then(setData).catch((e) => {
      console.error(e);
      toast({ title: "Failed to load reviews", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [restaurantId, source, sentiment, replied]);

  async function handleReply(reviewId: number) {
    if (!restaurantId || !replyText.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/restaurants/${restaurantId}/reviews/${reviewId}/reply`, { method: "POST", body: JSON.stringify({ reply: replyText }) });
      setReplyText(""); setReplyingTo(null);
      load();
      toast({ title: "Reply posted", description: "Your response was published to the review." });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to post reply", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
    setSending(false);
  }

  const stats = data.stats || {};

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg"><Star className="h-6 w-6 text-muted-foreground" /></div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Review Management</h1>
            <p className="text-muted-foreground text-sm">Monitor and respond to customer reviews</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-muted hover-elevate text-muted-foreground rounded-lg text-sm transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Reviews", value: stats.total || 0, color: "text-foreground" },
          { label: "Avg Rating", value: String(stats.averageRating || "0"), color: "text-warning" },
          { label: "Positive", value: stats.positive || 0, color: "text-success" },
          { label: "Negative", value: stats.negative || 0, color: "text-danger" },
          { label: "Replied", value: stats.replied || 0, color: "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="bg-muted rounded-lg p-4 border border-border text-center">
            <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Source:</span>
          {["all", "google", "zomato", "swiggy", "internal"].map(s => (
            <button key={s} onClick={() => setSource(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${source === s ? "bg-muted text-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{s === "all" ? "All" : SOURCE_ICONS[s]?.label || s}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sentiment:</span>
          {["all", "positive", "negative", "neutral"].map(s => (
            <button key={s} onClick={() => setSentiment(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${sentiment === s ? "bg-muted text-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          {[["all", "All"], ["false", "Pending"], ["true", "Replied"]].map(([v, l]) => (
            <button key={v} onClick={() => setReplied(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${replied === v ? "bg-muted text-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border" /></div>
      ) : (
        <div className="space-y-4">
          {data.reviews.map((review: any) => {
            const src = SOURCE_ICONS[review.source] || SOURCE_ICONS.internal;
            const sent = SENTIMENT_CFG[review.sentiment] || SENTIMENT_CFG.neutral;
            const SentIcon = sent.icon;
            return (
              <div key={review.id} className="bg-muted rounded-lg border border-border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${src.bg} ${src.color}`}>{src.label}</span>
                      <span className={`p-1 rounded-lg ${sent.bg}`}><SentIcon className={`h-3 w-3 ${sent.color}`} /></span>
                      <Stars rating={review.rating} />
                      {review.replied && <span className="px-2 py-0.5 rounded-full text-xs bg-success-subtle text-success border border-success-border">Replied</span>}
                    </div>
                    <p className="text-foreground text-sm leading-relaxed">{review.text}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-muted-foreground">{review.reviewer}</span>
                      <span>•</span>
                      <span>{new Date(review.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                    {review.replied && review.reply && (
                      <div className="mt-3 pl-3 border-l-2 border-border">
                        <div className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1"><Reply className="h-3 w-3" /> Your Reply</div>
                        <p className="text-xs text-muted-foreground">{review.reply}</p>
                      </div>
                    )}
                  </div>
                </div>

                {!review.replied && (
                  <div className="mt-4 pt-4 border-t border-border">
                    {replyingTo === review.id ? (
                      <div className="space-y-2">
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} className="w-full bg-muted text-foreground text-sm rounded-lg px-3 py-2 border border-border focus:border-border outline-none resize-none" placeholder="Write a professional reply..." />
                        <div className="flex gap-2">
                          <button onClick={() => { setReplyingTo(null); setReplyText(""); }} className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs hover-elevate transition-colors">Cancel</button>
                          <button onClick={() => handleReply(review.id)} disabled={sending || !replyText.trim()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover-elevate text-foreground text-xs disabled:opacity-50 transition-colors">
                            <Send className="h-3 w-3" /> {sending ? "Sending..." : "Send Reply"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setReplyingTo(review.id); setReplyText(""); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-muted-foreground transition-colors">
                        <MessageSquare className="h-3.5 w-3.5" /> Reply to Review
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {data.reviews.length === 0 && <div className="text-center text-muted-foreground py-16"><Star className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No reviews found</p></div>}
        </div>
      )}
    </div>
  );
}
