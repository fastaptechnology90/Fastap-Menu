import { useState, useEffect, useCallback } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useToast } from "@/hooks/use-toast";
import { useGuestBack } from "@/hooks/useGuestBack";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  RESERVATION_TYPES, SEATING_PREFERENCES, SPECIAL_OCCASIONS,
  depositForType, guestLimits, seatingForType,
  type ReservationTypeId, type SlotInfo, type ReservationRecord,
} from "@/lib/reservationCatalog";
import {
  ChevronLeft, Calendar, Clock, Users, MapPin, CheckCircle,
  CreditCard, Smartphone, Wallet, RefreshCw, X, Edit3,
} from "lucide-react";
import { GuestIcon } from "@/components/user/GuestIcon";

type Step = "type" | "details" | "deposit" | "success";
type Tab = "new" | "my";

const TYPE_ICONS: Record<string, string> = Object.fromEntries(RESERVATION_TYPES.map(t => [t.id, t.icon]));

export default function Reservation() {
  const [, navigate] = useAppLocation();
  const goBack = useGuestBack();
  const { venue, user, activeRestaurant } = useUser();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.
  const slug = venue.restaurantSlug || params.get("slug") || DEMO_SLUG;
  const prefilledTable = params.get("table") || undefined;
  const prefilledRoom = params.get("room") || undefined;

  const [tab, setTab] = useState<Tab>("new");
  const [step, setStep] = useState<Step>(() => (prefilledTable || prefilledRoom ? "details" : "type"));
  const [bookingType, setBookingType] = useState<ReservationTypeId>(() => (prefilledRoom ? "table" : "table"));
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timeLabel, setTimeLabel] = useState("");
  const [guests, setGuests] = useState(2);
  const [seating, setSeating] = useState("indoor-ac");
  const [specialTags, setSpecialTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [payDepositNow, setPayDepositNow] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [myBookings, setMyBookings] = useState<ReservationRecord[]>([]);
  const [bookingToken, setBookingToken] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [createdStatus, setCreatedStatus] = useState<string>("pending");
  const [depositNotice, setDepositNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const [editBooking, setEditBooking] = useState<ReservationRecord | null>(null);
  const [spaServices, setSpaServices] = useState<{ id: number; name: string; price: number }[]>([]);
  const [spaServiceId, setSpaServiceId] = useState<number | null>(null);
  /**
   * Who the booking is for, when nobody is signed in.
   *
   * The form never asked. It sent `customerPhone: "0000000000"` for every visitor who
   * had not logged in, so every anonymous booking on the platform was filed under one
   * number — "My bookings" looks bookings up by phone, so the guest could never find,
   * change or cancel what they had just booked, and the venue had no number to ring when
   * the sitting moved. The server now rejects that placeholder, which without this would
   * simply turn the bug into a 400. So ask.
   */
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupTried, setLookupTried] = useState(false);

  const contactName = (user?.name || guestName).trim();
  const contactPhone = (user?.mobile || guestPhone).trim();
  const phoneDigits = contactPhone.replace(/\D/g, "");
  /** Matches the server's rule so the guest is told before the request, not after. */
  const contactUsable = contactName.length > 0
    && phoneDigits.length >= 8 && phoneDigits.length <= 15
    && new Set(phoneDigits).size > 1;

  useEffect(() => {
    if (prefilledTable) {
      setBookingType("table");
      setStep("details");
    } else if (prefilledRoom) {
      setBookingType("table");
      setStep("details");
    }
  }, [prefilledTable, prefilledRoom]);

  const scanLabel = prefilledTable
    ? `Table ${prefilledTable}`
    : prefilledRoom
      ? `Room ${prefilledRoom}`
      : null;

  const deposit = depositForType(bookingType);
  const limits = guestLimits(bookingType);
  const seatingOptions = seatingForType(bookingType);

  const fetchSlots = useCallback(async () => {
    if (!date || !venue.restaurantId) return;
    setLoadingSlots(true);
    try {
      const data = await publicApi.reservationSlots(venue.restaurantId, date, bookingType);
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
      toast({ title: "Error", description: "Could not load time slots.", variant: "destructive" });
    } finally {
      setLoadingSlots(false);
    }
  }, [date, venue.restaurantId, bookingType]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  useEffect(() => {
    if (bookingType === "spa" && venue.restaurantId) {
      publicApi.spaServices(venue.restaurantId).then(list => setSpaServices(list))
        .catch(e => toast({ title: "Could not load spa treatments", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
    }
  }, [bookingType, venue.restaurantId]);

  useEffect(() => {
    const opts = seatingForType(bookingType);
    if (opts.length && !opts.find(o => o.id === seating)) setSeating(opts[0].id);
    const lim = guestLimits(bookingType);
    if (guests < lim.min) setGuests(lim.min);
    if (guests > lim.max) setGuests(lim.max);
  }, [bookingType, guests, seating]);

  const loadMyBookings = useCallback(async (phoneOverride?: string) => {
    // A guest who booked without signing in has a phone number but no account, so the
    // lookup takes whichever number we know: theirs from the session, the one they just
    // booked with, or the one they type in.
    const phone = (phoneOverride ?? user?.mobile ?? guestPhone ?? "").trim();
    if (!venue.restaurantId || !phone) return;
    try {
      const list = await publicApi.reservations(venue.restaurantId, phone);
      setMyBookings(list);
    } catch { setMyBookings([]); }
    setLookupTried(true);
  }, [venue.restaurantId, user?.mobile, guestPhone]);

  useEffect(() => {
    if (tab === "my") loadMyBookings();
  }, [tab, loadMyBookings]);

  function toggleTag(tag: string) {
    setSpecialTags(p => p.includes(tag) ? p.filter(x => x !== tag) : [...p, tag]);
  }

  async function submitReservation(withDeposit: boolean) {
    setSubmitting(true);
    const scanNote = prefilledTable
      ? `Table: ${prefilledTable}`
      : prefilledRoom
        ? `Room: ${prefilledRoom}`
        : "";
    const payload = {
      restaurantId: venue.restaurantId ?? 1,
      customerName: contactName,
      customerPhone: contactPhone,
      customerEmail: user?.email,
      date,
      time: time || timeLabel,
      guestCount: guests,
      reservationType: bookingType,
      zone: seating,
      specialRequest: [scanNote, ...specialTags, notes].filter(Boolean).join(" | "),
      notes: [scanNote, notes].filter(Boolean).join(" | "),
      // The deposit is the venue's to set, not the browser's. Sending it from here meant
      // the amount written against the booking was whatever the page said it was.
      payDeposit: withDeposit,
      serviceId: bookingType === "spa" ? spaServiceId : undefined,
      tableId: prefilledTable && venue.tableId ? venue.tableId : undefined,
    };

    try {
      const res = await publicApi.createReservation(payload);
      setCreatedId(res.id);
      setBookingToken(res.bookingToken ?? `#REV${res.id}`);
      // A booking that still owes a deposit comes back as "pending", not confirmed. The
      // success screen used to announce "Booking Confirmed!" either way.
      setCreatedStatus(String(res.status ?? "pending"));
      if (deposit > 0 && !withDeposit) {
        setStep("deposit");
      } else {
        setStep("success");
      }
    } catch (e) {
      toast({
        title: "Could not book",
        description: e instanceof Error ? e.message : "Please try again, or call the restaurant.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function payDeposit() {
    if (!createdId) { setStep("success"); return; }
    setSubmitting(true);
    try {
      await publicApi.payReservationDeposit(createdId, { paymentMethod });
      setCreatedStatus("confirmed");
      setStep("success");
    } catch (e) {
      // The server's answer here is usually "online deposits are not available yet, your
      // booking is held and the deposit is collected at the venue" — which is good news,
      // not an error. Showing "Could not pay deposit" instead made the guest think the
      // booking had failed.
      setDepositNotice(e instanceof Error ? e.message : "The deposit is collected at the venue. Your booking is held.");
      setStep("success");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooking(id: number) {
    try {
      await publicApi.cancelReservation(id);
      toast({ title: "Booking cancelled" });
    } catch (e) {
      // The guest has to know their table is still held, or they will not turn up.
      toast({ title: "Could not cancel", description: e instanceof Error ? e.message : "Your booking is still confirmed. Please call the restaurant.", variant: "destructive" });
      return;
    }
    loadMyBookings();
  }

  async function saveEdit() {
    if (!editBooking) return;
    try {
      await publicApi.updateReservation(editBooking.id, {
        date: editBooking.date,
        time: editBooking.time,
        guestCount: editBooking.guestCount,
        notes: editBooking.notes,
        specialRequest: editBooking.specialRequest,
        zone: editBooking.zone,
      });
    } catch (e) {
      // The dialog stays open with the edits intact so they can be retried.
      toast({ title: "Could not update the booking", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
      return;
    }
    setEditBooking(null);
    toast({ title: "Booking updated" });
    loadMyBookings();
  }

  function resetNew() {
    setStep("type");
    setDate("");
    setTime("");
    setTimeLabel("");
    setSpecialTags([]);
    setNotes("");
    setPayDepositNow(false);
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-10">
      <div className="guest-header px-4 py-3">
        <div className="flex items-center gap-3">
          <GuestBackButton
            onClick={() => (step === "type" ? goBack() : setStep(step === "deposit" ? "details" : "type"))}
          />
          <div className="flex-1">
            <h1 className="font-semibold">Reservations</h1>
            <p className="text-xs text-muted-foreground">{activeRestaurant}</p>
          </div>
        </div>
      </div>

      {step === "success" && (
        <div className="flex flex-col items-center px-4 pt-10 text-center">
          <CheckCircle className="h-16 w-16 text-success mb-4" />
          <h2 className="text-2xl font-semibold mb-2">
            {createdStatus === "confirmed" ? "Booking Confirmed!" : "Booking Requested"}
          </h2>
          <p className="text-muted-foreground mb-1">{TYPE_ICONS[bookingType]} {RESERVATION_TYPES.find(t => t.id === bookingType)?.label}</p>
          <p className="text-muted-foreground mb-2">{date} · {timeLabel || time} · {guests} guests</p>
          {createdStatus !== "confirmed" && (
            <p className="text-warning text-sm mb-3 max-w-sm">
              The restaurant confirms this shortly — you will not have a table until they do.
            </p>
          )}
          {depositNotice && <p className="text-muted-foreground text-sm mb-4 max-w-sm">{depositNotice}</p>}
          <div className="guest-section-card w-full max-w-sm mb-6">
            <div className="text-3xl font-semibold text-primary font-mono">{bookingToken}</div>
            <p className="text-xs text-muted-foreground mt-2">Show this token when you arrive</p>
            {contactPhone && (
              <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
                Booked under {contactName} · {contactPhone}. Look it up under My bookings with that number.
              </p>
            )}
          </div>
          <div className="flex gap-3 w-full max-w-sm">
            <button onClick={() => navigate(`/user/menu?slug=${slug}`)} className="flex-1 py-3 rounded-xl bg-primary font-semibold text-sm">Menu</button>
            <button onClick={() => { resetNew(); setTab("my"); setStep("type"); }} className="flex-1 py-3 rounded-xl border border-border text-sm">My Bookings</button>
          </div>
        </div>
      )}

      {step === "deposit" && (
        <div className="px-4 pt-6 space-y-4 max-w-md mx-auto">
          <h2 className="text-xl font-semibold">Pay Advance Deposit</h2>
          <p className="text-sm text-muted-foreground">₹{deposit} required for {RESERVATION_TYPES.find(t => t.id === bookingType)?.label}. Refundable on arrival.</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "upi", label: "UPI", Icon: Smartphone },
                { id: "card", label: "Card", Icon: CreditCard },
                { id: "wallet", label: "Wallet", Icon: Wallet },
              ] as const
            ).map(({ id, label, Icon: PayIcon }) => (
              <button
                key={id}
                onClick={() => setPaymentMethod(id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs ${paymentMethod === id ? "bg-muted border-primary" : "bg-muted border-border"}`}
              >
                <PayIcon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
          <button onClick={payDeposit} disabled={submitting} className="w-full py-4 rounded-xl bg-primary font-semibold disabled:opacity-50">
            Pay ₹{deposit}
          </button>
          <button onClick={() => setStep("success")} className="w-full py-3 text-sm text-muted-foreground">Skip — pay at venue</button>
        </div>
      )}

      {step !== "success" && step !== "deposit" && (
        <>
          <div className="mx-4 mt-4 flex gap-1 bg-muted p-1 rounded-xl">
            {(["new", "my"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {t === "new" ? "New Booking" : "My Bookings"}
              </button>
            ))}
          </div>

          {tab === "my" && (
            <div className="px-4 mt-4 space-y-3">
              {/* Bookings are found by the phone number they were made with. A guest who
                  booked without an account has that number but no session, so let them
                  type it rather than telling them to sign in for an account they
                  never made. */}
              {!user?.mobile && (
                <div className="guest-section-card space-y-2">
                  <label htmlFor="res-lookup" className="text-sm font-semibold block">Find a booking</label>
                  <div className="flex gap-2">
                    <input
                      id="res-lookup"
                      value={lookupPhone || guestPhone}
                      onChange={e => setLookupPhone(e.target.value)}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="The number you booked with"
                      className="guest-input flex-1"
                    />
                    <button
                      onClick={() => loadMyBookings(lookupPhone || guestPhone)}
                      disabled={!(lookupPhone || guestPhone).trim()}
                      className="guest-btn-primary px-5 disabled:opacity-40"
                    >
                      Find
                    </button>
                  </div>
                </div>
              )}
              {myBookings.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  {user?.mobile || lookupTried
                    ? "No bookings found for that number."
                    : "Enter the number you booked with to see your bookings."}
                </p>
              )}
              {myBookings.map(b => (
                <div key={b.id} className="rounded-2xl bg-card border border-border p-4">
                  <div className="flex justify-between mb-2">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {RESERVATION_TYPES.find(t => t.id === b.reservationType)?.label ?? b.reservationType}
                      </p>
                      <p className="text-sm text-muted-foreground">{b.date} · {b.time} · {b.guestCount} guests</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full h-fit ${b.status === "confirmed" ? "bg-success-subtle text-success" : b.status === "cancelled" ? "bg-danger-subtle text-danger" : "bg-warning-subtle text-warning"}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-mono text-primary text-sm">{b.bookingToken ?? `#REV${b.id}`}</span>
                    {b.status !== "cancelled" && (
                      <div className="flex gap-2">
                        <button onClick={() => setEditBooking({ ...b })} className="text-xs border border-border px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <Edit3 className="h-3 w-3" /> Modify
                        </button>
                        <button onClick={() => cancelBooking(b.id)} className="text-xs border border-danger-border text-danger px-3 py-1.5 rounded-lg">Cancel</button>
                      </div>
                    )}
                  </div>
                  {parseFloat(b.depositAmount ?? "0") > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">Deposit: ₹{b.depositAmount} · {b.depositStatus ?? "pending"}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "new" && step === "type" && (
            <div className="px-4 mt-4 space-y-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Reservation type</p>
              <div className="grid grid-cols-2 gap-2">
                {RESERVATION_TYPES.map(bt => (
                  <button
                    key={bt.id}
                    onClick={() => { setBookingType(bt.id); setStep("details"); }}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${bookingType === bt.id ? "bg-muted border-primary" : "bg-muted border-border hover:border-border"}`}
                  >
                    <GuestIcon id={bt.id} className="h-5 w-5 text-primary" />
                    <span className="text-sm font-semibold">{bt.label}</span>
                    <span className="text-2xs text-muted-foreground">{bt.desc}</span>
                    {bt.deposit > 0 && <span className="text-2xs text-warning">Deposit ₹{bt.deposit}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "new" && step === "details" && (
            <div className="px-4 mt-4 space-y-4">
              {scanLabel && (
                <div className="rounded-xl bg-success-subtle border border-success-border p-3 flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-success shrink-0" />
                  <div>
                    <p className="text-xs text-success uppercase tracking-wide">QR scan</p>
                    <p className="font-semibold">Booking for {scanLabel}</p>
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-muted border border-primary p-3 flex items-center gap-3">
                <span className="text-2xl">{TYPE_ICONS[bookingType]}</span>
                <div>
                  <p className="font-semibold">{RESERVATION_TYPES.find(t => t.id === bookingType)?.label}</p>
                  <button onClick={() => setStep("type")} className="text-xs text-primary">Change type</button>
                </div>
              </div>

              {bookingType === "spa" && spaServices.length > 0 && (
                <div className="rounded-2xl bg-card border border-border p-4">
                  <p className="text-sm font-semibold mb-2">Spa service</p>
                  <div className="space-y-2">
                    {spaServices.map(s => (
                      <button key={s.id} onClick={() => setSpaServiceId(s.id)} className={`w-full text-left p-3 rounded-xl border text-sm ${spaServiceId === s.id ? "bg-muted border-primary" : "bg-muted border-border"}`}>
                        {s.name} · ₹{s.price}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-card border border-border p-4">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Date</p>
                <input type="date" value={date} onChange={e => { setDate(e.target.value); setTime(""); setTimeLabel(""); }}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm [color-scheme:dark]" />
              </div>

              {date && (
                <div className="rounded-2xl bg-card border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Live slot availability</p>
                    <button onClick={fetchSlots} className="text-muted-foreground"><RefreshCw className={`h-4 w-4 ${loadingSlots ? "animate-spin" : ""}`} /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map(slot => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => { setTime(slot.time); setTimeLabel(slot.label); }}
                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${!slot.available ? "opacity-30 line-through bg-muted border-border" : time === slot.time ? "bg-muted border-primary text-primary" : "bg-muted border-border"}`}
                      >
                        {slot.label}
                        {slot.available && slot.remaining <= 1 && <span className="block text-2xs text-warning">Last slot</span>}
                      </button>
                    ))}
                  </div>
                  {slots.length === 0 && !loadingSlots && (
                    <p className="text-xs text-muted-foreground text-center py-4">Select a date to see available slots</p>
                  )}
                </div>
              )}

              <div className="rounded-2xl bg-card border border-border p-4">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Guest count</p>
                <div className="flex items-center gap-4 justify-center">
                  <button onClick={() => setGuests(g => Math.max(limits.min, g - 1))} className="h-10 w-10 rounded-xl bg-muted text-lg">−</button>
                  <span className="text-2xl font-semibold">{guests}</span>
                  <button onClick={() => setGuests(g => Math.min(limits.max, g + 1))} className="h-10 w-10 rounded-xl bg-primary text-lg">+</button>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">{limits.min}–{limits.max} guests for this type</p>
              </div>

              {seatingOptions.length > 0 && (
                <div className="rounded-2xl bg-card border border-border p-4">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Seating preference</p>
                  <div className="grid grid-cols-3 gap-2">
                    {seatingOptions.map(s => (
                      <button key={s.id} onClick={() => setSeating(s.id)} className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs border ${seating === s.id ? "bg-muted border-primary" : "bg-muted border-border"}`}>
                        <GuestIcon id={s.id} className="h-4 w-4" />{s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-card border border-border p-4">
                <p className="text-sm font-semibold mb-3">Special requests</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {SPECIAL_OCCASIONS.map(occ => (
                    <button key={occ} onClick={() => toggleTag(occ)} className={`px-3 py-1.5 rounded-full text-xs border ${specialTags.includes(occ) ? "bg-muted border-primary" : "border-border bg-muted"}`}>
                      {occ}
                    </button>
                  ))}
                </div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Dietary needs, décor, AV equipment, pool towels..."
                  className="w-full bg-muted border border-border rounded-xl p-3 text-sm resize-none" />
              </div>

              {/* Who the table is for. Skipped entirely when the guest is signed in. */}
              {!user?.mobile && (
                <div className="guest-section-card space-y-3">
                  <p className="text-sm font-semibold">Who is the table for?</p>
                  <div>
                    <label htmlFor="res-name" className="text-xs text-muted-foreground mb-1 block">Name</label>
                    <input
                      id="res-name"
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      autoComplete="name"
                      placeholder="The name on the booking"
                      className="guest-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="res-phone" className="text-xs text-muted-foreground mb-1 block">Mobile number</label>
                    <input
                      id="res-phone"
                      value={guestPhone}
                      onChange={e => setGuestPhone(e.target.value)}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="10-digit mobile"
                      aria-describedby="res-phone-help"
                      className="guest-input"
                    />
                    <p id="res-phone-help" className="text-xs text-muted-foreground mt-1">
                      The venue calls this number if anything changes, and it is how you find this booking again.
                    </p>
                  </div>
                </div>
              )}

              {deposit > 0 && (
                <div className="guest-section-card flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Advance deposit</p>
                    <p className="text-xs text-muted-foreground">₹{deposit} — pay now or at the venue</p>
                  </div>
                  <button
                    onClick={() => setPayDepositNow(!payDepositNow)}
                    role="switch"
                    aria-checked={payDepositNow}
                    aria-label="Pay the deposit now"
                    className={`w-11 h-6 rounded-full relative shrink-0 transition-colors ${payDepositNow ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card transition-[left] ${payDepositNow ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              )}

              {!contactUsable && date && time && (
                <p className="text-xs text-warning">
                  {!contactName ? "Add the name the booking is under." : "Enter a mobile number the venue can reach you on."}
                </p>
              )}

              <button
                onClick={() => submitReservation(payDepositNow)}
                disabled={!date || !time || !contactUsable || submitting}
                className="guest-btn-primary w-full py-4 disabled:opacity-40"
              >
                {submitting ? "Booking…" : deposit > 0 && payDepositNow ? `Book and pay ₹${deposit}` : "Confirm reservation"}
              </button>
            </div>
          )}
        </>
      )}

      {editBooking && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-border rounded-2xl p-5 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Modify reservation</h3>
              <button onClick={() => setEditBooking(null)}><X className="h-5 w-5" /></button>
            </div>
            <input type="date" value={editBooking.date} onChange={e => setEditBooking({ ...editBooking, date: e.target.value })}
              className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm [color-scheme:dark]" />
            <input value={editBooking.time} onChange={e => setEditBooking({ ...editBooking, time: e.target.value })}
              placeholder="Time" className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm" />
            <div className="flex items-center gap-3 justify-center">
              <button onClick={() => setEditBooking({ ...editBooking, guestCount: Math.max(1, editBooking.guestCount - 1) })} className="h-9 w-9 rounded-lg bg-muted">−</button>
              <span>{editBooking.guestCount} guests</span>
              <button onClick={() => setEditBooking({ ...editBooking, guestCount: editBooking.guestCount + 1 })} className="h-9 w-9 rounded-lg bg-primary">+</button>
            </div>
            <textarea value={editBooking.notes ?? ""} onChange={e => setEditBooking({ ...editBooking, notes: e.target.value })}
              className="w-full bg-muted border border-border rounded-xl p-3 text-sm" rows={2} placeholder="Notes" />
            <button onClick={saveEdit} className="w-full py-3 rounded-xl bg-primary font-semibold">Save changes</button>
          </div>
        </div>
      )}
    </div>
  );
}
