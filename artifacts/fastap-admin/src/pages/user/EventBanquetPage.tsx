import { useState, useEffect, useCallback, useMemo } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestEmpty } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useGuestBack } from "@/hooks/useGuestBack";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  EVENT_TYPES, SEATING_LAYOUTS,
  type EventTypeId, type GuestInvitation, type EventQuotation,
} from "@/lib/eventBanquetCatalog";
import {
  ChevronRight, CheckCircle2, Users, Calendar, Clock,
  MapPin, FileText, Send, Plus, Trash2, LayoutGrid, Info, CalendarDays,
  Heart, Cake, Gem, Briefcase, Mic, Martini, Waves, Music, Building2,
  Rows3, Circle, Grid3x3, GraduationCap, Umbrella, PartyPopper,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Step = "type" | "hall" | "layout" | "catering" | "decor" | "quote" | "details" | "invites" | "success";
type Tab = "plan" | "my";

// ── Live-catalog shapes ──────────────────────────────────────────────────────
type CatalogHall = { id: string; name: string; capacity: number; area: string; rate: number; image?: string; features: readonly string[] | string[]; preview: string };
type CatalogCatering = { id: string; label: string; icon?: string; perGuest: number; desc: string; items: readonly string[] | string[] };
type CatalogDecor = { id: string; label: string; icon?: string; price: number; desc: string };
type CatalogLayout = { id: string; label: string; icon?: string; capacityFactor?: number; desc: string; rows: number; cols: number };
type CatalogEventType = { id: string; label: string; icon?: string; desc?: string; hallTypes: readonly string[] | string[] };
type EventCatalog = {
  eventTypes: CatalogEventType[];
  seatingLayouts: CatalogLayout[];
  halls: CatalogHall[];
  cateringPackages: CatalogCatering[];
  decorationPackages: CatalogDecor[];
  configured: boolean;
  notice: string | null;
  restaurantName?: string;
};

/**
 * What this venue actually offers, and nothing else.
 *
 * This page used to carry six invented halls — "Grand Banquet Hall, 5000 sq ft,
 * 25,000" — six catering packages at 450-1,800 a head and seven decoration packages,
 * and it fell back to them whenever the venue had published none. So a guest sitting in
 * a 40-cover cafe was quoted a wedding in a room that does not exist, and the venue's
 * own staff then had to explain the quote away.
 *
 * `GET /public/events/catalog/:id` answers this honestly: it returns the venue's own
 * spaces when the owner has published them, and `configured: false` with a notice when
 * they have not. Event types ("Wedding") and seating layouts ("Theatre style") are
 * industry vocabulary rather than claims about the venue, so those stay local as a
 * fallback. Nothing with a price in it does.
 */
const EMPTY_CATALOG: EventCatalog = {
  eventTypes: EVENT_TYPES as unknown as CatalogEventType[],
  seatingLayouts: SEATING_LAYOUTS as unknown as CatalogLayout[],
  halls: [],
  cateringPackages: [],
  decorationPackages: [],
  configured: false,
  notice: null,
};

const EVENT_TYPE_ICON: Record<string, LucideIcon> = {
  wedding: Heart, birthday: Cake, engagement: Gem, corporate: Briefcase,
  conference: Mic, cocktail: Martini, pool_party: Waves, live_music: Music,
};

const LAYOUT_ICON: Record<string, LucideIcon> = {
  theatre: Rows3, banquet: Circle, cocktail: Martini,
  u_shape: Grid3x3, classroom: GraduationCap, poolside: Umbrella,
};

function SeatingPreview({ layoutId, guestCount, layouts }: { layoutId: string; guestCount: number; layouts: CatalogLayout[] }) {
  const layout = layouts.find(l => l.id === layoutId) ?? layouts[0];
  if (!layout) return null;
  const cells = layout.rows * layout.cols;
  const filled = Math.min(guestCount, cells);
  return (
    <div className="guest-section-card">
      <p className="text-xs text-muted-foreground mb-3 text-center">{layout.label} — {layout.desc}</p>
      <div className="flex justify-center">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cells }).map((_, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-xs ${i < filled ? "bg-primary" : "bg-muted"} ${layoutId === "banquet" && i % 5 === 0 ? "rounded-full h-4 w-4" : ""}`}
            />
          ))}
        </div>
      </div>
      <p className="text-2xs text-muted-foreground text-center mt-2">
        {filled} / {layout.capacityFactor ? Math.round(guestCount * layout.capacityFactor) : guestCount} seats mapped
      </p>
    </div>
  );
}

export default function EventBanquetPage() {
  const [, navigate] = useAppLocation();
  const goBack = useGuestBack();
  const { venue, user, activeRestaurant } = useUser();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.
  const slug = venue.restaurantSlug || params.get("slug") || DEMO_SLUG;

  const [tab, setTab] = useState<Tab>("plan");
  const [step, setStep] = useState<Step>("type");
  const [eventType, setEventType] = useState<EventTypeId>("wedding");
  const [eventName, setEventName] = useState("");
  const [hallId, setHallId] = useState("");
  const [layoutId, setLayoutId] = useState("banquet");
  const [cateringId, setCateringId] = useState("");
  const [decorId, setDecorId] = useState("");
  const [guestCount, setGuestCount] = useState(100);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("18:00");
  const [notes, setNotes] = useState("");
  const [quotation, setQuotation] = useState<EventQuotation | null>(null);
  const [invitations, setInvitations] = useState<GuestInvitation[]>([]);
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enquiryToken, setEnquiryToken] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const { toast } = useToast();

  const [catalog, setCatalog] = useState<EventCatalog>(EMPTY_CATALOG);

  useEffect(() => {
    if (!venue.restaurantId) return;
    let cancelled = false;
    publicApi.events.catalog(venue.restaurantId)
      .then((res: Partial<EventCatalog> | null) => {
        if (cancelled || !res) return;
        const liveTypes = Array.isArray(res.eventTypes) && res.eventTypes.length
          ? res.eventTypes.map(t => ({ ...t, desc: t.desc ?? EVENT_TYPES.find(e => e.id === t.id)?.desc ?? "" }))
          : EMPTY_CATALOG.eventTypes;
        setCatalog({
          eventTypes: liveTypes,
          seatingLayouts: Array.isArray(res.seatingLayouts) && res.seatingLayouts.length ? res.seatingLayouts : EMPTY_CATALOG.seatingLayouts,
          // No fallback: an unpublished space list stays empty rather than borrowing
          // another venue's rooms and rates.
          halls: Array.isArray(res.halls) ? res.halls : [],
          cateringPackages: Array.isArray(res.cateringPackages) ? res.cateringPackages : [],
          decorationPackages: Array.isArray(res.decorationPackages) ? res.decorationPackages : [],
          configured: res.configured === true,
          notice: res.notice ?? null,
          restaurantName: res.restaurantName,
        });
      })
      .catch(() => { /* stays unconfigured — an enquiry still goes through */ });
    return () => { cancelled = true; };
  }, [venue.restaurantId]);

  /** True only when the venue has published at least one space with a rate. */
  const priced = catalog.configured && catalog.halls.length > 0;

  const halls = useMemo(() => {
    const t = catalog.eventTypes.find(e => e.id === eventType);
    if (!t || !Array.isArray(t.hallTypes) || t.hallTypes.length === 0) return catalog.halls;
    const filtered = catalog.halls.filter(h => t.hallTypes.includes(h.id));
    return filtered.length ? filtered : catalog.halls;
  }, [catalog, eventType]);

  const selectedHall = catalog.halls.find(h => h.id === hallId) ?? halls[0];

  useEffect(() => {
    if (halls.length && !halls.find(h => h.id === hallId)) setHallId(halls[0].id);
  }, [halls, hallId]);
  useEffect(() => {
    if (catalog.cateringPackages.length && !catalog.cateringPackages.find(c => c.id === cateringId)) setCateringId(catalog.cateringPackages[0].id);
  }, [catalog.cateringPackages, cateringId]);
  useEffect(() => {
    if (catalog.decorationPackages.length && !catalog.decorationPackages.find(d => d.id === decorId)) setDecorId(catalog.decorationPackages[0].id);
  }, [catalog.decorationPackages, decorId]);

  // The quotation comes from the server against the venue's published rates. The page
  // used to compute one locally from its own constants and show that when the call
  // failed, which is how a guest ended up holding a price nobody at the venue had set.
  const refreshQuote = useCallback(async () => {
    if (!priced || !venue.restaurantId || !hallId) { setQuotation(null); return; }
    try {
      const res = await publicApi.events.quotation({ hallId, guestCount, cateringPackageId: cateringId, decorationPackageId: decorId });
      setQuotation(res.quotation ?? null);
    } catch {
      setQuotation(null);
    }
  }, [priced, hallId, guestCount, cateringId, decorId, venue.restaurantId]);

  useEffect(() => {
    if (step === "quote") refreshQuote();
  }, [step, refreshQuote]);

  const loadMyEvents = useCallback(async () => {
    if (!venue.restaurantId || !user?.mobile) return;
    try {
      setMyEvents(await publicApi.events.my(venue.restaurantId, user.mobile));
    } catch { setMyEvents([]); }
  }, [venue.restaurantId, user?.mobile]);

  useEffect(() => { if (tab === "my") loadMyEvents(); }, [tab, loadMyEvents]);

  function addInvitation() {
    if (!inviteName.trim()) return;
    setInvitations(prev => [...prev, {
      id: `local-${Date.now()}`,
      name: inviteName.trim(),
      phone: invitePhone || undefined,
      email: inviteEmail || undefined,
      status: "pending",
    }]);
    setInviteName("");
    setInvitePhone("");
    setInviteEmail("");
  }

  async function submitEnquiry() {
    setSubmitting(true);
    const hall = catalog.halls.find(h => h.id === hallId);
    try {
      const res = await publicApi.events.enquiry({
        restaurantId: venue.restaurantId ?? 1,
        name: eventName || `${catalog.eventTypes.find(t => t.id === eventType)?.label} Event`,
        type: eventType,
        eventDate,
        eventTime,
        guestCount,
        contactName: user?.name || "Guest",
        contactPhone: user?.mobile || "",
        notes,
        venue: hall?.name,
        hallId: priced ? hallId : undefined,
        seatingLayout: layoutId,
        cateringPackageId: priced ? cateringId : undefined,
        decorationPackageId: priced ? decorId : undefined,
        guestInvitations: invitations,
        quotation,
      });
      setEnquiryToken(res.enquiryToken ?? `EVT-${res.id}`);
      if (res.id && invitations.length > 0) {
        // The enquiry itself is already saved, so a failed invite send is a
        // partial success, not a reason to discard the whole form.
        await publicApi.events.sendInvitations(res.id, invitations.map(i => ({ name: i.name, phone: i.phone, email: i.email })))
          .catch(() => toast({ title: "Enquiry sent, invitations were not", description: "Your event request went through. Send the invitations again from your bookings.", variant: "destructive" }));
      }
      setStep("success");
    } catch {
      toast({ title: "Could not send", description: "Your event enquiry did not go through. Try again in a moment.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // A venue with no published spaces has nothing to choose between and nothing to
  // price, so those four steps are not shown at all rather than shown empty.
  const STEPS: Step[] = priced
    ? ["type", "hall", "layout", "catering", "decor", "quote", "invites"]
    : ["type", "details", "invites"];
  const stepIdx = Math.max(0, STEPS.indexOf(step));

  function goNext() {
    const next = STEPS[stepIdx + 1];
    if (next) setStep(next);
  }

  const canSubmit = Boolean(eventDate) && !submitting;

  return (
    <div className="guest-page thin-scroll min-h-screen pb-12">
      <div className="guest-header px-4 py-3">
        <div className="flex items-center gap-3">
          <GuestBackButton
            onClick={() => (step === "type" && tab === "plan" ? goBack() : step === "type" ? setTab("plan") : setStep(STEPS[Math.max(0, stepIdx - 1)]))}
          />
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-lg">Events &amp; Banquet</h1>
            <p className="text-xs text-muted-foreground truncate">{activeRestaurant}</p>
          </div>
        </div>
        {tab === "plan" && step !== "success" && (
          <div className="flex gap-1 mt-3" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={stepIdx + 1}>
            {STEPS.map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full ${i <= stepIdx ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        )}
      </div>

      {step === "success" ? (
        <div className="px-4 pt-10 text-center">
          <CheckCircle2 className="h-14 w-14 text-success mx-auto mb-4" strokeWidth={1.5} />
          <h2 className="text-2xl font-semibold mb-2">Enquiry sent</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            The events team at {catalog.restaurantName || activeRestaurant} will come back to you with
            availability{priced ? " and confirm the quote" : ", spaces and rates"}.
          </p>
          <div className="guest-section-card max-w-sm mx-auto mb-6">
            <p className="text-xs text-muted-foreground">Reference</p>
            <p className="text-2xl font-mono tabular-nums text-primary">{enquiryToken}</p>
            {quotation && <p className="text-sm text-muted-foreground mt-2">Indicative total ₹{quotation.total.toLocaleString("en-IN")}</p>}
          </div>
          <button onClick={() => navigate(`/user/menu?slug=${slug}`)} className="guest-btn-primary px-8 py-3">Done</button>
        </div>
      ) : (
        <>
          <div className="mx-4 mt-4 guest-tab-row">
            {(["plan", "my"] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); if (t === "plan") setStep("type"); }} className={`guest-tab ${tab === t ? "guest-tab--active" : ""}`}>
                {t === "plan" ? "Plan an event" : "My enquiries"}
              </button>
            ))}
          </div>

          {tab === "my" && (
            <div className="px-4 mt-4 space-y-3">
              {myEvents.length === 0 ? (
                <GuestEmpty
                  icon={CalendarDays}
                  title="No enquiries yet"
                  message="Event enquiries you send appear here with their reference and status."
                  actionLabel="Plan an event"
                  onAction={() => { setTab("plan"); setStep("type"); }}
                />
              ) : myEvents.map(ev => {
                const meta = (ev.metadata ?? {}) as Record<string, unknown>;
                const quote = meta.quotation as EventQuotation | undefined;
                return (
                  <div key={ev.id} className="guest-card p-4">
                    <div className="flex justify-between gap-3 mb-2">
                      <p className="font-medium">{ev.name}</p>
                      <span className="guest-pill shrink-0">{ev.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {catalog.eventTypes.find(t => t.id === ev.type)?.label ?? ev.type} · {ev.guestCount} guests
                    </p>
                    {quote?.total != null && <p className="text-sm text-primary mt-1">Quoted ₹{quote.total.toLocaleString("en-IN")}</p>}
                    {Array.isArray(meta.guestInvitations) && (meta.guestInvitations as unknown[]).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">{(meta.guestInvitations as unknown[]).length} invitations sent</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "plan" && step === "type" && (
            <div className="px-4 mt-4 space-y-4">
              {!priced && catalog.notice && (
                <div className="guest-section-card flex gap-3">
                  <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">{catalog.notice}</p>
                </div>
              )}
              <p className="guest-section-label">Select event type</p>
              <div className="grid grid-cols-2 gap-2">
                {catalog.eventTypes.map(t => {
                  const TypeIcon = EVENT_TYPE_ICON[t.id] ?? PartyPopper;
                  const active = eventType === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setEventType(t.id as EventTypeId); goNext(); }}
                      className={`guest-card guest-card-interactive flex flex-col items-start gap-1.5 p-3 text-left min-h-[104px] ${active ? "ring-1 ring-primary" : ""}`}
                    >
                      <TypeIcon className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">{t.label}</span>
                      <span className="text-2xs text-muted-foreground">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "plan" && step === "hall" && (
            <div className="px-4 mt-4 space-y-3">
              <p className="guest-section-label flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Spaces at {catalog.restaurantName || activeRestaurant}</p>
              {halls.map(h => (
                <button key={h.id} onClick={() => setHallId(h.id)} className={`guest-card guest-card-interactive w-full p-4 text-left ${hallId === h.id ? "ring-1 ring-primary" : ""}`}>
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{h.name}</p>
                      <p className="text-xs text-muted-foreground">{h.area} · up to {h.capacity} guests · ₹{h.rate.toLocaleString("en-IN")}</p>
                      <p className="text-xs text-muted-foreground mt-2">{h.preview}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {h.features.slice(0, 4).map(f => <span key={f} className="guest-pill text-2xs px-2 py-0.5">{f}</span>)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              <button onClick={goNext} className="guest-btn-primary w-full py-3.5">
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {tab === "plan" && step === "layout" && (
            <div className="px-4 mt-4 space-y-3">
              <p className="guest-section-label flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Seating layout</p>
              {catalog.seatingLayouts.map(l => {
                const LayoutIcon = LAYOUT_ICON[l.id] ?? LayoutGrid;
                return (
                  <button key={l.id} onClick={() => setLayoutId(l.id)} className={`guest-card guest-card-interactive w-full p-3 text-left ${layoutId === l.id ? "ring-1 ring-primary" : ""}`}>
                    <p className="font-medium text-sm flex items-center gap-2"><LayoutIcon className="h-4 w-4 text-primary" /> {l.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{l.desc}</p>
                  </button>
                );
              })}
              <div className="flex items-center gap-4 justify-center py-2">
                <button aria-label="Fewer guests" onClick={() => setGuestCount(g => Math.max(10, g - 10))} className="guest-btn-secondary h-11 w-11 p-0">−</button>
                <span className="text-xl font-semibold tabular-nums">{guestCount} guests</span>
                <button aria-label="More guests" onClick={() => setGuestCount(g => Math.min(selectedHall?.capacity ?? 500, g + 10))} className="guest-btn-primary h-11 w-11 p-0">+</button>
              </div>
              <SeatingPreview layoutId={layoutId} guestCount={guestCount} layouts={catalog.seatingLayouts} />
              <button onClick={goNext} className="guest-btn-primary w-full py-3.5">Continue</button>
            </div>
          )}

          {tab === "plan" && step === "catering" && (
            <div className="px-4 mt-4 space-y-3">
              <p className="guest-section-label">Catering package</p>
              {catalog.cateringPackages.map(c => (
                <button key={c.id} onClick={() => setCateringId(c.id)} className={`guest-card guest-card-interactive w-full p-4 text-left ${cateringId === c.id ? "ring-1 ring-primary" : ""}`}>
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-primary tabular-nums shrink-0">₹{c.perGuest}/guest</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                  <ul className="text-2xs text-muted-foreground mt-2 space-y-0.5">
                    {c.items.map(i => <li key={i}>· {i}</li>)}
                  </ul>
                </button>
              ))}
              <button onClick={goNext} className="guest-btn-primary w-full py-3.5">Continue</button>
            </div>
          )}

          {tab === "plan" && step === "decor" && (
            <div className="px-4 mt-4 space-y-3">
              <p className="guest-section-label">Decoration package</p>
              {catalog.decorationPackages.map(d => (
                <button key={d.id} onClick={() => setDecorId(d.id)} className={`guest-card guest-card-interactive w-full p-4 text-left ${decorId === d.id ? "ring-1 ring-primary" : ""}`}>
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{d.label}</span>
                    <span className="text-primary tabular-nums shrink-0">₹{d.price.toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{d.desc}</p>
                </button>
              ))}
              <button onClick={goNext} className="guest-btn-primary w-full py-3.5">View quotation</button>
            </div>
          )}

          {tab === "plan" && step === "quote" && (
            <div className="px-4 mt-4 space-y-4">
              <p className="guest-section-label flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Event quotation</p>
              {quotation ? (
                <div className="guest-section-card space-y-2">
                  {quotation.lines.map(l => (
                    <div key={l.label} className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground">{l.label}</span>
                      <span className="tabular-nums">₹{l.amount.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span><span className="tabular-nums">₹{quotation.subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>GST (5%)</span><span className="tabular-nums">₹{quotation.tax.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span><span className="tabular-nums">₹{quotation.total.toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Advance 30% — ₹{quotation.advance.toLocaleString("en-IN")}. Indicative until the venue confirms.</p>
                </div>
              ) : (
                <div className="guest-section-card flex gap-3">
                  <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">The venue will price this enquiry and reply with a quotation.</p>
                </div>
              )}
              <EventDetailsFields
                eventName={eventName} setEventName={setEventName}
                eventDate={eventDate} setEventDate={setEventDate}
                eventTime={eventTime} setEventTime={setEventTime}
                notes={notes} setNotes={setNotes}
              />
              <button onClick={goNext} disabled={!eventDate} className="guest-btn-primary w-full py-3.5 disabled:opacity-40">Guest invitations</button>
            </div>
          )}

          {tab === "plan" && step === "details" && (
            <div className="px-4 mt-4 space-y-4">
              <p className="guest-section-label flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Your event</p>
              <div className="flex items-center gap-4 justify-center py-2">
                <button aria-label="Fewer guests" onClick={() => setGuestCount(g => Math.max(10, g - 10))} className="guest-btn-secondary h-11 w-11 p-0">−</button>
                <span className="text-xl font-semibold tabular-nums">{guestCount} guests</span>
                <button aria-label="More guests" onClick={() => setGuestCount(g => g + 10)} className="guest-btn-primary h-11 w-11 p-0">+</button>
              </div>
              <EventDetailsFields
                eventName={eventName} setEventName={setEventName}
                eventDate={eventDate} setEventDate={setEventDate}
                eventTime={eventTime} setEventTime={setEventTime}
                notes={notes} setNotes={setNotes}
              />
              <button onClick={goNext} disabled={!eventDate} className="guest-btn-primary w-full py-3.5 disabled:opacity-40">Guest invitations</button>
            </div>
          )}

          {tab === "plan" && step === "invites" && (
            <div className="px-4 mt-4 space-y-4">
              <p className="guest-section-label flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /> Guest invitations (optional)</p>
              <div className="guest-section-card space-y-3">
                <input className="guest-input" placeholder="Guest name" value={inviteName} onChange={e => setInviteName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="guest-input" inputMode="tel" placeholder="Phone" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} />
                  <input className="guest-input" inputMode="email" placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                </div>
                <button onClick={addInvitation} className="guest-btn-secondary w-full py-2.5 text-sm">
                  <Plus className="h-4 w-4" /> Add guest
                </button>
              </div>
              {invitations.length > 0 && (
                <div className="space-y-2">
                  {invitations.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-muted text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{inv.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{inv.phone || inv.email || "—"}</p>
                      </div>
                      <button aria-label={`Remove ${inv.name}`} onClick={() => setInvitations(prev => prev.filter(i => i.id !== inv.id))} className="text-danger h-9 w-9 flex items-center justify-center shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {invitations.length} {invitations.length === 1 ? "guest" : "guests"} will be invited when you send
                  </p>
                </div>
              )}
              <button onClick={submitEnquiry} disabled={!canSubmit} className="guest-btn-primary w-full py-4 disabled:opacity-40">
                {submitting ? "Sending…" : "Send event enquiry"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventDetailsFields({
  eventName, setEventName, eventDate, setEventDate, eventTime, setEventTime, notes, setNotes,
}: {
  eventName: string; setEventName: (v: string) => void;
  eventDate: string; setEventDate: (v: string) => void;
  eventTime: string; setEventTime: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label htmlFor="ev-name" className="text-xs text-muted-foreground mb-1 block">Event name</label>
        <input id="ev-name" className="guest-input" placeholder="Reception, launch, birthday…" value={eventName} onChange={e => setEventName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="ev-date" className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" /> Date</label>
          <input id="ev-date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="guest-input [color-scheme:dark]" />
        </div>
        <div>
          <label htmlFor="ev-time" className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Clock className="h-3 w-3" /> Time</label>
          <input id="ev-time" type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="guest-input [color-scheme:dark]" />
        </div>
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requirements, AV needs, dietary notes…" className="guest-input py-3 min-h-[80px]" />
    </>
  );
}
