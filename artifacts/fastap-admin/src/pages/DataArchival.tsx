import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/DataTable";
import { api } from "@/lib/apiClient";
import { Archive, Play } from "lucide-react";
import { toast } from "sonner";

export default function DataArchival() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["archival"], queryFn: api.archival.get });

  const runMutation = useMutation({
    mutationFn: (policyId: string) => api.archival.run(policyId),
    onSuccess: (result) => { qc.invalidateQueries({ queryKey: ["archival"] }); toast.success(`Archived ${result.records} records`); },
    onError: () => toast.error("Archival failed"),
  });

  return (
    <PageShell
      title="Data Retention & Archival"
      description="Retention policies and automated archival jobs for orders, logs, and transactions."
      icon={<Archive className="h-6 w-6" />}
      accent="cyan"
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
    >
      <PanelCard title="Retention Policies" description="Configure how long data is kept before archival">
        <div className="admin-data-table-wrap">
          <DataTable data={data?.policies ?? []} columns={[
            { header: "Type", cell: (row: any) => <span className="capitalize font-medium">{row.type?.replace("_", " ")}</span> },
            { header: "Retention", cell: (row: any) => <Badge variant="outline">{row.retentionDays} days</Badge> },
            { header: "Auto", cell: (row: any) => <Badge variant={row.autoArchive ? "default" : "secondary"} className="text-xs">{row.autoArchive ? "On" : "Off"}</Badge> },
            { header: "Last Run", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.lastRun ? new Date(row.lastRun).toLocaleString() : "Never"}</span> },
            { header: "", cell: (row: any) => (
              <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" disabled={runMutation.isPending} onClick={() => runMutation.mutate(row.id)}>
                <Play className="h-3 w-3 mr-1" /> Run
              </Button>
            )},
          ]} />
        </div>
      </PanelCard>
      {(data?.archives ?? []).length > 0 && (
        <PanelCard title="Recent Archives">
          <div className="admin-data-table-wrap">
            <DataTable data={data.archives} columns={[
              { header: "ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Records", accessorKey: "records" },
              { header: "Status", cell: (row: any) => <Badge variant="outline" className="capitalize">{row.status}</Badge> },
              { header: "At", cell: (row: any) => new Date(row.at).toLocaleString() },
            ]} />
          </div>
        </PanelCard>
      )}
    </PageShell>
  );
}
