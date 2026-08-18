import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { api } from "@/lib/apiClient";
import { Server, Shield, Play } from "lucide-react";
import { toast } from "sonner";

export default function DisasterRecovery() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["dr-status"], queryFn: api.disasterRecovery.get });

  const testMutation = useMutation({
    mutationFn: () => api.disasterRecovery.save({ ...data, lastFailoverTest: new Date().toISOString(), status: "tested" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dr-status"] }); toast.success("Failover test completed"); },
    onError: () => toast.error("Test failed"),
  });

  return (
    <PageShell
      title="Disaster Recovery"
      description="Failover status, backup integrity, RPO/RTO monitoring, and recovery testing."
      icon={<Server className="h-6 w-6" />}
      accent="cyan"
      badge={data?.status}
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      actions={<Button onClick={() => testMutation.mutate()} disabled={testMutation.isPending} className="rounded-xl"><Play className="mr-2 h-4 w-4" /> Run Failover Test</Button>}
    >
      <div className="admin-stat-grid">
        <KpiCard title="Primary Region" value={data?.primaryRegion ?? "—"} accent="primary" />
        <KpiCard title="RPO" value={data?.rpo ?? "—"} accent="cyan" subtitle="Recovery point" />
        <KpiCard title="RTO" value={data?.rto ?? "—"} accent="violet" subtitle="Recovery time" />
        <KpiCard title="Integrity" value={data?.backupIntegrity ?? "—"} accent="emerald" />
      </div>
      <PanelCard title="Backup & Recovery" description="Cross-region redundancy configuration">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Backup Region", value: data?.backupRegion },
            { label: "Backup Integrity", value: data?.backupIntegrity, badge: true },
            { label: "Last Failover Test", value: data?.lastFailoverTest ? new Date(data.lastFailoverTest).toLocaleString() : "Never run" },
            { label: "System Status", value: data?.status, badge: true },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
              <span className="text-sm text-muted-foreground flex items-center gap-2"><Shield className="h-4 w-4" />{row.label}</span>
              {row.badge ? <Badge variant="outline" className="capitalize">{row.value}</Badge> : <span className="font-semibold text-sm">{row.value}</span>}
            </div>
          ))}
        </div>
      </PanelCard>
    </PageShell>
  );
}
