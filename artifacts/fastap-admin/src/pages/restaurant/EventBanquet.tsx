import { useState, useEffect, useCallback } from "react";
import { Calendar, Users, MapPin, Plus, X, CheckCircle, Phone, Church, Briefcase, Cake, Heart, PartyPopper, ClipboardList, UtensilsCrossed, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { ModulePackages } from "@/components/restaurant/ModulePackages";
import { events as eventsApi, tables as tablesApi, tasksSop } from "@/lib/api";

type EventItem = {
  id: string; name: string; type: string; date: string; rawDate: string; time: string; guests: number;
  venue: string; status: string; advance: number; total: number; catering: boolean;
  decor: boolean; staffAssigned: string[]; contact: string; phone: string; menu: string; notes: string;
};

function mapEvent(e: any): EventItem {
  const meta = typeof e.metadata === "object" && e.metadata ? e.metadata : e;
  const eventDate = e.eventDate || e.date || meta.date;
  const d = eventDate ? new Date(eventDate) : null;
  return {
    id: String(e.id),
    name: e.name || e.title || "Event",
    type: e.type || e.eventType || "enquiry_gen",
    date: d ? d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : (e.date || "TBD"),
    rawDate: d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "",
    time: e.eventTime || e.time || meta.time || "TBD",
    guests: parseInt(String(e.guestCount ?? e.guests ?? meta.guests)) || 0,
    venue: e.venue || meta.venue || "TBD",
    status: e.status || "enquiry",
    advance: parseFloat(String(e.advancePaid ?? e.advance ?? meta.advance)) || 0,
    total: parseFloat(String(e.totalAmount ?? e.total ?? meta.total)) || 0,
    catering: Boolean(e.catering ?? meta.catering ?? true),
    decor: Boolean(e.decor ?? meta.decor ?? false),
    staffAssigned: Array.isArray(e.staffAssigned) ? e.staffAssigned : [],
    contact: e.contactName || e.contact || meta.contact || "—",
    phone: e.contactPhone || e.phone || meta.phone || "—",
    menu: e.menu || meta.menu || "TBD",
    notes: e.notes || e.description || meta.notes || "",
  };
}

type VenueRow = {
  id: string; name: string; capacity: number; area: string;
  features: string[]; status: string; rate: number; rateUnit: string;
};

const TYPE_CFG: Record<string,{label:string;icon:LucideIcon;color:string;bg:string}> = {
  wedding:     {label:"Wedding",    icon:Church,color:"text-muted-foreground",   bg:"bg-muted"},
  corporate:   {label:"Corporate",  icon:Briefcase,color:"text-info",   bg:"bg-info-subtle"},
  birthday:    {label:"Birthday",   icon:Cake,color:"text-primary",  bg:"bg-primary/15"},
  anniversary: {label:"Anniversary",icon:Heart,color:"text-danger",   bg:"bg-danger-subtle"},
  social:      {label:"Social",     icon:PartyPopper,color:"text-muted-foreground", bg:"bg-muted"},
  enquiry_gen: {label:"General",    icon:ClipboardList,color:"text-muted-foreground",   bg:"bg-muted"},
};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  confirmed: {label:"Confirmed",color:"text-success",bg:"bg-success-subtle"},
  tentative: {label:"Tentative",color:"text-warning",bg:"bg-warning-subtle"},
  enquiry:   {label:"Enquiry",  color:"text-info",   bg:"bg-info-subtle"},
  cancelled: {label:"Cancelled",color:"text-danger",   bg:"bg-danger-subtle"},
  completed: {label:"Completed",color:"text-success",  bg:"bg-success-subtle"},
};

type Tab = "events"|"venues"|"checklist";

