import { useState, useEffect } from "react";
import { Clock, Plus, Check, X, Bell, Users, Timer, Phone, Search, BarChart3, Settings, MessageSquare, ChevronDown, Loader, MapPin, StickyNote, Smartphone } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { queue as queueApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const PREFS = ["No preference","Window seat","Non-AC","Outdoor","VIP area","Rooftop","Booth","Corner table","High chair needed","Wheelchair accessible","Conference","Near kitchen"];

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  waiting:  {label:"Waiting",   color:"text-warning", bg:"bg-warning-subtle"},
  called:   {label:"Notified",  color:"text-info",   bg:"bg-info-subtle"},
  notified: {label:"Notified",  color:"text-info",   bg:"bg-info-subtle"},
  seated:   {label:"Seated",    color:"text-success",bg:"bg-success-subtle"},
  cancelled:{label:"Left",      color:"text-danger",    bg:"bg-danger-subtle"},
};

function mapQueueEntry(e: any) {
  const token = `#${String(e.tokenNumber ?? 0).padStart(2, "0")}`;
  return {
    id: String(e.id),
    name: e.guestName || "Guest",
    guests: e.partySize ?? 2,
    mobile: e.guestPhone || "",
    waitSince: e.createdAt ? new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
    estimatedWait: e.estimatedWait ?? 15,
    status: e.status === "called" ? "notified" : (e.status || "waiting"),
    token,
    preference: e.tablePreference || "No preference",
    note: e.specialRequests || "",
    rawStatus: e.status,
  };
}

type Tab = "queue"|"history"|"settings";

