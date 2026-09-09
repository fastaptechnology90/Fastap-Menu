import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageShell, PanelCard, EmptyState } from "@/components/shared/PageShell";
import { api } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { TrendingDown, AlertTriangle, ShieldAlert } from "lucide-react";

export default function RevenueLeakage() {
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["revenue-leakage"], queryFn: api.revenueLeakage.get, refetchInterval: 120000 });

  const expected = data?.expectedCommission ?? 0;
  const actual = data?.actualCommission ?? 0;
  const issues = data?.issues ?? [];

  return (
    <PageShell
      title="Revenue Leakage Detection"
      description="Commission owed against commission recorded, plus the refund and settlement anomalies the platform flags."
      icon={<TrendingDown className="h-6 w-6" />}
      badge={issues.length > 0 ? `${issues.length} ${issues.length === 1 ? "issue" : "issues"} flagged` : undefined}
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
    >
      {/* Both commission figures are the same calculation — the commission rate applied
          to the same set of paid orders — so the difference between them is zero by
          construction and always will be. It measures that the platform's own arithmetic
          is self-consistent, not that no money is going missing. Real leakage (a venue
          whose refunds exceed its sales, a payout released twice) is invisible to it. */}
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>A zero here is not an all-clear</AlertTitle>
        <AlertDescription>
          Expected and recorded commission are computed the same way from the same paid orders,
          so they agree by construction and the gap between them is always ₹0. Use the flagged
          issues below, the settlement figures and the vendor wallets to judge whether money is
          actually going missing.
        </AlertDescription>
      </Alert>

      <div className="admin-stat-grid">
        <KpiCard title="Commission owed" value={fmtINRFull(expected)} icon={<ShieldAlert />} subtitle="Rate × paid orders" />
        <KpiCard title="Commission recorded" value={fmtINRFull(actual)} icon={<TrendingDown />} subtitle="Same calculation" />
        <KpiCard title="Refunded orders" value={data?.hiddenRefunds ?? 0} icon={<AlertTriangle />} subtitle="Count, platform-wide" />
        <KpiCard title="Issues flagged" value={issues.length} subtitle="Rules that tripped" />
      </div>

      <PanelCard title="Detected issues" description="Anomalies the platform's own rules picked up">
        {issues.length === 0 ? (
          <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="No rules tripped" description="No refund-ratio or settlement anomaly is currently flagged." />
        ) : (
          <div className="space-y-3">
            {issues.map((issue: any, i: number) => (
              <div key={i} className="admin-insight-card flex items-start gap-3">
                <Badge variant={issue.severity === "critical" ? "danger" : "warning"} className="mt-0.5 shrink-0 capitalize">
                  {issue.severity}
                </Badge>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{issue.type?.replace(/_/g, " ")}</p>
                  <p className="mt-0.5 text-sm">{issue.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>
    </PageShell>
  );
}
