import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { api } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { Activity } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

function FeedSection({ title, items, render }: { title: string; items: any[]; render: (item: any) => React.ReactNode }) {
  return (
    <PanelCard title={title} action={<Badge variant="secondary" className="text-xs">{items.length} live</Badge>}>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p> : items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
            {render(item)}
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

export default function LiveMonitoring() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["live-feed"],
    queryFn: api.liveFeed.get,
    refetchInterval: 15_000,
  });

  const rel = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  return (
    <PageShell
      title="Live Monitoring"
      description="Real-time orders, payments, refunds, settlements, and support — auto-refreshes every 15s."
      icon={<Activity className="h-6 w-6" />}
      accent="cyan"
      badge={<span className="flex items-center gap-1.5 text-xs"><span className="admin-glow-dot" /> Live</span>}
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      actions={<Link href="/dashboard"><Button size="sm" variant="outline" className="rounded-xl">Dashboard</Button></Link>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FeedSection title="Live Orders" items={data?.orders ?? []} render={o => (
          <>
            <div>
              <span className="font-mono text-xs text-primary">{o.id}</span>
              {o.vendor && <p className="text-xs font-medium text-foreground truncate max-w-[9rem]">{o.vendor}</p>}
              <p className="text-xs text-muted-foreground">{o.tableName ? `${o.tableName} · ` : ""}{rel(o.at)}</p>
            </div>
            <div className="text-right"><p className="font-semibold">{fmtINRFull(o.amount)}</p><StatusBadge status={o.status} /></div>
          </>
        )} />
        <FeedSection title="Live Payments" items={data?.payments ?? []} render={p => (
          <>
            <div><span className="font-mono text-xs">{p.id}</span><p className="text-xs text-muted-foreground">{p.vendor}</p></div>
            <div className="text-right"><p className="font-semibold text-emerald-500">{fmtINRFull(p.amount)}</p><StatusBadge status={p.status} /></div>
          </>
        )} />
        <FeedSection title="Live Refunds" items={data?.refunds ?? []} render={r => (
          <>
            <div><span className="text-xs">{r.vendor}</span><p className="text-xs text-muted-foreground">{rel(r.at)}</p></div>
            <div className="text-right"><p className="font-semibold text-rose-500">{fmtINRFull(r.amount)}</p></div>
          </>
        )} />
        <FeedSection title="Settlements" items={data?.settlements ?? []} render={s => (
          <>
            <div><span className="text-xs font-medium">{s.vendor}</span></div>
            <StatusBadge status={s.status} />
          </>
        )} />
        <FeedSection title="Support Tickets" items={data?.tickets ?? data?.support ?? []} render={t => (
          <>
            <div>
              <span className="font-mono text-xs">{t.id}</span>
              <p className="text-xs truncate max-w-[140px]">{t.subject}</p>
            </div>
            <Badge variant="outline" className="text-xs capitalize">{t.priority ?? t.status ?? "open"}</Badge>
          </>
        )} />
        <FeedSection title="Platform Activity" items={data?.activity ?? data?.system ?? []} render={a => (
          <>
            <div>
              <span className="text-xs font-medium">{a.action ?? a.event}</span>
              <p className="text-xs text-muted-foreground">{a.user ?? a.module ?? "system"}</p>
            </div>
            <span className="text-xs text-muted-foreground">{rel(a.at)}</span>
          </>
        )} />
      </div>
    </PageShell>
  );
}
