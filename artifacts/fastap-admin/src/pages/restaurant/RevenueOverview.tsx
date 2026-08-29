import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { restaurantApi } from "@/lib/api";
import { TrendingUp, CalendarRange, Loader2, ShoppingBag, Utensils, Leaf, BedDouble, Wine, Package, CreditCard, Smartphone, Banknote, Wallet, User, X } from "lucide-react";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const fmt = (n: number | undefined) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const SOURCE_ICON: Record<string, typeof Utensils> = {
  "Restaurant / POS": Utensils,
  "Room Service": BedDouble,
  "Bar": Wine,
  "Spa": Leaf,
  "Takeaway": ShoppingBag,
  "Delivery": Package,
  "Events & Banquet": Package,
};
const METHOD_ICON: Record<string, typeof Banknote> = {
  Cash: Banknote, UPI: Smartphone, Card: CreditCard, Wallet: Wallet, "Room bill": BedDouble,
};
const TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in", dinein: "Dine-in", room_service: "Room Service", takeaway: "Takeaway",
  delivery: "Delivery", bar: "Bar", banquet: "Banquet", pickup: "Pickup",
};
const BAR_COLORS = ["bg-amber-500", "bg-cyan-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500", "bg-blue-500", "bg-orange-500"];

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
  const CANON = ["Restaurant / POS", "Room Service", "Bar", "Takeaway", "Delivery", "Events & Banquet", "Spa"];
  const rows = CANON.map(label => {
    const found = (data?.bySource ?? []).find(s => s.label === label);
    const amount = found?.amount ?? (label === "Spa" ? (data?.spaRevenue ?? 0) : label === "Events & Banquet" ? (data?.banquetRevenue ?? 0) : 0);
    return { label, amount, count: found?.count ?? 0 };
  });

  return (
    <div className="p-4 lg:p-6 space-y-5 text-white">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-amber-400" /> Revenue Overview</h1>
          <p className="text-xs text-white/40">Poora revenue breakdown — kis panel se kitna, kis method se kitna, sab kuch.</p>
        </div>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => applyPreset(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${preset === p.key ? "bg-amber-500 text-black border-amber-500" : "border-white/10 bg-white/5 text-white/50 hover:text-white"}`}>{p.label}</button>
        ))}
        <button onClick={() => setPreset("custom")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all ${preset === "custom" ? "bg-amber-500 text-black border-amber-500" : "border-white/10 bg-white/5 text-white/50 hover:text-white"}`}><CalendarRange className="h-3.5 w-3.5" /> Custom</button>
        {preset === "custom" && (
          <div className="flex items-center gap-1.5">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs [color-scheme:dark]" />
            <span className="text-white/30 text-xs">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs [color-scheme:dark]" />
          </div>
        )}
      </div>

      {/* Grand total */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/20 p-5">
        <p className="text-xs text-white/50">Total revenue {isAll ? "(all time)" : `(${from} → ${to})`}</p>
        <p className="text-4xl font-extrabold text-amber-400 mt-1">{fmt(total)}</p>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <span className="text-white/70"><Utensils className="h-3.5 w-3.5 inline mb-0.5 text-cyan-400" /> Orders: <b>{fmt(data?.orderRevenue)}</b></span>
          <span className="text-white/70"><Leaf className="h-3.5 w-3.5 inline mb-0.5 text-emerald-400" /> Spa: <b>{fmt(data?.spaRevenue)}</b></span>
          {(data?.banquetRevenue ?? 0) > 0 && <span className="text-white/70"><Package className="h-3.5 w-3.5 inline mb-0.5 text-violet-400" /> Events: <b>{fmt(data?.banquetRevenue)}</b></span>}
          <span className="text-white/40">· {data?.totalOrders ?? 0} paid orders</span>
        </div>
      </div>

      {/* Full revenue table — every source in one place */}
      <div className="rounded-2xl bg-[#0e1520] border border-white/8 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8">
          <h2 className="text-sm font-bold">Revenue by source — full table</h2>
          <p className="text-[11px] text-white/40">Orders · Cashier/POS · Room Service · Bar · Spa · Events — sab ek jagah</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/40 border-b border-white/5 bg-white/[0.02]">
                <th className="px-4 py-2.5 font-medium">Source / Panel</th>
                <th className="px-4 py-2.5 font-medium text-right">Orders</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map(r => {
                const Icon = SOURCE_ICON[r.label] || Utensils;
                const clickable = r.amount > 0;
                return (
                  <tr key={r.label} onClick={() => clickable && setDrill({ kind: "source", value: r.label })} title={clickable ? "Click to see payments" : undefined} className={`${r.amount > 0 ? "" : "opacity-45"} ${clickable ? "cursor-pointer hover:bg-white/5" : ""} transition-colors`}>
                    <td className="px-4 py-2.5"><span className="flex items-center gap-2"><Icon className="h-4 w-4 text-white/40" /> {r.label}{clickable && <span className="text-white/25 text-xs">›</span>}</span></td>
                    <td className="px-4 py-2.5 text-right text-white/60">{r.label === "Spa" ? "—" : r.count}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-400">{fmt(r.amount)}</td>
                    <td className="px-4 py-2.5 text-right text-white/50">{pct(r.amount)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-white/15 font-bold bg-white/[0.03]">
                <td className="px-4 py-3">Total revenue</td>
                <td className="px-4 py-3 text-right text-white/60">{data?.totalOrders ?? 0}</td>
                <td className="px-4 py-3 text-right text-amber-400 text-base">{fmt(total)}</td>
                <td className="px-4 py-3 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* By source / panel */}
      <Section title="By panel / source" subtitle="Kis panel se kitna revenue aaya">
        {(data?.bySource ?? []).length === 0 ? <Empty /> : (data?.bySource ?? []).map((s, i) => {
          const Icon = SOURCE_ICON[s.label] || Utensils;
          return (
            <div key={s.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-white/50" /> {s.label} {s.count > 0 && <span className="text-white/30 text-xs">· {s.count}</span>}</span>
                <span className="font-bold">{fmt(s.amount)} <span className="text-white/40 text-xs font-normal">({pct(s.amount)}%)</span></span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} style={{ width: `${pct(s.amount)}%` }} />
              </div>
            </div>
          );
        })}
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        {/* By payment method — every method used across the whole restaurant */}
        <Section title="By payment method" subtitle="UPI · Cash · Card · Wallet · Room bill · Aggregator — sab">
          {(() => {
            const CANON_M = ["Cash", "UPI", "Card", "Wallet", "Room bill", "Aggregator"];
            const map = new Map((data?.byMethod ?? []).map(m => [m.method, m]));
            const extras = (data?.byMethod ?? []).filter(m => !CANON_M.includes(m.method));
            const mrows = [...CANON_M.map(method => map.get(method) ?? { method, amount: 0, count: 0 }), ...extras];
            return mrows.map(m => {
              const Icon = METHOD_ICON[m.method] || Banknote;
              const clickable = m.count > 0;
              return (
                <div key={m.method} onClick={() => clickable && setDrill({ kind: "method", value: m.method })} className={`flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5 text-sm ${clickable ? "cursor-pointer hover:border-amber-500/30" : "opacity-45"} transition-colors`}>
                  <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-white/50" /> {m.method} <span className="text-white/30 text-xs">· {m.count}</span>{clickable && <span className="text-white/25 text-xs">›</span>}</span>
                  <span className="font-bold">{fmt(m.amount)}</span>
                </div>
              );
            });
          })()}
        </Section>

        {/* By order type */}
        <Section title="By order type" subtitle={`Orders · ${fmt(data?.orderRevenue)}`}>
          {(data?.byType ?? []).length === 0 ? <Empty /> : (data?.byType ?? []).map(t => (
            <div key={t.type} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5 text-sm">
              <span className="capitalize">{TYPE_LABEL[t.type] || t.type.replace(/_/g, " ")} <span className="text-white/30 text-xs">· {t.count}</span></span>
              <span className="font-bold">{fmt(t.amount)}</span>
            </div>
          ))}
        </Section>
      </div>

      {/* Collected by — kisne (kis panel/staff) kitna collect kiya */}
      <Section title="Collected by" subtitle="Kisne (kis staff/panel) kitna payment collect kiya">
        {(data?.byCollector ?? []).length === 0 ? <Empty /> : (data?.byCollector ?? []).map(c => (
          <div key={c.collector} onClick={() => setDrill({ kind: "collector", value: c.collector })} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5 text-sm cursor-pointer hover:border-amber-500/30 transition-colors">
            <span className="flex items-center gap-2"><User className="h-4 w-4 text-white/50" /> {c.collector} <span className="text-white/30 text-xs">· {c.count}</span><span className="text-white/25 text-xs">›</span></span>
            <span className="font-bold">{fmt(c.amount)}</span>
          </div>
        ))}
      </Section>

      <p className="text-[11px] text-white/30">Tip: kisi bhi panel/source row pe <b>click</b> karo → us panel ke saare individual payments (order, amount, method, kisne collect kiya) dikhenge. "By panel" total = grand total ({fmt(total)}). Same paid-order rule sab jagah.</p>

      {/* Drill-down: payments for the clicked source */}
      {drill && (() => {
        const list = (data?.payments ?? []).filter(p => (drill.kind === "source" ? p.source : drill.kind === "collector" ? p.collector : p.method) === drill.value);
        const sum = list.reduce((s, p) => s + p.amount, 0);
        const kindLabel = drill.kind === "source" ? "panel" : drill.kind === "collector" ? "collected by" : "method";
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setDrill(null); setExpandedPay(null); }}>
            <div className="w-full max-w-lg bg-[#111827] rounded-2xl border border-white/10 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-[#111827]">
                <div>
                  <h3 className="font-bold">{drill.value} <span className="text-white/40 text-xs font-normal">· {kindLabel}</span></h3>
                  <p className="text-xs text-white/40">{list.length} payment{list.length !== 1 ? "s" : ""} · {fmt(sum)}</p>
                </div>
                <button onClick={() => setDrill(null)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
              </div>
              <div className="p-3 space-y-2">
                {list.length === 0 ? <p className="text-sm text-white/30 py-6 text-center">Is panel me abhi koi payment nahi.</p> : list.map(p => {
                  const open = expandedPay === p.id;
                  return (
                  <div key={p.id} onClick={() => setExpandedPay(open ? null : p.id)} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 cursor-pointer hover:border-amber-500/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{p.orderNumber}{p.tableName ? ` · ${p.tableName}` : ""}</span>
                      <span className="text-amber-400 font-bold">{fmt(p.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">{p.method}</span>
                      {p.customerName && <span className="text-white/50">{p.customerName}</span>}
                      <span className="text-white/40">collected by: <b className="text-white/70">{p.collector}</b></span>
                      <span className="text-white/25 ml-auto">{open ? "▲" : "▼"}</span>
                    </div>
                    {open && (
                      <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                        {[["Panel", p.source], ["Type", p.type], ["Amount", fmt(p.amount)], ["Method", p.method], ["Collected by", p.collector], ["Guest", p.customerName || "—"], ["Table", p.tableName || "—"], ["UPI ID", p.upiId || "—"], ["UTR / Ref", p.utr || "—"], ["Time", p.at ? new Date(p.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"]].map(([k, v]) => (
                          <div key={k}><span className="text-white/35">{k}: </span><span className="text-white/75 capitalize">{v}</span></div>
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
    <div className="rounded-2xl bg-[#0e1520] border border-white/8 p-4 space-y-3">
      <div><h2 className="text-sm font-bold">{title}</h2>{subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
function Empty() { return <p className="text-sm text-white/30 py-4 text-center">No revenue in this range.</p>; }
