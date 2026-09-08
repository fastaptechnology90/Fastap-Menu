import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AsyncButton } from "@/components/shared/AsyncButton";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, CheckCircle, XCircle, Eye, RotateCcw, Ban, ArrowUpRight } from "lucide-react";
import { api, type Refund } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { toast } from "sonner";
import { KpiCard } from "@/components/shared/KpiCard";
import { statusIs, statusLabel } from "@/pages/statusValue";

/** The API returns the stored status verbatim — `pending`, not `Pending`. */
const isPending = (refund: Refund) => statusIs(refund.status, "pending");
/** A settled refund must not be re-opened by a partial adjustment. */
const isAdjustable = (refund: Refund) => statusIs(refund.status, "pending", "processing");

export default function Refunds() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [search, setSearch] = useState("");
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string; amount: number }>({ open: false, id: "", amount: 0 });
  const [partialDialog, setPartialDialog] = useState<{ open: boolean; id: string; max: number }>({ open: false, id: "", max: 0 });
  const [partialAmount, setPartialAmount] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: refunds = [], isLoading, isError, refetch } = useQuery({ queryKey: ["refunds"], queryFn: api.refunds.list, refetchInterval: 30000 });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["refunds"] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.refunds.approve(id),
    onSuccess: (_, id) => { const r = refunds.find(r => r.id === id); toast.success(`Refund ${id} approved — ${fmtINRFull(r?.amount ?? 0)} will be processed`); invalidate(); },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.refunds.reject(id, reason),
    // The dialog only clears once the rejection has actually landed, so a failed
    // request leaves the typed reason where the user can retry it.
    onSuccess: (_, { id }) => { toast.error(`Refund ${id} rejected`); setRejectDialog({ open: false, id: "", amount: 0 }); setRejectReason(""); invalidate(); },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.refunds.retry(id),
    onSuccess: (_, id) => { toast.success(`Refund ${id} retry initiated`); invalidate(); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.refunds.cancel(id),
    onSuccess: (_, id) => { toast.info(`Refund ${id} cancelled`); invalidate(); },
  });

  const partialMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.refunds.partial(id, amount),
    onSuccess: () => { setPartialDialog({ open: false, id: "", max: 0 }); setPartialAmount(""); toast.success("Partial refund updated"); invalidate(); },
  });

  const escalateMutation = useMutation({
    mutationFn: (id: string) => api.refunds.escalate(id, { reason: "High-value refund requires approval" }),
    onSuccess: (_, id) => { toast.warning(`Refund ${id} escalated to approvals`); invalidate(); },
  });

  const filtered = refunds.filter(r => r.id.toLowerCase().includes(search.toLowerCase()) || r.vendorName.toLowerCase().includes(search.toLowerCase()) || r.customerName.toLowerCase().includes(search.toLowerCase()));
  const pendingRefunds = refunds.filter(isPending);
  const totalPending = pendingRefunds.reduce((s, r) => s + r.amount, 0);

  const partialValue = Number(partialAmount);
  const partialInvalid = !partialAmount || Number.isNaN(partialValue) || partialValue <= 0 || partialValue > partialDialog.max;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div><h2 className="text-2xl font-bold tracking-tight">Refund Management</h2><p className="text-muted-foreground">Approve, reject, partial refund, retry, cancel, and escalate requests.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Pending" value={pendingRefunds.length} icon={<Eye className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Approved" value={refunds.filter(r => statusIs(r.status, "approved")).length} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Pending Amount" value={fmtINRFull(totalPending)} icon={<XCircle className="h-4 w-4 text-orange-500" />} />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search refund ID, vendor..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filtered}
            loading={isLoading}
            error={isError}
            onRetry={() => { void refetch(); }}
            errorMessage="We could not load the refund queue."
            emptyMessage="No refund requests"
            emptyDescription="Refunds raised by vendors or customers will appear here."
            columns={[
              { header: "Refund ID", cell: (row: Refund) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", accessorKey: "vendorName", sortable: true },
              { header: "Customer", accessorKey: "customerName", sortable: true },
              { header: "Amount", sortable: true, sortValue: (row: Refund) => row.amount, cell: (row: Refund) => <span className="font-medium text-destructive">{fmtINRFull(row.amount)}</span> },
              { header: "Type", cell: (row: Refund) => <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{row.type}</span> },
              { header: "Reason", cell: (row: Refund) => <span className="text-xs text-muted-foreground">{row.reason}</span> },
              { header: "Status", sortable: true, sortValue: (row: Refund) => row.status, cell: (row: Refund) => <StatusBadge status={statusLabel(row.status)} /> },
              { header: "Actions", cell: (row: Refund) => (
                <div className="flex items-center gap-1 flex-wrap">
                  <AsyncButton
                    size="sm" variant="outline" className="text-green-500 border-green-500/30 h-7 text-xs"
                    disabled={!isPending(row)}
                    errorMessage="Failed to approve refund"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Approve refund of ${fmtINRFull(row.amount)}?`,
                        description: `${row.id} will be sent for processing to ${row.customerName}. This cannot be undone.`,
                        confirmLabel: "Approve refund",
                      });
                      if (!ok) return;
                      await approveMutation.mutateAsync(row.id);
                    }}
                  >Approve</AsyncButton>
                  <Button size="sm" variant="outline" className="text-red-500 border-red-500/30 h-7 text-xs" disabled={!isPending(row)} onClick={() => { setRejectDialog({ open: true, id: row.id, amount: row.amount }); setRejectReason(""); }}>Reject</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!isAdjustable(row)} onClick={() => { setPartialDialog({ open: true, id: row.id, max: row.amount }); setPartialAmount(String(row.amount)); }}>Partial</Button>
                  <AsyncButton size="sm" variant="ghost" className="h-7 text-xs" title="Retry" errorMessage="Retry failed" onClick={() => retryMutation.mutateAsync(row.id)}><RotateCcw className="h-3 w-3" /></AsyncButton>
                  <AsyncButton
                    size="sm" variant="ghost" className="h-7 text-xs text-red-400" title="Cancel"
                    errorMessage="Cancel failed"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Cancel refund ${row.id}?`,
                        description: "The customer will not receive this refund.",
                        destructive: true,
                        confirmLabel: "Cancel refund",
                        cancelLabel: "Keep it",
                      });
                      if (!ok) return;
                      await cancelMutation.mutateAsync(row.id);
                    }}
                  ><Ban className="h-3 w-3" /></AsyncButton>
                  <AsyncButton size="sm" variant="ghost" className="h-7 text-xs text-orange-500" title="Escalate" errorMessage="Escalation failed" onClick={() => escalateMutation.mutateAsync(row.id)}><ArrowUpRight className="h-3 w-3" /></AsyncButton>
                </div>
              )},
            ]}
          />
        </CardContent>
      </Card>
      <Dialog open={rejectDialog.open} onOpenChange={open => { if (!open) setRejectDialog({ open: false, id: "", amount: 0 }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Refund — {fmtINRFull(rejectDialog.amount)}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Provide a reason for rejection. The customer will be notified.</p>
          <Textarea placeholder="e.g. Order was delivered successfully per our records..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: "", amount: 0 })}>Cancel</Button>
            <AsyncButton
              variant="destructive" disabled={!rejectReason.trim()} pendingLabel="Rejecting…"
              errorMessage="Failed to reject refund"
              onClick={() => rejectMutation.mutateAsync({ id: rejectDialog.id, reason: rejectReason })}
            >Confirm Rejection</AsyncButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={partialDialog.open} onOpenChange={open => { if (!open) setPartialDialog({ open: false, id: "", max: 0 }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Partial Refund (max {fmtINRFull(partialDialog.max)})</DialogTitle></DialogHeader>
          <Input type="number" min="0" max={partialDialog.max} value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="Amount" />
          {partialAmount && partialInvalid && (
            <p className="text-xs text-destructive">Enter an amount above zero and no more than {fmtINRFull(partialDialog.max)}.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialDialog({ open: false, id: "", max: 0 })}>Cancel</Button>
            <AsyncButton
              disabled={partialInvalid} pendingLabel="Applying…"
              errorMessage="Partial refund failed"
              onClick={() => partialMutation.mutateAsync({ id: partialDialog.id, amount: partialValue })}
            >Apply Partial</AsyncButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
