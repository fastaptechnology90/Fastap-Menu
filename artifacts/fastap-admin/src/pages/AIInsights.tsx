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

  const insights = data?.insights ?? [];
  const priorityColor = (p: string) => p === "high" ? "destructive" : p === "medium" ? "secondary" : "outline";

  return (
    <PageShell
      title="AI Business Insights"
      description="Predictive churn risk, upsell signals, and platform health intelligence powered by live data."
      icon={<Brain className="h-6 w-6" />}
      accent="violet"
      badge="AI Engine"
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
    >
      <div className="admin-stat-grid">
        <KpiCard title="Active Insights" value={insights.length} accent="violet" icon={<Sparkles className="h-4 w-4 text-violet-500" />} />
        <KpiCard title="Churn Risk" value={data?.churnRisk?.length ?? 0} accent="amber" icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} subtitle="Vendors at risk" />
        <KpiCard title="Forecast Periods" value={data?.forecast?.length ?? 0} accent="emerald" icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <PanelCard title="Revenue Forecast" description="Projected platform revenue" className="lg:col-span-2">
          <div className="h-[200px]">
            {(data?.forecast ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.forecast}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => fmtINR(v)} />
                  <Tooltip formatter={(v: number) => [fmtINR(v), "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#forecastGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="Building forecast" description="More order data needed for projections." />
            )}
          </div>
        </PanelCard>

        <PanelCard title="Intelligence Feed" description="Actionable recommendations" className="lg:col-span-3">
          {insights.length === 0 ? (
            <EmptyState icon={<Brain className="h-6 w-6" />} title="All clear" description="No critical insights right now." />
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
