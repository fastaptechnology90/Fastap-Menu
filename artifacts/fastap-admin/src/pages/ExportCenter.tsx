import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Download, Table, File, Loader2, CheckCircle, Clock, Shield } from "lucide-react";

// `supported` mirrors what generateExportCsv on the API actually builds a file for.
// Every other module falls through to a generic vendor-name list on the server, so
// offering it here would hand the operator a file that does not hold the data its
// label promises. Those stay listed but disabled until the API grows a real exporter.
const EXPORT_MODULES = [
  { id: "vendors", label: "Vendors", icon: "👥", supported: true, description: "Vendor records with plan, status, and signup date" },
  { id: "payments", label: "Payments", icon: "💳", supported: true, description: "Order-level transaction history with amount, method, and status" },
  { id: "audit-logs", label: "Audit Logs", icon: "🔍", supported: true, description: "Complete audit trail of admin actions" },
  { id: "analytics", label: "Analytics Report", icon: "📈", supported: true, description: "Order-level data behind the revenue and growth reports" },
  { id: "refunds", label: "Refunds", icon: "↩️", supported: false, description: "All refund requests and their resolution status" },
  { id: "settlements", label: "Settlements", icon: "💰", supported: false, description: "Settlement batches with gross, deductions, and net payout" },
  { id: "subscriptions", label: "Subscriptions", icon: "📦", supported: false, description: "Vendor subscription records and renewal dates" },
  { id: "invoices", label: "Invoices", icon: "🧾", supported: false, description: "All generated invoices with payment status" },
  { id: "taxes", label: "Taxes", icon: "📊", supported: false, description: "GST, TDS/TCS records and tax summaries" },
  { id: "kyc", label: "KYC Records", icon: "🪪", supported: false, description: "Vendor verification documents and status" },
  { id: "fraud", label: "Fraud Alerts", icon: "🚨", supported: false, description: "Fraud detection alerts and risk scores" },
  { id: "support", label: "Support Tickets", icon: "🎫", supported: false, description: "All support tickets with resolution data" },
];

