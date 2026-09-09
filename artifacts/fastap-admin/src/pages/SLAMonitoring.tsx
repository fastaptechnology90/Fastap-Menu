import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw, Loader2, TrendingUp, Bell } from "lucide-react";
import { PageHeader } from "@/components/shared/Page";

export default function SLAMonitoring() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const escalateMutation = useMutation({
    mutationFn: (ticketId: string) => api.support.escalate(ticketId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sla"] }); toast({ title: "Ticket escalated" }); },
    onError: () => toast({ title: "Escalation failed", variant: "destructive" }),
  });

  const { data: sla, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sla"],
    queryFn: api.sla.get,
    refetchInterval: 60000,
  });

  const slaTypes = [
    { name: "Support SLA", target: "< 4 hours", current: sla?.supportAvg || "—", compliance: sla?.supportCompliance || 0, icon: <Clock className="h-4 w-4 text-info" /> },
    { name: "Refund SLA", target: "< 24 hours", current: sla?.refundAvg || "—", compliance: sla?.refundCompliance || 0, icon: <Clock className="h-4 w-4 text-success" /> },
    { name: "Settlement SLA", target: "< 48 hours", current: sla?.settlementAvg || "—", compliance: sla?.settlementCompliance || 0, icon: <Clock className="h-4 w-4 text-warning" /> },
    { name: "Downtime SLA", target: "99.9% uptime", current: sla?.uptimeActual || "—", compliance: sla?.uptimeCompliance || 0, icon: <CheckCircle className="h-4 w-4 text-muted-foreground" /> },
  ];

  const breaches = sla?.breaches || [];
  const warnings = sla?.warnings || [];
  const totalBreaches = breaches.length;
  const criticalBreaches = breaches.filter((b: any) => b.severity === "critical").length;
  const avgCompliance = slaTypes.reduce((s, t) => s + t.compliance, 0) / slaTypes.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA Monitoring System"
        description="Track refund SLA, support SLA, settlement SLA, and uptime SLA in real-time."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Overall Compliance" value={`${avgCompliance.toFixed(1)}%`} icon={<TrendingUp className="h-4 w-4 text-success" />} />
        <KpiCard title="Active Warnings" value={warnings.length} icon={<Bell className="h-4 w-4 text-warning" />} />
        <KpiCard title="SLA Breaches" value={totalBreaches} icon={<AlertTriangle className="h-4 w-4 text-danger" />} />
        <KpiCard title="Critical Breaches" value={criticalBreaches} icon={<XCircle className="h-4 w-4 text-danger" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {slaTypes.map((slaType, i) => (
          <Card key={i} className={`${slaType.compliance < 90 ? "border-danger-border" : slaType.compliance < 95 ? "border-warning-border" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                {slaType.icon}
                <Badge variant={slaType.compliance >= 95 ? "default" : slaType.compliance >= 90 ? "outline" : "destructive"} className="text-xs">
                  {slaType.compliance >= 95 ? "Healthy" : slaType.compliance >= 90 ? "Warning" : "Breached"}
                </Badge>
              </div>
              <CardTitle className="text-base mt-2">{slaType.name}</CardTitle>
              <CardDescription className="text-xs">Target: {slaType.target}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Response</span>
                  <span className="font-bold">{slaType.current}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Compliance</span>
                  <span className={`font-bold ${slaType.compliance >= 95 ? "text-success" : slaType.compliance >= 90 ? "text-warning" : "text-danger"}`}>{slaType.compliance}%</span>
                </div>
                <Progress value={slaType.compliance} className={`h-2 mt-2 ${slaType.compliance < 90 ? "[&>div]:bg-danger" : slaType.compliance < 95 ? "[&>div]:bg-warning" : ""}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-danger" /> SLA Breaches</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {breaches.map((breach: any) => (
                  <div key={breach.id} className={`flex items-start gap-3 p-3 rounded-lg border ${breach.severity === "critical" ? "border-danger-border bg-danger-subtle" : "border-warning-border bg-warning-subtle"}`}>
                    <XCircle className={`h-4 w-4 mt-0.5 ${breach.severity === "critical" ? "text-danger" : "text-warning"}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{breach.slaType}</p>
                        <Badge variant="destructive" className="text-xs">{breach.severity}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{breach.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Breached by: <span className="font-medium text-danger">{breach.overduBy}</span> | {new Date(breach.breachedAt).toLocaleString()}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" disabled={escalateMutation.isPending} onClick={() => escalateMutation.mutate(breach.id)}>Escalate</Button>
                  </div>
                ))}
                {breaches.length === 0 && <p className="text-center text-sm text-muted-foreground py-6 text-success">No SLA breaches detected</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-warning" /> SLA Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {warnings.map((warn: any) => (
                  <div key={warn.id} className="flex items-start gap-3 p-3 rounded-lg border border-warning-border bg-warning-subtle">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{warn.slaType}</p>
                      <p className="text-xs text-muted-foreground">{warn.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">SLA deadline in: <span className="font-medium text-warning">{warn.timeLeft}</span></p>
                    </div>
                  </div>
                ))}
                {warnings.length === 0 && <p className="text-center text-sm text-muted-foreground py-6 text-success">No SLA warnings</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>SLA Breach History</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <DataTable data={sla?.history || []} pageSize={10} columns={[
              { header: "Breach ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "SLA Type", cell: (row: any) => <span className="font-medium">{row.slaType}</span> },
              { header: "Vendor / Ticket", cell: (row: any) => <span className="text-sm">{row.reference}</span> },
              { header: "Target", cell: (row: any) => <span className="text-muted-foreground text-sm">{row.target}</span> },
              { header: "Actual", cell: (row: any) => <span className="text-danger font-medium">{row.actual}</span> },
              { header: "Overdue By", cell: (row: any) => <span className="text-danger font-bold">{row.overdueBy}</span> },
              { header: "Severity", cell: (row: any) => <Badge variant={row.severity === "critical" ? "destructive" : "outline"} className="text-xs">{row.severity}</Badge> },
              { header: "Breached At", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.breachedAt).toLocaleDateString()}</span> },
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
