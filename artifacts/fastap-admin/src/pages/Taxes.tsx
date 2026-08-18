import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Plus, Loader2 } from "lucide-react";
import { api, type Tax } from "@/lib/apiClient";
import { toast } from "sonner";

const defaultForm = { name: "", rate: "", type: "Sales Tax", region: "India" };

export default function Taxes() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: taxes = [], isLoading } = useQuery({ queryKey: ["taxes"], queryFn: api.taxes.list });
  const { data: reports = [] } = useQuery({ queryKey: ["tax-reports"], queryFn: api.taxes.reports });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.taxes.toggle(id),
    onSuccess: (t) => { toast.success(`${t.name} ${t.status ? "enabled" : "disabled"}`); qc.invalidateQueries({ queryKey: ["taxes"] }); },
    onError: () => toast.error("Failed to toggle tax"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.taxes.create(data),
    onSuccess: (t) => { toast.success(`${t.name} created`); setDialog(false); setForm(defaultForm); qc.invalidateQueries({ queryKey: ["taxes"] }); },
    onError: () => toast.error("Failed to create tax"),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">Tax Management</h2><p className="text-muted-foreground">Configure tax slabs and view compliance reports.</p></div>
        <Button onClick={() => { setDialog(true); setForm(defaultForm); }}><Plus className="mr-2 h-4 w-4" /> Add Tax Rule</Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tax Slabs & Rules</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
              <div className="space-y-3">
                {taxes.map(tax => (
                  <div key={tax.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{tax.name}</p>
                      <p className="text-xs text-muted-foreground">{tax.type} — {tax.region} — <span className="font-bold text-primary">{tax.rate}%</span></p>
                    </div>
                    <Switch checked={tax.status} onCheckedChange={() => toggleMutation.mutate(tax.id)} disabled={toggleMutation.isPending} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Monthly Tax Reports</CardTitle><Button variant="outline" size="sm" onClick={() => api.exportCenter.create({ module: "taxes", format: "csv" }).then(r => api.exportCenter.download(r.id)).then(() => toast.success("Tax report exported")).catch(() => toast.error("Export failed"))}><Download className="h-4 w-4 mr-2" /> Export</Button></CardHeader>
          <CardContent>
            <div className="space-y-3">
                {(reports.length ? reports : []).map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{r.month}</p>
                    <p className="text-xs text-muted-foreground">Sales: ₹{r.totalSales.toLocaleString("en-IN")} — Tax: <span className="font-medium">₹{r.taxCollected.toLocaleString("en-IN")}</span></p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === "Filed" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Tax Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Tax Name</Label><Input placeholder="e.g. GST - Food" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Rate (%)</Label><Input type="number" placeholder="5" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Sales Tax">Sales Tax</SelectItem><SelectItem value="Withholding">Withholding</SelectItem><SelectItem value="VAT">VAT</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Region</Label><Input placeholder="India" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button disabled={!form.name || !form.rate || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add Tax Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
