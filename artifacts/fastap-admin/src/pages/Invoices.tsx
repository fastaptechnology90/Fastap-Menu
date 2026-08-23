import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/KpiCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Mail, RefreshCw, Loader2, Receipt, Eye } from "lucide-react";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function Invoices() {
  const { data: invoices = [], isLoading, refetch, isFetching } = useQuery({ queryKey: ["invoices"], queryFn: api.invoices.list });
  const [viewing, setViewing] = useState<any | null>(null);

  // Anything not yet paid is outstanding — "Pending" (e.g. unpaid commission invoices)
  // counts too, not only "Unpaid"/"Overdue". Otherwise the Outstanding total showed ₹0
  // even when a pending invoice was clearly owed.
  const unpaid = invoices.filter((i: any) => i.status !== "Paid");
  const totalUnpaid = unpaid.reduce((s: number, i: any) => s + i.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">Invoice Management</h2><p className="text-muted-foreground">Track vendor billing and generated invoices.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => api.invoices.exportAll().then(() => toast.success("Invoices exported")).catch(() => toast.error("Export failed"))}>
            <Download className="mr-2 h-4 w-4" /> Export All
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Total Invoices" value={invoices.length} icon={<Receipt className="h-4 w-4 text-primary" />} />
        <KpiCard title="Unpaid / Pending" value={unpaid.length} icon={<Receipt className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Outstanding Amount" value={fmt(totalUnpaid)} icon={<Receipt className="h-4 w-4 text-orange-500" />} />
      </div>

      <Card>
        <CardHeader><CardTitle>All Invoices</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable data={invoices} pageSize={10} columns={[
              { header: "Invoice #", cell: (row: any) => <span className="font-mono text-xs font-bold">{row.id}</span> },
              { header: "Vendor", accessorKey: "vendorName" },
              { header: "Type", cell: (row: any) => <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{row.type}</span> },
              { header: "Amount", cell: (row: any) => <span className="font-medium">{fmt(row.amount)}</span> },
              { header: "Date Issued", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.date}</span> },
              { header: "Due Date", cell: (row: any) => { const overdue = new Date(row.dueDate) < new Date() && row.status !== "Paid"; return <span className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{row.dueDate}</span>; } },
              { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
              { header: "Actions", cell: (row: any) => (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewing(row)}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" onClick={() => api.invoices.download(row.id).catch(() => toast.error("Download failed"))}><Download className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Email to Vendor" onClick={() => api.invoices.email(row.id).then(() => toast.success(`Invoice ${row.id} emailed`)).catch(() => toast.error("Email failed"))}><Mail className="h-3.5 w-3.5" /></Button>
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
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Amount</span><span className="font-bold text-primary">{fmt(viewing.amount)}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Date Issued</span><span>{viewing.date}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Due Date</span><span>{viewing.dueDate}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span><StatusBadge status={viewing.status} /></div>
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
