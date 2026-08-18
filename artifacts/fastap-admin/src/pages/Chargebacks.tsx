import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/shared/KpiCard";
import { UploadCloud, CheckCircle, ShieldAlert, Loader2 } from "lucide-react";
import { api, type Chargeback } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { toast } from "sonner";

export default function Chargebacks() {
  const qc = useQueryClient();
  const [evidenceDialog, setEvidenceDialog] = useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [evidence, setEvidence] = useState("");

  const { data: chargebacks = [], isLoading } = useQuery({ queryKey: ["chargebacks"], queryFn: api.chargebacks.list });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.chargebacks.accept(id),
    onSuccess: (_, id) => { toast.success(`Chargeback ${id} accepted — amount will be refunded`); qc.invalidateQueries({ queryKey: ["chargebacks"] }); },
    onError: () => toast.error("Failed to accept"),
  });

  const contestMutation = useMutation({
    mutationFn: (id: string) => api.chargebacks.contest(id),
    onSuccess: (_, id) => { toast.info(`Evidence submitted for ${id}`); qc.invalidateQueries({ queryKey: ["chargebacks"] }); },
    onError: () => toast.error("Failed to contest"),
  });

  const evidenceMutation = useMutation({
    mutationFn: ({ id, evidence }: { id: string; evidence: string }) => api.chargebacks.uploadEvidence(id, evidence),
    onSuccess: () => { setEvidenceDialog({ open: false, id: "" }); setEvidence(""); toast.success("Evidence uploaded"); qc.invalidateQueries({ queryKey: ["chargebacks"] }); },
    onError: () => toast.error("Upload failed"),
  });

  const totalAmount = chargebacks.reduce((s, c) => s + c.amount, 0);
  const pending = chargebacks.filter(c => c.status === "Pending Response");
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
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable data={chargebacks} columns={[
              { header: "Case ID", cell: (row: Chargeback) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", accessorKey: "vendorName" },
              { header: "Amount", cell: (row: Chargeback) => <span className="font-medium text-destructive">{fmtINRFull(row.amount)}</span> },
              { header: "Reason", cell: (row: Chargeback) => <span className="text-xs text-muted-foreground">{row.reason}</span> },
              { header: "Deadline", cell: (row: Chargeback) => { const isOverdue = new Date(row.deadline) < new Date(); return <span className={`text-xs font-medium ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>{row.deadline}{isOverdue ? " ⚠" : ""}</span>; } },
              { header: "Status", cell: (row: Chargeback) => <StatusBadge status={row.status} /> },
              { header: "Actions", cell: (row: Chargeback) => (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={row.status !== "Pending Response"} onClick={() => { setEvidenceDialog({ open: true, id: row.id }); setEvidence(""); }}>
                    <UploadCloud className="h-3 w-3 mr-1" /> Evidence
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-blue-500" disabled={row.status !== "Pending Response"} onClick={() => contestMutation.mutate(row.id)}>Contest</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" disabled={row.status !== "Pending Response"} onClick={() => acceptMutation.mutate(row.id)}>Accept</Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
      <Dialog open={evidenceDialog.open} onOpenChange={open => setEvidenceDialog({ open, id: "" })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Evidence — {evidenceDialog.id}</DialogTitle></DialogHeader>
          <Textarea placeholder="Describe evidence or paste document reference URL..." value={evidence} onChange={e => setEvidence(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceDialog({ open: false, id: "" })}>Cancel</Button>
            <Button disabled={!evidence.trim() || evidenceMutation.isPending} onClick={() => evidenceMutation.mutate({ id: evidenceDialog.id, evidence })}>
              {evidenceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Submit Evidence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
