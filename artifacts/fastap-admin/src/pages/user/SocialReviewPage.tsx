import { useState, useEffect, useCallback, useRef } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError, GuestEmpty } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  SOCIAL_FEATURES, RATING_CATEGORIES,
  SOCIAL_PLATFORMS, SHARE_TEMPLATES,
} from "@/lib/socialReviewCatalog";
import {
  ChevronLeft, Star, MessageSquare, Camera, Share2, Gift,
  CheckCircle, AlertCircle, Loader, RefreshCw, Heart, Upload, Copy, ExternalLink,
} from "lucide-react";
import { GuestIcon } from "@/components/user/GuestIcon";

type Tab = "ratings" | "reviews" | "photos" | "share" | "referral";

const TAB_MAP: Record<Tab, string> = {
  ratings: "ratings", reviews: "reviews", photos: "food_image_uploads",
  share: "social_sharing", referral: "referral_sharing",
};

function StarPicker({ value, onChange, size = "md" }: { value: number; onChange: (v: number) => void; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-5 w-5" : "h-8 w-8";
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5">
          <Star className={`${cls} ${n <= value ? "fill-warning text-warning" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`${cls} ${n <= Math.round(rating) ? "fill-warning text-warning" : "text-muted-foreground"}`} />
      ))}
    </div>
  );
}

export default function SocialReviewPage() {
  const [, navigate] = useAppLocation();
  const { venue, user, activeTable } = useUser();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.

  const slug = venue.restaurantSlug || params.get("slug") || DEMO_SLUG;

  const { toast: pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("ratings");
  const [stats, setStats] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [referral, setReferral] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [overall, setOverall] = useState(5);
  const [food, setFood] = useState(5);
  const [service, setService] = useState(5);
  const [ambience, setAmbience] = useState(5);
  const [comment, setComment] = useState("");
  const [shareTemplate, setShareTemplate] = useState("restaurant");
  const [dishName, setDishName] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const [photoCaption, setPhotoCaption] = useState("");

  const guestName = user?.name ?? "Guest";

  const load = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [ratingsRes, reviewsRes, photosRes, refRes] = await Promise.all([
        publicApi.social.ratings(slug),
        publicApi.social.reviews(slug),
        publicApi.social.foodPhotos(slug),
        publicApi.social.referral(slug, typeof window !== "undefined" ? window.location.origin : ""),
      ]);
      setStats(ratingsRes);
      setReviews(reviewsRes.reviews ?? []);
      setPhotos(photosRes.photos ?? []);
      setReferral(refRes);
      const featured = ratingsRes?.featuredDish || reviewsRes?.reviews?.[0]?.dishName;
      if (featured) setDishName(String(featured));
    } catch {
      setApiError("Could not load reviews and ratings.");
      setStats(null);
      setReviews([]);
      setPhotos([]);
      setReferral(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // One green tick banner was used for confirmations AND for failures, so "Permission
  // denied", "Sync failed" and "Image too large" all read as good news. `ok: false`
  // paints the same banner as a problem.
  function showToast(msg: string, ok = true) {
    setToast({ text: msg, ok });
    setTimeout(() => setToast(null), 2800);
  }

  async function handleSubmitReview() {
    setSubmitting(true);
    try {
      await publicApi.social.submitReview({
        restaurantId: venue.restaurantId ?? 1,
        customerName: guestName,
        rating: overall,
        foodRating: food,
        serviceRating: service,
        ambienceRating: ambience,
        comment,
      });
      showToast("Review submitted — thank you!");
      setComment("");
      load();
      setTab("reviews");
    } catch {
      pushToast({ title: "Error", description: "Could not submit review.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhotoUpload(file: File) {
    if (file.size > 1_500_000) { showToast("That photo is too large — please pick one under 1.5 MB", false); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await publicApi.social.uploadPhoto({
          restaurantId: venue.restaurantId ?? 1,
          imageData: reader.result as string,
          caption: photoCaption || file.name,
          uploader: guestName,
        });
        showToast("Photo uploaded!");
        setPhotoCaption("");
        load();
      } catch {
        pushToast({ title: "Error", description: "Could not upload photo.", variant: "destructive" });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleShare(platform: string) {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const res = await publicApi.social.share({
        slug, platform, template: shareTemplate, baseUrl,
        dishName: shareTemplate === "dish" ? dishName : undefined,
        rating: shareTemplate === "review" ? overall : undefined,
        reviewText: shareTemplate === "review" ? comment : undefined,
        table: activeTable || undefined,
      });
      // "native" → open the OS share sheet when the Web Share API is available.
      if (platform === "native" && typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: stats?.restaurantName ?? venue.restaurantName ?? "Restaurant", text: res.message, url: res.url });
          return;
        } catch (err) {
          if ((err as { name?: string })?.name === "AbortError") return; // guest dismissed the share sheet
          // any other failure → fall through to clipboard copy below
        }
      }
      if (platform === "copy" || platform === "native") {
        await navigator.clipboard?.writeText(res.message ?? res.url);
        showToast("Link copied!");
      } else if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
        showToast(`Opening ${platform}...`);
      }
    } catch {
      pushToast({ title: "Error", description: "Could not share.", variant: "destructive" });
    }
  }

  async function handleReferralShare(platform: string) {
    try {
      const res = await publicApi.social.trackReferralShare({
        restaurantId: venue.restaurantId ?? 1,
        slug,
        baseUrl: typeof window !== "undefined" ? window.location.origin : "",
      });
      const link = res.link ?? referral?.link;
      const venueName = stats?.restaurantName ?? venue.restaurantName ?? "our restaurant";
      const reward = res.friendReward ?? referral?.friendReward;
      // Was: "Use code SPICE1 for 10% off first order". No first-order discount exists —
      // nothing reads a referral code at checkout — so the guest was made to promise
      // their own friends something the venue would refuse at the till. The reward line
      // is included only if the venue actually sent one.
      const msg = reward
        ? `Join me at ${venueName}! Use code ${res.code ?? referral?.code} for ${reward}: ${typeof window !== "undefined" ? window.location.origin : ""}${link}`
        : `Join me at ${venueName} — order from your table with this link: ${typeof window !== "undefined" ? window.location.origin : ""}${link}`;
      if (platform === "copy") {
        await navigator.clipboard?.writeText(msg);
        showToast("Referral link copied!");
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
      }
      load();
    } catch {
      pushToast({ title: "Error", description: "Could not share referral link.", variant: "destructive" });
    }
  }

  async function handleLike(photoId: string) {
    try {
      await publicApi.social.likePhoto(photoId, venue.restaurantId ?? 1);
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, likes: (p.likes ?? 0) + 1 } : p));
    } catch {
      pushToast({ title: "Error", description: "Could not like photo.", variant: "destructive" });
    }
  }

  const breakdown = stats?.stats?.breakdown ?? { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const totalReviews = stats?.stats?.total ?? reviews.length;
  const avgRating = stats?.stats?.average ?? 0;

  const tabs: { id: Tab; label: string; icon: typeof Star }[] = [
    { id: "ratings", label: "Ratings", icon: Star },
    { id: "reviews", label: "Reviews", icon: MessageSquare },
    { id: "photos", label: "Photos", icon: Camera },
    { id: "share", label: "Share", icon: Share2 },
    { id: "referral", label: "Refer", icon: Gift },
  ];

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-28">
      <div className="guest-header border-b border-warning-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Social & Review System</p>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Star className="h-5 w-5 text-warning fill-warning" /> Reviews & Social
            </h1>
          </div>
          <button onClick={load} className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {toast && (
          <div
            role={toast.ok ? undefined : "alert"}
            className={`mx-4 mb-2 rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${toast.ok ? "border-success-border bg-success-subtle text-success" : "border-danger-border bg-danger-subtle text-danger"}`}
          >
            {toast.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {toast.text}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold ${
                tab === t.id ? "bg-warning-subtle border border-warning-border text-warning" : "bg-muted border border-border text-muted-foreground"
              }`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 space-y-4">
        {loading && <GuestLoading label="Loading reviews…" />}
        {!loading && apiError && (
          <GuestError message={apiError} onRetry={load} />
        )}
        {!loading && !apiError && (
        <>
        <div className="grid grid-cols-2 gap-2">
          {SOCIAL_FEATURES.map(f => (
            <button key={f.id} onClick={() => {
              const t = Object.entries(TAB_MAP).find(([, v]) => v === f.id)?.[0] as Tab | undefined;
              if (t) setTab(t);
            }}
              className={`rounded-xl border p-3 text-left ${TAB_MAP[tab] === f.id ? "border-warning-border bg-warning-subtle" : "border-border bg-muted"}`}>
              <GuestIcon id={f.id} className="h-5 w-5 text-primary" />
              <p className="text-xs font-semibold mt-1">{f.label}</p>
            </button>
          ))}
        </div>

        {/* Ratings */}
        {tab === "ratings" && (
          <>
            <p className="text-sm text-muted-foreground">{SOCIAL_FEATURES[0].desc}</p>

            <div className="rounded-2xl border border-warning-border p-6 text-center">
              <p className="text-5xl font-semibold text-warning">{avgRating}</p>
              <StarDisplay rating={avgRating} size="md" />
              <p className="text-sm text-muted-foreground mt-2">{totalReviews} reviews</p>
            </div>

            <div className="rounded-xl bg-muted border border-border p-4 space-y-2">
              {[5, 4, 3, 2, 1].map(star => {
                const count = breakdown[star] ?? 0;
                const pct = totalReviews ? (count / totalReviews) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <span className="w-10 text-muted-foreground flex items-center gap-0.5 tabular-nums">{star}<Star className="h-3 w-3 fill-current" /></span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-muted-foreground text-xs">{count}</span>
                  </div>
                );
              })}
            </div>

            {(stats?.categories ?? RATING_CATEGORIES.map(c => ({ id: c.id, label: c.label, score: avgRating }))).map((cat: { id: string; label: string; score: number }) => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl bg-muted border border-border">
                <span className="text-sm">{cat.label}</span>
                <div className="flex items-center gap-2">
                  <StarDisplay rating={cat.score} />
                  <span className="font-semibold text-warning">{cat.score}</span>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-border bg-muted p-4 space-y-4">
              <p className="font-semibold">Rate your experience</p>
              {[
                { label: "Overall", value: overall, set: setOverall },
                { label: "Food", value: food, set: setFood },
                { label: "Service", value: service, set: setService },
                { label: "Ambience", value: ambience, set: setAmbience },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <StarPicker value={r.value} onChange={r.set} size="sm" />
                </div>
              ))}
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional comment..."
                className="w-full rounded-xl bg-muted border border-border p-3 text-sm min-h-[80px] resize-none" />
              <button onClick={handleSubmitReview} disabled={submitting}
                className="w-full py-3 rounded-xl bg-primary font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader className="h-5 w-5 animate-spin" /> : <Star className="h-5 w-5" />}
                Submit Rating & Review
              </button>
            </div>
          </>
        )}

        {/* Reviews */}
        {tab === "reviews" && (
          <>
            <p className="text-sm text-muted-foreground">{SOCIAL_FEATURES[1].desc}</p>
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <GuestEmpty message="No reviews yet." />
              ) : reviews.map(review => (
                <div key={review.id} className="rounded-2xl border border-border bg-muted p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{review.reviewer}</p>
                      <p className="text-2xs text-muted-foreground">{new Date(review.date).toLocaleDateString()} · {review.source}</p>
                    </div>
                    <div className="text-right">
                      <StarDisplay rating={review.rating} />
                      <p className="text-xs text-warning font-semibold mt-0.5">{review.rating}/5</p>
                    </div>
                  </div>
                  {review.text && <p className="text-sm text-muted-foreground mt-2">{review.text}</p>}
                  {(review.foodRating || review.serviceRating) && (
                    <div className="flex gap-3 mt-2 text-2xs text-muted-foreground">
                      {review.foodRating && <span>Food {review.foodRating}</span>}
                      {review.serviceRating && <span>Service {review.serviceRating}</span>}
                      {review.ambienceRating && <span>Ambience {review.ambienceRating}</span>}
                    </div>
                  )}
                  {review.hasPhoto && (
                    <span className="inline-block mt-2 text-2xs px-2 py-0.5 rounded-full bg-warning-subtle text-warning">Has photo</span>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setTab("ratings")} className="w-full py-3 rounded-xl border border-warning-border text-warning font-semibold text-sm">
              Write a Review
            </button>
          </>
        )}

        {/* Food Photos */}
        {tab === "photos" && (
          <>
            <p className="text-sm text-muted-foreground">{SOCIAL_FEATURES[2].desc}</p>

            <div className="rounded-2xl border border-dashed border-warning-border bg-warning-subtle p-6 text-center">
              <Upload className="h-10 w-10 mx-auto text-warning mb-2" />
              <p className="font-semibold">Upload Food Photo</p>
              <p className="text-xs text-muted-foreground mt-1">JPG/PNG · max 1.5MB</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }} />
              <input value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} placeholder="Caption (optional)"
                className="w-full mt-3 rounded-xl bg-muted border border-border px-3 py-2 text-sm" />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="mt-3 px-6 py-2.5 rounded-xl bg-primary font-semibold text-sm disabled:opacity-50 flex items-center gap-2 mx-auto">
                {uploading ? <Loader className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Choose Photo
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {photos.length === 0 ? (
                <GuestEmpty message="No photos yet." />
              ) : photos.map(photo => (
                <div key={photo.id} className="rounded-2xl overflow-hidden border border-border bg-muted">
                  <img src={photo.url} alt={photo.caption} className="w-full aspect-square object-cover" />
                  <div className="p-3">
                    <p className="text-sm font-semibold truncate">{photo.caption}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-2xs text-muted-foreground">{photo.uploader}</p>
                      <button onClick={() => handleLike(photo.id)} className="flex items-center gap-1 text-xs text-primary">
                        <Heart className="h-3.5 w-3.5" /> {photo.likes ?? 0}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Social Sharing */}
        {tab === "share" && (
          <>
            <p className="text-sm text-muted-foreground">{SOCIAL_FEATURES[3].desc}</p>

            <p className="text-sm font-semibold">What to share</p>
            <div className="grid grid-cols-2 gap-2">
              {SHARE_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setShareTemplate(t.id)}
                  className={`p-3 rounded-xl border text-left text-sm font-semibold ${shareTemplate === t.id ? "border-warning-border bg-warning-subtle" : "border-border bg-muted"}`}>
                  <GuestIcon id={t.id} className="h-5 w-5 text-primary" />
                  <p className="mt-1">{t.label}</p>
                </button>
              ))}
            </div>

            {shareTemplate === "dish" && (
              <input value={dishName} onChange={e => setDishName(e.target.value)} placeholder="Dish name"
                className="w-full rounded-xl bg-muted border border-border px-4 py-3 text-sm" />
            )}

            <p className="text-sm font-semibold">Share via</p>
            <div className="grid grid-cols-3 gap-2">
              {SOCIAL_PLATFORMS.map(p => (
                <button key={p.id} onClick={() => handleShare(p.id)}
                  className="p-4 rounded-xl border border-border bg-muted text-center hover:border-warning-border active:scale-95 transition-all">
                  <GuestIcon id={p.id} className="h-5 w-5 mx-auto mb-1" />
                  <p className="text-2xs font-semibold mt-1">{p.label}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Referral Sharing */}
        {tab === "referral" && (
          <>
            <p className="text-sm text-muted-foreground">{SOCIAL_FEATURES[4].desc}</p>

            {/* The rewards here were constants — "You get ₹100 wallet credit", "Friend
                gets 10% off first order". `POST /public/social/referral/share` returns a
                code, a link and two counters and no reward of any kind; nothing credits a
                wallet on signup and no checkout reads a referral code. Shown only when
                the venue actually sends one. */}
            <div className="guest-section-card text-center">
              <Gift className="h-9 w-9 mx-auto text-primary mb-2" strokeWidth={1.5} />
              <p className="guest-section-label">Your referral code</p>
              <p className="text-3xl font-semibold my-2 font-mono">{referral?.code ?? "—"}</p>
              {referral?.reward
                ? <p className="text-sm text-muted-foreground">You get <span className="text-success font-medium">{referral.reward}</span></p>
                : <p className="text-sm text-muted-foreground">Share the venue with a friend — this code tracks who came from you.</p>}
              {referral?.friendReward && <p className="text-xs text-muted-foreground mt-1">Your friend gets {referral.friendReward}</p>}
            </div>

            <div className="rounded-xl bg-muted border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Referral link</p>
              <p className="text-sm font-mono break-all text-warning">{referral?.link ?? `...?slug=${slug}&ref=CODE`}</p>
              <button onClick={() => handleReferralShare("copy")}
                className="mt-3 w-full py-2.5 rounded-xl bg-muted font-semibold text-sm flex items-center justify-center gap-2">
                <Copy className="h-4 w-4" /> Copy Referral Link
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-muted border border-border p-4">
                <p className="text-2xl font-semibold text-warning">{referral?.shares ?? 0}</p>
                <p className="text-xs text-muted-foreground">Shares</p>
              </div>
              <div className="rounded-xl bg-muted border border-border p-4">
                <p className="text-2xl font-semibold text-success">{referral?.signups ?? 0}</p>
                <p className="text-xs text-muted-foreground">Friends joined</p>
              </div>
            </div>

            <button onClick={() => handleReferralShare("whatsapp")}
              className="w-full py-4 rounded-2xl bg-primary font-semibold flex items-center justify-center gap-2">
              <ExternalLink className="h-5 w-5" /> Share on WhatsApp
            </button>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
