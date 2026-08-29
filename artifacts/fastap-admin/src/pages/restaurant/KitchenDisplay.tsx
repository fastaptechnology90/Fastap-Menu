import { useState, useEffect, useRef } from "react";
import { useRestaurant, type LiveOrder } from "@/contexts/RestaurantContext";
import { splitCustomizations } from "@/lib/orderItemExtras";
import { ChefHat, Volume2, VolumeX, Flame, Clock, AlertTriangle, CheckCircle, Printer, Settings, RotateCcw, Zap, Wine, IceCream, Salad, Beef, X, Play } from "lucide-react";

function Timer({ start, targetMins = 20 }: { start: Date; targetMins?: number }) {
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - new Date(start).getTime()) / 1000));
  useEffect(() => { const t = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(t); }, []);
  const mins = Math.floor(elapsed / 60), secs = elapsed % 60;
  const pct = Math.min(100, (mins / targetMins) * 100);
  const color = pct >= 100 ? "text-red-400 animate-pulse" : pct >= 70 ? "text-yellow-400" : "text-emerald-400";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`font-mono font-extrabold text-sm ${color}`}>{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}</span>
      <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct>=100?"bg-red-500":pct>=70?"bg-yellow-500":"bg-emerald-500"}`} style={{width:`${pct}%`}} />
      </div>
    </div>
  );
}

const STATIONS = [
  { id:"all", label:"All Stations", icon:ChefHat, color:"text-white" },
  { id:"hot", label:"Hot Line", icon:Flame, color:"text-red-400" },
  { id:"grill", label:"Grill", icon:Beef, color:"text-orange-400" },
  { id:"cold", label:"Cold", icon:Salad, color:"text-cyan-400" },
  { id:"bar", label:"Bar", icon:Wine, color:"text-violet-400" },
  { id:"desserts", label:"Desserts", icon:IceCream, color:"text-pink-400" },
  { id:"expo", label:"Expo", icon:Zap, color:"text-amber-400" },
];

function getItemStation(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("kebab")||n.includes("tikka")||n.includes("tandoor")||n.includes("grill")||n.includes("seekh")) return "grill";
  if (n.includes("salad")||n.includes("raita")||n.includes("cold")||n.includes("mezze")) return "cold";
  if (n.includes("gulab")||n.includes("ice cream")||n.includes("halwa")||n.includes("kheer")||n.includes("dessert")||n.includes("brownie")||n.includes("cake")) return "desserts";
  if (n.includes("beer")||n.includes("wine")||n.includes("mocktail")||n.includes("lassi")||n.includes("juice")||n.includes("soft drink")||n.includes("cola")||n.includes("water")) return "bar";
  return "hot";
}

const COLS: { key: LiveOrder["status"]; label: string; color: string; bg: string; dot: string }[] = [
  { key:"new", label:"New / Queued", color:"text-orange-400", bg:"from-orange-500/8", dot:"bg-orange-400 animate-pulse" },
  { key:"preparing", label:"Cooking", color:"text-blue-400", bg:"from-blue-500/8", dot:"bg-blue-400 animate-pulse" },
  { key:"ready", label:"Ready to Serve", color:"text-emerald-400", bg:"from-emerald-500/8", dot:"bg-emerald-400" },
];

const DEFAULT_TARGETS: Record<string,number> = { hot:18, grill:22, cold:8, bar:5, desserts:10, expo:25, all:20 };
/** Hide stale/historical orders from the kitchen board. 7-day window so a quiet demo or
 *  a slow day still shows recent active orders instead of a blank, "broken-looking" board. */
const KITCHEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isKitchenActive(order: LiveOrder) {
  if (["served", "billed", "cancelled"].includes(order.status)) return false;
  const placed = new Date(order.placedAt).getTime();
  if (Number.isNaN(placed)) return false;
  return Date.now() - placed <= KITCHEN_MAX_AGE_MS;
}

function sortKitchenOrders(orders: LiveOrder[], priorityMode: boolean) {
  return [...orders].sort((a, b) => {
    const ta = new Date(a.placedAt).getTime();
    const tb = new Date(b.placedAt).getTime();
    return priorityMode ? ta - tb : tb - ta;
  });
}

export default function KitchenDisplay() {
  const { liveOrders, updateOrderStatus } = useRestaurant();
  const [station, setStation] = useState("all");
  const [view, setView] = useState<"kanban"|"list"|"grid">("kanban");
  const [soundOn, setSoundOn] = useState(true);
  const [priorityMode, setPriorityMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recallOrder, setRecallOrder] = useState<LiveOrder|null>(null);
  const [bumped, setBumped] = useState<LiveOrder[]>([]);
  const [targetTimes, setTargetTimes] = useState(DEFAULT_TARGETS);
  const [autoAccept, setAutoAccept] = useState(false);
  const prevCount = useRef(0);

  const active = liveOrders.filter(isKitchenActive);

  useEffect(() => {
    const newCount = active.filter(o=>o.status==="new").length;
    if (soundOn && newCount > prevCount.current) {
      try {
        const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; gain.gain.value = 0.08;
        osc.start(); setTimeout(()=>osc.stop(),180);
      } catch {}
    }
    prevCount.current = newCount;
  }, [liveOrders, soundOn]);

  // Auto-accept: when enabled, freshly-arrived pending ("new") orders are advanced
  // to "accepted" automatically so the kitchen doesn't have to acknowledge each one.
  useEffect(() => {
    if (!autoAccept) return;
    const pending = liveOrders.filter(o => o.status === "new" && isKitchenActive(o));
    pending.forEach(o => updateOrderStatus(o.id, "accepted"));
  }, [autoAccept, liveOrders]);

  const target = targetTimes[station] || 20;

  function getCol(status: LiveOrder["status"]) {
    let orders = active.filter(o => o.status === status || (status==="new" && o.status==="accepted"));
    if (station !== "all") orders = orders.filter(o => o.items.some(i => getItemStation(i.name)===station));
    return priorityMode
      ? sortKitchenOrders(orders, true)
      : sortKitchenOrders(orders, false);
  }

  function bump(order: LiveOrder, next: LiveOrder["status"]) {
    setBumped(p => [order, ...p.slice(0,4)]);
    updateOrderStatus(order.id, next);
  }

  const stats = {
    total: active.length,
    new: active.filter(o=>o.status==="new"||o.status==="accepted").length,
    cooking: active.filter(o=>o.status==="preparing").length,
    ready: active.filter(o=>o.status==="ready").length,
    urgent: active.filter(o => Math.floor((Date.now()-new Date(o.placedAt).getTime())/60000) >= target).length,
    avg: active.length ? Math.round(active.reduce((s,o)=>s+Math.floor((Date.now()-new Date(o.placedAt).getTime())/60000),0)/active.length) : 0,
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#050a12]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0c1220]">
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <ChefHat className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="font-extrabold text-xs">Kitchen Display</p>
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"/><span className="text-xs text-emerald-400">Live</span></div>
          </div>
        </div>

        {/* Stations */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1 mx-2">
          {STATIONS.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={()=>setStation(s.id)} className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${station===s.id ? `bg-amber-500/20 border-amber-500/40 ${s.color}` : "border-white/10 bg-white/5 text-white/40 hover:text-white/70"}`}>
                <Icon className="h-3 w-3" />{s.label}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={()=>setPriorityMode(!priorityMode)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${priorityMode?"bg-red-500/20 border-red-500/40 text-red-300":"border-white/10 bg-white/5 text-white/40"}`}>
            <Flame className="h-3.5 w-3.5"/>Rush
          </button>
          <button onClick={()=>setSoundOn(!soundOn)} className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-all ${soundOn?"bg-amber-500/20 border-amber-500/40 text-amber-400":"bg-white/5 border-white/10 text-white/30"}`}>
            {soundOn ? <Volume2 className="h-3.5 w-3.5"/> : <VolumeX className="h-3.5 w-3.5"/>}
          </button>
          <div className="flex gap-0.5 bg-white/5 p-0.5 rounded-lg">
            {(["kanban","list","grid"] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} className={`px-2 py-1 rounded-md text-xs font-medium capitalize transition-all ${view===v?"bg-white/15 text-white":"text-white/30"}`}>{v}</button>
            ))}
          </div>
          <button onClick={()=>bumped.length>0&&setRecallOrder(bumped[0])} disabled={bumped.length===0} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-white/10 bg-white/5 text-white/40 hover:text-white/70 disabled:opacity-30 transition-all">
            <RotateCcw className="h-3.5 w-3.5"/>Recall ({bumped.length})
          </button>
          <button onClick={()=>setShowSettings(true)} className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">
            <Settings className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-6 border-b border-white/5 bg-[#080d18]">
        {[
          {label:"Total",value:stats.total,color:"text-white"},
          {label:"New",value:stats.new,color:"text-orange-400"},
          {label:"Cooking",value:stats.cooking,color:"text-blue-400"},
          {label:"Ready",value:stats.ready,color:"text-emerald-400"},
          {label:"Urgent",value:stats.urgent,color:"text-red-400"},
          {label:"Avg Wait",value:`${stats.avg}m`,color:"text-amber-400"},
        ].map(s=>(
          <div key={s.label} className="flex flex-col items-center justify-center py-2 border-r border-white/5 last:border-r-0">
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/30">{s.label}</p>
          </div>
        ))}
      </div>

      {active.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-3xl">🍳</div>
          <h3 className="text-lg font-bold text-white/80">No active kitchen orders right now</h3>
          <p className="text-sm text-white/40 mt-1 max-w-md">New dine-in / room / online orders will appear here automatically as soon as they come in. Completed, served and cancelled orders are hidden.</p>
        </div>
      )}

      {/* Kanban */}
      {active.length > 0 && view==="kanban" && (
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-3 divide-x divide-white/5">
          {COLS.map(col=>{
            const orders = getCol(col.key);
            return (
              <div key={col.key} className={`flex flex-col min-h-0 bg-gradient-to-b ${col.bg} to-transparent`}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${col.dot}`}/>
                    <span className={`text-sm font-bold ${col.color}`}>{col.label}</span>
                  </div>
                  <span className={`h-6 min-w-6 px-1.5 rounded-full flex items-center justify-center text-xs font-extrabold ${col.color} bg-white/10`}>{orders.length}</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {orders.map(order=>{
                    const mins = Math.floor((Date.now()-new Date(order.placedAt).getTime())/60000);
                    const isUrgent = mins >= target;
                    const isWarn = mins >= target*0.7 && !isUrgent;
                    const stItems = station==="all" ? order.items : order.items.filter(i=>getItemStation(i.name)===station);
                    return (
                      <div key={order.id} className={`rounded-xl border p-3 transition-all ${isUrgent?"border-red-500/60 bg-red-500/10 shadow-lg shadow-red-500/10":isWarn?"border-yellow-500/40 bg-yellow-500/5":"border-white/8 bg-white/[0.04]"}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-base leading-none">{order.tableNo}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-md ${order.type==="dine-in"?"bg-amber-500/15 text-amber-400":order.type==="delivery"?"bg-blue-500/15 text-blue-400":"bg-white/10 text-white/50"}`}>
                                {order.type==="dine-in"?"🍽️":order.type==="delivery"?"🛵":order.type==="takeaway"?"🛍️":"🏨"} {order.type}
                              </span>
                              {isUrgent&&<span className="flex items-center gap-0.5 text-xs text-red-400 font-bold"><AlertTriangle className="h-3 w-3"/>LATE</span>}
                            </div>
                            <p className="text-xs text-white/30 mt-0.5">{order.id} · {order.guests} guests</p>
                          </div>
                          <Timer start={order.placedAt} targetMins={target}/>
                        </div>

                        <div className="space-y-1.5 mb-2.5">
                          {stItems.map((item,i)=>{
                            const hasExtras = (Array.isArray(item.addons)&&item.addons.length>0)||(Array.isArray(item.customizations)&&item.customizations.length>0)||item.variant||item.notes;
                            return (
                            <div key={i} className="flex items-start gap-2">
                              <div className={`h-5 w-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${item.status==="ready"?"bg-emerald-500/30 text-emerald-400":item.status==="preparing"?"bg-blue-500/30 text-blue-400":"bg-white/10 text-white/50"}`}>{item.qty}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm flex-1 ${item.status==="ready"?"line-through text-white/40":"text-white/85"}`}>{item.name}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-md shrink-0 ${getItemStation(item.name)==="grill"?"bg-orange-500/15 text-orange-400":getItemStation(item.name)==="cold"?"bg-cyan-500/15 text-cyan-400":getItemStation(item.name)==="bar"?"bg-violet-500/15 text-violet-400":getItemStation(item.name)==="desserts"?"bg-pink-500/15 text-pink-400":"bg-red-500/15 text-red-400"}`}>
                                    {getItemStation(item.name)}
                                  </span>
                                </div>
                                {hasExtras && (
                                  <div className="mt-1 ml-0.5 pl-2 border-l-2 border-amber-500/40 space-y-0.5">
                                    {item.variant && <p className="text-[11px] text-violet-300">🍽 {item.variant}</p>}
                                    {Array.isArray(item.addons)&&item.addons.length>0 && <p className="text-[11px] font-semibold text-emerald-300">➕ Add: {item.addons.map(a=>a.name).join(", ")}</p>}
                                    {(() => { const { removes, prefs } = splitCustomizations(item.customizations); return (<>
                                      {removes.length>0 && <p className="text-[11px] font-semibold text-rose-300">➖ Remove: {removes.join(", ")}</p>}
                                      {prefs.length>0 && <p className="text-[11px] font-semibold text-cyan-300">⚡ {prefs.join(" · ")}</p>}
                                    </>); })()}
                                    {item.notes && <p className="text-[11px] text-yellow-300">📝 {item.notes}</p>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );})}
                        </div>

                        {order.specialReq&&(
                          <div className="flex items-start gap-1.5 text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-lg px-2.5 py-1.5 mb-2.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px"/><span>{order.specialReq}</span>
                          </div>
                        )}

                        <div className="text-xs text-white/30 mb-2.5">{order.waiter}</div>

                        <div className="flex gap-1.5">
                          {(col.key==="new"||order.status==="accepted")&&(
                            <>
                              <button onClick={()=>bump(order,"preparing")} className="flex-1 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-500/30 transition-all flex items-center justify-center gap-1">
                                <Play className="h-3 w-3"/>Start Cooking
                              </button>
                              <button onClick={() => window.print()} title="Print KOT" className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"><Printer className="h-3.5 w-3.5"/></button>
                            </>
                          )}
                          {col.key==="preparing"&&(
                            <button onClick={()=>bump(order,"ready")} className="flex-1 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-1">
                              <CheckCircle className="h-3 w-3"/>Mark Ready
                            </button>
                          )}
                          {col.key==="ready"&&(
                            <button onClick={()=>bump(order,"served")} className="flex-1 py-2 rounded-lg bg-teal-500/20 border border-teal-500/30 text-teal-400 text-xs font-bold hover:bg-teal-500/30 transition-all flex items-center justify-center gap-1">
                              <CheckCircle className="h-3 w-3"/>Serve
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {orders.length===0&&(
                    <div className="flex flex-col items-center justify-center h-32 text-white/15">
                      <CheckCircle className="h-8 w-8 mb-2"/><p className="text-xs">All clear</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {active.length > 0 && view==="list"&&(
        <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/30 border-b border-white/5">
                {["Order","Table","Type","Items","Stations","Status","Timer","Action"].map(h=>(
                  <th key={h} className="pb-3 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortKitchenOrders(active, priorityMode).map(order=>(
                <tr key={order.id} className={`hover:bg-white/3 transition-all ${Math.floor((Date.now()-new Date(order.placedAt).getTime())/60000)>=target?"bg-red-500/5":""}`}>
                  <td className="py-3 pr-4 font-mono text-xs text-white/50">{order.id}</td>
                  <td className="py-3 pr-4 font-extrabold">{order.tableNo}</td>
                  <td className="py-3 pr-4 text-xs text-white/50">{order.type}</td>
                  <td className="py-3 pr-4"><p className="text-xs text-white/60 max-w-36 truncate">{order.items.map(i=>`${i.qty}×${i.name}`).join(", ")}</p></td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(order.items.map(i=>getItemStation(i.name)))].map(st=>(
                        <span key={st} className="text-xs px-1.5 py-0.5 rounded-md bg-white/10 text-white/50 capitalize">{st}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${order.status==="new"?"bg-orange-500/20 text-orange-400":order.status==="preparing"?"bg-blue-500/20 text-blue-400":order.status==="ready"?"bg-emerald-500/20 text-emerald-400":"bg-white/10 text-white/40"}`}>{order.status}</span>
                  </td>
                  <td className="py-3 pr-4"><Timer start={order.placedAt} targetMins={target}/></td>
                  <td className="py-3">
                    {(order.status==="new"||order.status==="accepted")&&<button onClick={()=>bump(order,"preparing")} className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30">Start</button>}
                    {order.status==="preparing"&&<button onClick={()=>bump(order,"ready")} className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30">Ready</button>}
                    {order.status==="ready"&&<button onClick={()=>bump(order,"served")} className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/30">Served</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid View */}
      {active.length > 0 && view==="grid"&&(
        <div className="flex-1 min-h-0 overflow-y-auto p-3 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {sortKitchenOrders(active, priorityMode).map(order=>{
              const mins = Math.floor((Date.now()-new Date(order.placedAt).getTime())/60000);
              return (
                <div key={order.id} className={`rounded-xl border p-3 ${mins>=target?"border-red-500/50 bg-red-500/8":"border-white/8 bg-white/[0.04]"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold">{order.tableNo}</span>
                    <Timer start={order.placedAt} targetMins={target}/>
                  </div>
                  <div className="space-y-1 mb-2">
                    {order.items.slice(0,3).map((item,i)=>{
                      const extras=[...(item.addons?.map(a=>a.name)||[]),...(item.customizations||[])];
                      return (
                        <div key={i}>
                          <p className="text-xs text-white/60 truncate">{item.qty}× {item.name}</p>
                          {extras.length>0&&<p className="text-[10px] text-amber-300/90 truncate">↳ {extras.join(", ")}</p>}
                          {item.notes&&<p className="text-[10px] text-yellow-300/80 truncate">📝 {item.notes}</p>}
                        </div>
                      );
                    })}
                    {order.items.length>3&&<p className="text-xs text-white/30">+{order.items.length-3} more</p>}
                  </div>
                  {order.specialReq&&<p className="text-xs text-yellow-300 truncate mb-1">⚠️ {order.specialReq}</p>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${order.status==="new"?"bg-orange-500/20 text-orange-400":order.status==="preparing"?"bg-blue-500/20 text-blue-400":"bg-emerald-500/20 text-emerald-400"}`}>{order.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings&&(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-bold flex items-center gap-2"><Settings className="h-4 w-4 text-amber-400"/>KDS Settings</h3>
              <button onClick={()=>setShowSettings(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Target Prep Times (minutes)</p>
                <div className="space-y-2">
                  {Object.entries(targetTimes).filter(([k])=>k!=="all").map(([st,mins])=>(
                    <div key={st} className="flex items-center justify-between">
                      <span className="text-sm capitalize text-white/70">{st==="hot"?"Hot Line":st==="cold"?"Cold Station":st.charAt(0).toUpperCase()+st.slice(1)}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>setTargetTimes(t=>({...t,[st]:Math.max(3,mins-1)}))} className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 text-sm">−</button>
                        <span className="w-8 text-center text-sm font-bold text-amber-400">{mins}</span>
                        <button onClick={()=>setTargetTimes(t=>({...t,[st]:mins+1}))} className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 text-sm">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Options</p>
                <div className="space-y-3">
                  {[
                    {label:"Sound Alerts",val:soundOn,set:setSoundOn},
                    {label:"Auto-accept Orders",val:autoAccept,set:setAutoAccept},
                  ].map(({label,val,set})=>(
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-white/70">{label}</span>
                      <button onClick={()=>set(!val)} className={`h-6 w-11 rounded-full transition-all relative ${val?"bg-amber-500":"bg-white/10"}`}>
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${val?"left-[22px]":"left-0.5"}`}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={()=>setShowSettings(false)} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-sm">Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Recall Modal */}
      {recallOrder&&(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2"><RotateCcw className="h-4 w-4 text-amber-400"/>Recall Order</h3>
              <button onClick={()=>setRecallOrder(null)}><X className="h-5 w-5 text-white/40"/></button>
            </div>
            <div className="bg-white/5 rounded-xl p-3 mb-4">
              <p className="font-bold">{recallOrder.tableNo} — {recallOrder.id}</p>
              <p className="text-xs text-white/40 mt-1">{recallOrder.items.map(i=>`${i.qty}× ${i.name}`).join(", ")}</p>
            </div>
            <p className="text-sm text-white/50 mb-4">This will move the order back to "Preparing" status.</p>
            <div className="flex gap-3">
              <button onClick={()=>setRecallOrder(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
              <button onClick={()=>{updateOrderStatus(recallOrder.id,"preparing");setRecallOrder(null);}} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-sm">Recall Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