export default function ExportCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState<string | null>(null);
  // The export API emits CSV only and ignores any date range, so no format or date
  // control is offered here — one that changed nothing would just mislead.
  const format = "csv";

  const { data: exportHistory = [], isLoading } = useQuery({
    queryKey: ["export-history"],
    queryFn: api.exportCenter.history,
  });

  const handleExport = async (moduleId: string, moduleLabel: string) => {
    setExporting(moduleId);
    try {
      const result = await api.exportCenter.create({ module: moduleId, format });
      qc.invalidateQueries({ queryKey: ["export-history"] });
      toast({
        title: `${moduleLabel} export completed`,
        description: `${result.records ?? 0} records exported as ${format.toUpperCase()}.`,
      });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const normStatus = (s: string) => (s || "").toLowerCase();
  const completedExports = exportHistory.filter((e: any) => normStatus(e.status) === "completed").length;
  const pendingExports = exportHistory.filter((e: any) => ["processing", "pending", "pending approval"].includes(normStatus(e.status))).length;
  const totalSize = exportHistory.reduce((s: number, e: any) => s + (e.sizeMb || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Export Center</h2>
          <p className="text-muted-foreground">Export platform data as CSV, with an audited request history.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Exports" value={exportHistory.length} icon={<Download className="h-4 w-4 text-primary" />} />
        <KpiCard title="Completed" value={completedExports} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Processing" value={pendingExports} icon={<Clock className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Total Size" value={`${totalSize.toFixed(1)} MB`} icon={<File className="h-4 w-4 text-blue-500" />} />
      </div>

      <Tabs defaultValue="export">
        <TabsList>
          <TabsTrigger value="export">Export Data</TabsTrigger>
          <TabsTrigger value="history">Export History</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export Settings</CardTitle>
              <CardDescription>
                Exports are generated as CSV covering the full table. Excel, PDF, and date-range
                filtering are not implemented on the export API yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <Table className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">CSV</span>
                <Badge variant="secondary" className="text-xs">Only available format</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {EXPORT_MODULES.map(mod => (
              <Card key={mod.id} className={mod.supported ? "hover:border-primary/50 transition-colors" : "opacity-60"}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{mod.icon}</span>
                      <CardTitle className="text-base">{mod.label}</CardTitle>
                    </div>
                    <Badge variant={mod.supported ? "outline" : "secondary"} className="text-xs uppercase">
                      {mod.supported ? format : "N/A"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">{mod.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full" variant="outline" size="sm"
                    disabled={!mod.supported || exporting === mod.id}
                    title={mod.supported ? undefined : "No exporter for this module on the API yet"}
                    onClick={() => handleExport(mod.id, mod.label)}
                  >
                    {exporting === mod.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                    {mod.supported ? `Export ${mod.label}` : "Not available yet"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <DataTable data={exportHistory} pageSize={10} columns={[
                  { header: "Export ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
                  { header: "Module", cell: (row: any) => <span className="font-medium capitalize">{row.module}</span> },
                  { header: "Format", cell: (row: any) => <Badge variant="outline" className="text-xs uppercase">{row.format}</Badge> },
                  { header: "Requested By", cell: (row: any) => <span className="text-sm">{row.requestedBy}</span> },
                  { header: "Records", cell: (row: any) => <span className="font-medium">{row.records?.toLocaleString()}</span> },
                  { header: "Size", cell: (row: any) => <span className="text-sm text-muted-foreground">{row.sizeMb} MB</span> },
                  { header: "Requested At", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.requestedAt).toLocaleString()}</span> },
                  { header: "Status", cell: (row: any) => <Badge variant={normStatus(row.status) === "completed" ? "default" : normStatus(row.status) === "failed" || normStatus(row.status) === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">{row.status}</Badge> },
                  { header: "Action", cell: (row: any) => normStatus(row.status) === "completed" && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => api.exportCenter.download(row.id).catch((e: any) => toast({ title: "Download failed", description: e.message, variant: "destructive" }))}>
                      <Download className="h-3 w-3 mr-1" /> Download
                    </Button>
                  )},
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Export Governance Controls</CardTitle>
                <CardDescription>Display-only defaults — no configuration API to change these.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Require Approval for Bulk Exports", desc: "Exports >10,000 records need manager approval" },
                  { label: "Restrict Sensitive Data", desc: "Mask PAN, bank details in CSV exports" },
                  { label: "Audit All Exports", desc: "Log every export request in audit trail" },
                  { label: "Export Watermarking", desc: "Add user ID watermark to PDF exports" },
                  { label: "Time-Limited Download Links", desc: "Links expire after 24 hours" },
                ].map((ctrl, i) => (
                  <div key={i} className="flex items-start justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{ctrl.label}</p>
                      <p className="text-xs text-muted-foreground">{ctrl.desc}</p>
                    </div>
                    {/* No governance-settings endpoint — these are fixed defaults, marked static rather than shown as configurable. */}
                    <Badge variant="secondary" className="text-xs ml-2 shrink-0">Static</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Pending Approvals</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {exportHistory.filter((e: any) => normStatus(e.status) === "pending approval").map((exp: any) => (
                    <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium capitalize">{exp.module} Export</p>
                        <p className="text-xs text-muted-foreground">{exp.records?.toLocaleString()} records · {exp.requestedBy}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-400" onClick={() => api.exportCenter.reject(exp.id).then(() => { qc.invalidateQueries({ queryKey: ["export-history"] }); toast({ title: "Export rejected" }); }).catch(() => toast({ title: "Failed", variant: "destructive" }))}>Reject</Button>
                        <Button size="sm" className="h-7 text-xs" onClick={() => api.exportCenter.approve(exp.id).then(() => { qc.invalidateQueries({ queryKey: ["export-history"] }); toast({ title: "Export approved" }); }).catch(() => toast({ title: "Failed", variant: "destructive" }))}>Approve</Button>
                      </div>
                    </div>
                  ))}
                  {exportHistory.filter((e: any) => normStatus(e.status) === "pending approval").length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-6">No pending approvals</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
