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
    { name: "Support SLA", target: "< 4 hours", current: sla?.supportAvg || "—", compliance: sla?.supportCompliance || 0, icon: <Clock className="h-4 w-4 text-blue-500" /> },
    { name: "Refund SLA", target: "< 24 hours", current: sla?.refundAvg || "—", compliance: sla?.refundCompliance || 0, icon: <Clock className="h-4 w-4 text-green-500" /> },
    { name: "Settlement SLA", target: "< 48 hours", current: sla?.settlementAvg || "—", compliance: sla?.settlementCompliance || 0, icon: <Clock className="h-4 w-4 text-orange-500" /> },
    { name: "Downtime SLA", target: "99.9% uptime", current: sla?.uptimeActual || "—", compliance: sla?.uptimeCompliance || 0, icon: <CheckCircle className="h-4 w-4 text-purple-500" /> },
  ];

  const breaches = sla?.breaches || [];
  const warnings = sla?.warnings || [];
  const totalBreaches = breaches.length;
  const criticalBreaches = breaches.filter((b: any) => b.severity === "critical").length;
  const avgCompliance = slaTypes.reduce((s, t) => s + t.compliance, 0) / slaTypes.length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">SLA Monitoring System</h2>
          <p className="text-muted-foreground">Track refund SLA, support SLA, settlement SLA, and uptime SLA in real-time.</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Overall Compliance" value={`${avgCompliance.toFixed(1)}%`} icon={<TrendingUp className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Active Warnings" value={warnings.length} icon={<Bell className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="SLA Breaches" value={totalBreaches} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Critical Breaches" value={criticalBreaches} icon={<XCircle className="h-4 w-4 text-red-600" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {slaTypes.map((slaType, i) => (
          <Card key={i} className={`${slaType.compliance < 90 ? "border-red-500/30" : slaType.compliance < 95 ? "border-yellow-500/30" : ""}`}>
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
                  <span className={`font-bold ${slaType.compliance >= 95 ? "text-green-400" : slaType.compliance >= 90 ? "text-yellow-400" : "text-red-400"}`}>{slaType.compliance}%</span>
                </div>
                <Progress value={slaType.compliance} className={`h-2 mt-2 ${slaType.compliance < 90 ? "[&>div]:bg-red-500" : slaType.compliance < 95 ? "[&>div]:bg-yellow-500" : ""}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> SLA Breaches</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {breaches.map((breach: any) => (
                  <div key={breach.id} className={`flex items-start gap-3 p-3 rounded-lg border ${breach.severity === "critical" ? "border-red-500/30 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5"}`}>
                    <XCircle className={`h-4 w-4 mt-0.5 ${breach.severity === "critical" ? "text-red-400" : "text-orange-400"}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{breach.slaType}</p>
                        <Badge variant="destructive" className="text-xs">{breach.severity}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{breach.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Breached by: <span className="font-medium text-red-400">{breach.overduBy}</span> | {new Date(breach.breachedAt).toLocaleString()}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" disabled={escalateMutation.isPending} onClick={() => escalateMutation.mutate(breach.id)}>Escalate</Button>
                  </div>
                ))}
                {breaches.length === 0 && <p className="text-center text-sm text-muted-foreground py-6 text-green-400">No SLA breaches detected</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-yellow-500" /> SLA Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {warnings.map((warn: any) => (
                  <div key={warn.id} className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{warn.slaType}</p>
                      <p className="text-xs text-muted-foreground">{warn.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">SLA deadline in: <span className="font-medium text-yellow-400">{warn.timeLeft}</span></p>
                    </div>
                  </div>
                ))}
                {warnings.length === 0 && <p className="text-center text-sm text-muted-foreground py-6 text-green-400">No SLA warnings</p>}
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
              { header: "Actual", cell: (row: any) => <span className="text-red-400 font-medium">{row.actual}</span> },
              { header: "Overdue By", cell: (row: any) => <span className="text-red-400 font-bold">{row.overdueBy}</span> },
              { header: "Severity", cell: (row: any) => <Badge variant={row.severity === "critical" ? "destructive" : "outline"} className="text-xs">{row.severity}</Badge> },
              { header: "Breached At", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.breachedAt).toLocaleDateString()}</span> },
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
