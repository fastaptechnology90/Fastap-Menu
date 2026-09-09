import { useState, useEffect, useCallback } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError, GuestEmpty } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  COCKTAIL_MIXERS, COCKTAIL_GARNISHES, COCKTAIL_STYLES,
} from "@/lib/barNightlifeCatalog";
import {
  Clock, Music, Wine, Crown, Calendar, Users, CheckCircle2,
  ShoppingCart, Sparkles, MapPin, Info, Martini, GlassWater,
} from "lucide-react";

/** A row from the venue's bar catalog. The shape is the venue's to decide, but naming
 *  it stops every picker below from walking an untyped value. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BarCatalogRow = Record<string, any>;

type Tab = "happy-hour" | "cocktail" | "dj" | "table" | "lounge";

export default function BarNightlifePage() {
  const [, navigate] = useAppLocation();
  const { venue, user, activeRestaurant, activeTable, addToCart } = useUser();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.

  const slug = venue.restaurantSlug || params.get("slug") || DEMO_SLUG;

  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("happy-hour");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [hhActive, setHhActive] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [happyHourItems, setHappyHourItems] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [barCatalog, setBarCatalog] = useState<any>(null);
  const [hhNotice, setHhNotice] = useState<string | null>(null);

  // Table reservation
  const [tableId, setTableId] = useState("");
  const [tableDate, setTableDate] = useState("");
  const [tableTime, setTableTime] = useState("");
  const [tableGuests, setTableGuests] = useState(2);
  const [tableSlots, setTableSlots] = useState<{ time: string; available: boolean }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tableBooked, setTableBooked] = useState<any>(null);

  // Lounge booking
  const [loungeId, setLoungeId] = useState("");
  const [loungeDate, setLoungeDate] = useState("");
  const [loungeTime, setLoungeTime] = useState("21:00");
  const [loungeGuests, setLoungeGuests] = useState(4);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [loungeBooked, setLoungeBooked] = useState<any>(null);

  // DJ booking
  const [djEventId, setDjEventId] = useState("");
  const [djDate, setDjDate] = useState("");
  const [djGuests, setDjGuests] = useState(2);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [djBooked, setDjBooked] = useState<any>(null);

  // Cocktail builder
  const [baseId, setBaseId] = useState("");
  const [mixerId, setMixerId] = useState("soda");
  const [styleId, setStyleId] = useState("regular");
  const [garnishIds, setGarnishIds] = useState<string[]>([]);

  /**
   * Everything on this screen comes from the venue's own bar catalog, or it is not shown.
   *
   * Every one of these lists used to fall back to a constant in
   * `lib/barNightlifeCatalog.ts` when the venue had published nothing — which is every
   * venue today. So a restaurant with no bar programme advertised "Happy Hour, Mon-Fri
   * 16:00-19:00, 20% off", six spirits, six lounges with 5,000-15,000 minimum spends and
   * named DJ nights, and quoted custom cocktails off a hardcoded 320 base price that
   * appears nowhere in the product. `GET /public/bar/catalog/:id` answers `configured:
   * false` with a notice; the page now says that instead of inventing a bar.
   */
  const barTables: BarCatalogRow[] = barCatalog?.barTables ?? [];
  const loungeZones: BarCatalogRow[] = barCatalog?.loungeZones ?? [];
  const djEvents: BarCatalogRow[] = barCatalog?.djEvents ?? [];
  const cocktailBases: BarCatalogRow[] = barCatalog?.cocktailBases ?? [];
  const barTimeSlots: string[] = barCatalog?.timeSlots ?? [];
  const happyHourConfig: BarCatalogRow | null = barCatalog?.happyHour ?? null;
  const barNotice: string | null = barCatalog?.notice ?? null;

  const [submitting, setSubmitting] = useState(false);
  const [cartToast, setCartToast] = useState<string | null>(null);

  // Happy hour used to be decided by the device clock against a hardcoded Mon-Fri
  // 16:00-19:00 window, so a phone in another timezone (or with the wrong time) showed a
  // "LIVE" discount the venue was not running and the bill did not honour. Ask the venue.
  useEffect(() => {
    if (!slug) return;
    const tick = setInterval(() => {
      publicApi.bar.happyHour(slug).then(hh => setHhActive(Boolean(hh.isActive))).catch(() => undefined);
    }, 60_000);
    return () => clearInterval(tick);
  }, [slug]);

  const loadBarData = useCallback(async () => {
    if (!venue.restaurantId) {
      setApiError("Restaurant not loaded.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setApiError(null);
    try {
      const [catalog, hh] = await Promise.all([
        publicApi.bar.catalog(venue.restaurantId),
        publicApi.bar.happyHour(slug),
      ]);
      setHhActive(Boolean(hh.isActive ?? catalog.isHappyHourNow));
      setHappyHourItems(hh.items ?? []);
      setHhNotice(hh.notice ?? null);
      setBarCatalog(catalog);
      if (Array.isArray(catalog.barTables) && catalog.barTables[0]) setTableId(t => t || catalog.barTables[0].id);
      if (Array.isArray(catalog.loungeZones) && catalog.loungeZones[0]) setLoungeId(l => l || catalog.loungeZones[0].id);
      if (Array.isArray(catalog.djEvents) && catalog.djEvents[0]) setDjEventId(d => d || catalog.djEvents[0].id);
      if (Array.isArray(catalog.cocktailBases) && catalog.cocktailBases[0]) setBaseId(b => b || catalog.cocktailBases[0].id);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Could not load bar data.");
      setHappyHourItems([]);
      setBarCatalog(null);
    } finally {
      setLoading(false);
    }
  }, [venue.restaurantId, slug]);

  useEffect(() => { loadBarData(); }, [loadBarData]);

  const fetchTableSlots = useCallback(async () => {
    if (!tableDate || !venue.restaurantId) {
      setTableSlots([]);
      return;
    }
    try {
      const res = await publicApi.bar.tableSlots(venue.restaurantId, tableDate, tableId);
      setTableSlots(res.slots ?? []);
    } catch (e) {
      setTableSlots([]);
      toast({ title: "Could not load table times", description: e instanceof Error ? e.message : "Please pick another date.", variant: "destructive" });
    }
  }, [tableDate, tableId, venue.restaurantId, toast]);

  useEffect(() => { fetchTableSlots(); }, [fetchTableSlots]);

  function toggleGarnish(id: string) {
    setGarnishIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addHappyHourToCart(item: any) {
    const price = item.happyHourPrice ?? item.price;
    addToCart({
      menuItemId: String(item.id),
      name: item.name,
      price: typeof price === "number" ? price : parseFloat(String(price)),
      quantity: 1,
      customizations: hhActive ? ["Happy Hour"] : [],
      addons: [],
      course: "beverage",
    });
    setCartToast(`${item.name} added`);
    setTimeout(() => setCartToast(null), 2500);
  }

  /**
   * Send a built cocktail to the bar.
   *
   * It used to go into the cart under a made-up id ("cocktail-gin-soda-double"). The
   * order route prices every line against the menu table, so that id parsed to NaN and
   * the WHOLE basket was rejected with "Menu item null not found" — a guest who built a
   * cocktail could no longer order anything at all. A custom drink is not a menu row, so
   * it goes to the bar as a request instead of poisoning the basket.
   */
  async function sendCocktailToBar() {
    const base = cocktailBases.find((b: { id: string }) => b.id === baseId) ?? cocktailBases[0];
    if (!base) {
      setCartToast("Pick a base spirit first.");
      setTimeout(() => setCartToast(null), 3000);
      return;
    }
    if (!venue.restaurantId) {
      setCartToast("We do not know which venue you are in. Scan the QR code at your table.");
      setTimeout(() => setCartToast(null), 4000);
      return;
    }
    const mixer = COCKTAIL_MIXERS.find(m => m.id === mixerId);
    const style = COCKTAIL_STYLES.find(s => s.id === styleId);
    const garnishLabels = garnishIds.map(g => COCKTAIL_GARNISHES.find(x => x.id === g)?.label).filter(Boolean);
    const name = `Custom ${base.label}${style && style.label !== "Regular" ? ` (${style.label})` : ""}`;
    const spec = [name, mixer?.label, garnishLabels.length ? `Garnish: ${garnishLabels.join(", ")}` : null]
      .filter(Boolean).join(" · ");

    setSubmitting(true);
    try {
      await publicApi.waiterCall({
        restaurantId: venue.restaurantId,
        tableId: venue.tableId,
        tableName: activeTable,
        type: "custom_cocktail",
        message: spec,
      });
    } catch (e) {
      setCartToast(e instanceof Error ? e.message : "We could not reach the bar. Please order at the counter.");
      setTimeout(() => setCartToast(null), 5000);
      return;
    } finally {
      setSubmitting(false);
    }
    setCartToast("Sent to the bar — they will confirm the price when they bring it over.");
    setTimeout(() => setCartToast(null), 5000);
  }

  async function bookTable() {
    if (!tableDate || !tableTime) return;
    setSubmitting(true);
    try {
      const res = await publicApi.bar.tableReservation({
        restaurantId: venue.restaurantId ?? 1,
        customerName: user?.name || "Guest",
        customerPhone: user?.mobile || "",
        date: tableDate,
        time: tableTime,
        guestCount: tableGuests,
        tableId,
      });
      setTableBooked(res);
    } catch {
      toast({ title: "Could not reserve", description: "That bar table was not booked. Try another time.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function bookLounge() {
    if (!loungeDate || !loungeTime) return;
    setSubmitting(true);
    try {
      const res = await publicApi.bar.loungeBooking({
        restaurantId: venue.restaurantId ?? 1,
        customerName: user?.name || "Guest",
        customerPhone: user?.mobile || "",
        date: loungeDate,
        time: loungeTime,
        guestCount: loungeGuests,
        loungeId,
      });
      setLoungeBooked(res);
    } catch {
      toast({ title: "Could not book", description: "That lounge was not booked. Try another date.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function bookDj() {
    setSubmitting(true);
    try {
      const res = await publicApi.bar.djBooking({
        restaurantId: venue.restaurantId ?? 1,
        customerName: user?.name || "Guest",
        customerPhone: user?.mobile || "",
        guestCount: djGuests,
        djEventId,
        eventDate: djDate || undefined,
      });
      setDjBooked(res);
    } catch {
      toast({ title: "Could not book", description: "That event was not booked. Try again in a moment.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const TABS: { id: Tab; label: string; icon: typeof Clock }[] = [
    { id: "happy-hour", label: "Happy hour", icon: Clock },
    { id: "cocktail", label: "Cocktails", icon: Martini },
    { id: "dj", label: "Events", icon: Music },
    { id: "table", label: "Bar tables", icon: MapPin },
    { id: "lounge", label: "Lounges", icon: Crown },
  ];

  // Every one of these was read straight through (`selectedTable.capacity`) with no
  // guard. The venue publishes none of them today, so the list is empty, and opening
  // the Bar tables or Lounges tab threw and blanked the whole screen.
  const selectedLounge = loungeZones.find(l => l.id === loungeId) ?? loungeZones[0] ?? null;
  const selectedDj = djEvents.find(d => d.id === djEventId) ?? djEvents[0] ?? null;
  const selectedTable = barTables.find(t => t.id === tableId) ?? barTables[0] ?? null;

  function NotConfigured({ what }: { what: string }) {
    return (
      <div className="guest-section-card flex gap-3">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          {barNotice ?? `${activeRestaurant || "This venue"} has not published ${what}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="guest-page thin-scroll min-h-screen pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Bar &amp; nightlife</p>
            <h1 className="text-base font-semibold truncate">{activeRestaurant || venue.restaurantName || "Bar"}</h1>
          </div>
          <button onClick={() => navigate("/user/cart")} aria-label="Open cart" className="guest-btn-secondary h-11 w-11 p-0">
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>

        {hhActive && !apiError && happyHourConfig && (
          <div className="mx-4 mb-2 rounded-md bg-success-subtle border border-success-border px-4 py-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-success shrink-0" />
            <span className="text-sm font-medium text-success">
              Happy hour on now{happyHourConfig.discountPercent ? ` — ${happyHourConfig.discountPercent}% off the bar menu` : ""}
            </span>
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`guest-pill ${tab === t.id ? "guest-pill-active" : ""}`}
            >
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {cartToast && (
        <div role="status" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] bg-card border border-border text-sm px-4 py-2.5 rounded-md flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> {cartToast}
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        {loading && <GuestLoading label="Loading bar menu…" />}
        {!loading && apiError && (
          <GuestError message={apiError} onRetry={loadBarData} />
        )}

        {!loading && !apiError && tab === "happy-hour" && (
          <>
            {happyHourConfig ? (
              <div className="guest-section-card">
                <div className="flex items-start gap-3">
                  <GlassWater className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-semibold text-lg">{happyHourConfig.label ?? "Happy hour"}</h2>
                    {(happyHourConfig.days || happyHourConfig.start) && (
                      <p className="text-sm text-muted-foreground">
                        {[happyHourConfig.days, happyHourConfig.start && `${happyHourConfig.start} – ${happyHourConfig.end}`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {happyHourConfig.desc && <p className="text-sm text-muted-foreground mt-1">{happyHourConfig.desc}</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="guest-section-card flex gap-3">
                <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  {hhNotice ?? `${activeRestaurant || "This venue"} is not running a happy hour.`}
                </p>
              </div>
            )}
            <div className="space-y-3">
              {happyHourItems.length === 0 ? (
                <GuestEmpty
                  icon={Wine}
                  title="Nothing on offer right now"
                  message="Drinks on the main menu can still be ordered from your table."
                  actionLabel="Open the menu"
                  onAction={() => navigate(`/user/menu?slug=${slug}`)}
                />
              ) : happyHourItems.map(item => {
                const orig = item.originalPrice ?? item.price;
                const hhPrice = item.happyHourPrice ?? orig;
                const discounted = Number(hhPrice) < Number(orig);
                return (
                  <div key={item.id} className="guest-card p-4 flex gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{item.name}</h3>
                      {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-lg font-semibold tabular-nums">₹{hhPrice}</span>
                        {discounted && <span className="text-sm text-muted-foreground line-through tabular-nums">₹{orig}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => addHappyHourToCart({ ...item, happyHourPrice: hhPrice })}
                      className="guest-btn-primary self-center px-4 text-sm shrink-0"
                    >
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Cocktail builder — only when the venue has published its own spirits */}
        {!loading && !apiError && tab === "cocktail" && (
          cocktailBases.length === 0 ? (
            <NotConfigured what="a cocktail list" />
          ) : (
            <>
              <div className="guest-section-card">
                <div className="flex items-center gap-2 mb-1">
                  <Wine className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">Build your cocktail</h2>
                </div>
                <p className="text-sm text-muted-foreground">Spirit, mixer, strength and garnish. The bar confirms the price when they bring it over.</p>
              </div>

              <section>
                <p className="guest-section-label mb-2">Base spirit</p>
                <div className="grid grid-cols-3 gap-2">
                  {cocktailBases.map(b => (
                    <button key={b.id} onClick={() => setBaseId(b.id)} aria-pressed={baseId === b.id}
                      className={`guest-card guest-card-interactive p-3 text-center text-sm min-h-[64px] ${baseId === b.id ? "ring-1 ring-primary" : ""}`}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Mixer, strength and garnish are preparation choices, not a price list.
                  They used to carry rupee amounts (+₹20 cranberry, +₹15 spicy rim) that
                  no venue had ever set and no bill ever charged. */}
              <section>
                <p className="guest-section-label mb-2">Mixer</p>
                <div className="flex flex-wrap gap-2">
                  {COCKTAIL_MIXERS.map(m => (
                    <button key={m.id} onClick={() => setMixerId(m.id)} aria-pressed={mixerId === m.id}
                      className={`guest-pill ${mixerId === m.id ? "guest-pill-active" : ""}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <p className="guest-section-label mb-2">Strength</p>
                <div className="flex gap-2">
                  {COCKTAIL_STYLES.map(s => (
                    <button key={s.id} onClick={() => setStyleId(s.id)} aria-pressed={styleId === s.id}
                      className={`guest-pill flex-1 justify-center py-2.5 ${styleId === s.id ? "guest-pill-active" : ""}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <p className="guest-section-label mb-2">Garnish</p>
                <div className="flex flex-wrap gap-2">
                  {COCKTAIL_GARNISHES.map(g => (
                    <button key={g.id} onClick={() => toggleGarnish(g.id)} aria-pressed={garnishIds.includes(g.id)}
                      className={`guest-pill ${garnishIds.includes(g.id) ? "guest-pill-active" : ""}`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </section>

              <div className="guest-section-card flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {/* The old screen showed "about ₹355" off a hardcoded ₹320 base. No
                      venue had set that, and the bill would not have matched it. */}
                  The bar prices a custom mix and tells you before it is made.
                </p>
                <button onClick={sendCocktailToBar} disabled={submitting} className="guest-btn-primary px-5 shrink-0 disabled:opacity-50">
                  {submitting ? "Sending…" : "Send to the bar"}
                </button>
              </div>
            </>
          )
        )}

        {/* Events */}
        {!loading && !apiError && tab === "dj" && (
          djBooked ? (
            <div className="guest-section-card text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" strokeWidth={1.5} />
              <h2 className="text-xl font-semibold mb-1">Event booked</h2>
              <p className="text-muted-foreground text-sm">{djBooked.djEvent?.name ?? selectedDj?.name}</p>
              <p className="text-sm mt-2 tabular-nums">
                {djBooked.guestCount} guests
                {typeof (djBooked.djEvent?.cover ?? selectedDj?.cover) === "number" && ` · cover ₹${(djBooked.djEvent?.cover ?? selectedDj?.cover) * djGuests}`}
              </p>
              <button onClick={() => setDjBooked(null)} className="guest-btn-secondary mt-4 px-5 text-sm">Book another</button>
            </div>
          ) : djEvents.length === 0 ? (
            <NotConfigured what="an events programme" />
          ) : (
            <>
              <div className="space-y-3">
                {djEvents.map(ev => (
                  <button key={ev.id} onClick={() => setDjEventId(ev.id)} aria-pressed={djEventId === ev.id}
                    className={`guest-card guest-card-interactive w-full text-left p-4 ${djEventId === ev.id ? "ring-1 ring-primary" : ""}`}>
                    <div className="flex items-start gap-3">
                      <Music className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium">{ev.name}</h3>
                        <p className="text-xs text-muted-foreground">{[ev.genre, ev.day, ev.time].filter(Boolean).join(" · ")}</p>
                        {ev.desc && <p className="text-sm text-muted-foreground mt-1">{ev.desc}</p>}
                        <p className="text-sm font-medium text-primary mt-2">{!ev.cover ? "Free entry" : `₹${ev.cover} cover / person`}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="guest-section-card space-y-3">
                <div>
                  <label htmlFor="dj-date" className="text-xs text-muted-foreground">Preferred date (optional)</label>
                  <input id="dj-date" type="date" value={djDate} onChange={e => setDjDate(e.target.value)} className="guest-input mt-1 [color-scheme:dark]" />
                </div>
                <div>
                  <label htmlFor="dj-guests" className="text-xs text-muted-foreground">Guests</label>
                  <input id="dj-guests" type="number" min={1} max={20} value={djGuests} onChange={e => setDjGuests(parseInt(e.target.value) || 2)} className="guest-input mt-1" />
                </div>
                <button onClick={bookDj} disabled={submitting} className="guest-btn-primary w-full py-3 disabled:opacity-50">
                  {submitting ? "Booking…" : selectedDj?.cover ? `Book — ₹${selectedDj.cover * djGuests} cover` : "Book"}
                </button>
              </div>
            </>
          )
        )}

        {/* Bar table reservations */}
        {!loading && !apiError && tab === "table" && (
          tableBooked ? (
            <div className="guest-section-card text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" strokeWidth={1.5} />
              <h2 className="text-xl font-semibold">Table reserved</h2>
              <p className="font-mono mt-2 text-primary">{tableBooked.bookingToken}</p>
              <p className="text-sm text-muted-foreground mt-2">{tableBooked.table?.name} · {tableBooked.date} at {tableBooked.time}</p>
              {/* The deposit line used to read a flat "Deposit ₹300 pending" whatever the
                  venue charged. It now shows only what came back from the booking. */}
              <p className="text-xs text-muted-foreground mt-1">
                {tableBooked.guestCount} guests{tableBooked.depositAmount ? ` · deposit ₹${tableBooked.depositAmount} pending` : ""}
              </p>
              <button onClick={() => setTableBooked(null)} className="guest-btn-secondary mt-4 px-5 text-sm">Book another table</button>
            </div>
          ) : barTables.length === 0 || !selectedTable ? (
            <NotConfigured what="bookable bar tables" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2">
                {barTables.map(t => (
                  <button key={t.id} onClick={() => setTableId(t.id)} aria-pressed={tableId === t.id}
                    className={`guest-card guest-card-interactive text-left p-3 flex items-center gap-3 ${tableId === t.id ? "ring-1 ring-primary" : ""}`}>
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.zone} · up to {t.capacity} guests</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="guest-section-card space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="bt-date" className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</label>
                    <input id="bt-date" type="date" value={tableDate} onChange={e => setTableDate(e.target.value)} className="guest-input mt-1 [color-scheme:dark]" />
                  </div>
                  <div>
                    <label htmlFor="bt-guests" className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Guests</label>
                    <input id="bt-guests" type="number" min={1} max={selectedTable.capacity} value={tableGuests}
                      onChange={e => setTableGuests(Math.min(selectedTable.capacity, parseInt(e.target.value) || 2))}
                      className="guest-input mt-1" />
                  </div>
                </div>
                {tableDate && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><Clock className="h-3 w-3" /> Time</p>
                    {/* No local fallback list: an empty answer means the venue has no
                        sittings that day, and offering times it cannot honour is worse. */}
                    {(tableSlots.length ? tableSlots : barTimeSlots.map(t => ({ time: t, available: true }))).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No sittings published for that date. Try another day.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(tableSlots.length ? tableSlots : barTimeSlots.map(t => ({ time: t, available: true }))).map(s => (
                          <button key={s.time} disabled={!s.available} onClick={() => setTableTime(s.time)} aria-pressed={tableTime === s.time}
                            className={`guest-pill ${tableTime === s.time ? "guest-pill-active" : ""} ${!s.available ? "opacity-40 cursor-not-allowed" : ""}`}>
                            {s.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={bookTable} disabled={submitting || !tableDate || !tableTime} className="guest-btn-primary w-full py-3 disabled:opacity-50">
                  {submitting ? "Reserving…" : `Reserve ${selectedTable.name}`}
                </button>
              </div>
            </>
          )
        )}

        {/* Lounges */}
        {!loading && !apiError && tab === "lounge" && (
          loungeBooked ? (
            <div className="guest-section-card text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" strokeWidth={1.5} />
              <h2 className="text-xl font-semibold">Lounge booked</h2>
              <p className="font-mono mt-2 text-primary">{loungeBooked.bookingToken}</p>
              <p className="text-sm text-muted-foreground mt-2">{loungeBooked.lounge?.name ?? selectedLounge?.name}</p>
              {(loungeBooked.lounge?.deposit ?? selectedLounge?.deposit) != null && (
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  Deposit ₹{loungeBooked.lounge?.deposit ?? selectedLounge?.deposit}
                  {(loungeBooked.lounge?.minSpend ?? selectedLounge?.minSpend) != null && ` · min spend ₹${loungeBooked.lounge?.minSpend ?? selectedLounge?.minSpend}`}
                </p>
              )}
              <button onClick={() => setLoungeBooked(null)} className="guest-btn-secondary mt-4 px-5 text-sm">Book another lounge</button>
            </div>
          ) : loungeZones.length === 0 || !selectedLounge ? (
            <NotConfigured what="private lounges" />
          ) : (
            <>
              <div className="space-y-3">
                {loungeZones.map(l => (
                  <button key={l.id} onClick={() => { setLoungeId(l.id); setLoungeGuests(Math.min(loungeGuests, l.capacity)); }} aria-pressed={loungeId === l.id}
                    className={`guest-card guest-card-interactive w-full text-left p-4 ${loungeId === l.id ? "ring-1 ring-primary" : ""}`}>
                    <div className="flex items-start gap-3">
                      <Crown className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium">{l.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Up to {l.capacity} guests{l.minSpend != null ? ` · min spend ₹${Number(l.minSpend).toLocaleString("en-IN")}` : ""}
                        </p>
                        {Array.isArray(l.features) && (
                          <ul className="flex flex-wrap gap-1 mt-2">
                            {(l.features as string[]).map((f: string) => (
                              <li key={f} className="guest-pill text-2xs px-2 py-0.5">{f}</li>
                            ))}
                          </ul>
                        )}
                        {l.deposit != null && <p className="text-sm text-primary mt-2 tabular-nums">Deposit ₹{Number(l.deposit).toLocaleString("en-IN")}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="guest-section-card space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="lz-date" className="text-xs text-muted-foreground">Date</label>
                    <input id="lz-date" type="date" value={loungeDate} onChange={e => setLoungeDate(e.target.value)} className="guest-input mt-1 [color-scheme:dark]" />
                  </div>
                  <div>
                    <label htmlFor="lz-time" className="text-xs text-muted-foreground">Time</label>
                    {barTimeSlots.length ? (
                      <select id="lz-time" value={loungeTime} onChange={e => setLoungeTime(e.target.value)} className="guest-input mt-1">
                        {barTimeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <input id="lz-time" type="time" value={loungeTime} onChange={e => setLoungeTime(e.target.value)} className="guest-input mt-1 [color-scheme:dark]" />
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="lz-guests" className="text-xs text-muted-foreground">Guests (max {selectedLounge.capacity})</label>
                  <input id="lz-guests" type="number" min={1} max={selectedLounge.capacity} value={loungeGuests}
                    onChange={e => setLoungeGuests(Math.min(selectedLounge.capacity, parseInt(e.target.value) || 2))}
                    className="guest-input mt-1" />
                </div>
                <button onClick={bookLounge} disabled={submitting || !loungeDate} className="guest-btn-primary w-full py-3 disabled:opacity-50">
                  {submitting ? "Booking…" : `Book ${selectedLounge.name}`}
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
