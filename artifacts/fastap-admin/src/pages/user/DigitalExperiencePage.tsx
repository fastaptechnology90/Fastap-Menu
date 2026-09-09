import { useState, useEffect, useCallback, useRef } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError, GuestEmpty } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useDigitalExperience } from "@/contexts/DigitalExperienceContext";
import { publicApi } from "@/lib/api";
import {
  DIGITAL_FEATURES, SPIN_WHEEL_SEGMENTS,
  FESTIVAL_THEMES, SEASONAL_ANIMATIONS, type LiveOffer, type VideoBanner,
} from "@/lib/digitalExperienceCatalog";
import {
  ChevronLeft, Flame, Film, Sparkles, Palette, Snowflake,
  CheckCircle, Loader, RefreshCw, ChevronRight, Gift, RotateCw,
} from "lucide-react";
import { GuestIcon } from "@/components/user/GuestIcon";

type Tab = "offers" | "videos" | "promos" | "themes" | "animations";

const TAB_MAP: Record<Tab, string> = {
  offers: "live_offers", videos: "video_banners", promos: "interactive_promotions",
  themes: "festival_themes", animations: "seasonal_animations",
};

function formatCountdown(expiresAt: string | null) {
  if (!expiresAt) return "Always on";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${s}s left`;
  return `${s}s left`;
}

export default function DigitalExperiencePage() {
  const [, navigate] = useAppLocation();
  const { venue } = useUser();
  const { festivalTheme, seasonalAnimation, setFestivalTheme, setSeasonalAnimation } = useDigitalExperience();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.

  const slug = venue.restaurantSlug || params.get("slug") || DEMO_SLUG;

  const { toast: pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("offers");
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [banners, setBanners] = useState<VideoBanner[]>([]);
  const [promoConfig, setPromoConfig] = useState<any>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [revealedScratch, setRevealedScratch] = useState<Set<string>>(new Set());
  const [revealedTap, setRevealedTap] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [offersRes, bannersRes, promosRes] = await Promise.all([
        publicApi.digitalExperience.offers(slug),
        publicApi.digitalExperience.banners(slug),
        publicApi.digitalExperience.promotions(slug),
      ]);
      setOffers(offersRes.offers ?? []);
      setBanners(bannersRes.banners ?? []);
      setPromoConfig(promosRes);
    } catch {
      setApiError("Could not load digital experience data.");
      setOffers([]);
      setBanners([]);
      setPromoConfig(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (tab !== "videos") return;
    const id = setInterval(() => setBannerIdx(i => (i + 1) % banners.length), 8000);
    return () => clearInterval(id);
  }, [tab, banners.length]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  async function handleClaim(offerId: string) {
    setClaiming(offerId);
    try {
      const res = await publicApi.digitalExperience.claimOffer(offerId);
      setClaimed(prev => new Set(prev).add(offerId));
      showToast(res.message ?? "Offer claimed!");
    } catch {
      pushToast({ title: "Error", description: "Could not claim offer.", variant: "destructive" });
    } finally {
      setClaiming(null);
    }
  }

  async function handleSpin() {
    if (spinning) return;
    setSpinning(true);
    setSpinResult(null);
    try {
      const res = await publicApi.digitalExperience.spin();
      const segCount = SPIN_WHEEL_SEGMENTS.length;
      const segAngle = 360 / segCount;
      const target = 360 * 5 + (360 - res.segmentIndex * segAngle - segAngle / 2);
      setWheelRotation(prev => prev + target);
      setTimeout(() => {
        setSpinResult(res.message);
        setSpinning(false);
        showToast(res.message);
      }, 4200);
    } catch {
      setSpinning(false);
      pushToast({ title: "Error", description: "Spin failed. Please try again.", variant: "destructive" });
    }
  }

  const currentBanner = banners[bannerIdx] ?? banners[0];
  const scratchCards = promoConfig?.scratchCards ?? [];
  const tapPromos = promoConfig?.tapPromos ?? [];

  const tabs: { id: Tab; label: string; icon: typeof Flame }[] = [
    { id: "offers", label: "Offers", icon: Flame },
    { id: "videos", label: "Videos", icon: Film },
    { id: "promos", label: "Promos", icon: Sparkles },
    { id: "themes", label: "Themes", icon: Palette },
    { id: "animations", label: "FX", icon: Snowflake },
  ];

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-28">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Digital Experience System</p>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--fest-primary,#f97316)]" /> Live Experience
            </h1>
          </div>
          <button onClick={load} className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {toast && (
          <div className="mx-4 mb-2 rounded-lg border border-success-border bg-success-subtle px-3 py-2 text-xs text-success flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> {toast}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold ${
                tab === t.id ? "bg-[var(--fest-primary,#f97316)]/25 border border-[var(--fest-primary,#f97316)]/50" : "bg-muted border border-border text-muted-foreground"
              }`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 space-y-4">
        {loading && <GuestLoading label="Loading experience…" />}
        {!loading && apiError && (
          <GuestError message={apiError} onRetry={load} />
        )}
        {!loading && !apiError && (
        <>
        <div className="grid grid-cols-2 gap-2">
          {DIGITAL_FEATURES.map(f => (
            <button key={f.id} onClick={() => {
              const t = Object.entries(TAB_MAP).find(([, v]) => v === f.id)?.[0] as Tab | undefined;
              if (t) setTab(t);
            }}
              className={`rounded-xl border p-3 text-left ${TAB_MAP[tab] === f.id ? "border-[var(--fest-primary,#f97316)]/40 bg-[var(--fest-primary,#f97316)]/10" : "border-border bg-muted"}`}>
              <GuestIcon id={f.id} className="h-5 w-5 text-primary" />
              <p className="text-xs font-semibold mt-1">{f.label}</p>
            </button>
          ))}
        </div>

        {/* Live Offers */}
        {tab === "offers" && (
          <>
            <p className="text-sm text-muted-foreground">{DIGITAL_FEATURES[0].desc}</p>
            <div className="flex items-center gap-2 text-xs text-danger">
              <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
              {offers.filter(o => o.badge === "LIVE NOW").length} live offer(s) right now
            </div>
            <div className="space-y-3">
              {offers.length === 0 ? (
                <GuestEmpty message="No live offers right now." />
              ) : offers.map(offer => (
                <div key={offer.id} className="rounded-2xl border border-border bg-muted overflow-hidden">
                  <div className="h-1 from-[var(--fest-primary,#f97316)] to-[var(--fest-secondary,#7c3aed)]" />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${offer.badge === "LIVE NOW" ? "bg-danger-subtle text-danger" : "bg-muted text-primary"}`}>
                          {offer.badge}
                        </span>
                        <p className="font-semibold mt-2">{offer.title}</p>
                        <p className="text-xs text-muted-foreground">{offer.subtitle}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {offer.discountPercent && <p className="text-2xl font-semibold text-[var(--fest-primary,#f97316)]">{offer.discountPercent}%</p>}
                        {offer.discountAmount && !offer.discountPercent && <p className="text-xl font-semibold text-[var(--fest-primary,#f97316)]">₹{offer.discountAmount}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <div>
                        <p className="text-2xs text-muted-foreground">Code: <span className="font-mono text-muted-foreground">{offer.code}</span></p>
                        <p className="text-xs text-warning mt-0.5">{formatCountdown(offer.expiresAt)}</p>
                      </div>
                      <button onClick={() => handleClaim(offer.id)} disabled={claiming === offer.id || claimed.has(offer.id)}
                        className="px-4 py-2 rounded-xl bg-[var(--fest-primary,#f97316)] text-sm font-semibold disabled:opacity-50 flex items-center gap-1">
                        {claiming === offer.id ? <Loader className="h-4 w-4 animate-spin" /> : claimed.has(offer.id) ? "Claimed" : "Claim"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Video Banners */}
        {tab === "videos" && banners.length === 0 && (
          <GuestEmpty message="No video banners available." />
        )}
        {tab === "videos" && currentBanner && (
          <>
            <p className="text-sm text-muted-foreground">{DIGITAL_FEATURES[1].desc}</p>
            <div className="rounded-2xl overflow-hidden border border-border bg-black relative aspect-video">
              {currentBanner.videoUrl ? (
                <video ref={videoRef} key={currentBanner.id} src={currentBanner.videoUrl} poster={currentBanner.posterUrl}
                  className="w-full h-full object-cover" autoPlay muted loop playsInline />
              ) : (
                <img src={currentBanner.posterUrl} alt={currentBanner.title} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="font-semibold text-lg">{currentBanner.title}</p>
                <p className="text-sm text-muted-foreground">{currentBanner.subtitle}</p>
                <button onClick={() => navigate("/user/menu")} className="mt-2 px-4 py-2 rounded-xl bg-[var(--fest-primary,#f97316)] text-sm font-semibold">
                  {currentBanner.cta}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => setBannerIdx(i => (i - 1 + banners.length) % banners.length)} className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex gap-1.5">
                {banners.map((b, i) => (
                  <button key={b.id} onClick={() => setBannerIdx(i)} className={`h-2 rounded-full transition-all ${i === bannerIdx ? "w-6 bg-[var(--fest-primary,#f97316)]" : "w-2 bg-muted"}`} />
                ))}
              </div>
              <button onClick={() => setBannerIdx(i => (i + 1) % banners.length)} className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </>
        )}

        {/* Interactive Promotions */}
        {tab === "promos" && (
          <>
            <p className="text-sm text-muted-foreground">{DIGITAL_FEATURES[2].desc}</p>

            <div className="rounded-2xl border border-border bg-muted p-6 text-center">
              <p className="text-sm font-semibold mb-4 flex items-center justify-center gap-2"><Gift className="h-4 w-4" /> Spin & Win</p>
              <div className="relative mx-auto w-56 h-56">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-white" />
                <div className="w-full h-full rounded-full border-4 border-border overflow-hidden transition-transform duration-[4000ms] ease-out"
                  style={{ transform: `rotate(${wheelRotation}deg)` }}>
                  {SPIN_WHEEL_SEGMENTS.map((seg, i) => {
                    const angle = 360 / SPIN_WHEEL_SEGMENTS.length;
                    return (
                      <div key={seg.id} className="absolute w-1/2 h-1/2 origin-bottom-right left-1/2 top-0"
                        style={{ transform: `rotate(${i * angle}deg) skewY(${90 - angle}deg)`, background: seg.color }}>
                        <span className={`absolute text-2xs font-semibold whitespace-nowrap ${i % 2 === 0 ? "text-primary-foreground" : "text-foreground"}`}
                          style={{ transform: `skewY(${angle - 90}deg) rotate(${angle / 2}deg)`, left: "20%", top: "30%" }}>
                          {seg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={handleSpin} disabled={spinning}
                  className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-[var(--fest-accent,#0b1120)] border-2 border-border font-semibold text-xs flex items-center justify-center disabled:opacity-50">
                  {spinning ? <Loader className="h-5 w-5 animate-spin" /> : <RotateCw className="h-5 w-5" />}
                </button>
              </div>
              {spinResult && (
                <div role="status" className="mt-4">
                  <p className="font-semibold">{spinResult}</p>
                  <p className="text-xs text-muted-foreground mt-1">Show this to a member of staff to claim it.</p>
                </div>
              )}
            </div>

            <p className="text-sm font-semibold">Scratch Cards</p>
            <p className="text-xs text-muted-foreground -mt-1">Show the reveal to a member of staff — these are not applied automatically at checkout.</p>
            <div className="grid grid-cols-3 gap-2">
              {scratchCards.map((sc: { id: string; title: string; hidden: string }) => (
                // Revealing is local only — nothing is claimed, coded or redeemable,
                // and a reload hides it again. Say what it is rather than dressing a
                // React Set up as a prize.
                <button key={sc.id} onClick={() => setRevealedScratch(prev => new Set(prev).add(sc.id))}
                  className={`aspect-square rounded-xl border p-2 text-center text-xs font-semibold transition-all ${
                    revealedScratch.has(sc.id) ? "border-success-border bg-success-subtle text-success" : "border-border text-transparent"
                  }`}>
                  {revealedScratch.has(sc.id) ? sc.hidden : sc.title}
                </button>
              ))}
            </div>

            <p className="text-sm font-semibold">Tap to Reveal</p>
            <p className="text-xs text-muted-foreground -mt-1">Show the reveal to a member of staff — these are not applied automatically at checkout.</p>
            <div className="space-y-2">
              {tapPromos.map((tp: { id: string; emoji: string; title: string; reward: string }) => (
                <button key={tp.id} onClick={() => { setRevealedTap(prev => new Set(prev).add(tp.id)); showToast(`${tp.reward} — show this to a member of staff`); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left ${revealedTap.has(tp.id) ? "border-success-border bg-success-subtle" : "border-border bg-muted"}`}>
                  <GuestIcon id={tp.id} className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-semibold">{tp.title}</p>
                    <p className="text-xs text-muted-foreground">{revealedTap.has(tp.id) ? tp.reward : "Tap to reveal reward"}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Festival Themes */}
        {tab === "themes" && (
          <>
            <p className="text-sm text-muted-foreground">{DIGITAL_FEATURES[3].desc}</p>
            <p className="text-xs text-muted-foreground">Active: <span className="text-[var(--fest-primary,#f97316)] capitalize">{festivalTheme}</span> — applies across the app</p>
            <div className="grid grid-cols-2 gap-3">
              {FESTIVAL_THEMES.map(theme => (
                <button key={theme.id} onClick={() => { setFestivalTheme(theme.id); showToast(`${theme.label} theme applied`); }}
                  className={`rounded-2xl border p-4 text-left transition-all ${festivalTheme === theme.id ? "border-[var(--fest-primary,#f97316)] ring-2 ring-[var(--fest-primary,#f97316)]/30" : "border-border"}`}
                  style={{ background: `linear-gradient(135deg, ${theme.primary}22, ${theme.secondary}18)` }}>
                  <GuestIcon id={theme.id} className="h-6 w-6 text-primary" />
                  <p className="font-semibold mt-2">{theme.label}</p>
                  <div className="flex gap-1 mt-2">
                    <span className="h-4 w-4 rounded-full" style={{ background: theme.primary }} />
                    <span className="h-4 w-4 rounded-full" style={{ background: theme.secondary }} />
                  </div>
                  {festivalTheme === theme.id && <p className="text-2xs text-success mt-2">Active</p>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Seasonal Animations */}
        {tab === "animations" && (
          <>
            <p className="text-sm text-muted-foreground">{DIGITAL_FEATURES[4].desc}</p>
            <p className="text-xs text-muted-foreground">Active: <span className="capitalize">{seasonalAnimation}</span> — visible app-wide overlay</p>
            <div className="grid grid-cols-2 gap-3">
              {SEASONAL_ANIMATIONS.map(anim => (
                <button key={anim.id} onClick={() => { setSeasonalAnimation(anim.id); showToast(anim.id === "none" ? "Animations off" : `${anim.label} enabled`); }}
                  className={`rounded-2xl border p-4 text-center ${seasonalAnimation === anim.id ? "border-[var(--fest-primary,#f97316)] bg-[var(--fest-primary,#f97316)]/10" : "border-border bg-muted"}`}>
                  <GuestIcon id={anim.id} className="h-6 w-6 text-primary" />
                  <p className="font-semibold text-sm mt-2">{anim.label}</p>
                  {anim.particles > 0 && <p className="text-2xs text-muted-foreground">{anim.particles} particles</p>}
                  {seasonalAnimation === anim.id && <p className="text-2xs text-success mt-1">Active</p>}
                </button>
              ))}
            </div>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
