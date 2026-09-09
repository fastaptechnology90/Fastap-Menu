import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/shared/KpiCard";
import { ShieldAlert, ShieldBan, FileSearch, Search, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { api, type FraudAlert } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { toast } from "sonner";
import { statusIs, statusLabel } from "@/pages/statusValue";
import { PageHeader } from "@/components/shared/Page";

/**
 * The list route returns the stored status verbatim for everything except `active`,
 * so a settled alert arrives as `resolved` / `dismissed`. Comparing against
 * `"Resolved"` never matched, leaving Block Vendor live on an alert already closed.
 */
const isSettled = (alert: FraudAlert) => statusIs(alert.status, "resolved", "dismissed", "blocked");

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
  const active = alerts.filter(a => statusIs(a.status, "active"));
  const highRisk = alerts.filter(a => a.riskScore >= 75);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fraud Detection"
        description="Suspicious activity flagged by the platform rules, with the signal that raised each alert."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard title="Active Alerts" value={active.length} icon={<ShieldAlert className="h-4 w-4 text-destructive" />} />
        <KpiCard title="High Risk (≥75)" value={highRisk.length} icon={<ShieldBan className="h-4 w-4 text-warning" />} />
        <KpiCard title="Blocked Amount" value={fmtINRFull(alerts.reduce((s, a) => s + a.amount, 0))} icon={<FileSearch className="h-4 w-4 text-warning" />} />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search alerts..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : filtered.length === 0 ? (
            search
              ? <EmptyState tone="search" title="No matching alerts" description={`Nothing matches "${search}".`} />
              : <EmptyState title="No fraud alerts" description="Nothing has tripped the platform's fraud rules." />
          ) : (
            <DataTable data={filtered} columns={[
              { header: "Alert ID", cell: (row: FraudAlert) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", accessorKey: "vendorName" },
              { header: "Type", accessorKey: "type" },
              { header: "Signal", cell: (row: FraudAlert) => <span className="text-xs text-muted-foreground">{row.aiSignal}</span> },
              { header: "Risk Score", cell: (row: FraudAlert) => {
                const color = row.riskScore >= 75 ? "text-danger" : row.riskScore >= 50 ? "text-warning" : "text-muted-foreground";
                return <span className={`tabular-nums font-medium ${color}`}>{row.riskScore}/100</span>;
              }},
              { header: "Amount", cell: (row: FraudAlert) => <span className="font-medium text-destructive">{fmtINRFull(row.amount)}</span> },
              { header: "Status", cell: (row: FraudAlert) => <StatusBadge status={statusLabel(row.status)} /> },
              { header: "Actions", cell: (row: FraudAlert) => (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs text-success" disabled={isSettled(row)} onClick={() => resolveMutation.mutate(row.id)}>Resolve</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-danger" disabled={isSettled(row)} onClick={() => blockMutation.mutate(row.id)}>Block Vendor</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={isSettled(row)} onClick={() => dismissMutation.mutate(row.id)}>Dismiss</Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