export default function QueueWaitlist() {
  const { restaurantId } = useRestaurant();
  const [queue, setQueue] = useState<ReturnType<typeof mapQueueEntry>[]>([]);
  const [history, setHistory] = useState<ReturnType<typeof mapQueueEntry>[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("queue");
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name:"", guests:"2", mobile:"", preference:"No preference", note:"" });
  const [smsNotify, setSmsNotify] = useState(true);
  const [avgWaitBuffer, setAvgWaitBuffer] = useState(8);
  const [maxQueue, setMaxQueue] = useState(20);
  const [autoSms, setAutoSms] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    queueApi.list(restaurantId).then((rows: any[]) => {
      const mapped = Array.isArray(rows) ? rows.map(mapQueueEntry) : [];
      setQueue(mapped.filter(q => q.status !== "seated" && q.status !== "cancelled"));
      setHistory(mapped.filter(q => q.status === "seated" || q.status === "cancelled"));
    }).catch(() => { setQueue([]); setHistory([]); }).finally(() => setLoading(false));
  }, [restaurantId]);

  async function reload() {
    if (!restaurantId) return;
    const rows = await queueApi.list(restaurantId);
    const mapped = Array.isArray(rows) ? rows.map(mapQueueEntry) : [];
    setQueue(mapped.filter(q => q.status !== "seated" && q.status !== "cancelled"));
    setHistory(mapped.filter(q => q.status === "seated" || q.status === "cancelled"));
  }

  const waiting = queue.filter(q=>q.status==="waiting");
  const notified = queue.filter(q=>q.status==="notified");
  // Seated guests live in `history` (active `queue` excludes seated/cancelled), so
  // derive the real "seated today" count from there.
  const seated = history.filter(q=>q.status==="seated");
  const avgWait = waiting.length ? Math.round(waiting.reduce((s,q)=>s+q.estimatedWait,0)/waiting.length) : 0;

  const filtered = queue.filter(q => {
    const sf = q.status!=="seated"&&q.status!=="cancelled";
    const searchMatch = !search || q.name.toLowerCase().includes(search.toLowerCase()) || q.mobile.includes(search) || q.token.toLowerCase().includes(search.toLowerCase());
    return sf && searchMatch;
  });

  async function updateStatus(id: string, status: string) {
    if (!restaurantId) return;
    const apiStatus = status === "notified" ? "called" : status;
    try {
      await queueApi.update(restaurantId, parseInt(id, 10), { status: apiStatus });
      await reload();
      toast({ title: status === "seated" ? "Guest seated" : status === "notified" ? "Guest notified" : status === "cancelled" ? "Removed from queue" : "Queue updated" });
    } catch (e: any) {
      toast({ title: "Failed to update queue", description: e?.message, variant: "destructive" });
    }
  }

  async function addToQueue() {
    if (!restaurantId || !form.name) return;
    // Enforce the configured max queue capacity.
    if (queue.length >= maxQueue) {
      toast({ title: "Queue is full", description: `Maximum capacity of ${maxQueue} reached. Seat or remove a guest first.`, variant: "destructive" });
      return;
    }
    const guestName = form.name;
    try {
      await queueApi.add(restaurantId, {
        guestName: form.name,
        guestPhone: form.mobile,
        partySize: parseInt(form.guests) || 2,
        tablePreference: form.preference,
        specialRequests: form.note,
        estimatedWait: waiting.length * avgWaitBuffer + avgWaitBuffer,
      });
      setForm({ name:"", guests:"2", mobile:"", preference:"No preference", note:"" });
      setShowAdd(false);
      await reload();
      toast({ title: "Added to queue", description: guestName });
    } catch (e: any) {
      toast({ title: "Failed to add to queue", description: e?.message, variant: "destructive" });
    }
  }

  async function notify(id: string) {
    await updateStatus(id, "notified");
  }

  async function cancelEntry(id: string) {
    if (!restaurantId) return;
    try {
      await queueApi.update(restaurantId, parseInt(id, 10), { status: "cancelled" });
      await reload();
      toast({ title: "Removed from queue" });
    } catch (e: any) {
      toast({ title: "Failed to update queue", description: e?.message, variant: "destructive" });
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Queue & Waitlist</h1>
          <p className="text-xs text-muted-foreground">Real-time customer queue management</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2.5 rounded-lg text-sm shadow-sm transition-colors">
          <Plus className="h-4 w-4"/>Add to Queue
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Waiting",value:waiting.length,icon:Users,color:"text-warning",bg:"bg-warning-subtle"},
          {label:"Notified",value:notified.length,icon:Bell,color:"text-info",bg:"bg-info-subtle"},
          {label:"Seated Today",value:seated.length,icon:Check,color:"text-success",bg:"bg-success-subtle"},
          {label:"Avg Wait (min)",value:avgWait||"—",icon:Timer,color:"text-primary",bg:"bg-primary/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5"/></div>
            <div><p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {([["queue","Queue"],["history","History"],["settings","Settings"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab==="queue"&&(
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <input className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground" placeholder="Search name, token, phone..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Token Display Board */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse"/>
                <h2 className="text-sm font-semibold text-foreground">Live Queue Board</h2>
              </div>
              <div className="space-y-2">
                {filtered.slice(0,6).map((q,i)=>(
                  <div key={q.id} className={`flex items-center gap-3 p-3 rounded-lg ${i===0?"bg-primary/20 border border-primary/30":"bg-muted border border-border"}`}>
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-semibold text-sm shrink-0 ${i===0?"bg-primary text-primary-foreground":"bg-muted text-foreground"}`}>{q.token}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{q.name}</p>
                      <p className="text-xs text-muted-foreground">{q.guests} guests · ~{q.estimatedWait}m</p>
                    </div>
                    {q.status==="notified"&&<Bell className="h-4 w-4 text-info shrink-0"/>}
                    {i===0&&<span className="text-xs bg-primary text-primary-foreground font-semibold px-2 py-0.5 rounded-full">NOW</span>}
                  </div>
                ))}
                {filtered.length===0&&<p className="text-center text-sm text-muted-foreground py-6">Queue is empty</p>}
              </div>
            </div>

            {/* Queue List */}
            <div className="lg:col-span-2 space-y-3">
              {filtered.map(item=>{
                const cfg = STATUS_CFG[item.status];
                return (
                  <div key={item.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center font-semibold text-primary text-sm shrink-0">{item.token}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{item.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3"/>{item.guests} guests</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>Since {item.waitSince}</span>
                          <span className="flex items-center gap-1"><Timer className="h-3 w-3"/>~{item.estimatedWait}m</span>
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{item.mobile}</span>
                        </div>
                        {item.preference&&item.preference!=="No preference"&&<p className="text-xs text-primary mt-1"><MapPin className="h-3 w-3 inline mb-0.5" /> {item.preference}</p>}
                        {item.note&&<p className="text-xs text-muted-foreground mt-0.5"><StickyNote className="h-3 w-3 inline mb-0.5" /> {item.note}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.status==="waiting"&&(
                          <button onClick={()=>notify(item.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-info-subtle text-info text-xs font-semibold hover-elevate transition-colors">
                            <Bell className="h-3 w-3"/>{smsNotify?"SMS +":""}Notify
                          </button>
                        )}
                        {(item.status==="waiting"||item.status==="notified")&&(
                          <button onClick={()=>updateStatus(item.id,"seated")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate transition-colors">
                            <Check className="h-3 w-3"/>Seat
                          </button>
                        )}
                        {item.status!=="seated"&&item.status!=="cancelled"&&(
                          <button onClick={()=>updateStatus(item.id,"cancelled")} className="h-7 w-7 rounded-lg bg-danger-subtle text-danger flex items-center justify-center hover-elevate transition-colors"><X className="h-3 w-3"/></button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length===0&&(
                <div className="text-center py-16 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3"/>
                  <p className="font-semibold">No customers in queue</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab==="history"&&(
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-card px-4 py-3 border-b border-border grid grid-cols-3 gap-4">
            {[
              {label:"Seated Today",value:seated.length,color:"text-success"},
              {label:"Avg Wait Today",value:avgWait?`${avgWait}m`:"—",color:"text-primary"},
              {label:"No-shows",value:queue.filter(q=>q.status==="cancelled").length,color:"text-danger"},
            ].map(s=>(
              <div key={s.label} className="text-center">
                <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border bg-card">
                  {["Token","Name","Guests","Wait Time","Seated At","Table"].map(h=><th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map(h=>(
                  <tr key={h.id} className="hover:bg-muted">
                    <td className="px-4 py-3 font-semibold text-primary">{h.token}</td>
                    <td className="px-4 py-3 font-semibold">{h.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{h.guests}</td>
                    <td className="px-4 py-3 text-muted-foreground">{h.estimatedWait}m</td>
                    <td className="px-4 py-3 text-muted-foreground">{h.waitSince}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-success-subtle text-success px-2 py-0.5 rounded-full">{h.status}</span></td>
                  </tr>
                ))}
                {history.length===0&&<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No seated guests yet today</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="settings"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4">Wait Time Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Avg time per table turnover (minutes)</label>
                <div className="flex items-center gap-3">
                  <button onClick={()=>setAvgWaitBuffer(Math.max(3,avgWaitBuffer-1))} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover-elevate">−</button>
                  <span className="flex-1 text-center text-lg font-semibold text-primary">{avgWaitBuffer}m</span>
                  <button onClick={()=>setAvgWaitBuffer(avgWaitBuffer+1)} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover-elevate">+</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Max queue capacity</label>
                <div className="flex items-center gap-3">
                  <button onClick={()=>setMaxQueue(Math.max(5,maxQueue-5))} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover-elevate">−</button>
                  <span className="flex-1 text-center text-lg font-semibold text-primary">{maxQueue}</span>
                  <button onClick={()=>setMaxQueue(maxQueue+5)} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover-elevate">+</button>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4">Notification Settings</h3>
            <div className="space-y-3">
              {[
                {label:"SMS notifications",val:smsNotify,set:setSmsNotify,desc:"Send SMS when table is ready"},
                {label:"Auto-notify when table freed",val:autoSms,set:setAutoSms,desc:"Automatically notify next in queue"},
              ].map(({label,val,set,desc})=>(
                <div key={label} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <button onClick={()=>set(!val)} className={`h-6 w-11 rounded-full transition-colors relative shrink-0 ${val?"bg-primary":"bg-muted"}`}>
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-colors ${val?"left-[22px]":"left-0.5"}`}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd&&(
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Add to Waitlist</h2>
              <button onClick={()=>setShowAdd(false)} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover-elevate"><X className="h-4 w-4"/></button>
            </div>
            <div className="space-y-4">
              {[
                {label:"Customer Name *",key:"name",type:"text",placeholder:"Full name"},
                {label:"Mobile Number *",key:"mobile",type:"tel",placeholder:"+91 XXXXX XXXXX"},
                {label:"Number of Guests",key:"guests",type:"number",placeholder:"2"},
              ].map(f=>(
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 block">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"/>
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 block">Seating Preference</label>
                <div className="relative">
                  <select value={form.preference} onChange={e=>setForm(p=>({...p,preference:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 appearance-none">
                    {PREFS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"/>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 block">Special Note</label>
                <input type="text" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} placeholder="Birthday, anniversary, allergies..." className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"/>
              </div>
              {smsNotify&&form.mobile&&<p className="text-xs text-success bg-success-subtle rounded-lg px-3 py-2"><Smartphone className="h-3 w-3 inline mb-0.5" /> SMS confirmation will be sent to {form.mobile}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-semibold hover-elevate transition-colors">Cancel</button>
                <button onClick={addToQueue} disabled={!form.name||!form.mobile} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40">Add to Queue</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
