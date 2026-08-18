import { useState, useEffect, useCallback } from "react";
import { Calendar, Users, MapPin, Plus, X, CheckCircle, Phone } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { events as eventsApi, tables as tablesApi, tasksSop } from "@/lib/api";

type EventItem = {
  id: string; name: string; type: string; date: string; time: string; guests: number;
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

const TYPE_CFG: Record<string,{label:string;icon:string;color:string;bg:string}> = {
  wedding:     {label:"Wedding",    icon:"💒",color:"text-pink-400",   bg:"bg-pink-500/15"},
  corporate:   {label:"Corporate",  icon:"💼",color:"text-blue-400",   bg:"bg-blue-500/15"},
  birthday:    {label:"Birthday",   icon:"🎂",color:"text-amber-400",  bg:"bg-amber-500/15"},
  anniversary: {label:"Anniversary",icon:"💑",color:"text-rose-400",   bg:"bg-rose-500/15"},
  social:      {label:"Social",     icon:"🎉",color:"text-violet-400", bg:"bg-violet-500/15"},
  enquiry_gen: {label:"General",    icon:"📋",color:"text-white/50",   bg:"bg-white/10"},
};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  confirmed: {label:"Confirmed",color:"text-emerald-400",bg:"bg-emerald-500/15"},
  tentative: {label:"Tentative",color:"text-yellow-400",bg:"bg-yellow-500/15"},
  enquiry:   {label:"Enquiry",  color:"text-blue-400",   bg:"bg-blue-500/15"},
  cancelled: {label:"Cancelled",color:"text-red-400",   bg:"bg-red-500/15"},
  completed: {label:"Completed",color:"text-teal-400",  bg:"bg-teal-500/15"},
};

type Tab = "events"|"venues"|"checklist";

