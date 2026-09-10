import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw, Loader2, TrendingUp, Bell } from "lucide-react";
import { PageHeader } from "@/components/shared/Page";

type SlaTile = {
  name: string;
  target: string;
  current: string;
  /** null = not measured — never treat as 0% breach or 100% healthy */
  compliance: number | null;
  icon: React.ReactNode;
};

function complianceLabel(c: number | null) {
  if (c == null) return { text: "Not measured", variant: "secondary" as const, tone: "text-muted-foreground" };
  if (c >= 95) return { text: "On track", variant: "default" as const, tone: "text-success" };
  if (c >= 90) return { text: "Warning", variant: "outline" as const, tone: "text-warning" };
  return { text: "Breached", variant: "destructive" as const, tone: "text-danger" };
}

/** Breach rows use display ids like TKT-12; the escalate API needs the numeric ticket id. */
function ticketIdFromBreach(id: string) {
  const m = String(id).match(/(\d+)/);
  return m ? m[1] : id;
}

export default function SLAMonitoring() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const escalateMutation = useMutation({
    mutationFn: (ticketId: string) => api.support.escalate(ticketIdFromBreach(ticketId)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sla"] }); toast({ title: "Ticket escalated" }); },
    onError: () => toast({ title: "Escalation failed", variant: "destructive" }),
  });

  const { data: sla, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sla"],
    queryFn: api.sla.get,
    refetchInterval: 60000,
  });

  const slaTypes: SlaTile[] = [
    { name: "Support SLA", target: "< 4 hours", current: sla?.supportAvg || "—", compliance: sla?.supportCompliance ?? null, icon: <Clock className="h-4 w-4 text-info" /> },
    { name: "Refund SLA", target: "< 24 hours", current: sla?.refundAvg || "—", compliance: sla?.refundCompliance ?? null, icon: <Clock className="h-4 w-4 text-success" /> },
    { name: "Settlement SLA", target: "< 48 hours", current: sla?.settlementAvg || "—", compliance: sla?.settlementCompliance ?? null, icon: <Clock className="h-4 w-4 text-warning" /> },
    // Uptime is not recorded — never show a compliance % or "Healthy" badge for it.
    { name: "Platform uptime", target: "Not instrumented", current: sla?.uptimeActual || "Not measured", compliance: null, icon: <CheckCircle className="h-4 w-4 text-muted-foreground" /> },
  ];

  const breaches = sla?.breaches || [];
  const warnings = sla?.warnings || [];
  const totalBreaches = breaches.length;
  const criticalBreaches = breaches.filter((b: any) => b.severity === "critical").length;
  const measured = slaTypes.map(t => t.compliance).filter((c): c is number => c != null);
  const avgCompliance = measured.length ? measured.reduce((s, t) => s + t, 0) / measured.length : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA Monitoring"
        description="Support ticket deadlines and settlement due dates from live records. Uptime and refund due-by are not measured here."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </>
        }
      />

      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Only measured figures appear as percentages</AlertTitle>
        <AlertDescription>
          Refund SLA has no due-by date on the record, and platform uptime is not logged — those tiles
          stay “Not measured”. A blank compliance is not an all-clear.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Measured compliance"
          value={avgCompliance != null ? `${avgCompliance.toFixed(1)}%` : "—"}
          icon={<TrendingUp className="h-4 w-4 text-success" />}
        />
        <KpiCard title="Active Warnings" value={warnings.length} icon={<Bell className="h-4 w-4 text-warning" />} />
        <KpiCard title="SLA Breaches" value={totalBreaches} icon={<AlertTriangle className="h-4 w-4 text-danger" />} />
        <KpiCard title="Critical Breaches" value={criticalBreaches} icon={<XCircle className="h-4 w-4 text-danger" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {slaTypes.map((slaType, i) => {
          const label = complianceLabel(slaType.compliance);
          return (
            <Card key={i} className={`${slaType.compliance != null && slaType.compliance < 90 ? "border-danger-border" : slaType.compliance != null && slaType.compliance < 95 ? "border-warning-border" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  {slaType.icon}
                  <Badge variant={label.variant} className="text-xs">{label.text}</Badge>
                </div>
                <CardTitle className="text-base mt-2">{slaType.name}</CardTitle>
                <CardDescription className="text-xs">Target: {slaType.target}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-bold">{slaType.current}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Compliance</span>
                    <span className={`font-bold ${label.tone}`}>
                      {slaType.compliance != null ? `${slaType.compliance}%` : "—"}
                    </span>
                  </div>
                  {slaType.compliance != null ? (
                    <Progress value={slaType.compliance} className={`h-2 mt-2 ${slaType.compliance < 90 ? "[&>div]:bg-danger" : slaType.compliance < 95 ? "[&>div]:bg-warning" : ""}`} />
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">No sensor or deadline to score against.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
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
                {breaches.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No open support tickets past their SLA deadline</p>}
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
                {warnings.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No tickets within 4 hours of deadline</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent resolved tickets (timing)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <DataTable data={sla?.history || []} pageSize={10} columns={[
              { header: "Ticket", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "SLA Type", cell: (row: any) => <span className="font-medium">{row.slaType}</span> },
              { header: "Subject", cell: (row: any) => <span className="text-sm">{row.reference}</span> },
              { header: "Target", cell: (row: any) => <span className="text-muted-foreground text-sm">{row.target}</span> },
              { header: "Actual", cell: (row: any) => <span className="font-medium">{row.actual}</span> },
              { header: "Over target", cell: (row: any) => <span className={row.overdueBy !== "—" ? "text-danger font-bold" : "text-muted-foreground"}>{row.overdueBy}</span> },
              { header: "Severity", cell: (row: any) => <Badge variant={row.severity === "critical" ? "destructive" : "outline"} className="text-xs">{row.severity}</Badge> },
              { header: "Closed", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.breachedAt).toLocaleDateString()}</span> },
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
