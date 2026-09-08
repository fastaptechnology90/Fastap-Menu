import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AsyncButton } from "@/components/shared/AsyncButton";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/shared/KpiCard";
import { UploadCloud, ShieldAlert } from "lucide-react";
import { api, type Chargeback } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { toast } from "sonner";
import { statusIs, statusLabel } from "@/pages/statusValue";

/** The column defaults to `pending_response`; the screen used to look for `"Pending Response"`. */
const isOpen = (chargeback: Chargeback) => statusIs(chargeback.status, "pending_response");

export default function Chargebacks() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [evidenceDialog, setEvidenceDialog] = useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [evidence, setEvidence] = useState("");

  const { data: chargebacks = [], isLoading, isError, refetch } = useQuery({ queryKey: ["chargebacks"], queryFn: api.chargebacks.list });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["chargebacks"] });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.chargebacks.accept(id),
    // Accepting only closes the dispute here — the offsetting refund is raised
    // separately, so the toast must not promise money has moved.
    onSuccess: (_, id) => { toast.success(`Chargeback ${id} accepted — raise the matching refund to settle it`); invalidate(); },
  });

  const contestMutation = useMutation({
    mutationFn: (id: string) => api.chargebacks.contest(id),
    onSuccess: (_, id) => { toast.info(`Evidence submitted for ${id}`); invalidate(); },
  });

  const evidenceMutation = useMutation({
    mutationFn: ({ id, evidence }: { id: string; evidence: string }) => api.chargebacks.uploadEvidence(id, evidence),
    // Clears only once the upload has landed, so a failure keeps the draft.
    onSuccess: () => { setEvidenceDialog({ open: false, id: "" }); setEvidence(""); toast.success("Evidence uploaded"); invalidate(); },
  });

  const totalAmount = chargebacks.reduce((s, c) => s + c.amount, 0);
  const pending = chargebacks.filter(isOpen);
  const overdue = pending.filter(c => new Date(c.deadline) < new Date());

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div><h2 className="text-2xl font-bold tracking-tight">Chargeback Management</h2><p className="text-muted-foreground">Handle disputes and upload evidence to payment networks.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Pending Response" value={pending.length} icon={<ShieldAlert className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Overdue" value={overdue.length} icon={<ShieldAlert className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Total Disputed" value={fmtINRFull(totalAmount)} icon={<ShieldAlert className="h-4 w-4 text-orange-500" />} />
      </div>
      <Card>
        <CardHeader><CardTitle>Dispute Cases</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            data={chargebacks}
            loading={isLoading}
            error={isError}
            onRetry={() => { void refetch(); }}
            errorMessage="We could not load the dispute cases."
            emptyMessage="No open disputes"
            emptyDescription="Chargebacks filed against a vendor will appear here."
            searchable
            searchPlaceholder="Search case, vendor or reason…"
            columns={[
              { header: "Case ID", searchValue: (row: Chargeback) => row.id, cell: (row: Chargeback) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", accessorKey: "vendorName", sortable: true },
              { header: "Amount", sortable: true, sortValue: (row: Chargeback) => row.amount, cell: (row: Chargeback) => <span className="font-medium text-destructive">{fmtINRFull(row.amount)}</span> },
              { header: "Reason", searchValue: (row: Chargeback) => row.reason, cell: (row: Chargeback) => <span className="text-xs text-muted-foreground">{row.reason}</span> },
              { header: "Deadline", sortable: true, sortValue: (row: Chargeback) => row.deadline, cell: (row: Chargeback) => { const isOverdue = new Date(row.deadline) < new Date(); return <span className={`text-xs font-medium ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>{row.deadline}{isOverdue ? " ⚠" : ""}</span>; } },
              { header: "Status", sortable: true, sortValue: (row: Chargeback) => row.status, cell: (row: Chargeback) => <StatusBadge status={statusLabel(row.status)} /> },
              { header: "Actions", cell: (row: Chargeback) => (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!isOpen(row)} onClick={() => { setEvidenceDialog({ open: true, id: row.id }); setEvidence(""); }}>
                    <UploadCloud className="h-3 w-3 mr-1" /> Evidence
                  </Button>
                  <AsyncButton
                    size="sm" variant="outline" className="h-7 text-xs text-blue-500" disabled={!isOpen(row)}
                    errorMessage="Failed to contest"
                    onClick={() => contestMutation.mutateAsync(row.id)}
                  >Contest</AsyncButton>
                  <AsyncButton
                    size="sm" variant="ghost" className="h-7 text-xs text-red-500" disabled={!isOpen(row)}
                    errorMessage="Failed to accept"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Accept chargeback ${row.id}?`,
                        description: `Conceding the ${fmtINRFull(row.amount)} dispute ends your right to contest it. You will need to raise the matching refund yourself.`,
                        destructive: true,
                        confirmLabel: "Accept dispute",
                      });
                      if (!ok) return;
                      await acceptMutation.mutateAsync(row.id);
                    }}
                  >Accept</AsyncButton>
                </div>
              )},
            ]}
          />
        </CardContent>
      </Card>
      <Dialog open={evidenceDialog.open} onOpenChange={open => { if (!open) setEvidenceDialog({ open: false, id: "" }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Evidence — {evidenceDialog.id}</DialogTitle></DialogHeader>
          <Textarea placeholder="Describe evidence or paste document reference URL..." value={evidence} onChange={e => setEvidence(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceDialog({ open: false, id: "" })}>Cancel</Button>
            <AsyncButton
              disabled={!evidence.trim()} pendingLabel="Uploading…"
              errorMessage="Upload failed"
              onClick={() => evidenceMutation.mutateAsync({ id: evidenceDialog.id, evidence })}
            >Submit Evidence</AsyncButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
