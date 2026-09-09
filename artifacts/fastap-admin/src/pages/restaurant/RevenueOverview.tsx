import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { restaurantApi } from "@/lib/api";
import { TrendingUp, CalendarRange, Loader2, ShoppingBag, Utensils, Leaf, BedDouble, Wine, Package, CreditCard, Smartphone, Banknote, Wallet, User, X, Hotel, ChevronRight, PartyPopper, Bike } from "lucide-react";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const fmt = (n: number | undefined) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const SOURCE_ICON: Record<string, typeof Utensils> = {
  "Restaurant / POS": Utensils,
  "Room Service": BedDouble,
  "Hotel / Rooms": Hotel,
  "Bar": Wine,
  "Spa": Leaf,
  "Takeaway": ShoppingBag,
  "Delivery": Bike,
  "Events & Banquet": PartyPopper,
};

// One accent per panel so the owner can tell them apart at a glance.
const SOURCE_TONE: Record<string, { bg: string; text: string; bar: string }> = {
  "Restaurant / POS": { bg: "bg-primary/15", text: "text-primary", bar: "bg-primary" },
  "Hotel / Rooms": { bg: "bg-info-subtle", text: "text-info", bar: "bg-info" },
  "Room Service": { bg: "bg-info-subtle", text: "text-info", bar: "bg-info" },
  "Bar": { bg: "bg-muted", text: "text-muted-foreground", bar: "bg-muted" },
  "Spa": { bg: "bg-success-subtle", text: "text-success", bar: "bg-success" },
  "Takeaway": { bg: "bg-warning-subtle", text: "text-warning", bar: "bg-warning" },
  "Delivery": { bg: "bg-info-subtle", text: "text-info", bar: "bg-info" },
  "Events & Banquet": { bg: "bg-muted", text: "text-muted-foreground", bar: "bg-muted" },
};
const DEFAULT_TONE = { bg: "bg-muted", text: "text-muted-foreground", bar: "bg-muted" };
const METHOD_ICON: Record<string, typeof Banknote> = {
  Cash: Banknote, UPI: Smartphone, Card: CreditCard, Wallet: Wallet, "Room bill": BedDouble,
};
const TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in", dinein: "Dine-in", room_service: "Room Service", takeaway: "Takeaway",
  delivery: "Delivery", bar: "Bar", banquet: "Banquet", pickup: "Pickup",
};
const BAR_COLORS = ["bg-primary", "bg-info", "bg-muted", "bg-success", "bg-danger", "bg-info", "bg-warning"];

