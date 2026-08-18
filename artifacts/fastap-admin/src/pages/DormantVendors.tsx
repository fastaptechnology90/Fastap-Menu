import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { KpiCard } from "@/components/shared/KpiCard";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { Moon, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function DormantVendors() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["dormant-vendors"], queryFn: api.dormantVendors.get, refetchInterval: 300000 });
  const [rules, setRules] = useState<Record<string, unknown>>({});

  useEffect(() => { if (data?.rules) setRules(data.rules); }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.dormantVendors.saveRules(rules),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dormant-vendors"] }); toast.success("Rules saved"); },
    onError: () => toast.error("Save failed"),
  });

  const vendors = data?.vendors ?? [];

  return (
    <PageShell
      title="Dormant Vendor Detection"
      description="Inactive vendors with automated reminders, sales follow-up, and deactivation rules."
      icon={<Moon className="h-6 w-6" />}
      accent="amber"
      badge={`${vendors.length} dormant`}
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      actions={<Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-xl"><Save className="mr-2 h-4 w-4" /> Save Rules</Button>}
    >
      <KpiCard title="Dormant Vendors" value={vendors.length} accent="amber" icon={<Moon className="h-4 w-4 text-amber-500" />} subtitle="No orders in 30 days" />
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelCard title="Automation Rules" className="lg:col-span-1">
          <div className="space-y-4">
            {[
              { key: "autoRemind", label: "Auto-send reminders" },
              { key: "salesFollowUp", label: "Sales team follow-up" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch checked={!!rules[key]} onCheckedChange={v => setRules(r => ({ ...r, [key]: v }))} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2 border-t">Auto-deactivate after <Badge variant="outline">{String(rules.autoDeactivateDays ?? 90)}</Badge> days</p>
          </div>
        </PanelCard>
        <PanelCard title="Dormant Vendors" className="lg:col-span-2">
          <div className="admin-data-table-wrap">
            <DataTable data={vendors} columns={[
              { header: "Vendor", cell: (row: any) => <Link href={`/vendors/${row.id}`} className="font-semibold hover:text-primary">{row.name}</Link> },
              { header: "Plan", cell: (row: any) => <Badge variant="outline" className="capitalize text-xs">{row.plan}</Badge> },
              { header: "Days Inactive", cell: (row: any) => <span className="text-amber-600 font-medium">{row.daysInactive}d</span> },
              { header: "Signals", cell: (row: any) => <span className="text-xs text-muted-foreground">{(row.signals ?? []).join(", ")}</span> },
            ]} />
          </div>
        </PanelCard>
      </div>
    </PageShell>
  );
}