export default function EventBanquet() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("events");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newEvent, setNewEvent] = useState({ name:"", type:"wedding", date:"", time:"", guests:"", venue:"", contact:"", phone:"", advance:"", total:"", notes:"" });
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [checklistItems, setChecklistItems] = useState<string[]>([]);

  // Edit event modal state
  const [editEvent, setEditEvent] = useState<EventItem | null>(null);
  const [editForm, setEditForm] = useState({ name:"", type:"wedding", date:"", time:"", guests:"", venue:"", contact:"", phone:"", advance:"", total:"", menu:"", notes:"", status:"enquiry" });
  const [savingEdit, setSavingEdit] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await eventsApi.list(restaurantId);
      setEvents((Array.isArray(data) ? data : []).map(mapEvent));
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to load events", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
    finally { setLoading(false); }
  }, [restaurantId, toast]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  useEffect(() => {
    if (!restaurantId) return;
    tablesApi.areas(restaurantId).then(rows => {
      setVenues((Array.isArray(rows) ? rows : []).map((a: any) => {
        const layout = typeof a.layoutConfig === "object" && a.layoutConfig ? a.layoutConfig : {};
        const features = [a.areaType, a.description].filter(Boolean) as string[];
        return {
          id: String(a.id),
          name: a.name,
          capacity: parseInt(String(layout.capacity ?? 0), 10),
          area: a.description || a.areaType || "—",
          features: features.length ? features : [a.areaType || "venue"],
          status: a.isActive === false ? "maintenance" : "available",
          rate: parseFloat(String(layout.rate ?? 0)),
          rateUnit: layout.rateUnit || "per event",
        };
      }));
    }).catch(() => setVenues([]));

    Promise.all([
      tasksSop.sopList(restaurantId).catch(() => []),
      tasksSop.checklists(restaurantId).catch(() => null),
    ]).then(([sopRows, checklistData]) => {
      const eventSop = (Array.isArray(sopRows) ? sopRows : [])
        .filter((s: any) => /event|banquet|wedding/i.test(String(s.category || s.title || "")));
      if (eventSop.length) {
        setChecklistItems(eventSop.map((s: any) => s.title));
      } else if (checklistData?.templates?.opening?.length) {
        setChecklistItems(checklistData.templates.opening.map((t: any) => t.task || t.title || String(t)));
      } else {
        setChecklistItems([]);
      }
      if (checklistData?.progress?.opening?.length) {
        setCheckedItems(new Set(checklistData.progress.opening));
      }
    });
  }, [restaurantId]);

  const filtered = events.filter(e =>
    (typeFilter==="all"||e.type===typeFilter) &&
    (statusFilter==="all"||e.status===statusFilter)
  );

  const totalRevenue = events.filter(e=>e.status==="confirmed").reduce((s,e)=>s+e.total,0);
  const totalAdvance = events.reduce((s,e)=>s+e.advance,0);
  const upcomingCount = events.filter(e=>e.status==="confirmed"||e.status==="tentative").length;

  async function handleCreateEvent() {
    if (!newEvent.name || !restaurantId) return;
    try {
      const created = await eventsApi.create(restaurantId, {
        name: newEvent.name,
        type: newEvent.type,
        eventDate: newEvent.date,
        eventTime: newEvent.time,
        guestCount: parseInt(newEvent.guests) || 0,
        venue: newEvent.venue,
        contactName: newEvent.contact,
        contactPhone: newEvent.phone,
        advancePaid: parseFloat(newEvent.advance) || 0,
        totalAmount: parseFloat(newEvent.total) || 0,
        notes: newEvent.notes,
        status: "enquiry",
      });
      setEvents(e => [mapEvent(created), ...e]);
      setNewEvent({ name:"", type:"wedding", date:"", time:"", guests:"", venue:"", contact:"", phone:"", advance:"", total:"", notes:"" });
      setShowAdd(false);
      toast({ title: "Event created", description: `“${newEvent.name}” was added as an enquiry.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to create event", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function updateEventStatus(event: EventItem, status: string) {
    if (!restaurantId) return;
    try {
      const updated = await eventsApi.update(restaurantId, Number(event.id), { status });
      const mapped = mapEvent(updated);
      setEvents(e => e.map(x => x.id === event.id ? mapped : x));
      setSelected(mapped);
      toast({ title: "Event updated", description: `“${event.name}” is now ${status}.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to update event", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  function openEditEvent(ev: EventItem) {
    setEditForm({
      name: ev.name,
      type: ev.type,
      date: ev.rawDate || "",
      time: /^\d{1,2}:\d{2}/.test(ev.time) ? ev.time : "",
      guests: ev.guests ? String(ev.guests) : "",
      venue: ev.venue === "TBD" ? "" : ev.venue,
      contact: ev.contact === "—" ? "" : ev.contact,
      phone: ev.phone === "—" ? "" : ev.phone,
      advance: ev.advance ? String(ev.advance) : "",
      total: ev.total ? String(ev.total) : "",
      menu: ev.menu === "TBD" ? "" : ev.menu,
      notes: ev.notes,
      status: ev.status,
    });
    setEditEvent(ev);
  }

  async function handleSaveEditEvent() {
    if (!restaurantId || !editEvent) return;
    setSavingEdit(true);
    try {
      const updated = await eventsApi.update(restaurantId, Number(editEvent.id), {
        name: editForm.name,
        type: editForm.type,
        eventDate: editForm.date || undefined,
        eventTime: editForm.time,
        guestCount: parseInt(editForm.guests) || 0,
        venue: editForm.venue,
        contactName: editForm.contact,
        contactPhone: editForm.phone,
        advancePaid: parseFloat(editForm.advance) || 0,
        totalAmount: parseFloat(editForm.total) || 0,
        menu: editForm.menu,
        notes: editForm.notes,
        status: editForm.status,
      });
      const mapped = mapEvent(updated);
      setEvents(e => e.map(x => x.id === editEvent.id ? mapped : x));
      setSelected(prev => prev && prev.id === editEvent.id ? mapped : prev);
      setEditEvent(null);
      toast({ title: "Event updated", description: `“${editForm.name}” was saved.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to save event", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  }

  // Open the New-Event enquiry composer pre-filled with the chosen venue
  function bookVenue(v: VenueRow) {
    setSelected(null);
    setNewEvent(p => ({ ...p, venue: v.name }));
    setShowAdd(true);
  }

  // Toggle a checklist item and persist to the shared checklist progress store
  function toggleCheck(item: string) {
    const wasChecked = checkedItems.has(item);
    const next = new Set(checkedItems);
    wasChecked ? next.delete(item) : next.add(item);
    setCheckedItems(next);
    if (!restaurantId) return;
    tasksSop.saveChecklistProgress(restaurantId, "opening", Array.from(next)).catch((e) => {
      console.error(e);
      // revert optimistic update on failure
      setCheckedItems(prev => { const r = new Set(prev); wasChecked ? r.add(item) : r.delete(item); return r; });
      toast({ title: "Failed to save checklist", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    });
  }

  if (loading && events.length === 0) {
    return <div className="p-6 text-center text-muted-foreground text-sm">Loading events…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Events & Banquet</h1>
          <p className="text-xs text-muted-foreground">{upcomingCount} upcoming events · ₹{(totalRevenue/100000).toFixed(1)}L confirmed revenue</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm transition-colors">
          <Plus className="h-4 w-4"/>New Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Upcoming Events",value:upcomingCount,color:"text-primary",bg:"bg-primary/10"},
          {label:"Confirmed Revenue",value:`₹${(totalRevenue/100000).toFixed(1)}L`,color:"text-success",bg:"bg-success-subtle"},
          {label:"Advance Collected",value:`₹${(totalAdvance/1000).toFixed(0)}K`,color:"text-info",bg:"bg-info-subtle"},
          {label:"Enquiries",value:events.filter(e=>e.status==="enquiry").length,color:"text-muted-foreground",bg:"bg-muted"},
        ].map(s=>(
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4`}>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <ModulePackages restaurantId={restaurantId} module="events" title="Event & Party Packages / Rates" label="Package" />

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {([["events","Events"],["venues","Venues"],["checklist","Event Checklist"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab==="events"&&(
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1">
              {["all","wedding","corporate","birthday","anniversary"].map(t=>(
                <button key={t} onClick={()=>setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${typeFilter===t?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>
                  {t==="all"?"All Types":t}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {["all","confirmed","tentative","enquiry"].map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${statusFilter===s?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{s==="all"?"All Status":s}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {filtered.map(event=>{
              const tcfg = TYPE_CFG[event.type]||TYPE_CFG.enquiry_gen;
              const scfg = STATUS_CFG[event.status] || STATUS_CFG.enquiry;
              const paid = Math.round((event.advance/event.total)*100);
              return (
                <div key={event.id} className="bg-card border border-border rounded-lg p-5 hover:border-border cursor-pointer transition-colors" onClick={()=>setSelected(event)}>
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-lg ${tcfg.bg} ${tcfg.color} flex items-center justify-center shrink-0`}><tcfg.icon className="h-6 w-6" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold">{event.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3"/>{event.date}, {event.time}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{event.venue}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3"/>{event.guests} guests</span>
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{event.contact}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Payment</span>
                            <span className="text-muted-foreground">₹{(event.advance/1000).toFixed(0)}K / ₹{(event.total/1000).toFixed(0)}K ({paid}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${paid>=100?"bg-success":paid>=50?"bg-primary":"bg-danger"}`} style={{width:`${paid}%`}}/>
                          </div>
                        </div>
                        <div className="flex gap-1 text-xs">
                          {event.catering&&<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary"><UtensilsCrossed className="h-3 w-3" />Catering</span>}
                          {event.decor&&<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground"><PartyPopper className="h-3 w-3" />Decor</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab==="venues"&&(
        <div className="grid lg:grid-cols-2 gap-4">
          {venues.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
              No event venues configured. Add banquet or conference areas under Table & Area Management.
            </div>
          )}
          {venues.map(v=>(
            <div key={v.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{v.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span><Users className="h-3 w-3 inline mr-1"/>Cap: {v.capacity}</span>
                    <span>·</span>
                    <span>{v.area}</span>
                    <span>·</span>
                    <span className="text-primary font-semibold">₹{(v.rate/1000).toFixed(0)}K {v.rateUnit}</span>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${v.status==="available"?"bg-success-subtle text-success":v.status==="booked"?"bg-warning-subtle text-warning":"bg-danger-subtle text-danger"}`}>{v.status}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {v.features.map(f=>(
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">{f}</span>
                ))}
              </div>
              {v.status==="available"&&(
                <button onClick={()=>bookVenue(v)} className="mt-3 w-full py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">Book This Venue</button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab==="checklist"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-1">Event Execution Checklist</h3>
            <p className="text-xs text-muted-foreground mb-4">Standard checklist for all events</p>
            <div className="space-y-2">
              {checklistItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Add event SOP items or opening checklist tasks to build your execution checklist.</p>
              )}
              {checklistItems.map(item=>{
                const checked = checkedItems.has(item);
                return (
                  <button key={item} onClick={()=>toggleCheck(item)} className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${checked?"border-success-border bg-success-subtle":"border-border bg-card hover:border-border"}`}>
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${checked?"bg-success border-success-border":"border-border"}`}>
                      {checked&&<CheckCircle className="h-3 w-3 text-foreground"/>}
                    </div>
                    <span className={`text-sm ${checked?"text-muted-foreground line-through":"text-foreground"}`}>{item}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 text-xs text-muted-foreground text-center">
              {checkedItems.size}/{checklistItems.length} completed
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold mb-4">Upcoming Events Summary</h3>
              <div className="space-y-3">
                {events.filter(e=>e.status==="confirmed").slice(0,4).map(e=>(
                  <div key={e.id} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">{(() => { const TypeIcon = TYPE_CFG[e.type]?.icon || PartyPopper; return <TypeIcon className="h-5 w-5" />; })()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.date} · {e.guests} guests</p>
                    </div>
                    <p className="text-sm font-semibold text-primary">₹{(e.total/1000).toFixed(0)}K</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold mb-4">Event Types Distribution</h3>
              <div className="space-y-2">
                {Object.entries(TYPE_CFG).map(([type,cfg])=>{
                  const count = events.filter(e=>e.type===type).length;
                  if (!count) return null;
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`inline-flex items-center gap-1 font-medium ${cfg.color}`}><cfg.icon className="h-3.5 w-3.5" />{cfg.label}</span>
                        <span className="text-muted-foreground">{count} event{count!==1?"s":""}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{width:`${events.length ? (count/events.length)*100 : 0}%`}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail */}
      {selected&&(
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-end" onClick={()=>setSelected(null)}>
          <div className="w-full max-w-lg h-full bg-card border-l border-border overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  {(() => { const TypeIcon = TYPE_CFG[selected.type]?.icon || PartyPopper; return <TypeIcon className="h-5 w-5 text-muted-foreground" />; })()}
                  <h3 className="font-semibold">{selected.name}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${(STATUS_CFG[selected.status] || STATUS_CFG.enquiry).bg} ${(STATUS_CFG[selected.status] || STATUS_CFG.enquiry).color}`}>{(STATUS_CFG[selected.status] || STATUS_CFG.enquiry).label}</span>
              </div>
              <button onClick={()=>setSelected(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {label:"Date",value:`${selected.date}, ${selected.time}`},
                  {label:"Venue",value:selected.venue},
                  {label:"Guests",value:`${selected.guests} persons`},
                  {label:"Contact",value:selected.contact},
                  {label:"Phone",value:selected.phone},
                  {label:"Type",value:TYPE_CFG[selected.type]?.label||selected.type},
                ].map(r=>(
                  <div key={r.label} className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{r.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{r.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-muted rounded-lg p-4">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-muted-foreground">Payment Progress</span>
                  <span className="font-semibold text-primary">₹{(selected.advance/1000).toFixed(0)}K / ₹{(selected.total/1000).toFixed(0)}K</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden mb-1">
                  <div className="h-full rounded-full bg-primary" style={{width:`${Math.round((selected.advance/selected.total)*100)}%`}}/>
                </div>
                <p className="text-xs text-muted-foreground text-right">{Math.round((selected.advance/selected.total)*100)}% paid</p>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">Menu</p>
                <p className="text-sm">{selected.menu||"TBD"}</p>
              </div>

              {selected.notes&&(
                <div className="bg-warning-subtle border border-warning-border rounded-lg p-4">
                  <p className="text-xs text-warning mb-1">Special Instructions</p>
                  <p className="text-sm text-warning">{selected.notes}</p>
                </div>
              )}

              {selected.staffAssigned.length>0&&(
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-2">Assigned Staff</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.staffAssigned.map(s=><span key={s} className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full">{s}</span>)}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={()=>openEditEvent(selected)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold hover:bg-muted">Edit Event</button>
                {selected.status==="tentative"&&<button onClick={()=>updateEventStatus(selected,"confirmed")} className="flex-1 py-2.5 rounded-lg bg-success-subtle text-success font-semibold text-sm hover-elevate">Confirm</button>}
                {selected.status==="confirmed"&&<button onClick={()=>updateEventStatus(selected,"completed")} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm">Mark Complete</button>}
                {selected.status==="enquiry"&&<button onClick={()=>updateEventStatus(selected,"tentative")} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm">Convert to Booking</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAdd&&(
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">New Event / Booking</h2>
              <button onClick={()=>setShowAdd(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {label:"Event Name",key:"name",placeholder:"Wedding, Party...",col:"2"},
                {label:"Event Type",key:"type",type:"select",options:Object.keys(TYPE_CFG),col:"1"},
                {label:"Date",key:"date",type:"date",col:"1"},
                {label:"Time",key:"time",type:"time",col:"1"},
                {label:"Number of Guests",key:"guests",type:"number",placeholder:"100",col:"1"},
                {label:"Venue",key:"venue",type:"select",options:venues.length ? venues.map(v=>v.name) : ["Main Hall","Garden","Rooftop"],col:"2"},
                {label:"Contact Name",key:"contact",placeholder:"Client name",col:"1"},
                {label:"Contact Phone",key:"phone",placeholder:"+91 XXXXX",col:"1"},
                {label:"Total Budget (₹)",key:"total",type:"number",placeholder:"50000",col:"1"},
                {label:"Advance (₹)",key:"advance",type:"number",placeholder:"10000",col:"1"},
                {label:"Special Notes",key:"notes",placeholder:"Dietary, decor requirements...",col:"2"},
              ].map(f=>(
                <div key={f.key} className={f.col==="2"?"col-span-2":""}>
                  <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  {f.type==="select" ? (
                    <select value={(newEvent as any)[f.key]} onChange={e=>setNewEvent(p=>({...p,[f.key]:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground capitalize">
                      {f.options?.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type||"text"} value={(newEvent as any)[f.key]} onChange={e=>setNewEvent(p=>({...p,[f.key]:e.target.value}))} placeholder={(f as any).placeholder||""} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
              <button onClick={handleCreateEvent} disabled={!newEvent.name} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm disabled:opacity-40">Save Booking</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editEvent&&(
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">Edit Event</h2>
              <button onClick={()=>setEditEvent(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {label:"Event Name",key:"name",placeholder:"Wedding, Party...",col:"2"},
                {label:"Event Type",key:"type",type:"select",options:Object.keys(TYPE_CFG),col:"1"},
                {label:"Status",key:"status",type:"select",options:Object.keys(STATUS_CFG),col:"1"},
                {label:"Date",key:"date",type:"date",col:"1"},
                {label:"Time",key:"time",type:"time",col:"1"},
                {label:"Number of Guests",key:"guests",type:"number",placeholder:"100",col:"1"},
                {label:"Venue",key:"venue",type:"select",options:venues.length ? venues.map(v=>v.name) : ["Main Hall","Garden","Rooftop"],col:"1"},
                {label:"Contact Name",key:"contact",placeholder:"Client name",col:"1"},
                {label:"Contact Phone",key:"phone",placeholder:"+91 XXXXX",col:"1"},
                {label:"Total Budget (₹)",key:"total",type:"number",placeholder:"50000",col:"1"},
                {label:"Advance (₹)",key:"advance",type:"number",placeholder:"10000",col:"1"},
                {label:"Menu",key:"menu",placeholder:"Menu / package",col:"2"},
                {label:"Special Notes",key:"notes",placeholder:"Dietary, decor requirements...",col:"2"},
              ].map(f=>(
                <div key={f.key} className={f.col==="2"?"col-span-2":""}>
                  <label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  {f.type==="select" ? (
                    <select value={(editForm as any)[f.key]} onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground capitalize">
                      {f.options?.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type||"text"} value={(editForm as any)[f.key]} onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))} placeholder={(f as any).placeholder||""} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setEditEvent(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
              <button onClick={handleSaveEditEvent} disabled={savingEdit || !editForm.name} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm disabled:opacity-40">{savingEdit?"Saving…":"Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
