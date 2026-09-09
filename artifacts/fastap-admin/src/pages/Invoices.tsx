import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/Page";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KpiCard } from "@/components/shared/KpiCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Mail, RefreshCw, Loader2, Receipt, Eye, AlertTriangle } from "lucide-react";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * A subscription invoice's "Paid" is not a payment — the server computes it as
 * `amount === 0 ? "Paid" : (restaurant.isActive ? "Paid" : "Unpaid")`, so every
 * switched-on venue is paid by definition and the receivables total can never show a
 * debtor. Nothing has ever been collected against one: there is no subscriptions table,
 * no gateway call and no finance row anywhere carrying a subscription payment.
 *
 * Commission invoices are different — they carry a real settlement figure and a real
 * pending/paid state — so only the subscription rows are marked here.
 */
const isAssertedStatus = (row: { type?: string }) => row.type === "Subscription";

export default function Invoices() {
  const { data: invoices = [], isLoading, refetch, isFetching } = useQuery({ queryKey: ["invoices"], queryFn: api.invoices.list });
  const [viewing, setViewing] = useState<any | null>(null);

  const subscriptionInvoices = invoices.filter((i: any) => isAssertedStatus(i) && i.amount > 0);
  const uncollected = subscriptionInvoices.reduce((s: number, i: any) => s + i.amount, 0);

  // Anything not yet paid is outstanding — "Pending" (e.g. unpaid commission invoices)
  // counts too, not only "Unpaid"/"Overdue". Otherwise the Outstanding total showed ₹0
  // even when a pending invoice was clearly owed.
  const unpaid = invoices.filter((i: any) => !isAssertedStatus(i) && i.status !== "Paid");
  const totalUnpaid = unpaid.reduce((s: number, i: any) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Subscription and commission invoices raised against each vendor."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => api.invoices.exportAll().then(() => toast.success("Invoices exported")).catch(() => toast.error("Export failed"))}>
              <Download className="mr-2 h-4 w-4" /> Export all
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </>
        }
      />

      {subscriptionInvoices.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Subscription invoices are not backed by a payment record</AlertTitle>
          <AlertDescription>
            Their status is derived from whether the venue is switched on, not from money received —
            no subscription payment has ever been recorded on this platform. Treat {fmt(uncollected)}
            {" "}across {subscriptionInvoices.length} {subscriptionInvoices.length === 1 ? "invoice" : "invoices"} as
            uncollected until subscription billing is connected to the payment gateway.
            Commission invoices below carry real settlement figures.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard title="Invoices raised" value={invoices.length} icon={<Receipt />} />
        <KpiCard title="Commission outstanding" value={fmt(totalUnpaid)} icon={<Receipt />} subtitle={`${unpaid.length} unpaid`} />
        <KpiCard title="Subscriptions uncollected" value={fmt(uncollected)} icon={<Receipt />} subtitle="No payment recorded" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">All invoices</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : invoices.length === 0 ? (
            <EmptyState title="No invoices yet" description="Invoices appear once a vendor is on a paid plan or a settlement has been commissioned." />
          ) : (
            <DataTable data={invoices} pageSize={10} columns={[
              { header: "Invoice #", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", accessorKey: "vendorName" },
              { header: "Type", cell: (row: any) => <Badge variant="muted">{row.type}</Badge> },
              { header: "Amount", cell: (row: any) => <span className="tabular-nums font-medium">{fmt(row.amount)}</span> },
              { header: "Issued", cell: (row: any) => <span className="text-xs text-muted-foreground tabular-nums">{row.date}</span> },
              { header: "Due", cell: (row: any) => { const overdue = new Date(row.dueDate) < new Date() && row.status !== "Paid"; return <span className={`text-xs tabular-nums ${overdue ? "font-medium text-danger" : "text-muted-foreground"}`}>{row.dueDate}</span>; } },
              {
                header: "Status",
                cell: (row: any) => isAssertedStatus(row)
                  // Was a green "Paid" badge on money nobody has received.
                  ? <Badge variant="muted" title="Derived from the vendor being active — no payment is recorded against this invoice">Not recorded</Badge>
                  : <StatusBadge status={row.status} />,
              },
              { header: "Actions", cell: (row: any) => (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" title="View" aria-label={`View invoice ${row.id}`} onClick={() => setViewing(row)}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon-sm" title="Download" aria-label={`Download invoice ${row.id}`} onClick={() => api.invoices.download(row.id).catch(() => toast.error("Download failed"))}><Download className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon-sm" title="Email to vendor" aria-label={`Email invoice ${row.id}`} onClick={() => api.invoices.email(row.id).then(() => toast.success(`Invoice ${row.id} emailed`)).catch(() => toast.error("Email failed"))}><Mail className="h-3.5 w-3.5" /></Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invoice {viewing?.id}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Vendor</span><span className="font-medium">{viewing.vendorName}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Type</span><span>{viewing.type}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Amount</span><span className="font-medium tabular-nums">{fmt(viewing.amount)}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Issued</span><span className="tabular-nums">{viewing.date}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Due</span><span className="tabular-nums">{viewing.dueDate}</span></div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {isAssertedStatus(viewing)
                  ? <Badge variant="muted">Not recorded</Badge>
                  : <StatusBadge status={viewing.status} />}
              </div>
              {isAssertedStatus(viewing) && (
                <p className="text-xs text-muted-foreground">
                  This status follows the vendor's active flag. No payment has been recorded against it.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            <Button onClick={() => viewing && api.invoices.download(viewing.id).catch(() => toast.error("Download failed"))}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
