import { useState, useEffect, useCallback } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError, GuestEmpty } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  SPA_CATEGORIES, formatSlotLabel, type SpaSlot,
} from "@/lib/spaWellnessCatalog";
import {
  ChevronLeft, Calendar, Clock, User, Heart, CheckCircle,
  RefreshCw, X, Crown,
  Star,
} from "lucide-react";
import { GuestIcon } from "@/components/user/GuestIcon";

type Tab = "spa" | "wellness" | "membership" | "bookings";

export default function SpaWellness() {
  const [, navigate] = useAppLocation();
  const { venue, user, activeRestaurant } = useUser();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.
  const slug = venue.restaurantSlug || params.get("slug") || DEMO_SLUG;

  const [tab, setTab] = useState<Tab>("spa");
  const [spaServices, setSpaServices] = useState<any[]>([]);
  const [wellnessServices, setWellnessServices] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [therapistId, setTherapistId] = useState("any");
  const [isCouple, setIsCouple] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<SpaSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [membershipPlan, setMembershipPlan] = useState("gold");
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [bookingsError, setBookingsError] = useState("");
  const [booked, setBooked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [wellnessFilter, setWellnessFilter] = useState<string>("all");
  const [therapists, setTherapists] = useState<any[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<any[]>([]);
  const [wellnessTypes, setWellnessTypes] = useState<any[]>([]);
  const { toast } = useToast();

  const loadCatalog = useCallback(async () => {
    if (!venue.restaurantId) {
      setApiError("Restaurant not loaded.");
      setCatalogLoading(false);
      return;
    }
    setCatalogLoading(true);
    setApiError(null);
    try {
      const c = await publicApi.spa.catalog(venue.restaurantId);
      setSpaServices(c.spaServices ?? []);
      setWellnessServices(c.wellnessServices ?? []);
      setTherapists(Array.isArray(c.therapists) ? c.therapists : []);
      setMembershipPlans(Array.isArray(c.membershipPlans) ? c.membershipPlans : []);
      setWellnessTypes(Array.isArray(c.wellnessTypes) ? c.wellnessTypes : []);
    } catch {
      setApiError("Could not load spa catalog.");
      setSpaServices([]);
      setWellnessServices([]);
      setTherapists([]);
      setMembershipPlans([]);
      setWellnessTypes([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [venue.restaurantId]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const fetchSlots = useCallback(async () => {
    if (!date || !selected || !venue.restaurantId) return;
    setLoadingSlots(true);
    try {
      const res = await publicApi.spa.slots(venue.restaurantId, date, selected.duration ?? 60, therapistId);
      setSlots(res.slots ?? []);
    } catch {
      setSlots([]);
      toast({ title: "Error", description: "Could not load available slots.", variant: "destructive" });
    } finally {
      setLoadingSlots(false);
    }
  }, [date, selected, venue.restaurantId, therapistId]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const loadBookings = useCallback(async () => {
    if (!venue.restaurantId || !user?.mobile) return;
    try {
      const list = await publicApi.spa.bookings(venue.restaurantId, user.mobile);
      setMyBookings(list);
      setBookingsError("");
    } catch (e) {
      // A failed fetch used to render as "No bookings yet", so a guest with an
      // appointment in an hour was told they had none.
      setMyBookings([]);
      setBookingsError(e instanceof Error ? e.message : "We could not load your bookings.");
    }
  }, [venue.restaurantId, user?.mobile]);

  useEffect(() => { if (tab === "bookings") loadBookings(); }, [tab, loadBookings]);

  // The couple rate used to be the single price × 1.85, invented in the browser and
  // never sent anywhere — so the guest was quoted a number the booking did not contain.
  // A couple treatment is priced by the spa, at the price on its own service row.
  const displayPrice = selected ? parseFloat(selected.price) : 0;

  async function bookSession(bookingType: string, extra: Record<string, unknown> = {}) {
    if (!selected && bookingType !== "membership") {
      toast({ title: "Pick a treatment first", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const scheduledAt = bookingType === "membership"
      ? new Date().toISOString()
      : new Date(`${date}T${time}:00`).toISOString();

    try {
      if (bookingType === "membership") {
        await publicApi.spa.membership({
          restaurantId: venue.restaurantId ?? 1,
          guestName: user?.name || "Guest",
          guestPhone: user?.mobile,
          membershipPlanId: membershipPlan,
        });
      } else {
        await publicApi.spa.book({
          restaurantId: venue.restaurantId ?? 1,
          serviceId: selected.id,
          serviceName: selected.name,
          guestName: user?.name || "Guest",
          guestPhone: user?.mobile,
          scheduledAt,
          therapistId,
          therapist: therapists.find(t => t.id === therapistId)?.name,
          bookingType: isCouple || selected.category === "couple" ? "couple" : bookingType,
          partnerName: isCouple ? partnerName : undefined,
          isWellness: tab === "wellness",
          ...extra,
        });
      }
      setBooked(true);
    } catch (e) {
      toast({
        title: "Booking failed",
        description: e instanceof Error ? e.message : "Please pick another slot, or call the spa.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooking(id: number) {
    try {
      await publicApi.spa.cancel(id);
      toast({ title: "Booking cancelled" });
    } catch {
      // A cancellation that never landed still bills the guest for a no-show.
      toast({ title: "Could not cancel", description: "Your appointment is still booked. Please call the spa.", variant: "destructive" });
      return;
    }
    loadBookings();
  }

  const filteredWellness = wellnessFilter === "all"
    ? wellnessServices
    : wellnessServices.filter(s => s.category === wellnessFilter);

  if (booked) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-foreground flex flex-col items-center justify-center gap-4 px-8 text-center relative">
        <GuestBackButton className="absolute top-4 left-4" />
        <CheckCircle className="h-16 w-16 text-success" />
        <h2 className="text-xl font-semibold">
          {tab === "membership" ? "Membership Activated!" : "Booking Confirmed!"}
        </h2>
        <p className="text-muted-foreground">
          {tab === "membership"
            ? membershipPlans.find(p => p.id === membershipPlan)?.label
            : `${selected?.name} · ${date} at ${formatSlotLabel(time)}`}
        </p>
        {therapistId !== "any" && tab !== "membership" && (
          <p className="text-sm text-primary">Therapist: {therapists.find(t => t.id === therapistId)?.name ?? "Any"}</p>
        )}
        <button onClick={() => navigate(`/user/menu?slug=${slug}`)} className="mt-4 px-6 py-3 rounded-xl bg-primary font-semibold text-sm">Done</button>
      </div>
    );
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-12">
      <div className="guest-header px-4 py-3">
        <div className="flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <h1 className="font-semibold">Spa & Wellness</h1>
            <p className="text-xs text-muted-foreground">{activeRestaurant}</p>
          </div>
        </div>
      </div>

      {catalogLoading && <GuestLoading label="Loading spa catalog…" />}
      {!catalogLoading && apiError && (
        <GuestError message={apiError} onRetry={loadCatalog} />
      )}

      {!catalogLoading && !apiError && (
      <>
      <div className="mx-4 mt-4 flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto">
        {([
          ["spa", "Spa"],
          ["wellness", "Wellness"],
          ["membership", "Membership"],
          ["bookings", "My bookings"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); setSelected(null); setDate(""); setTime(""); }}
            className={`shrink-0 flex-1 py-2 px-2 rounded-lg text-xs font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* SPA TAB */}
        {tab === "spa" && (
          <>
            <p className="text-xs text-muted-foreground uppercase">Spa treatments</p>
            <div className="space-y-2">
              {spaServices.length === 0 ? (
                <GuestEmpty message="No spa services available." />
              ) : spaServices.map(s => (
                <button key={s.id} onClick={() => { setSelected(s); setIsCouple(s.category === "couple"); }}
                  className={`w-full text-left p-4 rounded-xl border ${selected?.id === s.id ? "bg-muted border-primary" : "bg-muted border-border"}`}>
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.duration} min · {SPA_CATEGORIES.find(c => c.id === s.category)?.label ?? s.category}</p>
                      {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                    </div>
                    <p className="font-semibold text-primary">₹{s.price}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* WELLNESS TAB */}
        {tab === "wellness" && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setWellnessFilter("all")} className={`shrink-0 px-3 py-1.5 rounded-full text-xs ${wellnessFilter === "all" ? "bg-muted text-primary" : "bg-muted text-muted-foreground"}`}>All</button>
              {(wellnessTypes.length ? wellnessTypes : []).map(w => (
                <button key={w.id} onClick={() => setWellnessFilter(w.category)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs ${wellnessFilter === w.category ? "bg-muted text-primary" : "bg-muted text-muted-foreground"}`}>
                  <><GuestIcon id={w.id} className="h-3.5 w-3.5" /> {w.label}</>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredWellness.map(s => (
                <button key={s.id} onClick={() => setSelected(s)}
                  className={`w-full text-left p-4 rounded-xl border ${selected?.id === s.id ? "bg-success-subtle border-success-border" : "bg-muted border-border"}`}>
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.duration} min · {wellnessTypes.find(w => w.id === s.type || w.id === s.category)?.label ?? s.type ?? "Wellness"}</p>
                      {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                    </div>
                    <p className="font-semibold text-success">₹{s.price}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* MEMBERSHIP TAB */}
        {tab === "membership" && (
          <>
            <p className="text-xs text-muted-foreground uppercase">Membership booking</p>
            {membershipPlans.length === 0 ? (
              <GuestEmpty title="No membership plans configured" />
            ) : membershipPlans.map(plan => (
              <button key={plan.id} onClick={() => setMembershipPlan(plan.id)}
                className={`w-full text-left p-4 rounded-xl border ${membershipPlan === plan.id ? "bg-warning-subtle border-warning-border" : "bg-muted border-border"}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg">{plan.label}</p>
                    <p className="text-sm text-muted-foreground">{plan.sessions} sessions / {plan.period}</p>
                    {Array.isArray(plan.perks) && plan.perks.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {plan.perks.map((p: string) => <li key={p} className="text-xs text-muted-foreground">• {p}</li>)}
                    </ul>
                    )}
                  </div>
                  <p className="font-semibold text-warning">₹{plan.price.toLocaleString()}</p>
                </div>
              </button>
            ))}
            <button onClick={() => bookSession("membership")} disabled={submitting}
              className="w-full py-4 rounded-xl bg-primary font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              <Crown className="h-5 w-5" /> Subscribe to {membershipPlans.find(p => p.id === membershipPlan)?.label ?? "plan"}
            </button>
          </>
        )}

        {/* MY BOOKINGS TAB */}
        {tab === "bookings" && (
          <>
            {myBookings.length === 0 && (
              bookingsError
                ? <p role="alert" className="text-center text-danger py-10 text-sm">{bookingsError}</p>
                : !user?.mobile
                  ? <p className="text-center text-muted-foreground py-10 text-sm">Sign in with the phone number you booked with to see your appointments.</p>
                  : <p className="text-center text-muted-foreground py-10 text-sm">No bookings yet</p>
            )}
            {myBookings.map(b => (
              <div key={b.id} className="rounded-xl bg-muted border border-border p-4">
                <div className="flex justify-between mb-1">
                  <p className="font-semibold">{b.serviceName}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "confirmed" || b.status === "booked" ? "bg-success-subtle text-success" : b.status === "cancelled" ? "bg-danger-subtle text-danger" : "bg-muted text-muted-foreground"}`}>{b.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {b.bookingType === "membership" ? "Membership" : new Date(b.scheduledAt).toLocaleString()} · ₹{b.price}
                </p>
                {b.therapist && <p className="text-xs text-primary mt-1">Therapist: {b.therapist}</p>}
                {b.bookingType === "couple" && <p className="text-xs text-muted-foreground">Couple session</p>}
                {b.status !== "cancelled" && b.bookingType !== "membership" && (
                  <button onClick={() => cancelBooking(b.id)} className="mt-2 text-xs text-danger flex items-center gap-1"><X className="h-3 w-3" /> Cancel</button>
                )}
              </div>
            ))}
          </>
        )}

        {/* Booking panel for spa & wellness */}
        {(tab === "spa" || tab === "wellness") && selected && (
          <div className="rounded-2xl bg-card border border-border p-4 space-y-4">
            <p className="font-semibold text-sm">Book: {selected.name}</p>

            {/* Therapist selection */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><User className="h-3 w-3" /> Therapist selection</p>
              <div className="grid grid-cols-2 gap-2">
                {[...therapists.filter(t => tab === "wellness" ? t.id === "sana" || t.id === "raj" || t.id === "any" : true)].map(t => (
                  <button key={t.id} onClick={() => setTherapistId(t.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs ${therapistId === t.id ? "bg-muted border-primary" : "bg-muted border-border"}`}>
                    <span className="text-lg">{t.avatar}</span>
                    <p className="font-semibold mt-1">{t.name}</p>
                    <p className="text-muted-foreground">{t.specialty}</p>
                    <p className="text-warning flex items-center gap-1"><Star className="h-3 w-3 fill-current" />{t.rating}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Couple spa booking */}
            {tab === "spa" && selected.category !== "couple" && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" />
                  <span className="text-sm">Couple spa booking</span>
                </div>
                <button onClick={() => setIsCouple(!isCouple)} className={`w-12 h-6 rounded-full relative ${isCouple ? "bg-primary" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card transition-all ${isCouple ? "left-6" : "left-0.5"}`} />
                </button>
              </div>
            )}
            {isCouple && (
              <input className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm" placeholder="Partner's name" value={partnerName} onChange={e => setPartnerName(e.target.value)} />
            )}

            {/* Slot scheduling */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> Slot scheduling</p>
              <input type="date" value={date} onChange={e => { setDate(e.target.value); setTime(""); }}
                min={new Date().toISOString().split("T")[0]}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm mb-2 [color-scheme:dark]" />
              {date && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Available slots</p>
                    <button onClick={fetchSlots}><RefreshCw className={`h-4 w-4 text-muted-foreground ${loadingSlots ? "animate-spin" : ""}`} /></button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {slots.map(slot => (
                      <button key={slot.time} disabled={!slot.available} onClick={() => setTime(slot.time)}
                        className={`py-2 rounded-lg text-2xs font-semibold border ${!slot.available ? "opacity-30 line-through bg-muted" : time === slot.time ? "bg-muted border-primary" : "bg-muted border-border"}`}>
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">{isCouple || selected.category === "couple" ? "Couple price" : "Total"}</span>
              <span className="text-xl font-semibold text-primary">₹{displayPrice.toLocaleString()}</span>
            </div>

            <button onClick={() => bookSession(tab === "wellness" ? "wellness" : "single")} disabled={!date || !time || submitting}
              className="w-full py-3.5 rounded-xl bg-primary font-semibold disabled:opacity-40">
              {submitting ? "Booking..." : "Confirm Booking"}
            </button>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
