import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Loader2, CheckCircle, AlertTriangle, XCircle, GitMerge, Download, Play, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fmtINR, fmtINRFull } from "@/lib/format";

export default function Reconciliation() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

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
  });

  const summary = recon?.summary || { matched: 0, mismatched: 0, missing: 0, duplicates: 0, totalAmount: 0 };
  const discrepancies = (recon?.discrepancies || []).filter((d: any) =>
    d.id?.toLowerCase().includes(search.toLowerCase()) || d.vendorName?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor: Record<string, string> = {
    Matched: "text-green-400",
    Mismatch: "text-red-400",
    Missing: "text-orange-400",
    Duplicate: "text-purple-400",
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
          <Button variant="outline" onClick={() => toast({ title: "Exporting discrepancy report..." })}><Download className="mr-2 h-4 w-4" /> Export Report</Button>
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
                  <Button variant="ghost" size="sm" className="h-7 text-xs">Investigate</Button>
                </div>
              ))}
              {(!recon?.leakageAlerts || recon.leakageAlerts.length === 0) && (
                <div className="text-center py-6 text-muted-foreground text-sm">No leakage detected</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="discrepancies">
        <TabsList>
          <TabsTrigger value="discrepancies">Discrepancies</TabsTrigger>
          <TabsTrigger value="history">Reconciliation History</TabsTrigger>
        </TabsList>

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
    </div>
  );
}
