import { useState, useEffect, useCallback } from "react";
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

type Step = "type" | "details" | "deposit" | "success";
type Tab = "new" | "my";

const TYPE_ICONS: Record<string, string> = Object.fromEntries(RESERVATION_TYPES.map(t => [t.id, t.icon]));

export default function Reservation() {
  const [, navigate] = useAppLocation();
  const goBack = useGuestBack();
  const { venue, user, activeRestaurant } = useUser();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const slug = venue.restaurantSlug || params.get("slug") || "spice-garden";
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
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const [editBooking, setEditBooking] = useState<ReservationRecord | null>(null);
  const [spaServices, setSpaServices] = useState<{ id: number; name: string; price: number }[]>([]);
  const [spaServiceId, setSpaServiceId] = useState<number | null>(null);

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
      publicApi.spaServices(venue.restaurantId).then(list => setSpaServices(list)).catch(() => {});
    }
  }, [bookingType, venue.restaurantId]);

  useEffect(() => {
    const opts = seatingForType(bookingType);
    if (opts.length && !opts.find(o => o.id === seating)) setSeating(opts[0].id);
    const lim = guestLimits(bookingType);
    if (guests < lim.min) setGuests(lim.min);
    if (guests > lim.max) setGuests(lim.max);
  }, [bookingType, guests, seating]);

  const loadMyBookings = useCallback(async () => {
    if (!venue.restaurantId || !user?.mobile) return;
    try {
      const list = await publicApi.reservations(venue.restaurantId, user.mobile);
      setMyBookings(list);
    } catch { setMyBookings([]); }
  }, [venue.restaurantId, user?.mobile]);

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
      customerName: user?.name || "Guest",
      customerPhone: user?.mobile || "0000000000",
      customerEmail: user?.email,
      date,
      time: time || timeLabel,
      guestCount: guests,
      reservationType: bookingType,
      zone: seating,
      specialRequest: [scanNote, ...specialTags, notes].filter(Boolean).join(" | "),
      notes: [scanNote, notes].filter(Boolean).join(" | "),
      depositAmount: deposit,
      payDeposit: withDeposit,
      serviceId: bookingType === "spa" ? spaServiceId : undefined,
      tableId: prefilledTable && venue.tableId ? venue.tableId : undefined,
    };

    try {
      const res = await publicApi.createReservation(payload);
      setCreatedId(res.id);
      setBookingToken(res.bookingToken ?? `#REV${res.id}`);
      if (deposit > 0 && !withDeposit) {
        setStep("deposit");
      } else {
        setStep("success");
      }
    } catch {
      toast({ title: "Error", description: "Could not create reservation.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function payDeposit() {
    if (!createdId) { setStep("success"); return; }
    setSubmitting(true);
    try {
      await publicApi.payReservationDeposit(createdId, { paymentMethod });
      setStep("success");
    } catch {
      toast({ title: "Error", description: "Could not pay deposit.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooking(id: number) {
    await publicApi.cancelReservation(id).catch(() => {});
    loadMyBookings();
  }

  async function saveEdit() {
    if (!editBooking) return;
    await publicApi.updateReservation(editBooking.id, {
      date: editBooking.date,
      time: editBooking.time,
      guestCount: editBooking.guestCount,
      notes: editBooking.notes,
      specialRequest: editBooking.specialRequest,
      zone: editBooking.zone,
    }).catch(() => {});
    setEditBooking(null);
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
    <div className="guest-page thin-scroll min-h-screen text-white pb-10">
      <div className="guest-header px-4 py-3">
        <div className="flex items-center gap-3">
          <GuestBackButton
            onClick={() => (step === "type" ? goBack() : setStep(step === "deposit" ? "details" : "type"))}
          />
          <div className="flex-1">
            <h1 className="font-bold">Reservations</h1>
            <p className="text-xs text-white/40">{activeRestaurant}</p>
          </div>
        </div>
      </div>

      {step === "success" && (
        <div className="flex flex-col items-center px-4 pt-10 text-center">
          <CheckCircle className="h-16 w-16 text-emerald-400 mb-4" />
          <h2 className="text-2xl font-extrabold mb-2">Booking Confirmed!</h2>
          <p className="text-white/50 mb-1">{TYPE_ICONS[bookingType]} {RESERVATION_TYPES.find(t => t.id === bookingType)?.label}</p>
          <p className="text-white/50 mb-6">{date} · {timeLabel || time} · {guests} guests</p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 w-full max-w-sm mb-6">
            <div className="text-4xl font-black text-orange-400 font-mono">{bookingToken}</div>
            <p className="text-xs text-white/40 mt-2">Show this token at arrival</p>
          </div>
          <div className="flex gap-3 w-full max-w-sm">
            <button onClick={() => navigate(`/user/menu?slug=${slug}`)} className="flex-1 py-3 rounded-xl bg-orange-500 font-semibold text-sm">Menu</button>
            <button onClick={() => { resetNew(); setTab("my"); setStep("type"); }} className="flex-1 py-3 rounded-xl border border-white/10 text-sm">My Bookings</button>
          </div>
        </div>
      )}

      {step === "deposit" && (
        <div className="px-4 pt-6 space-y-4 max-w-md mx-auto">
          <h2 className="text-xl font-bold">Pay Advance Deposit</h2>
          <p className="text-sm text-white/50">₹{deposit} required for {RESERVATION_TYPES.find(t => t.id === bookingType)?.label}. Refundable on arrival.</p>
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
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs ${paymentMethod === id ? "bg-orange-500/20 border-orange-500/50" : "bg-white/5 border-white/10"}`}
              >
                <PayIcon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
          <button onClick={payDeposit} disabled={submitting} className="w-full py-4 rounded-xl bg-orange-500 font-bold disabled:opacity-50">
            Pay ₹{deposit}
          </button>
          <button onClick={() => setStep("success")} className="w-full py-3 text-sm text-white/40">Skip — pay at venue</button>
        </div>
      )}

      {step !== "success" && step !== "deposit" && (
        <>
          <div className="mx-4 mt-4 flex gap-1 bg-white/5 p-1 rounded-xl">
            {(["new", "my"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === t ? "bg-orange-500 text-white" : "text-white/50"}`}>
                {t === "new" ? "New Booking" : "My Bookings"}
              </button>
            ))}
          </div>

          {tab === "my" && (
            <div className="px-4 mt-4 space-y-3">
              {myBookings.length === 0 && (
                <p className="text-center text-white/40 py-8 text-sm">No bookings yet</p>
              )}
              {myBookings.map(b => (
                <div key={b.id} className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
                  <div className="flex justify-between mb-2">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {TYPE_ICONS[b.reservationType] ?? "📅"} {RESERVATION_TYPES.find(t => t.id === b.reservationType)?.label ?? b.reservationType}
                      </p>
                      <p className="text-sm text-white/50">{b.date} · {b.time} · {b.guestCount} guests</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full h-fit ${b.status === "confirmed" ? "bg-emerald-500/20 text-emerald-400" : b.status === "cancelled" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-mono text-orange-400 text-sm">{b.bookingToken ?? `#REV${b.id}`}</span>
                    {b.status !== "cancelled" && (
                      <div className="flex gap-2">
                        <button onClick={() => setEditBooking({ ...b })} className="text-xs border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <Edit3 className="h-3 w-3" /> Modify
                        </button>
                        <button onClick={() => cancelBooking(b.id)} className="text-xs border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg">Cancel</button>
                      </div>
                    )}
                  </div>
                  {parseFloat(b.depositAmount ?? "0") > 0 && (
                    <p className="text-xs text-white/40 mt-2">Deposit: ₹{b.depositAmount} · {b.depositStatus ?? "pending"}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "new" && step === "type" && (
            <div className="px-4 mt-4 space-y-4">
              <p className="text-xs text-white/40 uppercase tracking-wide">Reservation type</p>
              <div className="grid grid-cols-2 gap-2">
                {RESERVATION_TYPES.map(bt => (
                  <button
                    key={bt.id}
                    onClick={() => { setBookingType(bt.id); setStep("details"); }}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${bookingType === bt.id ? "bg-orange-500/20 border-orange-500/50" : "bg-white/5 border-white/10 hover:border-white/20"}`}
                  >
                    <span className="text-2xl">{bt.icon}</span>
                    <span className="text-sm font-semibold">{bt.label}</span>
                    <span className="text-[10px] text-white/40">{bt.desc}</span>
                    {bt.deposit > 0 && <span className="text-[10px] text-amber-400">Deposit ₹{bt.deposit}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "new" && step === "details" && (
            <div className="px-4 mt-4 space-y-4">
              {scanLabel && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-300/80 uppercase tracking-wide">QR scan</p>
                    <p className="font-semibold">Booking for {scanLabel}</p>
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3 flex items-center gap-3">
                <span className="text-2xl">{TYPE_ICONS[bookingType]}</span>
                <div>
                  <p className="font-semibold">{RESERVATION_TYPES.find(t => t.id === bookingType)?.label}</p>
                  <button onClick={() => setStep("type")} className="text-xs text-orange-300">Change type</button>
                </div>
              </div>

              {bookingType === "spa" && spaServices.length > 0 && (
                <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
                  <p className="text-sm font-semibold mb-2">Spa service</p>
                  <div className="space-y-2">
                    {spaServices.map(s => (
                      <button key={s.id} onClick={() => setSpaServiceId(s.id)} className={`w-full text-left p-3 rounded-xl border text-sm ${spaServiceId === s.id ? "bg-pink-500/20 border-pink-500/40" : "bg-white/5 border-white/10"}`}>
                        {s.name} · ₹{s.price}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-orange-400" /> Date</p>
                <input type="date" value={date} onChange={e => { setDate(e.target.value); setTime(""); setTimeLabel(""); }}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm [color-scheme:dark]" />
              </div>

              {date && (
                <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-orange-400" /> Live slot availability</p>
                    <button onClick={fetchSlots} className="text-white/40"><RefreshCw className={`h-4 w-4 ${loadingSlots ? "animate-spin" : ""}`} /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map(slot => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => { setTime(slot.time); setTimeLabel(slot.label); }}
                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${!slot.available ? "opacity-30 line-through bg-white/5 border-white/5" : time === slot.time ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-white/5 border-white/10"}`}
                      >
                        {slot.label}
                        {slot.available && slot.remaining <= 1 && <span className="block text-[9px] text-amber-400">Last slot</span>}
                      </button>
                    ))}
                  </div>
                  {slots.length === 0 && !loadingSlots && (
                    <p className="text-xs text-white/40 text-center py-4">Select a date to see available slots</p>
                  )}
                </div>
              )}

              <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-orange-400" /> Guest count</p>
                <div className="flex items-center gap-4 justify-center">
                  <button onClick={() => setGuests(g => Math.max(limits.min, g - 1))} className="h-10 w-10 rounded-xl bg-white/10 text-lg">−</button>
                  <span className="text-2xl font-extrabold">{guests}</span>
                  <button onClick={() => setGuests(g => Math.min(limits.max, g + 1))} className="h-10 w-10 rounded-xl bg-orange-500 text-lg">+</button>
                </div>
                <p className="text-xs text-white/40 text-center mt-2">{limits.min}–{limits.max} guests for this type</p>
              </div>

              {seatingOptions.length > 0 && (
                <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-orange-400" /> Seating preference</p>
                  <div className="grid grid-cols-3 gap-2">
                    {seatingOptions.map(s => (
                      <button key={s.id} onClick={() => setSeating(s.id)} className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs border ${seating === s.id ? "bg-orange-500/20 border-orange-500/50" : "bg-white/5 border-white/10"}`}>
                        <span className="text-lg">{s.icon}</span>{s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
                <p className="text-sm font-semibold mb-3">Special requests</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {SPECIAL_OCCASIONS.map(occ => (
                    <button key={occ} onClick={() => toggleTag(occ)} className={`px-3 py-1.5 rounded-full text-xs border ${specialTags.includes(occ) ? "bg-orange-500/20 border-orange-500/40" : "border-white/10 bg-white/5"}`}>
                      {occ}
                    </button>
                  ))}
                </div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Dietary needs, décor, AV equipment, pool towels..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm resize-none" />
              </div>

              {deposit > 0 && (
                <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Advance deposit</p>
                    <p className="text-xs text-white/40">₹{deposit} — pay now or at venue</p>
                  </div>
                  <button onClick={() => setPayDepositNow(!payDepositNow)} className={`w-12 h-6 rounded-full relative ${payDepositNow ? "bg-orange-500" : "bg-white/20"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${payDepositNow ? "left-6" : "left-0.5"}`} />
                  </button>
                </div>
              )}

              <button
                onClick={() => submitReservation(payDepositNow)}
                disabled={!date || !time || submitting}
                className="w-full py-4 rounded-xl bg-orange-500 font-bold disabled:opacity-40"
              >
                {submitting ? "Booking..." : deposit > 0 && payDepositNow ? `Book & Pay ₹${deposit}` : "Confirm Reservation"}
              </button>
            </div>
          )}
        </>
      )}

      {editBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Modify reservation</h3>
              <button onClick={() => setEditBooking(null)}><X className="h-5 w-5" /></button>
            </div>
            <input type="date" value={editBooking.date} onChange={e => setEditBooking({ ...editBooking, date: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm [color-scheme:dark]" />
            <input value={editBooking.time} onChange={e => setEditBooking({ ...editBooking, time: e.target.value })}
              placeholder="Time" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm" />
            <div className="flex items-center gap-3 justify-center">
              <button onClick={() => setEditBooking({ ...editBooking, guestCount: Math.max(1, editBooking.guestCount - 1) })} className="h-9 w-9 rounded-lg bg-white/10">−</button>
              <span>{editBooking.guestCount} guests</span>
              <button onClick={() => setEditBooking({ ...editBooking, guestCount: editBooking.guestCount + 1 })} className="h-9 w-9 rounded-lg bg-orange-500">+</button>
            </div>
            <textarea value={editBooking.notes ?? ""} onChange={e => setEditBooking({ ...editBooking, notes: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm" rows={2} placeholder="Notes" />
            <button onClick={saveEdit} className="w-full py-3 rounded-xl bg-orange-500 font-semibold">Save changes</button>
          </div>
        </div>
      )}
    </div>
  );
}
