import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageShell, PanelCard, EmptyState } from "@/components/shared/PageShell";
import { api } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { TrendingDown, AlertTriangle, ShieldAlert } from "lucide-react";

export default function RevenueLeakage() {
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["revenue-leakage"], queryFn: api.revenueLeakage.get, refetchInterval: 120000 });

  const expected = data?.expectedCommission ?? 0;
  const actual = data?.actualCommission ?? 0;
  const captureRate = expected > 0 ? Math.round((actual / expected) * 100) : 100;

  return (
    <PageShell
      title="Revenue Leakage Detection"
      description="Commission gaps, hidden refunds, and settlement mismatches across the platform."
      icon={<TrendingDown className="h-6 w-6" />}
      accent="rose"
      badge={data?.leakageAmount ? `₹${data.leakageAmount.toLocaleString("en-IN")} at risk` : "Healthy"}
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
    >
      <div className="admin-stat-grid">
        <KpiCard title="Expected Commission" value={fmtINRFull(expected)} accent="primary" icon={<ShieldAlert className="h-4 w-4" />} />
        <KpiCard title="Actual Commission" value={fmtINRFull(actual)} accent="emerald" icon={<TrendingDown className="h-4 w-4 text-emerald-500" />} />
        <KpiCard title="Leakage Amount" value={fmtINRFull(data?.leakageAmount ?? 0)} accent="rose" icon={<AlertTriangle className="h-4 w-4 text-rose-500" />} />
        <KpiCard title="Hidden Refunds" value={data?.hiddenRefunds ?? 0} accent="amber" subtitle="Refund volume flagged" />
      </div>

      <PanelCard title="Commission Capture Rate" description={`${captureRate}% of expected commission collected`}>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Capture efficiency</span>
            <span className="font-bold">{captureRate}%</span>
          </div>
          <Progress value={captureRate} className="h-3" />
        </div>
      </PanelCard>

      <PanelCard title="Detected Issues" description="Automated anomaly detection">
        {(data?.issues ?? []).length === 0 ? (
          <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="No leakage detected" description="Commission and settlement data looks healthy." />
        ) : (
          <div className="space-y-3">
            {data.issues.map((issue: any, i: number) => (
              <div key={i} className="admin-insight-card flex items-start gap-3">
                <Badge variant={issue.severity === "critical" ? "destructive" : "secondary"} className="text-xs capitalize shrink-0 mt-0.5">
                  {issue.severity}
                </Badge>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{issue.type?.replace(/_/g, " ")}</p>
                  <p className="text-sm mt-0.5">{issue.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>
    </PageShell>
  );
}