export default function EventBanquet() {
  const { restaurantId } = useRestaurant();
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

  const loadEvents = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await eventsApi.list(restaurantId);
      setEvents((Array.isArray(data) ? data : []).map(mapEvent));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [restaurantId]);

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
    } catch (e) { console.error(e); }
  }

  async function updateEventStatus(event: EventItem, status: string) {
    if (!restaurantId) return;
    try {
      const updated = await eventsApi.update(restaurantId, Number(event.id), { status });
      const mapped = mapEvent(updated);
      setEvents(e => e.map(x => x.id === event.id ? mapped : x));
      setSelected(mapped);
    } catch (e) { console.error(e); }
  }

  function toggleCheck(item:string) {
    setCheckedItems(prev=>{ const n=new Set(prev); n.has(item)?n.delete(item):n.add(item); return n; });
  }

  if (loading && events.length === 0) {
    return <div className="p-6 text-center text-white/40 text-sm">Loading events…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Events & Banquet</h1>
          <p className="text-xs text-white/40">{upcomingCount} upcoming events · ₹{(totalRevenue/100000).toFixed(1)}L confirmed revenue</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="h-4 w-4"/>New Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Upcoming Events",value:upcomingCount,color:"text-amber-400",bg:"bg-amber-500/10"},
          {label:"Confirmed Revenue",value:`₹${(totalRevenue/100000).toFixed(1)}L`,color:"text-emerald-400",bg:"bg-emerald-500/10"},
          {label:"Advance Collected",value:`₹${(totalAdvance/1000).toFixed(0)}K`,color:"text-blue-400",bg:"bg-blue-500/10"},
          {label:"Enquiries",value:events.filter(e=>e.status==="enquiry").length,color:"text-violet-400",bg:"bg-violet-500/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["events","Events"],["venues","Venues"],["checklist","Event Checklist"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab==="events"&&(
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1">
              {["all","wedding","corporate","birthday","anniversary"].map(t=>(
                <button key={t} onClick={()=>setTypeFilter(t)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${typeFilter===t?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>
                  {t==="all"?"All Types":t}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {["all","confirmed","tentative","enquiry"].map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${statusFilter===s?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>{s==="all"?"All Status":s}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {filtered.map(event=>{
              const tcfg = TYPE_CFG[event.type]||TYPE_CFG.enquiry_gen;
              const scfg = STATUS_CFG[event.status] || STATUS_CFG.enquiry;
              const paid = Math.round((event.advance/event.total)*100);
              return (
                <div key={event.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5 hover:border-white/10 cursor-pointer transition-all" onClick={()=>setSelected(event)}>
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-2xl ${tcfg.bg} flex items-center justify-center text-2xl shrink-0`}>{tcfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-extrabold">{event.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/40 mb-3 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3"/>{event.date}, {event.time}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{event.venue}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3"/>{event.guests} guests</span>
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{event.contact}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-white/40">Payment</span>
                            <span className="text-white/60">₹{(event.advance/1000).toFixed(0)}K / ₹{(event.total/1000).toFixed(0)}K ({paid}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className={`h-full rounded-full ${paid>=100?"bg-emerald-500":paid>=50?"bg-amber-500":"bg-red-500"}`} style={{width:`${paid}%`}}/>
                          </div>
                        </div>
                        <div className="flex gap-1 text-xs">
                          {event.catering&&<span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">🍽️ Catering</span>}
                          {event.decor&&<span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400">🎊 Decor</span>}
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
            <div className="col-span-full text-center py-12 text-white/40 text-sm">
              No event venues configured. Add banquet or conference areas under Table & Area Management.
            </div>
          )}
          {venues.map(v=>(
            <div key={v.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold">{v.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                    <span><Users className="h-3 w-3 inline mr-1"/>Cap: {v.capacity}</span>
                    <span>·</span>
                    <span>{v.area}</span>
                    <span>·</span>
                    <span className="text-amber-400 font-semibold">₹{(v.rate/1000).toFixed(0)}K {v.rateUnit}</span>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${v.status==="available"?"bg-emerald-500/20 text-emerald-400":v.status==="booked"?"bg-orange-500/20 text-orange-400":"bg-red-500/20 text-red-400"}`}>{v.status}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {v.features.map(f=>(
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">{f}</span>
                ))}
              </div>
              {v.status==="available"&&(
                <button className="mt-3 w-full py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition-all">Book This Venue</button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab==="checklist"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-1">Event Execution Checklist</h3>
            <p className="text-xs text-white/40 mb-4">Standard checklist for all events</p>
            <div className="space-y-2">
              {checklistItems.length === 0 && (
                <p className="text-sm text-white/40 text-center py-6">Add event SOP items or opening checklist tasks to build your execution checklist.</p>
              )}
              {checklistItems.map(item=>{
                const checked = checkedItems.has(item);
                return (
                  <button key={item} onClick={()=>toggleCheck(item)} className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${checked?"border-emerald-500/30 bg-emerald-500/8":"border-white/8 bg-white/[0.03] hover:border-white/15"}`}>
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${checked?"bg-emerald-500 border-emerald-500":"border-white/20"}`}>
                      {checked&&<CheckCircle className="h-3 w-3 text-white"/>}
                    </div>
                    <span className={`text-sm ${checked?"text-white/40 line-through":"text-white/80"}`}>{item}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 text-xs text-white/40 text-center">
              {checkedItems.size}/{checklistItems.length} completed
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
              <h3 className="font-bold mb-4">Upcoming Events Summary</h3>
              <div className="space-y-3">
                {events.filter(e=>e.status==="confirmed").slice(0,4).map(e=>(
                  <div key={e.id} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center text-lg shrink-0">{TYPE_CFG[e.type]?.icon||"🎉"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{e.name}</p>
                      <p className="text-xs text-white/40">{e.date} · {e.guests} guests</p>
                    </div>
                    <p className="text-sm font-bold text-amber-400">₹{(e.total/1000).toFixed(0)}K</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
              <h3 className="font-bold mb-4">Event Types Distribution</h3>
              <div className="space-y-2">
                {Object.entries(TYPE_CFG).map(([type,cfg])=>{
                  const count = events.filter(e=>e.type===type).length;
                  if (!count) return null;
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`font-medium ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                        <span className="text-white/40">{count} event{count!==1?"s":""}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{width:`${events.length ? (count/events.length)*100 : 0}%`}}/>
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-end" onClick={()=>setSelected(null)}>
          <div className="w-full max-w-lg h-full bg-[#0e1520] border-l border-white/10 overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{TYPE_CFG[selected.type]?.icon}</span>
                  <h3 className="font-extrabold">{selected.name}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${(STATUS_CFG[selected.status] || STATUS_CFG.enquiry).bg} ${(STATUS_CFG[selected.status] || STATUS_CFG.enquiry).color}`}>{(STATUS_CFG[selected.status] || STATUS_CFG.enquiry).label}</span>
              </div>
              <button onClick={()=>setSelected(null)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
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
                  <div key={r.label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-white/40">{r.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{r.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-white/50">Payment Progress</span>
                  <span className="font-bold text-amber-400">₹{(selected.advance/1000).toFixed(0)}K / ₹{(selected.total/1000).toFixed(0)}K</span>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden mb-1">
                  <div className="h-full rounded-full bg-amber-500" style={{width:`${Math.round((selected.advance/selected.total)*100)}%`}}/>
                </div>
                <p className="text-xs text-white/30 text-right">{Math.round((selected.advance/selected.total)*100)}% paid</p>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs text-white/40 mb-2">Menu</p>
                <p className="text-sm">{selected.menu||"TBD"}</p>
              </div>

              {selected.notes&&(
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <p className="text-xs text-yellow-300/60 mb-1">Special Instructions</p>
                  <p className="text-sm text-yellow-200">{selected.notes}</p>
                </div>
              )}

              {selected.staffAssigned.length>0&&(
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-xs text-white/40 mb-2">Assigned Staff</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.staffAssigned.map(s=><span key={s} className="text-xs bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-full">{s}</span>)}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5">Edit Event</button>
                {selected.status==="tentative"&&<button onClick={()=>updateEventStatus(selected,"confirmed")} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-sm hover:bg-emerald-500/30">Confirm</button>}
                {selected.status==="confirmed"&&<button onClick={()=>updateEventStatus(selected,"completed")} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">Mark Complete</button>}
                {selected.status==="enquiry"&&<button onClick={()=>updateEventStatus(selected,"tentative")} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">Convert to Booking</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAdd&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">New Event / Booking</h2>
              <button onClick={()=>setShowAdd(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
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
                  <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  {f.type==="select" ? (
                    <select value={(newEvent as any)[f.key]} onChange={e=>setNewEvent(p=>({...p,[f.key]:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white capitalize">
                      {f.options?.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type||"text"} value={(newEvent as any)[f.key]} onChange={e=>setNewEvent(p=>({...p,[f.key]:e.target.value}))} placeholder={(f as any).placeholder||""} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
              <button onClick={handleCreateEvent} disabled={!newEvent.name} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">Save Booking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
