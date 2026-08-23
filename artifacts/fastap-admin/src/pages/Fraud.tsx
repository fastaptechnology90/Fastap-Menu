import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/shared/KpiCard";
import { ShieldAlert, ShieldBan, FileSearch, ShieldCheck, Search, Loader2 } from "lucide-react";
import { api, type FraudAlert } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { toast } from "sonner";

export default function Fraud() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: alerts = [], isLoading } = useQuery({ queryKey: ["fraud"], queryFn: api.fraud.list, refetchInterval: 15000 });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.fraud.resolve(id),
    onSuccess: () => { toast.success("Alert resolved"); qc.invalidateQueries({ queryKey: ["fraud"] }); },
    onError: () => toast.error("Failed to resolve"),
  });
  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.fraud.dismiss(id),
    onSuccess: () => { toast.info("Alert dismissed"); qc.invalidateQueries({ queryKey: ["fraud"] }); },
    onError: () => toast.error("Failed to dismiss"),
  });
  const blockMutation = useMutation({
    mutationFn: (id: string) => api.fraud.block(id),
    onSuccess: (_, id) => { const a = alerts.find(a => a.id === id); toast.error(`${a?.vendorName} has been blocked`); qc.invalidateQueries({ queryKey: ["fraud"] }); },
    onError: () => toast.error("Failed to block"),
  });

  const filtered = alerts.filter(a => a.vendorName.toLowerCase().includes(search.toLowerCase()) || a.type.toLowerCase().includes(search.toLowerCase()));
  const active = alerts.filter(a => a.status === "Active");
  const highRisk = alerts.filter(a => a.riskScore >= 75);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div><h2 className="text-2xl font-bold tracking-tight">Fraud Detection & AI</h2><p className="text-muted-foreground">Monitor suspicious activities and AI risk signals.</p></div>
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Active Alerts" value={active.length} icon={<ShieldAlert className="h-4 w-4 text-destructive" />} />
        <KpiCard title="High Risk (≥75)" value={highRisk.length} icon={<ShieldBan className="h-4 w-4 text-orange-500" />} />
        <KpiCard title="Blocked Amount" value={fmtINRFull(alerts.reduce((s, a) => s + a.amount, 0))} icon={<FileSearch className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="AI Accuracy" value="—" icon={<ShieldCheck className="h-4 w-4 text-green-500" />} />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search alerts..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable data={filtered} columns={[
              { header: "Alert ID", cell: (row: FraudAlert) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", accessorKey: "vendorName" },
              { header: "Type", accessorKey: "type" },
              { header: "AI Signal", cell: (row: FraudAlert) => <span className="text-xs text-muted-foreground">{row.aiSignal}</span> },
              { header: "Risk Score", cell: (row: FraudAlert) => {
                const color = row.riskScore >= 75 ? "text-red-500" : row.riskScore >= 50 ? "text-orange-500" : "text-yellow-500";
                return <span className={`font-bold ${color}`}>{row.riskScore}/100</span>;
              }},
              { header: "Amount", cell: (row: FraudAlert) => <span className="font-medium text-destructive">{fmtINRFull(row.amount)}</span> },
              { header: "Status", cell: (row: FraudAlert) => <StatusBadge status={row.status} /> },
              { header: "Actions", cell: (row: FraudAlert) => (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs text-green-500" disabled={row.status === "Resolved"} onClick={() => resolveMutation.mutate(row.id)}>Resolve</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-500" disabled={row.status === "Resolved"} onClick={() => blockMutation.mutate(row.id)}>Block Vendor</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={row.status === "Dismissed" || row.status === "Resolved"} onClick={() => dismissMutation.mutate(row.id)}>Dismiss</Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
