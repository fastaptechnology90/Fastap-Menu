import { useState, useEffect, useRef } from "react";
import { useRestaurant, type LiveOrder } from "@/contexts/RestaurantContext";
import { splitCustomizations } from "@/lib/orderItemExtras";
import { kitchenDisplayApi, printing, openPrintWindow } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { ChefHat, Volume2, VolumeX, Flame, Clock, AlertTriangle, CheckCircle, Printer, Settings, RotateCcw, Zap, Wine, IceCream, Salad, Beef, X, Play, Target, StickyNote, UtensilsCrossed, Bike, ShoppingBag, Hotel } from "lucide-react";

function Timer({ start, targetMins = 20 }: { start: Date; targetMins?: number }) {
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - new Date(start).getTime()) / 1000));
  useEffect(() => { const t = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(t); }, []);
  const mins = Math.floor(elapsed / 60), secs = elapsed % 60;
  const pct = Math.min(100, (mins / targetMins) * 100);
  const color = pct >= 100 ? "text-danger animate-pulse" : pct >= 70 ? "text-warning" : "text-success";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`font-mono font-semibold text-sm ${color}`}>{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}</span>
      <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-colors ${pct>=100?"bg-danger":pct>=70?"bg-warning":"bg-success"}`} style={{width:`${pct}%`}} />
      </div>
    </div>
  );
}

const STATIONS = [
  { id:"all", label:"All Stations", icon:ChefHat, color:"text-foreground" },
  { id:"hot", label:"Hot Line", icon:Flame, color:"text-danger" },
  { id:"grill", label:"Grill", icon:Beef, color:"text-warning" },
  { id:"cold", label:"Cold", icon:Salad, color:"text-info" },
  { id:"bar", label:"Bar", icon:Wine, color:"text-muted-foreground" },
  { id:"desserts", label:"Desserts", icon:IceCream, color:"text-muted-foreground" },
  { id:"expo", label:"Expo", icon:Zap, color:"text-primary" },
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
  { key:"new", label:"New / Queued", color:"text-warning", bg:"bg-warning-subtle/30", dot:"bg-warning animate-pulse" },
  { key:"preparing", label:"Cooking", color:"text-info", bg:"bg-info-subtle/30", dot:"bg-info animate-pulse" },
  { key:"ready", label:"Ready to Serve", color:"text-success", bg:"bg-success-subtle/30", dot:"bg-success" },
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

// One short tone at an offset within the shared AudioContext.
function beep(ctx: AudioContext, freq: number, startAt: number, dur: number, vol: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = vol;
  const t = ctx.currentTime + startAt;
  osc.start(t);
  osc.stop(t + dur);
}

export default function KitchenDisplay() {
  const { liveOrders, updateOrderStatus, restaurantId } = useRestaurant();
  const [station, setStation] = useState("all");
  const [view, setView] = useState<"kanban"|"list"|"grid">("kanban");
  const [soundOn, setSoundOn] = useState(true);
  const [priorityMode, setPriorityMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recallOrder, setRecallOrder] = useState<LiveOrder|null>(null);
  const [bumped, setBumped] = useState<LiveOrder[]>([]);
  const [targetTimes, setTargetTimes] = useState(DEFAULT_TARGETS);
  const [autoAccept, setAutoAccept] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevCount = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Everything above lived in this browser tab. A kitchen that set its grill target to
  // 25 minutes lost it on the next refresh, and a venue running two KDS screens had two
  // different sets of targets, so the same ticket went red on one and green on the other.
  const loadedPrefs = useRef(false);

  useEffect(() => {
    if (!restaurantId) return;
    let live = true;
    kitchenDisplayApi.prefs(restaurantId)
      .then(p => {
        if (!live) return;
        setTargetTimes({ ...DEFAULT_TARGETS, ...p.targetTimes });
        setSoundOn(p.soundOn);
        setAutoAccept(p.autoAccept);
        setPriorityMode(p.priorityMode);
        loadedPrefs.current = true;
      })
      .catch(() => { loadedPrefs.current = true; });
    return () => { live = false; };
  }, [restaurantId]);

  /**
   * Print the ticket for one order. This button called `window.print()`, which prints
   * the kitchen display itself — the dark screen, every column, every other table's
   * order — and never a ticket for this dish.
   */
  async function printKot(order: LiveOrder) {
    if (!restaurantId) return;
    const id = parseInt(String(order.id), 10);
    if (!Number.isInteger(id)) return;
    try {
      const r = await printing.reprint(restaurantId, id, "kot");
      if (!openPrintWindow(r.html, printing.kotUrl(restaurantId, id))) {
        toast({ title: "Your browser blocked the print window", description: "Allow pop-ups for this site to print tickets." });
      }
    } catch (e) {
      toast({
        title: "Could not print the kitchen ticket",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  /** Persist one setting, and say so if it did not stick rather than looking saved. */
  function savePref(patch: Partial<{ targetTimes: Record<string, number>; soundOn: boolean; autoAccept: boolean; priorityMode: boolean }>) {
    if (!restaurantId || !loadedPrefs.current) return;
    kitchenDisplayApi.savePrefs(restaurantId, patch).catch(e => {
      toast({
        title: "Could not save that kitchen setting",
        description: e instanceof Error ? e.message : "It will apply on this screen only until saved.",
        variant: "destructive",
      });
    });
  }

  const active = liveOrders.filter(isKitchenActive);

  // Mobile/WebView block audio until the first user gesture — create & resume the shared
  // AudioContext on the first tap or key so the new-order chime can actually play afterwards.
  useEffect(() => {
    const unlock = () => {
      try {
        if (!audioCtxRef.current) {
          const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (Ctor) audioCtxRef.current = new Ctor();
        }
        if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();
      } catch { /* audio unsupported */ }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const newCount = active.filter(o=>o.status==="new").length;
    let clear: ReturnType<typeof setTimeout> | undefined;
    if (newCount > prevCount.current) {
      // Visual flash always (even when muted) so a silent kitchen still notices a new order.
      setFlash(true);
      clear = setTimeout(() => setFlash(false), 2600);
      if (soundOn) {
        try {
          if (!audioCtxRef.current) {
            const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (Ctor) audioCtxRef.current = new Ctor();
          }
          const ctx = audioCtxRef.current;
          if (ctx) {
            if (ctx.state === "suspended") ctx.resume();
            // Three louder rising tones — hard to miss over kitchen noise.
            beep(ctx, 880, 0, 0.2, 0.18);
            beep(ctx, 1108, 0.24, 0.2, 0.18);
            beep(ctx, 1320, 0.48, 0.26, 0.18);
          }
        } catch { /* ignore */ }
      }
    }
    prevCount.current = newCount;
    return () => { if (clear) clearTimeout(clear); };
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
    <div className="h-full min-h-0 flex flex-col bg-background">
      {/* New-order flash — a pulsing amber frame so the kitchen notices even at a glance
          (and even when sound is muted). Non-blocking overlay. */}
      {flash && (
        <div className="pointer-events-none fixed inset-0 z-50 ring-8 ring-inset ring-primary animate-pulse" aria-hidden="true" />
      )}
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <ChefHat className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-xs">Kitchen Display</p>
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"/><span className="text-xs text-success">Live</span></div>
          </div>
        </div>

        {/* Stations */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1 mx-2">
          {STATIONS.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={()=>setStation(s.id)} className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${station===s.id ? `bg-primary/20 border-primary/40 ${s.color}` : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-3 w-3" />{s.label}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={()=>{const v=!priorityMode;setPriorityMode(v);savePref({priorityMode:v});}} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${priorityMode?"bg-danger-subtle border-danger-border text-danger":"border-border bg-muted text-muted-foreground"}`}>
            <Flame className="h-3.5 w-3.5"/>Rush
          </button>
          <button onClick={()=>{const v=!soundOn;setSoundOn(v);savePref({soundOn:v});}} className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-colors ${soundOn?"bg-primary/20 border-primary/40 text-primary":"bg-muted border-border text-muted-foreground"}`}>
            {soundOn ? <Volume2 className="h-3.5 w-3.5"/> : <VolumeX className="h-3.5 w-3.5"/>}
          </button>
          <div className="flex gap-0.5 bg-muted p-0.5 rounded-lg">
            {(["kanban","list","grid"] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} className={`px-2 py-1 rounded-md text-xs font-medium capitalize transition-colors ${view===v?"bg-muted text-foreground":"text-muted-foreground"}`}>{v}</button>
            ))}
          </div>
          <button onClick={()=>bumped.length>0&&setRecallOrder(bumped[0])} disabled={bumped.length===0} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-border bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            <RotateCcw className="h-3.5 w-3.5"/>Recall ({bumped.length})
          </button>
          <button onClick={()=>setShowSettings(true)} className="h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 border-b border-border bg-background">
        {[
          {label:"Total",value:stats.total,color:"text-foreground"},
          {label:"New",value:stats.new,color:"text-warning"},
          {label:"Cooking",value:stats.cooking,color:"text-info"},
          {label:"Ready",value:stats.ready,color:"text-success"},
          {label:"Urgent",value:stats.urgent,color:"text-danger"},
          {label:"Avg Wait",value:`${stats.avg}m`,color:"text-primary"},
        ].map(s=>(
          <div key={s.label} className="flex flex-col items-center justify-center py-2 border-r border-border last:border-r-0">
            <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {active.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          <div className="h-16 w-16 rounded-lg bg-muted text-muted-foreground flex items-center justify-center mb-4"><ChefHat className="h-7 w-7" /></div>
          <h3 className="text-lg font-semibold text-foreground">No active kitchen orders right now</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">New dine-in / room / online orders will appear here automatically as soon as they come in. Completed, served and cancelled orders are hidden.</p>
        </div>
      )}

      {/* Kanban */}
      {active.length > 0 && view==="kanban" && (
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-3 divide-x divide-border">
          {COLS.map(col=>{
            const orders = getCol(col.key);
            return (
              <div key={col.key} className={`flex flex-col min-h-0 ${col.bg}`}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${col.dot}`}/>
                    <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                  </div>
                  <span className={`h-6 min-w-6 px-1.5 rounded-full flex items-center justify-center text-xs font-semibold ${col.color} bg-muted`}>{orders.length}</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {orders.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      {station === "all" ? "Nothing here" : "Nothing for this station"}
                    </p>
                  )}
                  {orders.map(order=>{
                    const mins = Math.floor((Date.now()-new Date(order.placedAt).getTime())/60000);
                    const isUrgent = mins >= target;
                    const isWarn = mins >= target*0.7 && !isUrgent;
                    const stItems = station==="all" ? order.items : order.items.filter(i=>getItemStation(i.name)===station);
                    return (
                      <div key={order.id} className={`rounded-lg border p-3 transition-colors ${isUrgent?"border-danger-border bg-danger-subtle":isWarn?"border-warning-border bg-warning-subtle":"border-border bg-card"}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-base leading-none">{order.tableNo}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-md ${order.type==="dine-in"?"bg-primary/15 text-primary":order.type==="delivery"?"bg-info-subtle text-info":"bg-muted text-muted-foreground"}`}>
                                {(() => { const TypeIcon = order.type==="dine-in"?UtensilsCrossed:order.type==="delivery"?Bike:order.type==="takeaway"?ShoppingBag:Hotel; return <TypeIcon className="h-3 w-3 inline mb-0.5" />; })()} {order.type}
                              </span>
                              {isUrgent&&<span className="flex items-center gap-0.5 text-xs text-danger font-semibold"><AlertTriangle className="h-3 w-3"/>LATE</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{order.id} · {order.guests} guests</p>
                          </div>
                          <Timer start={order.placedAt} targetMins={target}/>
                        </div>

                        <div className="space-y-1.5 mb-2.5">
                          {stItems.map((item,i)=>{
                            const hasExtras = (Array.isArray(item.addons)&&item.addons.length>0)||(Array.isArray(item.customizations)&&item.customizations.length>0)||item.variant||item.notes;
                            return (
                            <div key={i} className="flex items-start gap-2">
                              <div className={`h-5 w-5 rounded-md flex items-center justify-center text-xs font-semibold shrink-0 ${item.status==="ready"?"bg-success-subtle text-success":item.status==="preparing"?"bg-info-subtle text-info":"bg-muted text-muted-foreground"}`}>{item.qty}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm flex-1 ${item.status==="ready"?"line-through text-muted-foreground":"text-foreground"}`}>{item.name}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-md shrink-0 ${getItemStation(item.name)==="grill"?"bg-warning-subtle text-warning":getItemStation(item.name)==="cold"?"bg-info-subtle text-info":getItemStation(item.name)==="bar"?"bg-muted text-muted-foreground":getItemStation(item.name)==="desserts"?"bg-muted text-muted-foreground":"bg-danger-subtle text-danger"}`}>
                                    {getItemStation(item.name)}
                                  </span>
                                </div>
                                {hasExtras && (
                                  <div className="mt-1 ml-0.5 pl-2 border-l-2 border-primary/40 space-y-0.5">
                                    {item.variant && <p className="text-2xs text-muted-foreground">{item.variant}</p>}
                                    {Array.isArray(item.addons)&&item.addons.length>0 && <p className="text-2xs font-semibold text-success">Add: {item.addons.map(a=>a.name).join(", ")}</p>}
                                    {(() => { const { removes, prefs } = splitCustomizations(item.customizations); return (<>
                                      {removes.length>0 && <p className="text-2xs font-semibold text-danger">Remove: {removes.join(", ")}</p>}
                                      {prefs.length>0 && <p className="text-2xs font-semibold text-info">{prefs.join(" · ")}</p>}
                                    </>); })()}
                                    {item.notes && <p className="text-2xs text-warning"><StickyNote className="h-3 w-3 inline mb-0.5" /> {item.notes}</p>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );})}
                        </div>

                        {order.specialReq&&(
                          <div className="flex items-start gap-1.5 text-xs bg-warning-subtle border border-warning-border text-warning rounded-lg px-2.5 py-1.5 mb-2.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px"/><span>{order.specialReq}</span>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground mb-2.5">{order.waiter}</div>

                        <div className="flex gap-1.5">
                          {(col.key==="new"||order.status==="accepted")&&(
                            <>
                              <button onClick={()=>bump(order,"preparing")} className="flex-1 py-2 rounded-lg bg-info-subtle border border-info-border text-info text-xs font-semibold hover-elevate transition-colors flex items-center justify-center gap-1">
                                <Play className="h-3 w-3"/>Start Cooking
                              </button>
                              <button onClick={()=>printKot(order)} title="Print kitchen ticket" className="h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><Printer className="h-3.5 w-3.5"/></button>
                            </>
                          )}
                          {col.key==="preparing"&&(
                            <button onClick={()=>bump(order,"ready")} className="flex-1 py-2 rounded-lg bg-success-subtle border border-success-border text-success text-xs font-semibold hover-elevate transition-colors flex items-center justify-center gap-1">
                              <CheckCircle className="h-3 w-3"/>Mark Ready
                            </button>
                          )}
                          {col.key==="ready"&&(
                            <button onClick={()=>bump(order,"served")} className="flex-1 py-2 rounded-lg bg-success-subtle border border-success-border text-success text-xs font-semibold hover-elevate transition-colors flex items-center justify-center gap-1">
                              <CheckCircle className="h-3 w-3"/>Serve
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {orders.length===0&&(
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
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
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  {["Order","Table","Type","Items","Stations","Status","Timer","Action"].map(h=>(
                    <th key={h} className="pb-3 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortKitchenOrders(active, priorityMode).map(order=>(
                  <tr key={order.id} className={`hover:bg-muted transition-colors ${Math.floor((Date.now()-new Date(order.placedAt).getTime())/60000)>=target?"bg-danger-subtle":""}`}>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{order.id}</td>
                    <td className="py-3 pr-4 font-semibold">{order.tableNo}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{order.type}</td>
                    <td className="py-3 pr-4"><p className="text-xs text-muted-foreground max-w-36 truncate">{order.items.map(i=>`${i.qty}×${i.name}`).join(", ")}</p></td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(order.items.map(i=>getItemStation(i.name)))].map(st=>(
                          <span key={st} className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground capitalize">{st}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${order.status==="new"?"bg-warning-subtle text-warning":order.status==="preparing"?"bg-info-subtle text-info":order.status==="ready"?"bg-success-subtle text-success":"bg-muted text-muted-foreground"}`}>{order.status}</span>
                    </td>
                    <td className="py-3 pr-4"><Timer start={order.placedAt} targetMins={target}/></td>
                    <td className="py-3">
                      {(order.status==="new"||order.status==="accepted")&&<button onClick={()=>bump(order,"preparing")} className="px-3 py-1 rounded-lg bg-info-subtle text-info text-xs font-semibold hover-elevate">Start</button>}
                      {order.status==="preparing"&&<button onClick={()=>bump(order,"ready")} className="px-3 py-1 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate">Ready</button>}
                      {order.status==="ready"&&<button onClick={()=>bump(order,"served")} className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-xs font-semibold hover:bg-primary/30">Served</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid View */}
      {active.length > 0 && view==="grid"&&(
        <div className="flex-1 min-h-0 overflow-y-auto p-3 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {sortKitchenOrders(active, priorityMode).map(order=>{
              const mins = Math.floor((Date.now()-new Date(order.placedAt).getTime())/60000);
              return (
                <div key={order.id} className={`rounded-lg border p-3 ${mins>=target?"border-danger-border bg-danger-subtle":"border-border bg-card"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{order.tableNo}</span>
                    <Timer start={order.placedAt} targetMins={target}/>
                  </div>
                  <div className="space-y-1 mb-2">
                    {order.items.slice(0,3).map((item,i)=>{
                      const extras=[...(item.addons?.map(a=>a.name)||[]),...(item.customizations||[])];
                      return (
                        <div key={i}>
                          <p className="text-xs text-muted-foreground truncate">{item.qty}× {item.name}</p>
                          {extras.length>0&&<p className="text-2xs text-primary truncate">{extras.join(", ")}</p>}
                          {item.notes&&<p className="text-2xs text-warning truncate">{item.notes}</p>}
                        </div>
                      );
                    })}
                    {order.items.length>3&&<p className="text-xs text-muted-foreground">+{order.items.length-3} more</p>}
                  </div>
                  {order.specialReq&&<p className="text-xs text-warning truncate mb-1"><AlertTriangle className="h-3 w-3 inline mb-0.5" /> {order.specialReq}</p>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${order.status==="new"?"bg-warning-subtle text-warning":order.status==="preparing"?"bg-info-subtle text-info":"bg-success-subtle text-success"}`}>{order.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings&&(
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card rounded-lg border border-border overflow-hidden max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4 text-primary"/>KDS Settings</h3>
              <button onClick={()=>setShowSettings(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Target Prep Times (minutes)</p>
                <div className="space-y-2">
                  {Object.entries(targetTimes).filter(([k])=>k!=="all").map(([st,mins])=>(
                    <div key={st} className="flex items-center justify-between">
                      <span className="text-sm capitalize text-foreground">{st==="hot"?"Hot Line":st==="cold"?"Cold Station":st.charAt(0).toUpperCase()+st.slice(1)}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>{const v=Math.max(3,mins-1);setTargetTimes(t=>({...t,[st]:v}));savePref({targetTimes:{[st]:v}});}} className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover-elevate text-sm">−</button>
                        <span className="w-8 text-center text-sm font-semibold text-primary">{mins}</span>
                        <button onClick={()=>{const v=mins+1;setTargetTimes(t=>({...t,[st]:v}));savePref({targetTimes:{[st]:v}});}} className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover-elevate text-sm">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Options</p>
                <div className="space-y-3">
                  {([
                    {key:"soundOn" as const,label:"Sound Alerts",val:soundOn,set:setSoundOn},
                    {key:"autoAccept" as const,label:"Auto-accept Orders",val:autoAccept,set:setAutoAccept},
                  ]).map(({key,label,val,set})=>(
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{label}</span>
                      <button onClick={()=>{const v=!val;set(v);savePref({[key]:v});}} className={`h-6 w-11 rounded-full transition-colors relative ${val?"bg-primary":"bg-muted"}`}>
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-colors ${val?"left-[22px]":"left-0.5"}`}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {/* Each control saves as it is changed, so this only closes the panel —
                  calling it "Save Settings" implied nothing had been saved until now. */}
              <button onClick={()=>setShowSettings(false)} className="w-full py-3 rounded-lg bg-primary hover:bg-primary/90 font-semibold text-sm">Done</button>
              <p className="text-center text-xs text-muted-foreground">Saved for this venue — every kitchen screen sees the same targets.</p>
            </div>
          </div>
        </div>
      )}

      {/* Recall Modal */}
      {recallOrder&&(
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-lg border border-border p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><RotateCcw className="h-4 w-4 text-primary"/>Recall Order</h3>
              <button onClick={()=>setRecallOrder(null)}><X className="h-5 w-5 text-muted-foreground"/></button>
            </div>
            <div className="bg-muted rounded-lg p-3 mb-4">
              <p className="font-semibold">{recallOrder.tableNo} — {recallOrder.id}</p>
              <p className="text-xs text-muted-foreground mt-1">{recallOrder.items.map(i=>`${i.qty}× ${i.name}`).join(", ")}</p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">This will move the order back to "Preparing" status.</p>
            <div className="flex gap-3">
              <button onClick={()=>setRecallOrder(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
              <button onClick={()=>{updateOrderStatus(recallOrder.id,"preparing");setRecallOrder(null);}} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 font-semibold text-sm">Recall Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