export default function RevenueOverview() {
  const { restaurantId } = useRestaurant();
  const today = new Date();
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const PRESETS = [
    { key: "today", label: "Today", from: ymd(today), to: ymd(today) },
    { key: "7d", label: "7 days", from: ymd(daysAgo(6)), to: ymd(today) },
    { key: "15d", label: "15 days", from: ymd(daysAgo(14)), to: ymd(today) },
    { key: "30d", label: "30 days", from: ymd(daysAgo(29)), to: ymd(today) },
    { key: "all", label: "All time", from: undefined as string | undefined, to: undefined as string | undefined },
  ];
  const [preset, setPreset] = useState("today");
  const [drill, setDrill] = useState<{ kind: "source" | "collector" | "method"; value: string } | null>(null);
  const [expandedPay, setExpandedPay] = useState<string | null>(null);
  const [from, setFrom] = useState(ymd(today));
  const [to, setTo] = useState(ymd(today));
  const isAll = preset === "all";
  const params = isAll ? {} : { from, to };

  const { data, isFetching } = useQuery({
    queryKey: ["revenue-breakdown", restaurantId, isAll ? "all" : from, isAll ? "all" : to],
    queryFn: () => restaurantApi.revenueBreakdown(Number(restaurantId), params),
    enabled: !!restaurantId,
    refetchInterval: 15000,
    staleTime: 0,
  });

  function applyPreset(p: typeof PRESETS[0]) {
    setPreset(p.key);
    if (p.from) setFrom(p.from);
    if (p.to) setTo(p.to);
  }

  const total = data?.total ?? 0;
  const pct = (a: number) => (total > 0 ? Math.round((a / total) * 100) : 0);

  // Full canonical panel list so the table always shows every source (even ₹0 ones).
  const CANON = ["Restaurant / POS", "Hotel / Rooms", "Room Service", "Bar", "Takeaway", "Delivery", "Events & Banquet", "Spa"];
  const rows = CANON.map(label => {
    const found = (data?.bySource ?? []).find(s => s.label === label);
    const fallback = label === "Spa" ? (data?.spaRevenue ?? 0)
      : label === "Events & Banquet" ? (data?.banquetRevenue ?? 0)
      : label === "Hotel / Rooms" ? (data?.roomRevenue ?? 0)
      : 0;
    return { label, amount: found?.amount ?? fallback, count: found?.count ?? 0 };
  })
    // Earning panels first, empty ones after — the owner cares about what made money.
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="p-4 lg:p-6 space-y-5 text-foreground">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Revenue Overview</h1>
          <p className="text-xs text-muted-foreground">Full revenue breakdown — by panel, by payment method, everything.</p>
        </div>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => applyPreset(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${preset === p.key ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}>{p.label}</button>
        ))}
        <button onClick={() => setPreset("custom")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-colors ${preset === "custom" ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}><CalendarRange className="h-3.5 w-3.5" /> Custom</button>
        {preset === "custom" && (
          <div className="flex items-center gap-1.5">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-muted border border-border rounded-lg px-2 py-1.5 text-xs [color-scheme:dark]" />
            <span className="text-muted-foreground text-xs">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-muted border border-border rounded-lg px-2 py-1.5 text-xs [color-scheme:dark]" />
          </div>
        )}
      </div>

      {/* Grand total */}
      <div className="rounded-lg bg-primary/10 border border-primary/20 p-5">
        <p className="text-xs text-muted-foreground">Total revenue {isAll ? "(all time)" : `(${from} → ${to})`}</p>
        <p className="text-4xl font-semibold text-primary mt-1">{fmt(total)}</p>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <span className="text-foreground"><Utensils className="h-3.5 w-3.5 inline mb-0.5 text-info" /> Orders: <b>{fmt(data?.orderRevenue)}</b></span>
          <span className="text-foreground"><Leaf className="h-3.5 w-3.5 inline mb-0.5 text-success" /> Spa: <b>{fmt(data?.spaRevenue)}</b></span>
          {(data?.roomRevenue ?? 0) > 0 && <span className="text-foreground"><Hotel className="h-3.5 w-3.5 inline mb-0.5 text-info" /> Rooms: <b>{fmt(data?.roomRevenue)}</b></span>}
          {(data?.banquetRevenue ?? 0) > 0 && <span className="text-foreground"><PartyPopper className="h-3.5 w-3.5 inline mb-0.5 text-muted-foreground" /> Events: <b>{fmt(data?.banquetRevenue)}</b></span>}
          <span className="text-muted-foreground">· {data?.totalOrders ?? 0} paid orders</span>
        </div>
      </div>

      {/* Every panel as its own card — amount, share of the day, and a tap for detail */}
      <div>
        <div className="flex items-end justify-between mb-2.5">
          <div>
            <h2 className="text-sm font-semibold">Revenue by panel</h2>
            <p className="text-2xs text-muted-foreground">Restaurant · Hotel rooms · Room service · Bar · Spa · Events — where each rupee came from</p>
          </div>
          <span className="text-2xs text-muted-foreground">Tap any card for the full breakdown</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(r => {
            const Icon = SOURCE_ICON[r.label] || Utensils;
            const tone = SOURCE_TONE[r.label] ?? DEFAULT_TONE;
            const clickable = r.amount > 0;
            return (
              <button
                key={r.label}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setDrill({ kind: "source", value: r.label })}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  clickable
                    ? "bg-card border-border hover:border-border hover:-translate-y-0.5 cursor-pointer"
                    : "bg-card border-border opacity-50 cursor-default"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone.bg}`}>
                      <Icon className={`h-4 w-4 ${tone.text}`} />
                    </span>
                    <span className="text-sm font-semibold truncate">{r.label}</span>
                  </span>
                  {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />}
                </div>

                <p className={`text-2xl font-semibold mt-3 ${clickable ? tone.text : "text-muted-foreground"}`}>{fmt(r.amount)}</p>

                <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${tone.bar} transition-colors`} style={{ width: `${pct(r.amount)}%` }} />
                </div>
                <div className="flex items-center justify-between text-2xs text-muted-foreground mt-1.5">
                  <span>{r.count > 0 ? `${r.count} orders` : "—"}</span>
                  <span>{pct(r.amount)}% of total</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-lg bg-card border border-border px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Total revenue</span>
          <span className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">{data?.totalOrders ?? 0} paid orders</span>
            <span className="text-lg font-semibold text-primary">{fmt(total)}</span>
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* By payment method — every method used across the whole restaurant */}
        <Section title="By payment method" subtitle="UPI · Cash · Card · Wallet · Room bill · Aggregator">
          {(() => {
            const CANON_M = ["Cash", "UPI", "Card", "Wallet", "Room bill", "Aggregator"];
            const map = new Map((data?.byMethod ?? []).map(m => [m.method, m]));
            const extras = (data?.byMethod ?? []).filter(m => !CANON_M.includes(m.method));
            const mrows = [...CANON_M.map(method => map.get(method) ?? { method, amount: 0, count: 0 }), ...extras];
            return mrows.map(m => {
              const Icon = METHOD_ICON[m.method] || Banknote;
              const clickable = m.count > 0;
              return (
                <div key={m.method} onClick={() => clickable && setDrill({ kind: "method", value: m.method })} className={`flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2.5 text-sm ${clickable ? "cursor-pointer hover:border-primary/30" : "opacity-45"} transition-colors`}>
                  <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /> {m.method} <span className="text-muted-foreground text-xs">· {m.count}</span>{clickable && <span className="text-muted-foreground text-xs">›</span>}</span>
                  <span className="font-semibold">{fmt(m.amount)}</span>
                </div>
              );
            });
          })()}
        </Section>

        {/* By order type */}
        <Section title="By order type" subtitle={`Orders · ${fmt(data?.orderRevenue)}`}>
          {(data?.byType ?? []).length === 0 ? <Empty /> : (data?.byType ?? []).map(t => (
            <div key={t.type} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2.5 text-sm">
              <span className="capitalize">{TYPE_LABEL[t.type] || t.type.replace(/_/g, " ")} <span className="text-muted-foreground text-xs">· {t.count}</span></span>
              <span className="font-semibold">{fmt(t.amount)}</span>
            </div>
          ))}
        </Section>
      </div>

      {/* Collected by — kisne (kis panel/staff) kitna collect kiya */}
      <Section title="Collected by" subtitle="Which staff / panel collected how much">
        {(data?.byCollector ?? []).length === 0 ? <Empty /> : (data?.byCollector ?? []).map(c => (
          <div key={c.collector} onClick={() => setDrill({ kind: "collector", value: c.collector })} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2.5 text-sm cursor-pointer hover:border-primary/30 transition-colors">
            <span className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {c.collector} <span className="text-muted-foreground text-xs">· {c.count}</span><span className="text-muted-foreground text-xs">›</span></span>
            <span className="font-semibold">{fmt(c.amount)}</span>
          </div>
        ))}
      </Section>

      <p className="text-2xs text-muted-foreground">Tip: <b>click</b> any panel / method / collector row to see its individual payments (order, amount, method, who collected). "By panel" total = grand total ({fmt(total)}). Same paid-order rule everywhere.</p>

      {/* Drill-down: payments for the clicked source */}
      {drill && (() => {
        const list = (data?.payments ?? []).filter(p => (drill.kind === "source" ? p.source : drill.kind === "collector" ? p.collector : p.method) === drill.value);
        const sum = list.reduce((s, p) => s + p.amount, 0);
        const kindLabel = drill.kind === "source" ? "panel" : drill.kind === "collector" ? "collected by" : "method";
        return (
          <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setDrill(null); setExpandedPay(null); }}>
            <div className="w-full max-w-lg bg-card rounded-lg border border-border max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
                <div>
                  <h3 className="font-semibold">{drill.value} <span className="text-muted-foreground text-xs font-normal">· {kindLabel}</span></h3>
                  <p className="text-xs text-muted-foreground">{list.length} payment{list.length !== 1 ? "s" : ""} · {fmt(sum)}</p>
                </div>
                <button onClick={() => setDrill(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
              </div>
              <div className="p-3 space-y-2">
                {list.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No payments here yet.</p> : list.map(p => {
                  const open = expandedPay === p.id;
                  return (
                  <div key={p.id} onClick={() => setExpandedPay(open ? null : p.id)} className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{p.orderNumber}{p.tableName ? ` · ${p.tableName}` : ""}</span>
                      <span className="text-primary font-semibold">{fmt(p.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-2xs">
                      <span className="px-1.5 py-0.5 rounded bg-info-subtle text-info">{p.method}</span>
                      {p.customerName && <span className="text-muted-foreground">{p.customerName}</span>}
                      <span className="text-muted-foreground">collected by: <b className="text-foreground">{p.collector}</b></span>
                      <span className="text-muted-foreground ml-auto">{open ? "▲" : "▼"}</span>
                    </div>
                    {open && (
                      <div className="mt-2 pt-2 border-t border-border grid grid-cols-2 gap-x-3 gap-y-1.5 text-2xs">
                        {[["Panel", p.source], ["Type", p.type], ["Amount", fmt(p.amount)], ["Method", p.method], ["Collected by", p.collector], ["Guest", p.customerName || "—"], ["Table", p.tableName || "—"], ["UPI ID", p.upiId || "—"], ["UTR / Ref", p.utr || "—"], ["Time", p.at ? new Date(p.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"]].map(([k, v]) => (
                          <div key={k}><span className="text-muted-foreground">{k}: </span><span className="text-foreground capitalize">{v}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                );})}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-card border border-border p-4 space-y-3">
      <div><h2 className="text-sm font-semibold">{title}</h2>{subtitle && <p className="text-2xs text-muted-foreground">{subtitle}</p>}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
function Empty() { return <p className="text-sm text-muted-foreground py-4 text-center">No revenue in this range.</p>; }
