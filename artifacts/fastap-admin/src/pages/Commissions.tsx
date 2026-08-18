import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/shared/KpiCard";
import { Plus, Percent, Trash2, Loader2 } from "lucide-react";
import { api, type CommissionRule } from "@/lib/apiClient";
import { toast } from "sonner";

const defaultForm = { name: "", type: "Fixed %", value: "", unit: "%", applyTo: "All Restaurants" };

export default function Commissions() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: rules = [], isLoading } = useQuery({ queryKey: ["commissions"], queryFn: api.commissions.list });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.commissions.create(data),
    onSuccess: () => { toast.success("Commission rule created"); setDialog(false); setForm(defaultForm); qc.invalidateQueries({ queryKey: ["commissions"] }); },
    onError: () => toast.error("Failed to create rule"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.commissions.delete(id),
    onSuccess: () => { toast.success("Rule deleted"); qc.invalidateQueries({ queryKey: ["commissions"] }); },
    onError: () => toast.error("Failed to delete"),
  });

  const pctRules = rules.filter(r => r.unit === "%" || r.type === "Fixed %");
  const avgRate = pctRules.length > 0
    ? (pctRules.reduce((s, r) => s + r.value, 0) / pctRules.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">Commission Management</h2><p className="text-muted-foreground">Configure take-rates and transaction fees.</p></div>
        <Button onClick={() => { setDialog(true); setForm(defaultForm); }}><Plus className="mr-2 h-4 w-4" /> New Rule</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Active Rules" value={rules.filter(r => r.status === "Active").length} icon={<Percent className="h-4 w-4 text-primary" />} />
        <KpiCard title="Average Rate" value={`${avgRate}%`} icon={<Percent className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Total Rules" value={rules.length} icon={<Percent className="h-4 w-4 text-muted-foreground" />} />
      </div>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable data={rules} columns={[
              { header: "Rule Name", cell: (row: CommissionRule) => <span className="font-medium">{row.name}</span> },
              { header: "Type", accessorKey: "type" },
              { header: "Rate", cell: (row: CommissionRule) => <span className="font-bold text-primary">{row.value}{row.unit}</span> },
              { header: "Applies To", accessorKey: "applyTo" },
              { header: "Status", cell: (row: CommissionRule) => <StatusBadge status={row.status} /> },
              { header: "Actions", cell: (row: CommissionRule) => (
                <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => { if (confirm(`Delete rule "${row.name}"?`)) deleteMutation.mutate(row.id); }}>
                  {deleteMutation.isPending && deleteMutation.variables === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Commission Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Rule Name</Label><Input placeholder="e.g. Standard Food Delivery" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Fixed %">Fixed %</SelectItem><SelectItem value="Fixed Amount">Fixed Amount</SelectItem><SelectItem value="Hybrid">Hybrid</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Value</Label><Input type="number" placeholder="12" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Applies To</Label><Input placeholder="e.g. All Restaurants" value={form.applyTo} onChange={e => setForm(f => ({ ...f, applyTo: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button disabled={!form.name || !form.value || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
