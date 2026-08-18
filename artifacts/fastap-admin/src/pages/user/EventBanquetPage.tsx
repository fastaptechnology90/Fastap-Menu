import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useToast } from "@/hooks/use-toast";
import { useGuestBack } from "@/hooks/useGuestBack";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  EVENT_TYPES, EVENT_HALLS, SEATING_LAYOUTS, CATERING_PACKAGES, DECORATION_PACKAGES,
  hallsForEventType, recommendedDecor, computeQuotation,
  type EventTypeId, type GuestInvitation, type EventQuotation,
} from "@/lib/eventBanquetCatalog";
import {
  ChevronLeft, ChevronRight, CheckCircle, Users, Calendar, Clock,
  MapPin, FileText, Send, Plus, Trash2, LayoutGrid,
} from "lucide-react";

type Step = "type" | "hall" | "layout" | "catering" | "decor" | "quote" | "invites" | "success";
type Tab = "plan" | "my";

function SeatingPreview({ layoutId, guestCount }: { layoutId: string; guestCount: number }) {
  const layout = SEATING_LAYOUTS.find(l => l.id === layoutId) ?? SEATING_LAYOUTS[0];
  const cells = layout.rows * layout.cols;
  const filled = Math.min(guestCount, cells);
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <p className="text-xs text-white/50 mb-3 text-center">{layout.label} — {layout.desc}</p>
      <div className="flex justify-center">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cells }).map((_, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-sm ${i < filled ? "bg-violet-400" : "bg-white/10"} ${layoutId === "banquet" && i % 5 === 0 ? "rounded-full h-4 w-4" : ""}`}
            />
          ))}
        </div>
      </div>
      <p className="text-[10px] text-white/40 text-center mt-2">{filled} / {layout.capacityFactor ? Math.round(guestCount * layout.capacityFactor) : guestCount} seats mapped</p>
    </div>
  );
}

export default function EventBanquetPage() {
  const [, navigate] = useAppLocation();
  const goBack = useGuestBack();
  const { venue, user, activeRestaurant } = useUser();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const slug = venue.restaurantSlug || params.get("slug") || "spice-garden";

  const [tab, setTab] = useState<Tab>("plan");
  const [step, setStep] = useState<Step>("type");
  const [eventType, setEventType] = useState<EventTypeId>("wedding");
  const [eventName, setEventName] = useState("");
  const [hallId, setHallId] = useState("grand_hall");
  const [layoutId, setLayoutId] = useState("banquet");
  const [cateringId, setCateringId] = useState("premium");
  const [decorId, setDecorId] = useState("floral");
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
  const [createdEventId, setCreatedEventId] = useState<number | null>(null);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const { toast } = useToast();

  const halls = useMemo(() => hallsForEventType(eventType), [eventType]);
  const decorOptions = useMemo(() => recommendedDecor(eventType), [eventType]);
  const selectedHall = EVENT_HALLS.find(h => h.id === hallId) ?? halls[0];

  useEffect(() => {
    if (halls.length && !halls.find(h => h.id === hallId)) setHallId(halls[0].id);
  }, [halls, hallId]);

  useEffect(() => {
    if (decorOptions.length && !decorOptions.find(d => d.id === decorId)) setDecorId(decorOptions[0].id);
  }, [decorOptions, decorId]);

  const refreshQuote = useCallback(async () => {
    const hall = EVENT_HALLS.find(h => h.id === hallId);
    const catering = CATERING_PACKAGES.find(c => c.id === cateringId);
    const decor = DECORATION_PACKAGES.find(d => d.id === decorId);
    if (!hall || !catering || !decor) return;
    const local = computeQuotation(hall.rate, guestCount, catering.perGuest, decor.price);
    setQuotation(local);
    if (venue.restaurantId) {
      try {
        const res = await publicApi.events.quotation({ hallId, guestCount, cateringPackageId: cateringId, decorationPackageId: decorId });
        setQuotation(res.quotation);
      } catch { /* local quote still shown */ }
    }
  }, [hallId, guestCount, cateringId, decorId, venue.restaurantId]);

  useEffect(() => {
    if (step === "quote" || step === "invites") refreshQuote();
  }, [step, refreshQuote]);

  const loadMyEvents = useCallback(async () => {
    if (!venue.restaurantId || !user?.mobile) return;
    try {
      const list = await publicApi.events.my(venue.restaurantId, user.mobile);
      setMyEvents(list);
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
    const hall = EVENT_HALLS.find(h => h.id === hallId);
    try {
      const res = await publicApi.events.enquiry({
        restaurantId: venue.restaurantId ?? 1,
        name: eventName || `${EVENT_TYPES.find(t => t.id === eventType)?.label} Event`,
        type: eventType,
        eventDate,
        eventTime,
        guestCount,
        contactName: user?.name || "Guest",
        contactPhone: user?.mobile || "",
        notes,
        venue: hall?.name,
        hallId,
        seatingLayout: layoutId,
        cateringPackageId: cateringId,
        decorationPackageId: decorId,
        guestInvitations: invitations,
        quotation,
      });
      setCreatedEventId(res.id);
      setEnquiryToken(res.enquiryToken ?? `EVT-${res.id}`);
      if (res.id && invitations.length > 0) {
        await publicApi.events.sendInvitations(res.id, invitations.map(i => ({ name: i.name, phone: i.phone, email: i.email }))).catch(() => {});
      }
      setStep("success");
    } catch {
      toast({ title: "Error", description: "Could not submit event enquiry.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const STEPS: Step[] = ["type", "hall", "layout", "catering", "decor", "quote", "invites"];
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-12">
      <div className="guest-header px-4 py-3">
        <div className="flex items-center gap-3">
          <GuestBackButton
            onClick={() => (step === "type" && tab === "plan" ? goBack() : step === "type" ? setTab("plan") : setStep(STEPS[Math.max(0, stepIdx - 1)]))}
          />
          <div className="flex-1">
            <h1 className="font-bold">Events & Banquet</h1>
            <p className="text-xs text-white/40">{activeRestaurant}</p>
          </div>
        </div>
        {tab === "plan" && step !== "success" && (
          <div className="flex gap-1 mt-3 overflow-x-auto">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-1 flex-1 min-w-[20px] rounded-full ${i <= stepIdx ? "bg-violet-500" : "bg-white/10"}`} />
            ))}
          </div>
        )}
      </div>

      {step === "success" ? (
        <div className="px-4 pt-10 text-center">
          <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Event Enquiry Submitted!</h2>
          <p className="text-white/50 mb-4">Our events team will contact you within 24 hours.</p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 max-w-sm mx-auto mb-6">
            <p className="text-xs text-white/40">Reference</p>
            <p className="text-2xl font-mono text-violet-400">{enquiryToken}</p>
            {quotation && <p className="text-sm text-white/60 mt-2">Quoted total: ₹{quotation.total.toLocaleString()}</p>}
          </div>
          <button onClick={() => navigate(`/user/menu?slug=${slug}`)} className="px-8 py-3 rounded-xl bg-violet-500 font-semibold">Done</button>
        </div>
      ) : (
        <>
          <div className="mx-4 mt-4 flex gap-1 bg-white/5 p-1 rounded-xl">
            {(["plan", "my"] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); if (t === "plan") setStep("type"); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === t ? "bg-violet-500 text-white" : "text-white/50"}`}>
                {t === "plan" ? "Plan Event" : "My Events"}
              </button>
            ))}
          </div>

          {tab === "my" && (
            <div className="px-4 mt-4 space-y-3">
              {myEvents.length === 0 && <p className="text-center text-white/40 py-10 text-sm">No events yet — start planning!</p>}
              {myEvents.map(ev => {
                const meta = (ev.metadata ?? {}) as Record<string, unknown>;
                const quote = meta.quotation as EventQuotation | undefined;
                return (
                  <div key={ev.id} className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
                    <div className="flex justify-between mb-2">
                      <p className="font-semibold">{ev.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">{ev.status}</span>
                    </div>
                    <p className="text-sm text-white/50">{EVENT_TYPES.find(t => t.id === ev.type)?.icon} {ev.type} · {ev.guestCount} guests</p>
                    {quote && <p className="text-sm text-violet-300 mt-1">Quote: ₹{quote.total?.toLocaleString()}</p>}
                    {Array.isArray(meta.guestInvitations) && (
                      <p className="text-xs text-white/40 mt-2">{(meta.guestInvitations as unknown[]).length} invitations sent</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "plan" && step === "type" && (
            <div className="px-4 mt-4 space-y-4">
              <p className="text-xs text-white/40 uppercase">Select event type</p>
              <div className="grid grid-cols-2 gap-2">
                {EVENT_TYPES.map(t => (
                  <button key={t.id} onClick={() => { setEventType(t.id); setStep("hall"); }} className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left ${eventType === t.id ? "bg-violet-500/20 border-violet-500/50" : "bg-white/5 border-white/10"}`}>
                    <span className="text-2xl">{t.icon}</span>
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="text-[10px] text-white/40">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "plan" && step === "hall" && (
            <div className="px-4 mt-4 space-y-4">
              <p className="text-xs text-white/40 uppercase flex items-center gap-1"><MapPin className="h-3 w-3" /> Hall preview</p>
              {halls.map(h => (
                <button key={h.id} onClick={() => setHallId(h.id)} className={`w-full rounded-2xl border p-4 text-left transition-all ${hallId === h.id ? "bg-violet-500/15 border-violet-500/40" : "bg-white/[0.03] border-white/8"}`}>
                  <div className="flex gap-4">
                    <div className="text-5xl">{h.image}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold">{h.name}</p>
                      <p className="text-xs text-white/50">{h.area} · up to {h.capacity} guests · ₹{h.rate.toLocaleString()}</p>
                      <p className="text-xs text-white/60 mt-2">{h.preview}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {h.features.slice(0, 4).map(f => <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5">{f}</span>)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              <button onClick={() => setStep("layout")} className="w-full py-3.5 rounded-xl bg-violet-500 font-semibold flex items-center justify-center gap-2">
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {tab === "plan" && step === "layout" && (
            <div className="px-4 mt-4 space-y-4">
              <p className="text-xs text-white/40 uppercase flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> Seating layout preview</p>
              {SEATING_LAYOUTS.map(l => (
                <button key={l.id} onClick={() => setLayoutId(l.id)} className={`w-full rounded-xl border p-3 text-left ${layoutId === l.id ? "border-violet-500/50 bg-violet-500/10" : "border-white/10 bg-white/5"}`}>
                  <p className="font-semibold text-sm">{l.icon} {l.label}</p>
                  <p className="text-xs text-white/40">{l.desc}</p>
                </button>
              ))}
              <div className="flex items-center gap-4 justify-center py-2">
                <button onClick={() => setGuestCount(g => Math.max(10, g - 10))} className="h-10 w-10 rounded-xl bg-white/10">−</button>
                <span className="text-xl font-bold">{guestCount} guests</span>
                <button onClick={() => setGuestCount(g => Math.min(selectedHall?.capacity ?? 300, g + 10))} className="h-10 w-10 rounded-xl bg-violet-500">+</button>
              </div>
              <SeatingPreview layoutId={layoutId} guestCount={guestCount} />
              <button onClick={() => setStep("catering")} className="w-full py-3.5 rounded-xl bg-violet-500 font-semibold">Continue</button>
            </div>
          )}

          {tab === "plan" && step === "catering" && (
            <div className="px-4 mt-4 space-y-3">
              <p className="text-xs text-white/40 uppercase">Catering package</p>
              {CATERING_PACKAGES.map(c => (
                <button key={c.id} onClick={() => setCateringId(c.id)} className={`w-full rounded-xl border p-4 text-left ${cateringId === c.id ? "bg-violet-500/15 border-violet-500/40" : "bg-white/5 border-white/10"}`}>
                  <div className="flex justify-between">
                    <span className="font-semibold">{c.icon} {c.label}</span>
                    <span className="text-violet-300">₹{c.perGuest}/guest</span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">{c.desc}</p>
                  <ul className="text-[10px] text-white/40 mt-2 space-y-0.5">
                    {c.items.map(i => <li key={i}>• {i}</li>)}
                  </ul>
                </button>
              ))}
              <button onClick={() => setStep("decor")} className="w-full py-3.5 rounded-xl bg-violet-500 font-semibold">Continue</button>
            </div>
          )}

          {tab === "plan" && step === "decor" && (
            <div className="px-4 mt-4 space-y-3">
              <p className="text-xs text-white/40 uppercase">Decoration package</p>
              {decorOptions.map(d => (
                <button key={d.id} onClick={() => setDecorId(d.id)} className={`w-full rounded-xl border p-4 text-left ${decorId === d.id ? "bg-violet-500/15 border-violet-500/40" : "bg-white/5 border-white/10"}`}>
                  <div className="flex justify-between">
                    <span className="font-semibold">{d.icon} {d.label}</span>
                    <span className="text-violet-300">₹{d.price.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">{d.desc}</p>
                </button>
              ))}
              <button onClick={() => setStep("quote")} className="w-full py-3.5 rounded-xl bg-violet-500 font-semibold">View quotation</button>
            </div>
          )}

          {tab === "plan" && step === "quote" && quotation && (
            <div className="px-4 mt-4 space-y-4">
              <p className="text-xs text-white/40 uppercase flex items-center gap-1"><FileText className="h-3 w-3" /> Event quotation</p>
              <div className="rounded-2xl bg-violet-500/10 border border-violet-500/30 p-4 space-y-2">
                {quotation.lines.map(l => (
                  <div key={l.label} className="flex justify-between text-sm">
                    <span className="text-white/70">{l.label}</span>
                    <span>₹{l.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-2 flex justify-between text-sm text-white/50">
                  <span>Subtotal</span><span>₹{quotation.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-white/50">
                  <span>GST (5%)</span><span>₹{quotation.tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-violet-300">
                  <span>Total</span><span>₹{quotation.total.toLocaleString()}</span>
                </div>
                <p className="text-xs text-amber-400">Advance (30%): ₹{quotation.advance.toLocaleString()}</p>
              </div>
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm" placeholder="Event name" value={eventName} onChange={e => setEventName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-white/40 flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" /> Date</label>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-xs text-white/40 flex items-center gap-1 mb-1"><Clock className="h-3 w-3" /> Time</label>
                  <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm [color-scheme:dark]" />
                </div>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requirements, AV needs, dietary notes..." className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm min-h-[80px]" />
              <button onClick={() => setStep("invites")} disabled={!eventDate} className="w-full py-3.5 rounded-xl bg-violet-500 font-semibold disabled:opacity-40">Guest invitations →</button>
            </div>
          )}

          {tab === "plan" && step === "invites" && (
            <div className="px-4 mt-4 space-y-4">
              <p className="text-xs text-white/40 uppercase flex items-center gap-1"><Send className="h-3 w-3" /> Guest invitation management</p>
              <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 space-y-3">
                <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm" placeholder="Guest name" value={inviteName} onChange={e => setInviteName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm" placeholder="Phone" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} />
                  <input className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm" placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                </div>
                <button onClick={addInvitation} className="w-full py-2.5 rounded-xl border border-violet-500/40 text-violet-300 text-sm flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" /> Add guest
                </button>
              </div>
              {invitations.length > 0 && (
                <div className="space-y-2">
                  {invitations.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 text-sm">
                      <div>
                        <p className="font-medium">{inv.name}</p>
                        <p className="text-xs text-white/40">{inv.phone || inv.email || "—"}</p>
                      </div>
                      <button onClick={() => setInvitations(prev => prev.filter(i => i.id !== inv.id))} className="text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <p className="text-xs text-white/40 text-center">{invitations.length} guest(s) will receive invitations on submit</p>
                </div>
              )}
              <button onClick={submitEnquiry} disabled={submitting || !eventDate} className="w-full py-4 rounded-xl bg-violet-500 font-bold disabled:opacity-40">
                {submitting ? "Submitting..." : "Submit event enquiry"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
