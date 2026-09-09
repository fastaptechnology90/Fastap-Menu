import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageShell, PanelCard, EmptyState } from "@/components/shared/PageShell";
import { api } from "@/lib/apiClient";
import { Brain, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmtINR } from "@/lib/format";

export default function AIInsights() {
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["ai-insights"], queryFn: api.aiInsights.get, refetchInterval: 120000 });
  // `ai-insights` returns forecast as a summary object; the month-by-month series it is
  // drawn from is only exposed on the extended analytics endpoint.
  const { data: extended } = useQuery({ queryKey: ["analytics-extended"], queryFn: api.analytics.extended, refetchInterval: 120000 });

  const insights = data?.insights ?? [];
  const forecastSummary = data?.forecast;
  const forecastSeries = extended?.forecastData ?? [];
  const priorityColor = (p: string) => p === "high" ? "destructive" : p === "medium" ? "secondary" : "outline";

  return (
    <PageShell
      title="Business Insights"
      description="Churn signals, upsell prompts and vendor health, derived from live order and plan data."
      icon={<Brain className="h-6 w-6" />}
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
    >
      <div className="admin-stat-grid">
        <KpiCard title="Active insights" value={insights.length} icon={<Sparkles />} />
        <KpiCard title="Churn risk" value={data?.churnRisk?.length ?? 0} icon={<AlertTriangle />} subtitle="Vendors flagged" />
        <KpiCard title="Projected takings" value={forecastSummary ? fmtINR(forecastSummary.projectedRevenue) : "—"} icon={<TrendingUp />} subtitle="Straight-line, six months out" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <PanelCard title="Projected takings" description="A straight-line projection, not a measurement" className="lg:col-span-2">
          <div className="h-[200px]">
            {forecastSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastSeries}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => fmtINR(v)} />
                  <Tooltip formatter={(v: number) => [fmtINR(v), "Forecast"]} />
                  <Area type="monotone" dataKey="forecast" stroke="hsl(var(--primary))" fill="url(#forecastGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="Not enough history" description="A projection needs at least one closed month of trading." />
            )}
          </div>
        </PanelCard>

        <PanelCard title="Signals" description="What the platform rules currently flag" className="lg:col-span-3">
          {insights.length === 0 ? (
            <EmptyState icon={<Brain className="h-6 w-6" />} title="Nothing flagged" description="No vendor currently trips a churn, upsell or health rule." />
          ) : (
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {insights.map((ins: any, i: number) => (
                <div key={i} className="admin-insight-card flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={priorityColor(ins.priority) as any} className="text-xs capitalize">{ins.type}</Badge>
                      <span className="font-semibold text-sm">{ins.vendor}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5">{ins.message}</p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize shrink-0">{ins.priority}</Badge>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>
    </PageShell>
  );
}
