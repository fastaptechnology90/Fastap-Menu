import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, RefreshCw, Loader2, Search, Download, XCircle, CreditCard, Key, Smartphone, FileText, RotateCcw } from "lucide-react";

export default function ErrorLogs() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: errorLogs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["error-logs"],
    queryFn: api.errorLogs.list,
    refetchInterval: 30000,
  });

  const filtered = errorLogs.filter((log: any) => {
    const matchSearch = log.message?.toLowerCase().includes(search.toLowerCase()) ||
      log.source?.toLowerCase().includes(search.toLowerCase()) ||
      log.id?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || log.errorType === typeFilter;
    return matchSearch && matchType;
  });

  const paymentErrors = errorLogs.filter((l: any) => l.errorType === "Payment Failure").length;
  const apiErrors = errorLogs.filter((l: any) => l.errorType === "API Failure").length;
  const loginErrors = errorLogs.filter((l: any) => l.errorType === "Login Failure").length;
  const qrErrors = errorLogs.filter((l: any) => l.errorType === "QR Failure").length;
  const criticalErrors = errorLogs.filter((l: any) => l.severity === "critical").length;

  const errorTypeIcon: Record<string, React.ReactNode> = {
    "Payment Failure": <CreditCard className="h-3.5 w-3.5" />,
    "API Failure": <Key className="h-3.5 w-3.5" />,
    "Login Failure": <AlertTriangle className="h-3.5 w-3.5" />,
    "QR Failure": <Smartphone className="h-3.5 w-3.5" />,
    "Settlement Failure": <FileText className="h-3.5 w-3.5" />,
  };

  const severityVariant: Record<string, "destructive" | "outline" | "secondary"> = {
    critical: "destructive",
    error: "destructive",
    warning: "outline",
    info: "secondary",
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Error Logs Center</h2>
          <p className="text-muted-foreground">Payment failures, API errors, login failures, QR errors, settlement failures.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast({ title: "Exporting error logs..." })}><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <KpiCard title="Critical Errors" value={criticalErrors} icon={<XCircle className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Payment Failures" value={paymentErrors} icon={<CreditCard className="h-4 w-4 text-orange-500" />} />
        <KpiCard title="API Failures" value={apiErrors} icon={<Key className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Login Failures" value={loginErrors} icon={<AlertTriangle className="h-4 w-4 text-blue-500" />} />
        <KpiCard title="QR Failures" value={qrErrors} icon={<Smartphone className="h-4 w-4 text-purple-500" />} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search errors…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Payment Failure">Payment Failure</SelectItem>
                <SelectItem value="API Failure">API Failure</SelectItem>
                <SelectItem value="Login Failure">Login Failure</SelectItem>
                <SelectItem value="QR Failure">QR Failure</SelectItem>
                <SelectItem value="Settlement Failure">Settlement Failure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <DataTable data={filtered} pageSize={15} columns={[
              { header: "Log ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Type", cell: (row: any) => (
                <div className="flex items-center gap-1.5 text-xs">
                  {errorTypeIcon[row.errorType] || <AlertTriangle className="h-3.5 w-3.5" />}
                  <span>{row.errorType}</span>
                </div>
              )},
              { header: "Message", cell: (row: any) => <span className="text-sm font-medium max-w-[200px] truncate block">{row.message}</span> },
              { header: "Source", cell: (row: any) => <span className="text-xs text-muted-foreground font-mono">{row.source}</span> },
              { header: "Vendor", cell: (row: any) => <span className="text-sm">{row.vendorName || "—"}</span> },
              { header: "Retry #", cell: (row: any) => <span className="font-medium">{row.retryCount ?? 0}</span> },
              { header: "Severity", cell: (row: any) => (
                <Badge variant={severityVariant[row.severity] ?? "secondary"} className="text-[10px] uppercase">{row.severity}</Badge>
              )},
              { header: "Timestamp", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</span> },
              { header: "Actions", cell: (row: any) => (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast({ title: `Retrying ${row.id}...` })}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400" onClick={() => toast({ title: "Escalating to engineering..." })}>
                    Escalate
                  </Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
