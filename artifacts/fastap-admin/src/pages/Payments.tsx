import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Payment, type PaymentDetail } from "@/lib/apiClient";
import { fmtINR, fmtINRFull } from "@/lib/format";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Download, CheckCircle, XCircle, RefreshCcw, Loader2, Eye, PauseCircle, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/Page";

export default function Payments() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all"); // all | 7 | 15 | 30 (days)
  const [detailId, setDetailId] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState("");

  const { data: payments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["superadmin-payments"],
    queryFn: () => api.payments.list({ limit: 200 }),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["payment-detail", detailId],
    queryFn: () => api.payments.get(detailId!),
    enabled: !!detailId,
  });

  const holdMutation = useMutation({
    mutationFn: () => api.payments.hold(detailId!, holdReason),
    onSuccess: () => { toast.success("Transaction held"); qc.invalidateQueries({ queryKey: ["superadmin-payments"] }); qc.invalidateQueries({ queryKey: ["payment-detail", detailId] }); setHoldReason(""); },
    onError: () => toast.error("Hold failed"),
  });

  const retryMutation = useMutation({
    mutationFn: () => api.payments.retry(detailId!),
    // A retry can flip the transaction to paid, which changes the row in the table behind the
    // dialog and every downstream payout figure — refreshing only the dialog looked like a no-op.
    onSuccess: (r: any) => {
      toast.success(r?.paymentStatus === "paid" ? "Payment captured" : "Retry attempted — still unpaid");
      qc.invalidateQueries({ queryKey: ["payment-detail", detailId] });
      qc.invalidateQueries({ queryKey: ["superadmin-payments"] });
      qc.invalidateQueries({ queryKey: ["superadmin-settlements"] });
    },
    onError: (e: Error) => toast.error(e.message || "Retry failed"),
  });

  const refundMutation = useMutation({
    mutationFn: () => api.payments.refund(detailId!, { reason: "Admin initiated from payments" }),
    onSuccess: () => {
      toast.success("Refund initiated");
      qc.invalidateQueries({ queryKey: ["refunds"] });
      qc.invalidateQueries({ queryKey: ["superadmin-payments"] });
      qc.invalidateQueries({ queryKey: ["payment-detail", detailId] });
      qc.invalidateQueries({ queryKey: ["superadmin-settlements"] });
    },
    onError: (e: Error) => toast.error(e.message || "Refund failed"),
  });

  const nowMs = Date.now();
  const filtered = payments.filter(t => {
    const q = searchTerm.toLowerCase();
    const matchSearch = t.id.toLowerCase().includes(q) ||
      t.vendorName.toLowerCase().includes(q) ||
      t.orderId.toLowerCase().includes(q) ||
      String((t as any).utr ?? "").toLowerCase().includes(q) ||
      String(t.paymentMode ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchPeriod = periodFilter === "all" ||
      (nowMs - new Date(t.dateTime).getTime()) <= Number(periodFilter) * 86_400_000;
    return matchSearch && matchStatus && matchPeriod;
  });

  const PERIODS: [string, string][] = [["all", "All"], ["7", "7 Days"], ["15", "15 Days"], ["30", "30 Days"]];

  // Payment-method chip — UPI / Cash / Card / Gateway clearly labelled + colour-coded.
  const modeBadge = (mode?: string) => {
    const m = (mode || "").toLowerCase();
    const label = m === "upi" ? "UPI" : m === "cash" ? "Cash" : m === "card" ? "Card"
      : (m.includes("gateway") || m.includes("online") || m.includes("razor")) ? "Gateway"
      : m === "aggregator" ? "Aggregator" : m === "wallet" ? "Wallet"
      : (m === "room_bill" || m === "room") ? "Room Bill" : m === "netbanking" ? "Netbanking" : (mode || "—");
    const cls = m === "upi" ? "bg-success-subtle text-success"
      : m === "cash" ? "bg-warning-subtle text-warning"
      : m === "card" ? "bg-info-subtle text-info"
      : (m.includes("gateway") || m.includes("online") || m.includes("razor")) ? "bg-muted text-muted-foreground"
      : m === "aggregator" ? "bg-muted text-muted-foreground"
      : (m === "room_bill" || m === "room") ? "bg-info-subtle text-info"
      : "bg-muted text-muted-foreground";
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase ${cls}`}>{label}</span>;
  };

  const successCount = payments.filter(t => t.status === "success" || t.status === "paid").length;
  const failedCount = payments.filter(t => t.status === "failed").length;
  const total = payments.length || 1;
  const successRate = ((successCount / total) * 100).toFixed(1);
  const failedRate = ((failedCount / total) * 100).toFixed(1);
  // Only paid transactions count toward volume/revenue — matches the dashboard,
  // analytics and settlements figures (failed/pending attempts don't inflate it).
  const totalGross = payments.reduce((s, t) => s + ((t as any).isPaid ? t.grossAmount : 0), 0);

  const exportCsv = () => {
    const header = "id,orderId,vendor,gross,commission,net,mode,status,date\n";
    const rows = filtered.map(t => [t.id, t.orderId, t.vendorName, t.grossAmount, t.commission, t.netPayout, t.paymentMode, t.status, t.dateTime].join(","));
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const suffix = periodFilter === "all" ? "all" : `last-${periodFilter}d`;
    const a = document.createElement("a"); a.href = url; a.download = `payments-${suffix}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} transactions${periodFilter === "all" ? "" : ` (last ${periodFilter} days)`}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Every transaction the platform has seen, with its gateway reference and settlement state."
        badge={<Badge variant="muted">{isLoading ? "Loading…" : `${payments.length} transactions`}</Badge>}
        actions={
          <>
            <Button variant="outline" size="icon-sm" aria-label="Refresh" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Success Rate" value={`${successRate}%`} icon={<CheckCircle className="h-4 w-4 text-success" />} />
        <KpiCard title="Failed Rate" value={`${failedRate}%`} icon={<XCircle className="h-4 w-4 text-danger" />} />
        <KpiCard title="Paid Volume" value={fmtINR(totalGross)} />
        <KpiCard title="Total Txns" value={payments.length.toLocaleString()} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <CardTitle>Transactions</CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search TXN, UTR, vendor, mode…" className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex rounded-lg border p-0.5">
                {PERIODS.map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setPeriodFilter(val)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${periodFilter === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <DataTable
              data={filtered}
              pageSize={10}
              onRowClick={(row: Payment) => setDetailId(row.id)}
              error={isError}
              onRetry={() => { void refetch(); }}
              errorMessage="We could not load transactions."
              emptyMessage="No transactions"
              emptyDescription="Payments taken through the platform appear here."
              columns={[
                { header: "TXN ID", cell: (row: Payment) => <span className="font-mono text-xs">{row.id}</span> },
                { header: "Vendor", cell: (row: Payment) => <span className="font-medium">{row.vendorName}</span> },
                { header: "Gross", cell: (row: Payment) => <span className="font-medium">{fmtINRFull(row.grossAmount)}</span> },
                { header: "Commission", cell: (row: Payment) => <span className="text-muted-foreground text-sm">-{fmtINRFull(row.commission)}</span> },
                { header: "Net", cell: (row: Payment) => <span className="font-bold text-success">{fmtINRFull(row.netPayout)}</span> },
                { header: "Mode", cell: (row: Payment) => modeBadge(row.paymentMode) },
                { header: "Date", cell: (row: Payment) => <span className="text-xs text-muted-foreground">{new Date(row.dateTime).toLocaleDateString()}</span> },
                { header: "Status", cell: (row: Payment) => <StatusBadge status={row.status} /> },
                { header: "", cell: (row: Payment) => (
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setDetailId(row.id)}><Eye className="h-3.5 w-3.5" /></Button>
                )},
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailId} onOpenChange={o => !o && setDetailId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payment Details</DialogTitle></DialogHeader>
          {detailLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-muted-foreground">Transaction</Label><p className="font-mono">{detail.id}</p></div>
                <div><Label className="text-muted-foreground">Order</Label><p className="font-mono">{detail.orderId}</p></div>
                <div><Label className="text-muted-foreground">Vendor</Label><p>{detail.vendorName}</p></div>
                <div><Label className="text-muted-foreground">Gateway ID</Label><p className="font-mono text-xs">{detail.gatewayTxnId}</p></div>
                <div><Label className="text-muted-foreground">Gross</Label><p className="font-bold">{fmtINRFull(detail.grossAmount)}</p></div>
                <div><Label className="text-muted-foreground">Net Payout</Label><p>{fmtINRFull(detail.netPayout)}</p></div>
                <div><Label className="text-muted-foreground">Payment method</Label>{modeBadge(detail.paymentMode)}</div>
                <div><Label className="text-muted-foreground">UPI ID</Label><p className="break-all">{detail.upiId || "—"}</p></div>
                <div><Label className="text-muted-foreground">UTR / Reference</Label><p className="break-all">{detail.reference || detail.utr || "—"}</p></div>
                <div><Label className="text-muted-foreground">Collected by</Label><p>{detail.collectedBy || "—"}</p></div>
                <div><Label className="text-muted-foreground">From panel</Label><p>{detail.collectedFrom || "—"}</p></div>
                <div><Label className="text-muted-foreground">Customer</Label><p>{detail.customerName || "—"}</p></div>
                <div><Label className="text-muted-foreground">Table / Room</Label><p>{detail.tableName || detail.roomNumber || "—"}</p></div>
                <div><Label className="text-muted-foreground">Status</Label><StatusBadge status={detail.status} /></div>
                {detail.held && <div className="col-span-2"><Badge variant="destructive">On Hold</Badge></div>}
              </div>
              {!detail.held && (
                <div className="space-y-1">
                  <Label>Hold reason (optional)</Label>
                  <Textarea value={holdReason} onChange={e => setHoldReason(e.target.value)} rows={2} placeholder="Risk review, dispute..." />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={retryMutation.isPending} onClick={() => retryMutation.mutate()}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry</Button>
            <Button variant="outline" size="sm" disabled={holdMutation.isPending || detail?.held} onClick={() => holdMutation.mutate()}><PauseCircle className="h-3.5 w-3.5 mr-1" /> Hold</Button>
            <Button
              variant="outline" size="sm" disabled={refundMutation.isPending}
              onClick={async () => {
                // A full refund is irreversible and was firing on a single click with no prompt.
                const ok = await confirm({
                  title: `Refund ${detail ? fmtINRFull(detail.grossAmount) : "this transaction"}?`,
                  description: `A full refund is raised against ${detail?.orderId ?? "this order"} and the payment is marked refunded. This cannot be undone here.`,
                  destructive: true,
                  confirmLabel: "Refund in full",
                });
                if (!ok) return;
                refundMutation.mutate();
              }}
            ><Undo2 className="h-3.5 w-3.5 mr-1" /> Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
