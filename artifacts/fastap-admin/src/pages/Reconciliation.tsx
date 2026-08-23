import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Loader2, CheckCircle, AlertTriangle, XCircle, GitMerge, Download, Play, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fmtINR, fmtINRFull } from "@/lib/format";
import { downloadCsv } from "@/lib/download";

export default function Reconciliation() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [investigate, setInvestigate] = useState<any | null>(null);

  const { data: recon, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["reconciliation"],
    queryFn: api.reconciliation.get,
  });

  const runReconciliation = useMutation({
    mutationFn: api.reconciliation.run,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reconciliation"] }); toast({ title: "Reconciliation run complete" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const adjustMutation = useMutation({
    mutationFn: (id: string) => api.reconciliation.adjust(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reconciliation"] }); toast({ title: "Manual adjustment applied" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const summary = recon?.summary || { matched: 0, mismatched: 0, missing: 0, duplicates: 0, totalAmount: 0 };
  const discrepancies = (recon?.discrepancies || []).filter((d: any) =>
    d.id?.toLowerCase().includes(search.toLowerCase()) || d.vendorName?.toLowerCase().includes(search.toLowerCase())
  );
  const matched = (recon?.matched || []).filter((m: any) =>
    m.id?.toLowerCase().includes(search.toLowerCase()) ||
    m.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    m.paymentMode?.toLowerCase().includes(search.toLowerCase())
  );

  const exportReport = () => {
    const rows = (recon?.discrepancies || []) as any[];
    if (!rows.length) { toast({ title: "Nothing to export", description: "No discrepancy rows loaded." }); return; }
    downloadCsv(rows.map((d: any) => ({
      "TXN ID": d.id,
      Vendor: d.vendorName ?? "",
      "Gateway Amount": d.gatewayAmount ?? 0,
      "Bank Amount": d.bankAmount ?? 0,
      Difference: d.difference ?? 0,
      Type: d.discrepancyType ?? "",
      Date: d.date ?? "",
    })), `reconciliation-discrepancies-${new Date().toISOString().split("T")[0]}.csv`);
    toast({ title: "Discrepancy report exported" });
  };

  const statusColor: Record<string, string> = {
    Matched: "text-green-400",
    Mismatch: "text-red-400",
    Missing: "text-orange-400",
    Duplicate: "text-purple-400",
  };
  const payColor = (mode?: string) => {
    const m = (mode || "").toLowerCase();
    if (m.includes("upi")) return "bg-emerald-500/15 text-emerald-400";
    if (m.includes("card")) return "bg-blue-500/15 text-blue-400";
    if (m.includes("gateway") || m.includes("razor") || m.includes("online")) return "bg-violet-500/15 text-violet-400";
    if (m.includes("cash")) return "bg-amber-500/15 text-amber-400";
    if (m.includes("wallet")) return "bg-pink-500/15 text-pink-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Financial Reconciliation Engine</h2>
          <p className="text-muted-foreground">Gateway vs bank matching, settlement mismatches, duplicate detection.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" onClick={exportReport}><Download className="mr-2 h-4 w-4" /> Export Report</Button>
          <Button onClick={() => runReconciliation.mutate()} disabled={runReconciliation.isPending}>
            {runReconciliation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run Auto Reconciliation
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <KpiCard title="Matched" value={summary.matched} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Mismatched" value={summary.mismatched} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Missing" value={summary.missing} icon={<XCircle className="h-4 w-4 text-orange-500" />} />
        <KpiCard title="Duplicates" value={summary.duplicates} icon={<GitMerge className="h-4 w-4 text-purple-500" />} />
        <KpiCard title="Total Reviewed" value={fmtINR(summary.totalAmount)} icon={<CheckCircle className="h-4 w-4 text-primary" />} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Reconciliation Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Gateway vs Bank", value: `${summary.matched}/${summary.matched + summary.mismatched}`, status: "ok" },
              { label: "Settlement Match", value: `${100 - Math.round((summary.mismatched / Math.max(summary.matched + summary.mismatched, 1)) * 100)}%`, status: "ok" },
              { label: "Missing Transactions", value: summary.missing, status: summary.missing > 0 ? "warn" : "ok" },
              { label: "Duplicate Entries", value: summary.duplicates, status: summary.duplicates > 0 ? "warn" : "ok" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{item.value}</span>
                  {item.status === "ok" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue Leakage Detection</CardTitle>
            <CardDescription>Missing commissions, hidden refunds, revenue anomalies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(recon?.leakageAlerts || []).map((alert: any, i: number) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${alert.severity === "high" ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                  <AlertTriangle className={`h-4 w-4 mt-0.5 ${alert.severity === "high" ? "text-red-400" : "text-yellow-400"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{alert.type}</p>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                    <p className="text-xs font-bold text-red-400 mt-1">Potential loss: {fmtINRFull(alert.amount ?? 0)}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setInvestigate(alert)}>Investigate</Button>
                </div>
              ))}
              {(!recon?.leakageAlerts || recon.leakageAlerts.length === 0) && (
                <div className="text-center py-6 text-muted-foreground text-sm">No leakage detected</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="matched">
        <TabsList>
          <TabsTrigger value="matched">Matched ({summary.matched})</TabsTrigger>
          <TabsTrigger value="discrepancies">Discrepancies ({summary.mismatched})</TabsTrigger>
          <TabsTrigger value="history">Reconciliation History</TabsTrigger>
        </TabsList>

        <TabsContent value="matched" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by ID, vendor or payment mode…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
              <CardDescription className="pt-2">Transactions where gateway amount matched the bank credit — with vendor and how the payment was made.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <DataTable data={matched} pageSize={10} columns={[
                  { header: "TXN ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
                  { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
                  { header: "Payment Method", cell: (row: any) => <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${payColor(row.paymentMode)}`}>{row.paymentMode}</span> },
                  { header: "Gateway Amt", cell: (row: any) => <span className="font-medium">{fmtINRFull(row.gatewayAmount ?? 0)}</span> },
                  { header: "Bank Amt", cell: (row: any) => <span className="font-medium">{fmtINRFull(row.bankAmount ?? 0)}</span> },
                  { header: "Status", cell: () => <span className="inline-flex items-center gap-1 text-green-400 text-xs font-medium"><CheckCircle className="h-3.5 w-3.5" /> Matched</span> },
                  { header: "Date", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.date}</span> },
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discrepancies" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by ID or vendor…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <DataTable data={discrepancies} pageSize={10} columns={[
                  { header: "TXN ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
                  { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
                  { header: "Gateway Amt", cell: (row: any) => <span className="font-medium">{fmtINRFull(row.gatewayAmount ?? 0)}</span> },
                  { header: "Bank Amt", cell: (row: any) => <span className="font-medium">{fmtINRFull(row.bankAmount ?? 0)}</span> },
                  { header: "Difference", cell: (row: any) => (
                    <span className={`font-bold ${row.difference < 0 ? "text-red-400" : "text-green-400"}`}>
                      {row.difference < 0 ? "-" : "+"}{fmtINRFull(Math.abs(row.difference ?? 0))}
                    </span>
                  )},
                  { header: "Type", cell: (row: any) => <span className={`font-medium ${statusColor[row.discrepancyType] || "text-muted-foreground"}`}>{row.discrepancyType}</span> },
                  { header: "Date", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.date}</span> },
                  { header: "Action", cell: (row: any) => (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => adjustMutation.mutate(row.id)}>Adjust</Button>
                  )},
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <DataTable data={recon?.history || []} pageSize={10} columns={[
                  { header: "Run ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
                  { header: "Triggered By", cell: (row: any) => <span className="font-medium">{row.triggeredBy}</span> },
                  { header: "Records", cell: (row: any) => <span>{row.totalRecords}</span> },
                  { header: "Matched", cell: (row: any) => <span className="text-green-400 font-medium">{row.matched}</span> },
                  { header: "Issues", cell: (row: any) => <span className={row.issues > 0 ? "text-red-400 font-bold" : "text-muted-foreground"}>{row.issues}</span> },
                  { header: "Duration", cell: (row: any) => <span className="text-muted-foreground text-sm">{row.duration}</span> },
                  { header: "Run At", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.runAt).toLocaleString()}</span> },
                  { header: "Status", cell: (row: any) => <Badge variant={row.status === "Completed" ? "default" : "destructive"} className="text-xs">{row.status}</Badge> },
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!investigate} onOpenChange={o => !o && setInvestigate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Leakage Alert Details</DialogTitle></DialogHeader>
          {investigate && (
            <div className="space-y-3 pt-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Alert ID</span><span className="font-mono text-xs">{investigate.id}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vendor</span><span className="font-medium">{investigate.vendorName || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{investigate.type || investigate.discrepancyType || "Revenue Leakage"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Potential Loss</span><span className="font-bold text-red-400">{fmtINRFull(investigate.amount ?? 0)}</span></div>
              <div className="pt-1">
                <p className="text-muted-foreground mb-1">Description</p>
                <p className="rounded-md border p-3 text-xs">{investigate.description || investigate.message || "No additional details available for this alert."}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
