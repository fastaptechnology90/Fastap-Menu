import { useState, useEffect, useMemo, useRef } from "react";
import { useRestaurant, type LiveOrder } from "@/contexts/RestaurantContext";
import { splitCustomizations } from "@/lib/orderItemExtras";
import { kitchenDisplayApi, printing, openPrintWindow } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  ChefHat, Volume2, VolumeX, Flame, AlertTriangle, CheckCircle, Printer, Settings,
  RotateCcw, Zap, Wine, IceCream, Salad, Beef, X, Play, StickyNote, UtensilsCrossed,
  Bike, ShoppingBag, Hotel, LayoutGrid, Rows3, List, Minus, Plus,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────────
   Kitchen Display

   The one screen in this product that is read from two metres away, standing up,
   by someone holding a pan. Everything here follows from that:

   - The ticket is the unit. Table number and elapsed time are the two things a
     chef reads first, so they are the two largest things on it.
   - Colour means time, and nothing else. Green under 70% of target, amber past
     it, red past target. That is the only use of the semantic ramp on this page.
   - There is one action per ticket and it is 56px tall and full width. A bump
     you have to aim at is a bump that gets missed.
   - The board re-times itself every second, so a ticket turns amber and then red
     while you are looking at it rather than on the next 15s order poll.
   ──────────────────────────────────────────────────────────────────────────── */

const STATIONS = [
  { id: "all", label: "All", icon: ChefHat },
  { id: "hot", label: "Hot Line", icon: Flame },
  { id: "grill", label: "Grill", icon: Beef },
  { id: "cold", label: "Cold", icon: Salad },
  { id: "bar", label: "Bar", icon: Wine },
  { id: "desserts", label: "Desserts", icon: IceCream },
  { id: "expo", label: "Expo", icon: Zap },
];

const STATION_LABEL: Record<string, string> = {
  hot: "Hot Line", grill: "Grill", cold: "Cold Station", bar: "Bar",
  desserts: "Desserts", expo: "Expo", all: "All stations",
};

function getItemStation(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("kebab")||n.includes("tikka")||n.includes("tandoor")||n.includes("grill")||n.includes("seekh")) return "grill";
  if (n.includes("salad")||n.includes("raita")||n.includes("cold")||n.includes("mezze")) return "cold";
  if (n.includes("gulab")||n.includes("ice cream")||n.includes("halwa")||n.includes("kheer")||n.includes("dessert")||n.includes("brownie")||n.includes("cake")) return "desserts";
  if (n.includes("beer")||n.includes("wine")||n.includes("mocktail")||n.includes("lassi")||n.includes("juice")||n.includes("soft drink")||n.includes("cola")||n.includes("water")) return "bar";
  return "hot";
}

type LaneKey = "new" | "preparing" | "ready";

const LANES: { key: LaneKey; label: string; short: string; dot: string; text: string }[] = [
  { key: "new",       label: "Queued",  short: "Queued",  dot: "bg-warning", text: "text-warning" },
  { key: "preparing", label: "Cooking", short: "Cooking", dot: "bg-info",    text: "text-info" },
  { key: "ready",     label: "Ready",   short: "Ready",   dot: "bg-success", text: "text-success" },
];

/* Every class below is written out in full. Tailwind scans source text, so an
   interpolated name like `bg-${tone}-subtle` is never emitted and the element
   ships invisible. */
type Tone = "ok" | "warn" | "late";
const TONE: Record<Tone, { card: string; bar: string; text: string; fill: string }> = {
  ok:   { card: "border-border bg-card",                   bar: "bg-success", text: "text-success", fill: "bg-success" },
  warn: { card: "border-warning-border bg-warning-subtle", bar: "bg-warning", text: "text-warning", fill: "bg-warning" },
  late: { card: "border-danger-border bg-danger-subtle",   bar: "bg-danger",  text: "text-danger",  fill: "bg-danger" },
};

