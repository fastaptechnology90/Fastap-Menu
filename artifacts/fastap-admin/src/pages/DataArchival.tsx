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

  // The endpoint counts rows older than the retention window and logs the run. It does not
  // move, copy, or delete anything, so the toast reports eligibility, not an archive.
  const runMutation = useMutation({
    mutationFn: (policyId: string) => api.archival.run(policyId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["archival"] });
      toast.success(result.records > 0
        ? `${result.records} records are past retention`
        : "No records past retention");
    },
    onError: () => toast.error("Retention scan failed"),
  });

  return (
    <PageShell
      title="Data Retention & Archival"
      description="Retention policies and eligibility scans for orders and audit logs. Scanning reports what is past retention — it does not move or delete data."
      icon={<Archive className="h-6 w-6" />}
      accent="cyan"
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
    >
      <PanelCard title="Retention Policies" description="Retention windows of record. Retention days and the auto-archive flag are read-only here — no API route edits them or runs a scheduled sweep.">
        <div className="admin-data-table-wrap">
          <DataTable data={data?.policies ?? []} columns={[
            { header: "Type", cell: (row: any) => <span className="capitalize font-medium">{row.type?.replace("_", " ")}</span> },
            { header: "Retention", cell: (row: any) => <Badge variant="outline">{row.retentionDays} days</Badge> },
            { header: "Auto", cell: (row: any) => <Badge variant={row.autoArchive ? "default" : "secondary"} className="text-xs">{row.autoArchive ? "On" : "Off"}</Badge> },
            { header: "Last Run", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.lastRun ? new Date(row.lastRun).toLocaleString() : "Never"}</span> },
            // runArchival only counts orders and audit_logs; any other type returns a
            // hard zero, which would read as "nothing is past retention" rather than
            // "this was never checked".
            { header: "", cell: (row: any) => {
              const scannable = row.type === "orders" || row.type === "audit_logs";
              return (
                <Button
                  size="sm" variant="outline" className="h-7 text-xs rounded-lg"
                  disabled={!scannable || runMutation.isPending}
                  title={scannable ? undefined : "The API has no retention scan for this data type"}
                  onClick={() => runMutation.mutate(row.id)}
                >
                  <Play className="h-3 w-3 mr-1" /> {scannable ? "Scan" : "No scan"}
                </Button>
              );
            }},
          ]} />
        </div>
      </PanelCard>
      {(data?.archives ?? []).length > 0 && (
        <PanelCard title="Recent Scans">
          <div className="admin-data-table-wrap">
            <DataTable data={data.archives} columns={[
              { header: "ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Records past retention", accessorKey: "records" },
              { header: "Status", cell: (row: any) => <Badge variant="outline" className="capitalize">{row.status}</Badge> },
              { header: "At", cell: (row: any) => new Date(row.at).toLocaleString() },
            ]} />
          </div>
        </PanelCard>
      )}
    </PageShell>
  );
}
