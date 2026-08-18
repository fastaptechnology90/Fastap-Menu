import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell, PanelCard, EmptyState } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/apiClient";
import { Scale, FileText } from "lucide-react";
import { toast } from "sonner";

export default function LegalCompliance() {
  const qc = useQueryClient();
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdForm, setHoldForm] = useState({ vendorId: "", reason: "" });

  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["legal"], queryFn: api.legal.get });

  const holdMutation = useMutation({
    mutationFn: () => api.legal.createHold({ ...holdForm, vendorId: Number(holdForm.vendorId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal"] }); setHoldOpen(false); toast.success("Legal hold applied"); },
    onError: () => toast.error("Failed to apply hold"),
  });

  return (
    <PageShell
      title="Legal & Compliance"
      description="Policy documents, GST compliance, legal holds, and investigation mode."
      icon={<Scale className="h-6 w-6" />}
      accent="primary"
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      actions={<Button variant="destructive" onClick={() => setHoldOpen(true)} className="rounded-xl">Apply Legal Hold</Button>}
    >
      <PanelCard title="Policy Documents" description="Published legal documents">
        <div className="admin-data-table-wrap">
          <DataTable data={data?.documents ?? []} columns={[
            { header: "Type", cell: (row: any) => <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{row.type}</span> },
            { header: "Version", accessorKey: "version" },
            { header: "Status", cell: (row: any) => <Badge className="text-xs capitalize">{row.status}</Badge> },
            { header: "Updated", cell: (row: any) => new Date(row.updatedAt).toLocaleDateString() },
          ]} />
        </div>
      </PanelCard>
      <PanelCard title="Active Legal Holds">
        {(data?.holds ?? []).length === 0 ? (
          <EmptyState icon={<Scale className="h-6 w-6" />} title="No active holds" description="Legal holds freeze vendor payouts and enable investigation mode." />
        ) : (
          <div className="admin-data-table-wrap">
            <DataTable data={data.holds} columns={[
              { header: "ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor ID", accessorKey: "vendorId" },
              { header: "Reason", accessorKey: "reason" },
              { header: "Created", cell: (row: any) => new Date(row.createdAt).toLocaleString() },
            ]} />
          </div>
        )}
      </PanelCard>
      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Apply Legal Hold</DialogTitle></DialogHeader>
          <Input placeholder="Vendor ID" value={holdForm.vendorId} onChange={e => setHoldForm(f => ({ ...f, vendorId: e.target.value }))} />
          <Textarea placeholder="Reason for hold" value={holdForm.reason} onChange={e => setHoldForm(f => ({ ...f, reason: e.target.value }))} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => holdMutation.mutate()} disabled={!holdForm.vendorId || holdMutation.isPending}>Apply Hold</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