const DEFAULT_TARGETS: Record<string, number> = { hot: 18, grill: 22, cold: 8, bar: 5, desserts: 10, expo: 25, all: 20 };

/** Hide stale/historical orders from the kitchen board. 7-day window so a quiet demo or
 *  a slow day still shows recent active orders instead of a blank, "broken-looking" board. */
const KITCHEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isKitchenActive(order: LiveOrder) {
  if (["served", "billed", "cancelled"].includes(order.status)) return false;
  const placed = new Date(order.placedAt).getTime();
  // A missing/bad timestamp must not hide a live ticket — that looked like a
  // broken KDS (order in the DB, blank board) and forced pointless reloads.
  if (Number.isNaN(placed)) return true;
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

function typeIcon(type: LiveOrder["type"]) {
  return type === "dine-in" ? UtensilsCrossed
    : type === "delivery" ? Bike
    : type === "takeaway" ? ShoppingBag
    : Hotel;
}

function elapsedSecs(order: LiveOrder, now: number) {
  const placed = new Date(order.placedAt).getTime();
  if (Number.isNaN(placed)) return 0;
  return Math.max(0, Math.floor((now - placed) / 1000));
}

function mmss(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * The prep target for one ticket, in minutes.
 *
 * The board used to time every ticket against whichever station filter happened
 * to be selected, so a 5-minute drink and a 22-minute grill order both went red
 * at 20. A ticket is now timed against the slowest station it actually contains,
 * which is what the kitchen means by "late".
 */
function targetFor(order: LiveOrder, station: string, targets: Record<string, number>) {
  const stations = station === "all"
    ? Array.from(new Set(order.items.map(i => getItemStation(i.name))))
    : [station];
  const mins = stations.map(s => targets[s] ?? DEFAULT_TARGETS[s] ?? targets.all ?? 20);
  return mins.length ? Math.max(...mins) : (targets[station] || targets.all || 20);
}

function toneFor(secs: number, targetMins: number): Tone {
  const pct = targetMins > 0 ? secs / (targetMins * 60) : 0;
  return pct >= 1 ? "late" : pct >= 0.7 ? "warn" : "ok";
}

/* ── Ticket ─────────────────────────────────────────────────────────────── */

function Ticket({
  order, now, station, target, action, onBump, onPrint,
}: {
  order: LiveOrder;
  now: number;
  station: string;
  target: number;
  action: { label: string; next: LiveOrder["status"]; icon: typeof Play; className: string } | null;
  onBump: (order: LiveOrder, next: LiveOrder["status"]) => void;
  onPrint: (order: LiveOrder) => void;
}) {
  const secs = elapsedSecs(order, now);
  const tone = toneFor(secs, target);
  const pct = Math.min(100, target > 0 ? (secs / (target * 60)) * 100 : 0);
  const TypeIcon = typeIcon(order.type);
  const items = station === "all" ? order.items : order.items.filter(i => getItemStation(i.name) === station);
  const ActionIcon = action?.icon;

  return (
    <article className={`relative overflow-hidden rounded-md border ${TONE[tone].card}`}>
      {/* The status stripe carries the time state at a glance, before any number
          has been read. It is the widest colour on the ticket on purpose. */}
      <span className={`absolute inset-y-0 left-0 w-1.5 ${TONE[tone].bar}`} aria-hidden />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <h3 className="truncate text-2xl font-semibold leading-none">{order.tableNo}</h3>
              {tone === "late" && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-danger px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-primary-foreground">
                  <AlertTriangle className="h-3 w-3" aria-hidden /> Late
                </span>
              )}
            </div>
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              #{order.id} · {order.guests} {order.guests === 1 ? "guest" : "guests"}
              {order.waiter ? ` · ${order.waiter}` : ""}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className={`font-mono text-2xl font-semibold leading-none tabular-nums ${TONE[tone].text}`}>
              {mmss(secs)}
            </p>
            <p className="mt-1.5 text-2xs tabular-nums text-muted-foreground">target {target}m</p>
          </div>
        </div>

        <div className="mt-2.5 h-1 overflow-hidden rounded-pill bg-muted" aria-hidden>
          <div className={`h-full ${TONE[tone].fill}`} style={{ width: `${pct}%` }} />
        </div>

        <ul className="mt-3 space-y-2">
          {items.map((item, i) => {
            const { removes, prefs } = splitCustomizations(item.customizations);
            const addons = Array.isArray(item.addons) ? item.addons : [];
            const hasExtras = addons.length > 0 || removes.length > 0 || prefs.length > 0 || !!item.variant || !!item.notes;
            const done = item.status === "ready";
            return (
              <li key={i} className="flex gap-2.5">
                <span
                  className={`mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums ${
                    done ? "bg-success-subtle text-success"
                      : item.status === "preparing" ? "bg-info-subtle text-info"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {item.qty}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-base leading-6 ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {item.name}
                    </span>
                    {station === "all" && (
                      <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                        {getItemStation(item.name)}
                      </span>
                    )}
                  </div>
                  {hasExtras && (
                    <div className="mt-1 space-y-0.5 border-l-2 border-border pl-2">
                      {item.variant && <p className="text-xs text-muted-foreground">{item.variant}</p>}
                      {addons.length > 0 && <p className="text-xs font-medium text-success">Add: {addons.map(a => a.name).join(", ")}</p>}
                      {removes.length > 0 && <p className="text-xs font-medium text-danger">No: {removes.join(", ")}</p>}
                      {prefs.length > 0 && <p className="text-xs font-medium text-info">{prefs.join(" · ")}</p>}
                      {item.notes && (
                        <p className="flex items-start gap-1 text-xs font-medium text-warning">
                          <StickyNote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {item.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {order.specialReq && (
          <p className="mt-3 flex items-start gap-1.5 rounded-md border border-warning-border bg-warning-subtle px-2.5 py-2 text-xs font-medium text-warning">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">{order.specialReq}</span>
          </p>
        )}

        {action && ActionIcon && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onBump(order, action.next)}
              className={`flex min-h-14 flex-1 items-center justify-center gap-2 rounded-md border text-base font-semibold transition-colors hover-elevate active-elevate-2 ${action.className}`}
            >
              <ActionIcon className="h-5 w-5" aria-hidden /> {action.label}
            </button>
            <button
              type="button"
              onClick={() => onPrint(order)}
              title="Print kitchen ticket"
              aria-label={`Print kitchen ticket for ${order.tableNo}`}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover-elevate active-elevate-2"
            >
              <Printer className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function KitchenDisplay() {
  const { liveOrders, updateOrderStatus, restaurantId } = useRestaurant();
  const [station, setStation] = useState("all");
  const [view, setView] = useState<"lanes" | "all" | "list">("lanes");
  const [lane, setLane] = useState<LaneKey>("new");
  const [soundOn, setSoundOn] = useState(true);
  const [priorityMode, setPriorityMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recallOrder, setRecallOrder] = useState<LiveOrder | null>(null);
  const [bumped, setBumped] = useState<LiveOrder[]>([]);
  const [targetTimes, setTargetTimes] = useState(DEFAULT_TARGETS);
  const [autoAccept, setAutoAccept] = useState(false);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const prevCount = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Everything above lived in this browser tab. A kitchen that set its grill target to
  // 25 minutes lost it on the next refresh, and a venue running two KDS screens had two
  // different sets of targets, so the same ticket went red on one and green on the other.
  const loadedPrefs = useRef(false);

  // One clock for the whole board. Every timer, every stripe and every "Late" badge
  // reads from it, so the colour of a ticket changes as the minute passes instead of
  // waiting for the next order poll — and there is one interval on the page, not one
  // per ticket.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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

  const active = useMemo(() => liveOrders.filter(isKitchenActive), [liveOrders]);

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
    const newCount = liveOrders.filter(o => isKitchenActive(o) && o.status === "new").length;
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

  /** Orders this station cares about, in board order. */
  const boardOrders = useMemo(() => {
    const filtered = station === "all"
      ? active
      : active.filter(o => o.items.some(i => getItemStation(i.name) === station));
    return sortKitchenOrders(filtered, priorityMode);
  }, [active, station, priorityMode]);

  function laneOrders(key: LaneKey) {
    return boardOrders.filter(o => o.status === key || (key === "new" && o.status === "accepted"));
  }

  function bump(order: LiveOrder, next: LiveOrder["status"]) {
    setBumped(p => [order, ...p.slice(0, 4)]);
    updateOrderStatus(order.id, next);
  }

  const laneAction = {
    new:       { label: "Start cooking", next: "preparing" as const, icon: Play,        className: "border-info-border bg-info-subtle text-info" },
    preparing: { label: "Mark ready",    next: "ready" as const,     icon: CheckCircle, className: "border-success-border bg-success-subtle text-success" },
    ready:     { label: "Served",        next: "served" as const,    icon: CheckCircle, className: "border-primary-border bg-primary text-primary-foreground" },
  } satisfies Record<LaneKey, { label: string; next: LiveOrder["status"]; icon: typeof Play; className: string }>;

  function actionFor(order: LiveOrder) {
    if (order.status === "new" || order.status === "accepted") return laneAction.new;
    if (order.status === "preparing") return laneAction.preparing;
    if (order.status === "ready") return laneAction.ready;
    return null;
  }

  const stats = useMemo(() => {
    const late = boardOrders.filter(o => toneFor(elapsedSecs(o, now), targetFor(o, station, targetTimes)) === "late").length;
    const avg = boardOrders.length
      ? Math.round(boardOrders.reduce((s, o) => s + elapsedSecs(o, now) / 60, 0) / boardOrders.length)
      : 0;
    return {
      total: boardOrders.length,
      queued: laneOrders("new").length,
      cooking: laneOrders("preparing").length,
      ready: laneOrders("ready").length,
      late,
      avg,
    };
    // `now` ticks every second; recomputing six counts over a board of tickets is cheap.
  }, [boardOrders, now, station, targetTimes]);

  const counters: { key: string; label: string; value: string; tone: string }[] = [
    { key: "total",   label: "On board", value: String(stats.total),   tone: "text-foreground" },
    { key: "queued",  label: "Queued",   value: String(stats.queued),  tone: "text-warning" },
    { key: "cooking", label: "Cooking",  value: String(stats.cooking), tone: "text-info" },
    { key: "ready",   label: "Ready",    value: String(stats.ready),   tone: "text-success" },
    { key: "late",    label: "Late",     value: String(stats.late),    tone: stats.late > 0 ? "text-danger" : "text-muted-foreground" },
    { key: "avg",     label: "Avg wait", value: `${stats.avg}m`,       tone: "text-foreground" },
  ];

  const iconBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors hover-elevate active-elevate-2";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden bg-background">
      {/* New-order flash — a pulsing frame so the kitchen notices even at a glance
          (and even when sound is muted). Non-blocking overlay. */}
      {flash && (
        <div className="pointer-events-none fixed inset-0 z-50 ring-8 ring-inset ring-primary motion-safe:animate-pulse" aria-hidden="true" />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────
          One row on a laptop, three short rows on a phone. Identity stays
          left, the counters take the middle, the controls stay right — so the
          chef's thumb always lands in the same place. */}
      <header className="shrink-0 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <ChefHat className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-sm font-semibold">Kitchen Display</h1>
              <p className="flex items-center gap-1 text-2xs text-success">
                <span className="h-1.5 w-1.5 rounded-pill bg-success motion-safe:animate-pulse" aria-hidden />
                Live · {STATION_LABEL[station] ?? station}
              </p>
            </div>
          </div>

          {/* Counters: full-width band under the title on a tablet in portrait,
              inline between title and controls from lg up. */}
          <dl className="order-last grid w-full grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-6 lg:order-none lg:w-auto lg:flex-1 lg:border-0 lg:bg-transparent lg:gap-2">
            {counters.map(c => (
              <div key={c.key} className="flex items-baseline justify-center gap-1.5 bg-card px-2 py-1.5 lg:rounded-md lg:border lg:border-border">
                <span className={`text-lg font-semibold tabular-nums ${c.tone}`}>{c.value}</span>
                <span className="text-2xs uppercase tracking-wide text-muted-foreground">{c.label}</span>
              </div>
            ))}
          </dl>

          <div className="ml-auto flex min-w-0 max-w-full shrink-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5">
            <button
              type="button"
              onClick={() => { const v = !priorityMode; setPriorityMode(v); savePref({ priorityMode: v }); }}
              aria-pressed={priorityMode}
              title="Rush mode — oldest ticket first"
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors hover-elevate active-elevate-2 ${
                priorityMode ? "border-danger-border bg-danger-subtle text-danger" : "border-border bg-card text-muted-foreground"
              }`}
            >
              <Flame className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Rush</span>
            </button>

            <button
              type="button"
              onClick={() => { const v = !soundOn; setSoundOn(v); savePref({ soundOn: v }); }}
              aria-pressed={soundOn}
              aria-label={soundOn ? "Mute new-order alert" : "Unmute new-order alert"}
              className={`${iconBtn} ${soundOn ? "border-primary-border bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground"}`}
            >
              {soundOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
            </button>

            <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
              {([
                { id: "lanes", label: "Lanes", icon: Rows3 },
                { id: "all",   label: "All",   icon: LayoutGrid },
                { id: "list",  label: "List",  icon: List },
              ] as const).map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  aria-pressed={view === v.id}
                  aria-label={v.label}
                  title={v.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                    view === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover-elevate"
                  }`}
                >
                  <v.icon className="h-4 w-4" aria-hidden />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => bumped.length > 0 && setRecallOrder(bumped[0])}
              disabled={bumped.length === 0}
              title="Bring the last bumped ticket back"
              className={`${iconBtn} relative border-border bg-card text-muted-foreground disabled:opacity-40`}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              <span className="sr-only">Recall last ticket</span>
              {bumped.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-primary px-1 text-2xs font-semibold text-primary-foreground tabular-nums">
                  {bumped.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="Kitchen display settings"
              className={`${iconBtn} border-border bg-card text-muted-foreground`}
            >
              <Settings className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Station strip — each chip carries its own prep target, because the
            target is what the colour on every ticket is measured against and it
            was previously buried two taps deep in a settings dialog. */}
        <div className="flex min-w-0 max-w-full gap-1.5 overflow-x-auto overscroll-x-contain border-t border-border px-3 py-2 no-scrollbar">
          {STATIONS.map(s => {
            const Icon = s.icon;
            const on = station === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStation(s.id)}
                aria-pressed={on}
                className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors hover-elevate active-elevate-2 ${
                  on ? "border-primary-border bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {s.label}
                {s.id !== "all" && (
                  <span className={`text-2xs tabular-nums ${on ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {targetTimes[s.id] ?? DEFAULT_TARGETS[s.id]}m
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Board ──────────────────────────────────────────────────────────── */}
      {boardOrders.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ChefHat className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">
            {station === "all" ? "Nothing on the pass" : `Nothing for ${STATION_LABEL[station] ?? station}`}
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            New dine-in, room and online orders appear here the moment they are placed — from the guest QR menu or the waiter Take order screen. Served, billed
            and cancelled tickets are cleared off the board.
          </p>
          {station !== "all" && (
            <button
              type="button"
              onClick={() => setStation("all")}
              className="mt-4 inline-flex min-h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold hover-elevate active-elevate-2"
            >
              Show all stations
            </button>
          )}
        </div>
      ) : view === "lanes" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Below 768px three lanes side by side is unreadable, so the lanes
              become one tab strip and one column. Above it, all three at once. */}
          <div className="flex shrink-0 gap-1 border-b border-border bg-card px-3 py-2 md:hidden">
            {LANES.map(l => {
              const count = laneOrders(l.key).length;
              const on = lane === l.key;
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLane(l.key)}
                  aria-pressed={on}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border text-sm font-semibold transition-colors ${
                    on ? "border-primary-border bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-pill ${l.dot}`} aria-hidden />
                  {l.short}
                  <span className="tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 divide-border md:grid-cols-3 md:divide-x">
            {LANES.map(l => {
              const orders = laneOrders(l.key);
              return (
                <section
                  key={l.key}
                  className={`min-h-0 flex-col ${lane === l.key ? "flex" : "hidden md:flex"}`}
                  aria-label={l.label}
                >
                  <div className="hidden shrink-0 items-center justify-between border-b border-border px-3 py-2 md:flex">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-pill ${l.dot}`} aria-hidden />
                      <span className={`text-sm font-semibold ${l.text}`}>{l.label}</span>
                    </span>
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-pill bg-muted px-1.5 text-xs font-semibold tabular-nums text-foreground">
                      {orders.length}
                    </span>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 custom-scrollbar">
                    {orders.length === 0 ? (
                      <p className="px-2 py-10 text-center text-sm text-muted-foreground">All clear</p>
                    ) : orders.map(order => (
                      <Ticket
                        key={order.id}
                        order={order}
                        now={now}
                        station={station}
                        target={targetFor(order, station, targetTimes)}
                        action={actionFor(order)}
                        onBump={bump}
                        onPrint={printKot}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : view === "all" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
          {/* One flow of every live ticket, oldest or newest first per Rush. What an
              expo wants mid-service: no lane to look across, just the next thing. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {boardOrders.map(order => (
              <Ticket
                key={order.id}
                order={order}
                now={now}
                station={station}
                target={targetFor(order, station, targetTimes)}
                action={actionFor(order)}
                onBump={bump}
                onPrint={printKot}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
          {/* The manager's read: every ticket on one line, wide table scrolling
              inside its own frame rather than taking the page sideways. */}
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-border">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">Table</th>
                  <th scope="col" className="px-3 py-2 font-medium">Order</th>
                  <th scope="col" className="px-3 py-2 font-medium">Items</th>
                  <th scope="col" className="px-3 py-2 font-medium">Stations</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Elapsed</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {boardOrders.map(order => {
                  const t = targetFor(order, station, targetTimes);
                  const secs = elapsedSecs(order, now);
                  const tone = toneFor(secs, t);
                  const action = actionFor(order);
                  const laneOf = order.status === "preparing" ? LANES[1] : order.status === "ready" ? LANES[2] : LANES[0];
                  return (
                    <tr key={order.id} className={tone === "late" ? "bg-danger-subtle" : "bg-card"}>
                      <td className="px-3 py-2.5 text-base font-semibold">{order.tableNo}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">#{order.id}</td>
                      <td className="max-w-[18rem] truncate px-3 py-2.5 text-muted-foreground">
                        {order.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {Array.from(new Set(order.items.map(i => getItemStation(i.name)))).map(st => (
                            <span key={st} className="rounded-md bg-muted px-1.5 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground">{st}</span>
                          ))}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${laneOf.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-pill ${laneOf.dot}`} aria-hidden />{laneOf.label}
                        </span>
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right font-mono text-base font-semibold tabular-nums ${TONE[tone].text}`}>
                        {mmss(secs)}
                        <span className="ml-1 text-2xs font-normal text-muted-foreground">/{t}m</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {action && (
                          <button
                            type="button"
                            onClick={() => bump(order, action.next)}
                            className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-semibold transition-colors hover-elevate active-elevate-2 ${action.className}`}
                          >
                            {action.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Settings ───────────────────────────────────────────────────────
          Header and footer are pinned; only the middle scrolls, so the Done
          button cannot be pushed off a 768px-tall tablet. */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Kitchen display settings"
            className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-md border border-border bg-card sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-md"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Settings className="h-4 w-4 text-primary" aria-hidden /> Kitchen display settings
              </h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover-elevate"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 custom-scrollbar">
              <section className="space-y-2">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Target prep time (minutes)</h3>
                <p className="text-xs text-muted-foreground">
                  A ticket turns amber at 70% of its target and red past it. Tickets are timed against the
                  slowest station they contain.
                </p>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {Object.entries(targetTimes).filter(([k]) => k !== "all").map(([st, mins]) => (
                    <li key={st} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-sm">{STATION_LABEL[st] ?? st}</span>
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Decrease ${STATION_LABEL[st] ?? st} target`}
                          onClick={() => { const v = Math.max(3, mins - 1); setTargetTimes(t => ({ ...t, [st]: v })); savePref({ targetTimes: { [st]: v } }); }}
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover-elevate active-elevate-2"
                        >
                          <Minus className="h-4 w-4" aria-hidden />
                        </button>
                        <span className="w-10 text-center text-sm font-semibold tabular-nums">{mins}m</span>
                        <button
                          type="button"
                          aria-label={`Increase ${STATION_LABEL[st] ?? st} target`}
                          onClick={() => { const v = mins + 1; setTargetTimes(t => ({ ...t, [st]: v })); savePref({ targetTimes: { [st]: v } }); }}
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover-elevate active-elevate-2"
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Options</h3>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {([
                    { key: "soundOn" as const,    label: "Sound alert on a new order", hint: "Three rising tones, loud enough for a kitchen.", val: soundOn,    set: setSoundOn },
                    { key: "autoAccept" as const, label: "Auto-accept new orders",     hint: "Skip the acknowledge step and go straight to the queue.", val: autoAccept, set: setAutoAccept },
                  ]).map(({ key, label, hint, val, set }) => (
                    <li key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-sm">{label}</span>
                        <span className="block text-xs text-muted-foreground">{hint}</span>
                      </span>
                      <Switch
                        checked={val}
                        aria-label={label}
                        onCheckedChange={v => { set(v); savePref({ [key]: v }); }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="shrink-0 space-y-2 border-t border-border p-4">
              {/* Each control saves as it is changed, so this only closes the panel —
                  calling it "Save Settings" implied nothing had been saved until now. */}
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="min-h-12 w-full rounded-md border border-primary-border bg-primary text-sm font-semibold text-primary-foreground hover-elevate active-elevate-2"
              >
                Done
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Saved for this venue — every kitchen screen sees the same targets.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Recall ─────────────────────────────────────────────────────────── */}
      {recallOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Recall order"
            className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-md border border-border bg-card sm:max-h-[calc(100dvh-2rem)] sm:max-w-sm sm:rounded-md"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <RotateCcw className="h-4 w-4 text-primary" aria-hidden /> Recall ticket
              </h2>
              <button
                type="button"
                onClick={() => setRecallOrder(null)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover-elevate"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="rounded-md border border-border bg-muted p-3">
                <p className="text-base font-semibold">{recallOrder.tableNo} · #{recallOrder.id}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {recallOrder.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
                </p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">This puts the ticket back on the cooking lane.</p>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={() => setRecallOrder(null)}
                className="min-h-12 flex-1 rounded-md border border-border bg-card text-sm font-semibold hover-elevate active-elevate-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { updateOrderStatus(recallOrder.id, "preparing"); setRecallOrder(null); }}
                className="min-h-12 flex-1 rounded-md border border-primary-border bg-primary text-sm font-semibold text-primary-foreground hover-elevate active-elevate-2"
              >
                Recall
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
