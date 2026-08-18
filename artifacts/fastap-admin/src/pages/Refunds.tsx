import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, CheckCircle, XCircle, Eye, Loader2, RotateCcw, Ban, ArrowUpRight } from "lucide-react";
import { api, type Refund } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { toast } from "sonner";
import { KpiCard } from "@/components/shared/KpiCard";

export default function Refunds() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string; amount: number }>({ open: false, id: "", amount: 0 });
  const [partialDialog, setPartialDialog] = useState<{ open: boolean; id: string; max: number }>({ open: false, id: "", max: 0 });
  const [partialAmount, setPartialAmount] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: refunds = [], isLoading } = useQuery({ queryKey: ["refunds"], queryFn: api.refunds.list, refetchInterval: 30000 });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["refunds"] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.refunds.approve(id),
    onSuccess: (_, id) => { const r = refunds.find(r => r.id === id); toast.success(`Refund ${id} approved — ${fmtINRFull(r?.amount ?? 0)} will be processed`); invalidate(); },
    onError: () => toast.error("Failed to approve refund"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.refunds.reject(id, reason),
    onSuccess: (_, { id }) => { toast.error(`Refund ${id} rejected`); setRejectDialog({ open: false, id: "", amount: 0 }); setRejectReason(""); invalidate(); },
    onError: () => toast.error("Failed to reject refund"),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.refunds.retry(id),
    onSuccess: (_, id) => { toast.success(`Refund ${id} retry initiated`); invalidate(); },
    onError: () => toast.error("Retry failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.refunds.cancel(id),
    onSuccess: (_, id) => { toast.info(`Refund ${id} cancelled`); invalidate(); },
    onError: () => toast.error("Cancel failed"),
  });

  const partialMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.refunds.partial(id, amount),
    onSuccess: () => { setPartialDialog({ open: false, id: "", max: 0 }); setPartialAmount(""); toast.success("Partial refund updated"); invalidate(); },
    onError: () => toast.error("Partial refund failed"),
  });

  const escalateMutation = useMutation({
    mutationFn: (id: string) => api.refunds.escalate(id, { reason: "High-value refund requires approval" }),
    onSuccess: (_, id) => { toast.warning(`Refund ${id} escalated to approvals`); invalidate(); },
    onError: () => toast.error("Escalation failed"),
  });

  const filtered = refunds.filter(r => r.id.toLowerCase().includes(search.toLowerCase()) || r.vendorName.toLowerCase().includes(search.toLowerCase()) || r.customerName.toLowerCase().includes(search.toLowerCase()));
  const totalPending = refunds.filter(r => r.status === "Pending").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div><h2 className="text-2xl font-bold tracking-tight">Refund Management</h2><p className="text-muted-foreground">Approve, reject, partial refund, retry, cancel, and escalate requests.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Pending" value={refunds.filter(r => r.status === "Pending").length} icon={<Eye className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Approved Today" value={refunds.filter(r => r.status === "Approved").length} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Pending Amount" value={fmtINRFull(totalPending)} icon={<XCircle className="h-4 w-4 text-orange-500" />} />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search refund ID, vendor..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable data={filtered} columns={[
              { header: "Refund ID", cell: (row: Refund) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", accessorKey: "vendorName" },
              { header: "Customer", accessorKey: "customerName" },
              { header: "Amount", cell: (row: Refund) => <span className="font-medium text-destructive">{fmtINRFull(row.amount)}</span> },
              { header: "Type", cell: (row: Refund) => <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{row.type}</span> },
              { header: "Reason", cell: (row: Refund) => <span className="text-xs text-muted-foreground">{row.reason}</span> },
              { header: "Status", cell: (row: Refund) => <StatusBadge status={row.status} /> },
              { header: "Actions", cell: (row: Refund) => (
                <div className="flex items-center gap-1 flex-wrap">
                  <Button size="sm" variant="outline" className="text-green-500 border-green-500/30 h-7 text-xs" disabled={row.status !== "Pending" || approveMutation.isPending} onClick={() => approveMutation.mutate(row.id)}>Approve</Button>
                  <Button size="sm" variant="outline" className="text-red-500 border-red-500/30 h-7 text-xs" disabled={row.status !== "Pending"} onClick={() => { setRejectDialog({ open: true, id: row.id, amount: row.amount }); setRejectReason(""); }}>Reject</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setPartialDialog({ open: true, id: row.id, max: row.amount }); setPartialAmount(String(row.amount)); }}>Partial</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => retryMutation.mutate(row.id)}><RotateCcw className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => cancelMutation.mutate(row.id)}><Ban className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-orange-500" onClick={() => escalateMutation.mutate(row.id)}><ArrowUpRight className="h-3 w-3" /></Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
      <Dialog open={rejectDialog.open} onOpenChange={open => setRejectDialog({ open, id: "", amount: 0 })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Refund — {fmtINRFull(rejectDialog.amount)}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Provide a reason for rejection. The customer will be notified.</p>
          <Textarea placeholder="e.g. Order was delivered successfully per our records..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: "", amount: 0 })}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || rejectMutation.isPending} onClick={() => rejectMutation.mutate({ id: rejectDialog.id, reason: rejectReason })}>
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={partialDialog.open} onOpenChange={open => setPartialDialog({ open, id: "", max: 0 })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Partial Refund (max {fmtINRFull(partialDialog.max)})</DialogTitle></DialogHeader>
          <Input type="number" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="Amount" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialDialog({ open: false, id: "", max: 0 })}>Cancel</Button>
            <Button disabled={!partialAmount || partialMutation.isPending} onClick={() => partialMutation.mutate({ id: partialDialog.id, amount: Number(partialAmount) })}>Apply Partial</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
