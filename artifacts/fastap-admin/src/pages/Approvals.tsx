import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/KpiCard";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { fmtINR } from "@/lib/format";
import { CheckCircle, XCircle, ShieldCheck, Layers } from "lucide-react";
import { toast } from "sonner";

export default function Approvals() {
  const qc = useQueryClient();
  const { data: items = [], isLoading, refetch, isFetching } = useQuery({ queryKey: ["approvals"], queryFn: api.approvals.list, refetchInterval: 30000 });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.approvals.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["approvals"] }); toast.success("Approval updated"); },
    onError: () => toast.error("Update failed"),
  });

  const pending = items.filter((a: any) => a.status === "pending");

  return (
    <PageShell
      title="Multi-Level Approvals"
      description="Finance, compliance, and operations sign-off for refunds, payouts, and high-value actions."
      icon={<Layers className="h-6 w-6" />}
      accent="violet"
      badge={`${pending.length} pending`}
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
    >
      <div className="admin-stat-grid">
        <KpiCard title="Pending" value={pending.length} accent="amber" icon={<ShieldCheck className="h-4 w-4 text-amber-500" />} subtitle="Awaiting review" />
        <KpiCard title="Approved" value={items.filter((a: any) => a.status === "approved").length} accent="emerald" icon={<CheckCircle className="h-4 w-4 text-emerald-500" />} />
        <KpiCard title="Rejected" value={items.filter((a: any) => a.status === "rejected").length} accent="rose" icon={<XCircle className="h-4 w-4 text-rose-500" />} />
      </div>
      <PanelCard title="Approval Queue" description="L1 → L2 → L3 escalation chain for sensitive operations">
        <div className="admin-data-table-wrap">
          <DataTable data={items} columns={[
            { header: "ID", cell: (row: any) => <span className="font-mono text-xs text-primary">{row.id}</span> },
            { header: "Type", cell: (row: any) => <Badge variant="outline" className="capitalize text-xs">{row.type || "general"}</Badge> },
            { header: "Level", cell: (row: any) => <Badge className="text-xs">L{row.level ?? 1}</Badge> },
            { header: "Amount", cell: (row: any) => row.amount ? <span className="font-semibold">{fmtINR(row.amount)}</span> : "—" },
            { header: "Reason", cell: (row: any) => <span className="text-xs text-muted-foreground max-w-[200px] truncate block">{row.reason || "—"}</span> },
            { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
            { header: "Actions", cell: (row: any) => row.status === "pending" ? (
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => updateMutation.mutate({ id: row.id, status: "approved" })}>Approve</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs text-rose-500 border-rose-500/30" onClick={() => updateMutation.mutate({ id: row.id, status: "rejected" })}>Reject</Button>
              </div>
            ) : null },
          ]} />
        </div>
      </PanelCard>
    </PageShell>
  );
}
