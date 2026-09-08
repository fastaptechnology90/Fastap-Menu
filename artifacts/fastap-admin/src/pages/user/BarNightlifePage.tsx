import { useState, useEffect, useCallback } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError, GuestEmpty } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  HAPPY_HOUR, COCKTAIL_BASES, COCKTAIL_MIXERS, COCKTAIL_GARNISHES, COCKTAIL_STYLES,
  BAR_TIME_SLOTS, buildCocktailPrice, isHappyHourActive,
} from "@/lib/barNightlifeCatalog";
import {
  ChevronLeft, Clock, Music, Wine, Crown, Calendar, Users, CheckCircle,
  ShoppingCart, Sparkles, MapPin,
} from "lucide-react";

/** A row from the venue's bar catalog. The shape is the venue's to decide, but naming
 *  it stops every picker below from walking an untyped value. */
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
  const [happyHourItems, setHappyHourItems] = useState<any[]>([]);
  const [barCatalog, setBarCatalog] = useState<any>(null);

  // Table reservation
  const [tableId, setTableId] = useState("");
  const [tableDate, setTableDate] = useState("");
  const [tableTime, setTableTime] = useState("");
  const [tableGuests, setTableGuests] = useState(2);
  const [tableSlots, setTableSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [tableBooked, setTableBooked] = useState<any>(null);

  // Lounge booking
  const [loungeId, setLoungeId] = useState("");
  const [loungeDate, setLoungeDate] = useState("");
  const [loungeTime, setLoungeTime] = useState("21:00");
  const [loungeGuests, setLoungeGuests] = useState(4);
  const [loungeBooked, setLoungeBooked] = useState<any>(null);

  // DJ booking
  const [djEventId, setDjEventId] = useState("");
  const [djDate, setDjDate] = useState("");
  const [djGuests, setDjGuests] = useState(2);
  const [djBooked, setDjBooked] = useState<any>(null);

  // Cocktail builder
  const [baseId, setBaseId] = useState("rum");
  const [mixerId, setMixerId] = useState("soda");
  const [styleId, setStyleId] = useState("regular");
  const [garnishIds, setGarnishIds] = useState<string[]>([]);
  const [cocktailQuote, setCocktailQuote] = useState<any>(null);

  // Shapes the venue's bar catalog returns. Typed here so the pickers below are not
  // walking untyped values.
  const barTables: BarCatalogRow[] = barCatalog?.barTables ?? [];
  const loungeZones: BarCatalogRow[] = barCatalog?.loungeZones ?? [];
  const djEvents: BarCatalogRow[] = barCatalog?.djEvents ?? [];
  const happyHourConfig = barCatalog?.happyHour ?? HAPPY_HOUR;
  const cocktailBases: BarCatalogRow[] = barCatalog?.cocktailBases ?? COCKTAIL_BASES;
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
      setBarCatalog(catalog);
      if (!tableId && Array.isArray(catalog.barTables) && catalog.barTables[0]) setTableId(catalog.barTables[0].id);
      if (!loungeId && Array.isArray(catalog.loungeZones) && catalog.loungeZones[0]) setLoungeId(catalog.loungeZones[0].id);
      if (!djEventId && Array.isArray(catalog.djEvents) && catalog.djEvents[0]) setDjEventId(catalog.djEvents[0].id);
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

  useEffect(() => {
    const base = cocktailBases.find(b => b.id === baseId) ?? cocktailBases[0];
    const basePrice = 320 + base.price;
    const price = buildCocktailPrice(basePrice, styleId, garnishIds, COCKTAIL_GARNISHES);
    const finalPrice = hhActive ? Math.round(price * (1 - happyHourConfig.discountPercent / 100)) : price;
    setCocktailQuote({ basePrice: price, finalPrice, happyHourApplied: hhActive, discount: hhActive ? happyHourConfig.discountPercent : 0 });
  }, [baseId, styleId, garnishIds, hhActive, happyHourConfig.discountPercent]);

  function toggleGarnish(id: string) {
    setGarnishIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  }

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
      toast({ title: "Error", description: "Table reservation failed.", variant: "destructive" });
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
      toast({ title: "Error", description: "Lounge booking failed.", variant: "destructive" });
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
      toast({ title: "Error", description: "DJ booking failed.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "happy-hour", label: "Happy Hour", icon: "⏰" },
    { id: "cocktail", label: "Cocktails", icon: "🍸" },
    { id: "dj", label: "DJ Events", icon: "🎧" },
    { id: "table", label: "Bar Tables", icon: "🪑" },
    { id: "lounge", label: "Premium Lounge", icon: "👑" },
  ];

  const selectedLounge = loungeZones.find(l => l.id === loungeId) ?? loungeZones[0];
  const selectedDj = djEvents.find(d => d.id === djEventId) ?? djEvents[0];
  const selectedTable = barTables.find(t => t.id === tableId) ?? barTables[0];

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-white/40">Bar & Nightlife</p>
            <h1 className="text-base font-bold">{activeRestaurant || venue.restaurantName || "Bar"}</h1>
          </div>
          <button onClick={() => navigate("/user/cart")} className="h-9 w-9 rounded-full bg-orange-500/20 flex items-center justify-center relative">
            <ShoppingCart className="h-4 w-4 text-orange-400" />
          </button>
        </div>

        {hhActive && !apiError && barCatalog && (
          <div className="mx-4 mb-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 px-4 py-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-200">Happy Hour LIVE — {happyHourConfig.discountPercent}% off bar menu</span>
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all ${
                tab === t.id ? "bg-violet-500/20 border border-violet-500/40 text-violet-200" : "bg-white/5 border border-white/10 text-white/60"
              }`}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {cartToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-white text-sm px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <CheckCircle className="h-4 w-4" /> {cartToast}
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        {loading && <GuestLoading label="Loading bar menu…" />}
        {!loading && apiError && (
          <GuestError message={apiError} onRetry={loadBarData} />
        )}
        {!loading && !apiError && tab === "happy-hour" && (
          <>
            <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 p-4">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{happyHourConfig.icon ?? "🍹"}</div>
                <div>
                  <h2 className="font-bold text-lg">{happyHourConfig.label}</h2>
                  <p className="text-sm text-white/60">{happyHourConfig.days} · {happyHourConfig.start} – {happyHourConfig.end}</p>
                  {happyHourConfig.desc && <p className="text-sm text-amber-200/80 mt-1">{happyHourConfig.desc}</p>}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {happyHourItems.length === 0 ? (
                <GuestEmpty message="No happy hour items available." />
              ) : happyHourItems.map(item => {
                const orig = item.originalPrice ?? item.price;
                const hhPrice = item.happyHourPrice ?? Math.round(parseFloat(String(orig)) * (1 - happyHourConfig.discountPercent / 100));
                return (
                  <div key={item.id} className="rounded-xl bg-white/5 border border-white/10 p-4 flex gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.name}</h3>
                      {item.description && <p className="text-xs text-white/50 mt-0.5">{item.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-lg font-bold text-amber-400">₹{hhPrice}</span>
                        <span className="text-sm text-white/40 line-through">₹{orig}</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">-{happyHourConfig.discountPercent}%</span>
                      </div>
                    </div>
                    <button
                      onClick={() => addHappyHourToCart({ ...item, happyHourPrice: hhPrice })}
                      className="self-center px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Cocktail Customization */}
        {!loading && !apiError && tab === "cocktail" && (
          <>
            <div className="rounded-2xl bg-violet-500/10 border border-violet-500/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wine className="h-5 w-5 text-violet-400" />
                <h2 className="font-bold">Build Your Cocktail</h2>
              </div>
              <p className="text-sm text-white/50">Choose spirit, mixer, strength & garnishes</p>
            </div>

            <section>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Base Spirit</p>
              <div className="grid grid-cols-3 gap-2">
                {cocktailBases.map(b => (
                  <button key={b.id} onClick={() => setBaseId(b.id)}
                    className={`p-3 rounded-xl border text-center text-sm ${baseId === b.id ? "border-violet-500 bg-violet-500/20" : "border-white/10 bg-white/5"}`}>
                    <div className="text-xl mb-1">{b.icon}</div>{b.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Mixer</p>
              <div className="flex flex-wrap gap-2">
                {COCKTAIL_MIXERS.map(m => (
                  <button key={m.id} onClick={() => setMixerId(m.id)}
                    className={`px-3 py-2 rounded-full text-xs border ${mixerId === m.id ? "border-violet-500 bg-violet-500/20" : "border-white/10 bg-white/5"}`}>
                    {m.label}{m.price > 0 ? ` +₹${m.price}` : ""}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Strength</p>
              <div className="flex gap-2">
                {COCKTAIL_STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyleId(s.id)}
                    className={`flex-1 py-2 rounded-xl text-sm border ${styleId === s.id ? "border-violet-500 bg-violet-500/20" : "border-white/10 bg-white/5"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Garnishes</p>
              <div className="flex flex-wrap gap-2">
                {COCKTAIL_GARNISHES.map(g => (
                  <button key={g.id} onClick={() => toggleGarnish(g.id)}
                    className={`px-3 py-2 rounded-full text-xs border ${garnishIds.includes(g.id) ? "border-emerald-500 bg-emerald-500/20" : "border-white/10 bg-white/5"}`}>
                    {g.label}{g.price > 0 ? ` +₹${g.price}` : ""}
                  </button>
                ))}
              </div>
            </section>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-white/50">Your cocktail</p>
                  {/* An indicative figure: a custom mix is not a menu row, so the bar prices it. */}
                  <p className="text-2xl font-bold text-violet-300">about ₹{cocktailQuote?.finalPrice ?? "—"}</p>
                  {cocktailQuote?.happyHourApplied && (
                    <p className="text-xs text-amber-400">Happy hour applied (−{cocktailQuote.discount}%)</p>
                  )}
                </div>
                <button onClick={sendCocktailToBar} disabled={submitting} className="px-5 py-3 rounded-xl bg-violet-500 hover:bg-violet-600 font-medium flex items-center gap-2 disabled:opacity-50">
                  <ShoppingCart className="h-4 w-4" /> {submitting ? "Sending…" : "Send to the bar"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* DJ Event Booking */}
        {!loading && !apiError && tab === "dj" && (
          <>
            {djBooked ? (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6 text-center">
                <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold mb-1">DJ Event Booked!</h2>
                <p className="text-white/60 text-sm">{djBooked.djEvent?.name ?? selectedDj.name}</p>
                <p className="text-emerald-300 mt-2">{djBooked.guestCount} guests · Cover ₹{(djBooked.djEvent?.cover ?? selectedDj.cover) * djGuests}</p>
                <button onClick={() => setDjBooked(null)} className="mt-4 text-sm text-white/50 underline">Book another</button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {djEvents.map(ev => (
                    <button key={ev.id} onClick={() => setDjEventId(ev.id)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${djEventId === ev.id ? "border-violet-500 bg-violet-500/10" : "border-white/10 bg-white/5"}`}>
                      <div className="flex items-start gap-3">
                        <Music className="h-5 w-5 text-violet-400 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold">{ev.name}</h3>
                          <p className="text-xs text-white/50">{ev.genre} · {ev.day} {ev.time}</p>
                          <p className="text-sm text-white/60 mt-1">{ev.desc}</p>
                          <p className="text-sm font-medium text-violet-300 mt-2">{ev.cover === 0 ? "Free entry" : `₹${ev.cover} cover / person`}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <div>
                    <label className="text-xs text-white/40">Preferred date (optional)</label>
                    <input type="date" value={djDate} onChange={e => setDjDate(e.target.value)}
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-white/40">Guest count</label>
                    <input type="number" min={1} max={20} value={djGuests} onChange={e => setDjGuests(parseInt(e.target.value) || 2)}
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <button onClick={bookDj} disabled={submitting}
                    className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-600 font-medium disabled:opacity-50">
                    {submitting ? "Booking..." : `Book — ₹${selectedDj.cover * djGuests} total cover`}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Bar Table Reservations */}
        {!loading && !apiError && tab === "table" && (
          <>
            {tableBooked ? (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6 text-center">
                <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold">Table Reserved!</h2>
                <p className="text-emerald-300 font-mono mt-2">{tableBooked.bookingToken}</p>
                <p className="text-sm text-white/60 mt-2">{tableBooked.table?.name} · {tableBooked.date} at {tableBooked.time}</p>
                <p className="text-xs text-white/40 mt-1">{tableBooked.guestCount} guests · Deposit ₹300 pending</p>
                <button onClick={() => setTableBooked(null)} className="mt-4 text-sm text-white/50 underline">Book another table</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2">
                  {barTables.map(t => (
                    <button key={t.id} onClick={() => setTableId(t.id)}
                      className={`text-left rounded-xl border p-3 flex items-center gap-3 ${tableId === t.id ? "border-violet-500 bg-violet-500/10" : "border-white/10 bg-white/5"}`}>
                      <MapPin className="h-4 w-4 text-violet-400" />
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-white/50">{t.zone} · up to {t.capacity} guests</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40 flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</label>
                      <input type="date" value={tableDate} onChange={e => setTableDate(e.target.value)}
                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 flex items-center gap-1"><Users className="h-3 w-3" /> Guests</label>
                      <input type="number" min={1} max={selectedTable.capacity} value={tableGuests}
                        onChange={e => setTableGuests(Math.min(selectedTable.capacity, parseInt(e.target.value) || 2))}
                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  {tableDate && (
                    <div>
                      <label className="text-xs text-white/40 flex items-center gap-1 mb-2"><Clock className="h-3 w-3" /> Time slot</label>
                      <div className="flex flex-wrap gap-2">
                        {(tableSlots.length ? tableSlots : BAR_TIME_SLOTS.map(t => ({ time: t, available: true }))).map(s => (
                          <button key={s.time} disabled={!s.available} onClick={() => setTableTime(s.time)}
                            className={`px-3 py-2 rounded-lg text-sm border ${tableTime === s.time ? "border-violet-500 bg-violet-500/20" : s.available ? "border-white/10 bg-white/5" : "border-white/5 bg-white/5 opacity-40 cursor-not-allowed"}`}>
                            {s.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={bookTable} disabled={submitting || !tableDate || !tableTime}
                    className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-600 font-medium disabled:opacity-50">
                    {submitting ? "Reserving..." : `Reserve ${selectedTable.name}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Premium Lounge Booking */}
        {!loading && !apiError && tab === "lounge" && (
          <>
            {loungeBooked ? (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6 text-center">
                <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold">Lounge Booked!</h2>
                <p className="text-emerald-300 font-mono mt-2">{loungeBooked.bookingToken}</p>
                <p className="text-sm text-white/60 mt-2">{loungeBooked.lounge?.name ?? selectedLounge.name}</p>
                <p className="text-xs text-white/40 mt-1">Deposit ₹{loungeBooked.lounge?.deposit ?? selectedLounge.deposit} · Min spend ₹{loungeBooked.lounge?.minSpend ?? selectedLounge.minSpend}</p>
                <button onClick={() => setLoungeBooked(null)} className="mt-4 text-sm text-white/50 underline">Book another lounge</button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {loungeZones.map(l => (
                    <button key={l.id} onClick={() => { setLoungeId(l.id); setLoungeGuests(Math.min(loungeGuests, l.capacity)); }}
                      className={`w-full text-left rounded-xl border p-4 ${loungeId === l.id ? "border-amber-500 bg-amber-500/10" : "border-white/10 bg-white/5"}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{l.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{l.name}</h3>
                            <Crown className="h-4 w-4 text-amber-400" />
                          </div>
                          <p className="text-xs text-white/50 mt-0.5">Up to {l.capacity} guests · Min spend ₹{l.minSpend.toLocaleString()}</p>
                          <ul className="flex flex-wrap gap-1 mt-2">
                            {(l.features as string[]).map((f: string) => (
                              <li key={f} className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-white/60">{f}</li>
                            ))}
                          </ul>
                          <p className="text-sm text-amber-300 mt-2">Deposit ₹{l.deposit.toLocaleString()}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40">Date</label>
                      <input type="date" value={loungeDate} onChange={e => setLoungeDate(e.target.value)}
                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-white/40">Time</label>
                      <select value={loungeTime} onChange={e => setLoungeTime(e.target.value)}
                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm">
                        {BAR_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/40">Guests (max {selectedLounge.capacity})</label>
                    <input type="number" min={1} max={selectedLounge.capacity} value={loungeGuests}
                      onChange={e => setLoungeGuests(Math.min(selectedLounge.capacity, parseInt(e.target.value) || 2))}
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <button onClick={bookLounge} disabled={submitting || !loungeDate}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 font-medium disabled:opacity-50">
                    {submitting ? "Booking..." : `Book ${selectedLounge.name} — ₹${selectedLounge.deposit} deposit`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
