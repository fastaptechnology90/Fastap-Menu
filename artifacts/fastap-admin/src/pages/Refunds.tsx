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
import { PageHeader } from "@/components/shared/Page";

/** The API returns the stored status verbatim — `pending`, not `Pending`. */
const isPending = (refund: Refund) => statusIs(refund.status, "pending");
/** A settled refund must not be re-opened by a partial adjustment. */
const isAdjustable = (refund: Refund) => statusIs(refund.status, "pending", "processing");

/**
 * The queue mixes two kinds of row: real refund records (`REF-12`) and read-only
 * history synthesised from already-refunded orders (`REF-ORD-12`). Only the first
 * kind is addressable — the action routes strip the prefix and look the number up
 * in the refunds table, so acting on `REF-ORD-12` writes to refund #12, an
 * unrelated customer's record. Actions stay off for the synthetic rows.
 */
const isActionable = (refund: Refund) => !/^REF-ORD-/i.test(refund.id);

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

  const q = search.toLowerCase().trim();
  const filtered = refunds.filter(r => {
    if (!q) return true;
    return (
      r.id.toLowerCase().includes(q)
      || r.vendorName.toLowerCase().includes(q)
      || r.customerName.toLowerCase().includes(q)
      || String(r.vendorId ?? "").includes(q)
    );
  });
  const pendingRefunds = refunds.filter(isPending);
  const totalPending = pendingRefunds.reduce((s, r) => s + r.amount, 0);

  const partialValue = Number(partialAmount);
  const partialInvalid = !partialAmount || Number.isNaN(partialValue) || partialValue <= 0 || partialValue > partialDialog.max;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refund Management"
        description="Approve, reject, partial refund, retry, cancel, and escalate requests."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Pending" value={pendingRefunds.length} icon={<Eye className="h-4 w-4 text-warning" />} />
        <KpiCard title="Approved" value={refunds.filter(r => statusIs(r.status, "approved")).length} icon={<CheckCircle className="h-4 w-4 text-success" />} />
        <KpiCard title="Pending Amount" value={fmtINRFull(totalPending)} icon={<XCircle className="h-4 w-4 text-warning" />} />
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
              { header: "Vendor", sortable: true, sortValue: (row: Refund) => row.vendorName, cell: (row: Refund) => (
                <div>
                  <p className="text-sm font-medium">{row.vendorName}</p>
                  {row.vendorId ? (
                    <p className="font-mono text-[10px] text-muted-foreground">#{row.vendorId}</p>
                  ) : (
                    <p className="text-[10px] text-warning">No vendor id</p>
                  )}
                </div>
              ) },
              { header: "Customer", accessorKey: "customerName", sortable: true },
              { header: "Amount", sortable: true, sortValue: (row: Refund) => row.amount, cell: (row: Refund) => <span className="font-medium text-destructive">{fmtINRFull(row.amount)}</span> },
              { header: "Type", cell: (row: Refund) => <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{row.type}</span> },
              { header: "Reason", cell: (row: Refund) => <span className="text-xs text-muted-foreground">{row.reason}</span> },
              { header: "Status", sortable: true, sortValue: (row: Refund) => row.status, cell: (row: Refund) => <StatusBadge status={statusLabel(row.status)} /> },
              { header: "Actions", cell: (row: Refund) => (
                <div className="flex items-center gap-1 flex-wrap">
                  <AsyncButton
                    size="sm" variant="outline" className="text-success border-success-border h-7 text-xs"
                    disabled={!isPending(row) || !isActionable(row)}
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
                  <Button size="sm" variant="outline" className="text-danger border-danger-border h-7 text-xs" disabled={!isPending(row) || !isActionable(row)} onClick={() => { setRejectDialog({ open: true, id: row.id, amount: row.amount }); setRejectReason(""); }}>Reject</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!isAdjustable(row) || !isActionable(row)} onClick={() => { setPartialDialog({ open: true, id: row.id, max: row.amount }); setPartialAmount(String(row.amount)); }}>Partial</Button>
                  <AsyncButton size="sm" variant="ghost" className="h-7 text-xs" title="Retry" disabled={!isActionable(row)} errorMessage="Retry failed" onClick={() => retryMutation.mutateAsync(row.id)}><RotateCcw className="h-3 w-3" /></AsyncButton>
                  <AsyncButton
                    size="sm" variant="ghost" className="h-7 text-xs text-danger" title="Cancel"
                    disabled={!isActionable(row)}
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
                  <AsyncButton size="sm" variant="ghost" className="h-7 text-xs text-warning" title="Escalate" disabled={!isActionable(row)} errorMessage="Escalation failed" onClick={() => escalateMutation.mutateAsync(row.id)}><ArrowUpRight className="h-3 w-3" /></AsyncButton>
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
