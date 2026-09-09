import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AsyncButton } from "@/components/shared/AsyncButton";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/shared/KpiCard";
import { Plus, Percent, Trash2, Loader2, Pencil } from "lucide-react";
import { api, type CommissionRule } from "@/lib/apiClient";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/Page";

const defaultForm = { id: "", name: "", type: "Fixed %", value: "", unit: "%", applyTo: "All Restaurants" };

// The rate column renders value + unit, so a "Fixed Amount" rule left on the default "%"
// displayed a ₹25 flat fee as "25%". Unit follows from the rule type.
const unitFor = (type: string) => (type === "Fixed Amount" ? "₹" : "%");

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function Commissions() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: rules = [], isLoading } = useQuery({ queryKey: ["commissions"], queryFn: api.commissions.list });
  // Real commission earned = order-driven amount from the platform stats (grows as paid
  // orders come in). The rules below only show the % rate — this KPI shows the ₹ amount.
  const { data: summary } = useQuery({ queryKey: ["superadmin-analytics-summary"], queryFn: () => api.analytics.summary() });
  const commissionEarned = Number(summary?.platformCommission ?? 0);

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = { name: data.name, type: data.type, value: Number(data.value), unit: unitFor(data.type), applyTo: data.applyTo };
      return data.id ? api.commissions.update(data.id, payload) : api.commissions.create(payload);
    },
    onSuccess: (_r, vars) => { toast.success(vars.id ? "Commission rule updated" : "Commission rule created"); setDialog(false); setForm(defaultForm); qc.invalidateQueries({ queryKey: ["commissions"] }); },
    onError: (e: Error) => toast.error(e.message || "Failed to save rule"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.commissions.delete(id),
    onSuccess: () => { toast.success("Rule deleted"); qc.invalidateQueries({ queryKey: ["commissions"] }); },
    onError: () => toast.error("Failed to delete"),
  });

  // Only percentage rules belong in an average take-rate; a flat ₹ fee would skew it.
  const pctRules = rules.filter(r => r.unit === "%" && r.type !== "Fixed Amount");
  const avgRate = pctRules.length > 0
    ? (pctRules.reduce((s, r) => s + r.value, 0) / pctRules.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission Management"
        description="Configure take-rates and transaction fees."
        actions={
          <>
            <Button onClick={() => { setDialog(true); setForm(defaultForm); }}><Plus className="mr-2 h-4 w-4" /> New Rule</Button>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Commission Collected" value={fmtMoney(commissionEarned)} icon={<Percent className="h-4 w-4 text-success" />} />
        <KpiCard title="Active Rules" value={rules.filter(r => r.status === "Active").length} icon={<Percent className="h-4 w-4 text-primary" />} />
        <KpiCard title="Average Rate" value={`${avgRate}%`} icon={<Percent className="h-4 w-4 text-info" />} />
        <KpiCard title="Total Rules" value={rules.length} icon={<Percent className="h-4 w-4 text-muted-foreground" />} />
      </div>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable data={rules} columns={[
              { header: "Rule Name", cell: (row: CommissionRule) => <span className="font-medium">{row.name}</span> },
              { header: "Type", accessorKey: "type" },
              { header: "Rate", cell: (row: CommissionRule) => <span className="font-bold text-primary">{row.unit === "₹" ? `₹${row.value}` : `${row.value}${row.unit}`}</span> },
              { header: "Applies To", accessorKey: "applyTo" },
              { header: "Status", cell: (row: CommissionRule) => <StatusBadge status={row.status} /> },
              { header: "Actions", cell: (row: CommissionRule) => (
                <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7" title="Edit rule"
                  onClick={() => { setForm({ id: row.id, name: row.name, type: row.type, value: String(row.value), unit: row.unit, applyTo: row.applyTo }); setDialog(true); }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AsyncButton
                  variant="ghost" size="icon" className="text-destructive h-7 w-7" title="Delete rule"
                  errorMessage="Failed to delete"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete rule "${row.name}"?`,
                      description: `Commission on ${row.applyTo} falls back to the platform default from the next order onward.`,
                      destructive: true,
                      confirmLabel: "Delete rule",
                    });
                    if (!ok) return;
                    await deleteMutation.mutateAsync(row.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </AsyncButton>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Edit Commission Rule" : "Create Commission Rule"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Rule Name</Label><Input placeholder="e.g. Standard Food Delivery" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Fixed %">Fixed %</SelectItem><SelectItem value="Fixed Amount">Fixed Amount</SelectItem><SelectItem value="Hybrid">Hybrid</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Value ({unitFor(form.type)})</Label><Input type="number" placeholder="12" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Applies To</Label><Input placeholder="e.g. All Restaurants" value={form.applyTo} onChange={e => setForm(f => ({ ...f, applyTo: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button disabled={!form.name || !form.value || saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {form.id ? "Save Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
