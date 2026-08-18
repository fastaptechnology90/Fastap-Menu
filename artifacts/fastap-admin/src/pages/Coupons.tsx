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
import { Plus, Copy, Ban, Loader2, Tag } from "lucide-react";
import { api, type Coupon } from "@/lib/apiClient";
import { toast } from "sonner";
import { KpiCard } from "@/components/shared/KpiCard";

const defaultForm = { code: "", type: "Percentage", discount: "", maxUses: "1000", expires: "" };

export default function Coupons() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: coupons = [], isLoading } = useQuery({ queryKey: ["coupons"], queryFn: api.coupons.list });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.coupons.create(data),
    onSuccess: (c) => { toast.success(`Coupon ${c.code} created`); setDialog(false); setForm(defaultForm); qc.invalidateQueries({ queryKey: ["coupons"] }); },
    onError: () => toast.error("Failed to create coupon"),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.coupons.toggle(id),
    onSuccess: (c) => { toast.success(`${c.code} is now ${c.status}`); qc.invalidateQueries({ queryKey: ["coupons"] }); },
    onError: () => toast.error("Failed to toggle"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.coupons.delete(id),
    onSuccess: () => { toast.success("Coupon deleted"); qc.invalidateQueries({ queryKey: ["coupons"] }); },
    onError: () => toast.error("Failed to delete"),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">Coupons & Promos</h2><p className="text-muted-foreground">Manage platform-wide discount codes.</p></div>
        <Button onClick={() => { setDialog(true); setForm(defaultForm); }}><Plus className="mr-2 h-4 w-4" /> Create Coupon</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Active Coupons" value={coupons.filter(c => c.status === "Active").length} icon={<Tag className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Total Uses" value={coupons.reduce((s, c) => s + c.used, 0).toLocaleString()} icon={<Tag className="h-4 w-4 text-primary" />} />
        <KpiCard title="Suspended" value={coupons.filter(c => c.status === "Suspended").length} icon={<Ban className="h-4 w-4 text-red-500" />} />
      </div>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable data={coupons} columns={[
              { header: "Code", cell: (row: Coupon) => (
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold tracking-wider">{row.code}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(row.code); toast.success("Copied!"); }}><Copy className="h-3 w-3" /></Button>
                </div>
              )},
              { header: "Type", accessorKey: "type" },
              { header: "Discount", cell: (row: Coupon) => <span className="text-primary font-medium">{row.type === "Flat" ? `₹${row.discount}` : `${row.discount}%`}</span> },
              { header: "Used / Max", cell: (row: Coupon) => <span className="text-sm">{row.used} / {row.maxUses}</span> },
              { header: "Expires", cell: (row: Coupon) => <span className="text-xs text-muted-foreground">{row.expires}</span> },
              { header: "Status", cell: (row: Coupon) => <StatusBadge status={row.status} /> },
              { header: "Actions", cell: (row: Coupon) => (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={row.status === "Expired" || toggleMutation.isPending} onClick={() => toggleMutation.mutate(row.id)}>
                    {row.status === "Active" ? <><Ban className="h-3 w-3 mr-1" /> Suspend</> : "Activate"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => { if (confirm(`Delete ${row.code}?`)) deleteMutation.mutate(row.id); }}>Delete</Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Coupon</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Coupon Code</Label><Input placeholder="SUMMER25" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} /></div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Percentage">Percentage</SelectItem><SelectItem value="Flat">Flat Amount</SelectItem><SelectItem value="Delivery">Free Delivery</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Discount {form.type === "Flat" ? "(₹)" : "(%)"}</Label><Input type="number" placeholder="20" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Max Uses</Label><Input type="number" placeholder="1000" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Expiry Date</Label><Input type="date" value={form.expires} onChange={e => setForm(f => ({ ...f, expires: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button disabled={!form.code || !form.discount || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
