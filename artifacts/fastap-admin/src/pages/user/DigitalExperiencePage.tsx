import { useCallback, useEffect, useState } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError, GuestEmpty } from "@/components/user/GuestApiState";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import { Gift, RefreshCw, Sparkles } from "lucide-react";

type LiveOffer = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  code?: string;
  discountPercent?: number;
  discountAmount?: number;
};

/**
 * Prize wheel / scratch / claim used to toast "Offer claimed — apply at checkout"
 * even though checkout never accepted those codes. This page stays browsable for
 * real venue campaigns, and labels interactive prizes as not collectable.
 */
export default function DigitalExperiencePage() {
  const { venue } = useUser();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const slug = venue.restaurantSlug || params.get("slug") || DEMO_SLUG;

  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [promoNote, setPromoNote] = useState("");
  const [scratchCards, setScratchCards] = useState<{ id: string; title: string; hidden: string }[]>([]);
  const [tapPromos, setTapPromos] = useState<{ id: string; emoji: string; title: string; reward: string }[]>([]);
  const [spinLabel, setSpinLabel] = useState("Spin & Win");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [offersRes, promosRes] = await Promise.all([
        publicApi.digitalExperience.offers(slug),
        publicApi.digitalExperience.promotions(slug),
      ]);
      setOffers(offersRes.offers ?? []);
      const collectable = promosRes.prizesCollectable === true;
      setPromoNote(
        collectable
          ? ""
          : (promosRes.prizesUnavailableReason
            || promosRes.spinWheel?.label
            || "Prize games are preview-only. Winnings cannot be applied at checkout yet."),
      );
      setSpinLabel(promosRes.spinWheel?.label || (collectable ? "Spin & Win" : "Preview only — not redeemable"));
      setScratchCards(promosRes.scratchCards ?? []);
      setTapPromos(promosRes.tapPromos ?? []);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Could not load digital experience.");
      setOffers([]);
      setScratchCards([]);
      setTapPromos([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-28">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Digital experience</p>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Offers & promos
            </h1>
          </div>
          <button type="button" onClick={load} className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center" aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-4">
        {loading && <GuestLoading label="Loading experience…" />}
        {!loading && apiError && <GuestError message={apiError} onRetry={load} />}
        {!loading && !apiError && (
          <>
            {promoNote && (
              <div className="rounded-xl border border-warning-border bg-warning-subtle px-3 py-2.5 text-xs text-warning">
                {promoNote}
              </div>
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Live offers</h2>
              {offers.length === 0 ? (
                <GuestEmpty message="No live offers right now." />
              ) : (
                offers.map(offer => (
                  <div key={offer.id} className="rounded-2xl border border-border bg-muted p-4">
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-muted text-primary">{offer.badge}</span>
                    <p className="font-semibold mt-2">{offer.title}</p>
                    <p className="text-xs text-muted-foreground">{offer.subtitle}</p>
                    {offer.code && (
                      <p className="text-2xs text-muted-foreground mt-2">
                        Code: <span className="font-mono">{offer.code}</span>
                        {" · "}ask staff to apply — in-app claim is not available
                      </p>
                    )}
                    <button
                      type="button"
                      disabled
                      title={promoNote || "Claim is not available"}
                      className="mt-3 px-4 py-2 rounded-xl bg-muted border border-border text-sm font-semibold text-muted-foreground opacity-70 cursor-not-allowed"
                    >
                      Claim unavailable
                    </button>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Gift className="h-4 w-4" /> Prize games</h2>
              <button
                type="button"
                disabled
                title={spinLabel}
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground opacity-70 cursor-not-allowed"
              >
                {spinLabel}
              </button>
              <div className="grid gap-2">
                {scratchCards.map(card => (
                  <div key={card.id} className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{card.title}</p>
                    <p>Hidden prize · not collectable</p>
                  </div>
                ))}
                {tapPromos.map(p => (
                  <div key={p.id} className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{p.emoji} {p.title}</p>
                    <p>{p.reward} · not collectable</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
