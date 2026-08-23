import { useState, useEffect } from "react";
import { Clock, Plus, Check, X, Bell, Users, Timer, Phone, Search, BarChart3, Settings, MessageSquare, ChevronDown, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { queue as queueApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const PREFS = ["No preference","Window seat","Non-AC","Outdoor","VIP area","Rooftop","Booth","Corner table","High chair needed","Wheelchair accessible","Conference","Near kitchen"];

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  waiting:  {label:"Waiting",   color:"text-yellow-400", bg:"bg-yellow-500/15"},
  called:   {label:"Notified",  color:"text-blue-400",   bg:"bg-blue-500/15"},
  notified: {label:"Notified",  color:"text-blue-400",   bg:"bg-blue-500/15"},
  seated:   {label:"Seated",    color:"text-emerald-400",bg:"bg-emerald-500/15"},
  cancelled:{label:"Left",      color:"text-red-400",    bg:"bg-red-500/15"},
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Queue & Waitlist</h1>
          <p className="text-xs text-white/40">Real-time customer queue management</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="h-4 w-4"/>Add to Queue
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Waiting",value:waiting.length,icon:Users,color:"text-yellow-400",bg:"bg-yellow-500/10"},
          {label:"Notified",value:notified.length,icon:Bell,color:"text-blue-400",bg:"bg-blue-500/10"},
          {label:"Seated Today",value:seated.length,icon:Check,color:"text-emerald-400",bg:"bg-emerald-500/10"},
          {label:"Avg Wait (min)",value:avgWait||"—",icon:Timer,color:"text-amber-400",bg:"bg-amber-500/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5"/></div>
            <div><p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p><p className="text-xs text-white/40">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["queue","Queue"],["history","History"],["settings","Settings"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab==="queue"&&(
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"/>
            <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" placeholder="Search name, token, phone..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Token Display Board */}
            <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>
                <h2 className="text-sm font-bold text-white/70">Live Queue Board</h2>
              </div>
              <div className="space-y-2">
                {filtered.slice(0,6).map((q,i)=>(
                  <div key={q.id} className={`flex items-center gap-3 p-3 rounded-xl ${i===0?"bg-amber-500/20 border border-amber-500/30":"bg-white/3 border border-white/5"}`}>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${i===0?"bg-amber-500 text-black":"bg-white/10 text-white"}`}>{q.token}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{q.name}</p>
                      <p className="text-xs text-white/40">{q.guests} guests · ~{q.estimatedWait}m</p>
                    </div>
                    {q.status==="notified"&&<Bell className="h-4 w-4 text-blue-400 shrink-0"/>}
                    {i===0&&<span className="text-xs bg-amber-500 text-black font-bold px-2 py-0.5 rounded-full">NOW</span>}
                  </div>
                ))}
                {filtered.length===0&&<p className="text-center text-sm text-white/30 py-6">Queue is empty</p>}
              </div>
            </div>

            {/* Queue List */}
            <div className="lg:col-span-2 space-y-3">
              {filtered.map(item=>{
                const cfg = STATUS_CFG[item.status];
                return (
                  <div key={item.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-extrabold text-amber-400 text-sm shrink-0">{item.token}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold">{item.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-white/40 flex-wrap">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3"/>{item.guests} guests</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>Since {item.waitSince}</span>
                          <span className="flex items-center gap-1"><Timer className="h-3 w-3"/>~{item.estimatedWait}m</span>
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{item.mobile}</span>
                        </div>
                        {item.preference&&item.preference!=="No preference"&&<p className="text-xs text-amber-400/70 mt-1">📍 {item.preference}</p>}
                        {item.note&&<p className="text-xs text-white/50 mt-0.5">📝 {item.note}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.status==="waiting"&&(
                          <button onClick={()=>notify(item.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30 transition-all">
                            <Bell className="h-3 w-3"/>{smsNotify?"SMS +":""}Notify
                          </button>
                        )}
                        {(item.status==="waiting"||item.status==="notified")&&(
                          <button onClick={()=>updateStatus(item.id,"seated")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-all">
                            <Check className="h-3 w-3"/>Seat
                          </button>
                        )}
                        {item.status!=="seated"&&item.status!=="cancelled"&&(
                          <button onClick={()=>updateStatus(item.id,"cancelled")} className="h-7 w-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all"><X className="h-3 w-3"/></button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length===0&&(
                <div className="text-center py-16 text-white/30">
                  <Users className="h-12 w-12 mx-auto mb-3"/>
                  <p className="font-semibold">No customers in queue</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab==="history"&&(
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <div className="bg-white/[0.02] px-4 py-3 border-b border-white/5 grid grid-cols-3 gap-4">
            {[
              {label:"Seated Today",value:seated.length,color:"text-emerald-400"},
              {label:"Avg Wait Today",value:avgWait?`${avgWait}m`:"—",color:"text-amber-400"},
              {label:"No-shows",value:queue.filter(q=>q.status==="cancelled").length,color:"text-red-400"},
            ].map(s=>(
              <div key={s.label} className="text-center">
                <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-white/40">{s.label}</p>
              </div>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/30 border-b border-white/5 bg-white/[0.02]">
                {["Token","Name","Guests","Wait Time","Seated At","Table"].map(h=><th key={h} className="px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {history.map(h=>(
                <tr key={h.id} className="hover:bg-white/3">
                  <td className="px-4 py-3 font-bold text-amber-400">{h.token}</td>
                  <td className="px-4 py-3 font-semibold">{h.name}</td>
                  <td className="px-4 py-3 text-white/60">{h.guests}</td>
                  <td className="px-4 py-3 text-white/60">{h.estimatedWait}m</td>
                  <td className="px-4 py-3 text-white/60">{h.waitSince}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">{h.status}</span></td>
                </tr>
              ))}
              {history.length===0&&<tr><td colSpan={6} className="px-4 py-8 text-center text-white/30">No seated guests yet today</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab==="settings"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Wait Time Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-2 block">Avg time per table turnover (minutes)</label>
                <div className="flex items-center gap-3">
                  <button onClick={()=>setAvgWaitBuffer(Math.max(3,avgWaitBuffer-1))} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">−</button>
                  <span className="flex-1 text-center text-lg font-bold text-amber-400">{avgWaitBuffer}m</span>
                  <button onClick={()=>setAvgWaitBuffer(avgWaitBuffer+1)} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">+</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block">Max queue capacity</label>
                <div className="flex items-center gap-3">
                  <button onClick={()=>setMaxQueue(Math.max(5,maxQueue-5))} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">−</button>
                  <span className="flex-1 text-center text-lg font-bold text-amber-400">{maxQueue}</span>
                  <button onClick={()=>setMaxQueue(maxQueue+5)} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">+</button>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Notification Settings</h3>
            <div className="space-y-3">
              {[
                {label:"SMS notifications",val:smsNotify,set:setSmsNotify,desc:"Send SMS when table is ready"},
                {label:"Auto-notify when table freed",val:autoSms,set:setAutoSms,desc:"Automatically notify next in queue"},
              ].map(({label,val,set,desc})=>(
                <div key={label} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/8">
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-white/40 mt-0.5">{desc}</p>
                  </div>
                  <button onClick={()=>set(!val)} className={`h-6 w-11 rounded-full transition-all relative shrink-0 ${val?"bg-amber-500":"bg-white/10"}`}>
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${val?"left-[22px]":"left-0.5"}`}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">Add to Waitlist</h2>
              <button onClick={()=>setShowAdd(false)} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/15"><X className="h-4 w-4"/></button>
            </div>
            <div className="space-y-4">
              {[
                {label:"Customer Name *",key:"name",type:"text",placeholder:"Full name"},
                {label:"Mobile Number *",key:"mobile",type:"tel",placeholder:"+91 XXXXX XXXXX"},
                {label:"Number of Guests",key:"guests",type:"number",placeholder:"2"},
              ].map(f=>(
                <div key={f.key}>
                  <label className="text-xs text-white/50 font-semibold uppercase tracking-wide mb-1.5 block">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"/>
                </div>
              ))}
              <div>
                <label className="text-xs text-white/50 font-semibold uppercase tracking-wide mb-1.5 block">Seating Preference</label>
                <div className="relative">
                  <select value={form.preference} onChange={e=>setForm(p=>({...p,preference:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 appearance-none">
                    {PREFS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none"/>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 font-semibold uppercase tracking-wide mb-1.5 block">Special Note</label>
                <input type="text" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} placeholder="Birthday, anniversary, allergies..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"/>
              </div>
              {smsNotify&&form.mobile&&<p className="text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">📱 SMS confirmation will be sent to {form.mobile}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-semibold hover:bg-white/10 transition-all">Cancel</button>
                <button onClick={addToQueue} disabled={!form.name||!form.mobile} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-all disabled:opacity-40">Add to Queue</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
