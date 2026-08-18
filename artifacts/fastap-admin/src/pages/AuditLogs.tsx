import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, RefreshCcw, Download, Shield, AlertTriangle, Activity, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

const severityVariant: Record<string, "destructive" | "outline" | "secondary"> = {
  critical: "destructive",
  warning: "outline",
  info: "secondary",
  success: "secondary",
};

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const { toast } = useToast();

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["superadmin-audit-logs"],
    queryFn: api.auditLogs.list,
  });

  const modules = [...new Set(logs.map(l => l.module))];

  const filtered = logs.filter(l => {
    const matchSearch = l.user.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.module.toLowerCase().includes(search.toLowerCase()) ||
      l.ipAddress.includes(search);
    const matchModule = moduleFilter === "all" || l.module === moduleFilter;
    const matchSeverity = severityFilter === "all" || l.severity === severityFilter;
    const matchDate = !dateFrom || new Date(l.dateTime) >= new Date(dateFrom);
    return matchSearch && matchModule && matchSeverity && matchDate;
  });

  const criticalCount = logs.filter(l => l.severity === "critical").length;
  const warningCount = logs.filter(l => l.severity === "warning").length;
  const todayCount = logs.filter(l => new Date(l.dateTime).toDateString() === new Date().toDateString()).length;

  const handleExport = () => {
    const headers = ["Timestamp", "User", "Action", "Module", "Target", "IP Address", "Severity"];
    const rows = filtered.map(l => [new Date(l.dateTime).toLocaleString(), l.user, l.action, l.module, l.target, l.ipAddress, l.severity]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-logs.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Audit log exported" });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">Immutable record of all system and administrative actions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Logs" value={logs.length} icon={<Activity className="h-4 w-4 text-primary" />} />
        <KpiCard title="Today" value={todayCount} icon={<Info className="h-4 w-4 text-blue-500" />} />
        <KpiCard title="Warnings" value={warningCount} icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Critical" value={criticalCount} icon={<Shield className="h-4 w-4 text-red-500" />} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search user, action, IP…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-[150px]" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From date" />
            {(moduleFilter !== "all" || severityFilter !== "all" || dateFrom || search) && (
              <Button variant="ghost" size="sm" onClick={() => { setModuleFilter("all"); setSeverityFilter("all"); setDateFrom(""); setSearch(""); }}>Clear</Button>
            )}
            <span className="text-sm text-muted-foreground self-center">{filtered.length} entries</span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <DataTable
              data={filtered}
              pageSize={15}
              columns={[
                { header: "Timestamp", cell: (row) => <span className="text-xs text-muted-foreground font-mono">{new Date(row.dateTime).toLocaleString()}</span> },
                { header: "User", cell: (row) => <span className="font-medium text-sm">{row.user}</span> },
                { header: "Action", cell: (row) => <span className="font-mono text-xs font-bold tracking-tight">{row.action}</span> },
                { header: "Module", cell: (row) => <Badge variant="outline" className="text-xs">{row.module}</Badge> },
                { header: "Target", cell: (row) => <span className="text-xs font-mono text-muted-foreground">{row.target}</span> },
                { header: "IP Address", cell: (row) => <span className="text-xs font-mono text-muted-foreground">{row.ipAddress}</span> },
                { header: "Severity", cell: (row) => (
                  <Badge variant={severityVariant[row.severity] ?? "secondary"} className="text-[10px] uppercase">{row.severity}</Badge>
                )},
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}