import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api, type Plan } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, Trash2, Loader2, Package, Pencil } from "lucide-react";

const DEFAULT_TOGGLES: Record<string, string> = {
  qrOrdering: "QR Ordering",
  nfcOrdering: "NFC Ordering",
  delivery: "Delivery",
  takeaway: "Takeaway",
  tableOrdering: "Table Ordering",
  waiterApp: "Waiter App",
  kitchenApp: "Kitchen App",
  housekeeping: "Housekeeping",
  loyalty: "Loyalty",
  whatsappMarketing: "WhatsApp Marketing",
  advancedAnalytics: "Advanced Analytics",
  whiteLabel: "White Label",
  aiInsights: "AI Insights",
};

const emptyPlan = (): Partial<Plan> & { id: string } => ({
  id: `plan_${Date.now()}`,
  name: "",
  price: 0,
  currency: "INR",
  features: [],
  featureToggles: {},
  maxBranches: 1,
  maxItems: 50,
  maxStaff: 5,
  maxTables: 20,
  trialDays: 0,
  isPublished: false,
});

export default function Plans() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<(Partial<Plan> & { id: string }) | null>(null);
  const [featureInput, setFeatureInput] = useState("");

  const { data: plans = [], isLoading } = useQuery({ queryKey: ["plans"], queryFn: api.plans.list });

  const saveMutation = useMutation({
    mutationFn: async (plan: Partial<Plan> & { id: string }) => {
      const exists = plans.some(p => p.id === plan.id);
      if (exists) return api.plans.update(plan.id, plan);
      return api.plans.create(plan);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      setDialog(false);
      setEditing(null);
      toast({ title: "Plan saved" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.plans.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plans"] }); toast({ title: "Plan deleted" }); },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.plans.duplicate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plans"] }); toast({ title: "Plan duplicated" }); },
  });

  const openEdit = (plan?: Plan) => {
    setEditing(plan ? { ...plan, featureToggles: plan.featureToggles ?? {} } : emptyPlan());
    setFeatureInput("");
    setDialog(true);
  };

  const toggleFeature = (key: string, on: boolean) => {
    if (!editing) return;
    setEditing({ ...editing, featureToggles: { ...editing.featureToggles, [key]: on } });
  };

  const addFeatureLine = () => {
    if (!editing || !featureInput.trim()) return;
    setEditing({ ...editing, features: [...(editing.features || []), featureInput.trim()] });
    setFeatureInput("");
  };

  if (isLoading) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Package Builder</h2>
          <p className="text-muted-foreground">Create and manage subscription plans with feature toggles and limits.</p>
        </div>
        <Button onClick={() => openEdit()}><Plus className="mr-2 h-4 w-4" /> Create Plan</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map(plan => (
          <Card key={plan.id} className={plan.isPublished === false ? "opacity-75" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <Badge variant={plan.isPublished !== false ? "default" : "secondary"} className="text-xs">
                  {plan.isPublished !== false ? "Published" : "Draft"}
                </Badge>
              </div>
              <CardDescription className="text-2xl font-bold text-foreground">
                {fmtINRFull(plan.price)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Branches: {plan.maxBranches} · Staff: {plan.maxStaff} · Items: {plan.maxItems}</p>
                {plan.trialDays ? <p>Trial: {plan.trialDays} days</p> : null}
              </div>
              <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">
                {(plan.features as string[]).slice(0, 5).map((f, i) => <li key={i}>• {f}</li>)}
              </ul>
              <div className="flex gap-1 pt-2">
                <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => openEdit(plan)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => duplicateMutation.mutate(plan.id)}><Copy className="h-3 w-3" /></Button>
                {!["free", "starter", "pro", "enterprise"].includes(plan.id) && (
                  <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => deleteMutation.mutate(plan.id)}><Trash2 className="h-3 w-3" /></Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialog} onOpenChange={o => { if (!o) { setDialog(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing && plans.some(p => p.id === editing.id) ? "Edit Plan" : "New Plan"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Plan ID</Label><Input value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} disabled={plans.some(p => p.id === editing.id)} /></div>
                <div className="space-y-1"><Label>Name</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Price (₹/mo)</Label><Input type="number" value={editing.price} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-1"><Label>Trial Days</Label><Input type="number" value={editing.trialDays ?? 0} onChange={e => setEditing({ ...editing, trialDays: parseInt(e.target.value, 10) || 0 })} /></div>
                <div className="space-y-1"><Label>Max Branches</Label><Input type="number" value={editing.maxBranches} onChange={e => setEditing({ ...editing, maxBranches: parseInt(e.target.value, 10) || 1 })} /></div>
                <div className="space-y-1"><Label>Max Staff</Label><Input type="number" value={editing.maxStaff} onChange={e => setEditing({ ...editing, maxStaff: parseInt(e.target.value, 10) || 1 })} /></div>
                <div className="space-y-1"><Label>Max Menu Items</Label><Input type="number" value={editing.maxItems} onChange={e => setEditing({ ...editing, maxItems: parseInt(e.target.value, 10) || 50 })} /></div>
                <div className="space-y-1"><Label>Max Tables</Label><Input type="number" value={editing.maxTables ?? 20} onChange={e => setEditing({ ...editing, maxTables: parseInt(e.target.value, 10) || 20 })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.isPublished !== false} onCheckedChange={v => setEditing({ ...editing, isPublished: v })} />
                <Label>Published (visible to vendors)</Label>
              </div>
              <div>
                <Label className="mb-2 block">Feature list (marketing bullets)</Label>
                <div className="flex gap-2 mb-2">
                  <Input placeholder="e.g. Unlimited QR codes" value={featureInput} onChange={e => setFeatureInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addFeatureLine())} />
                  <Button type="button" variant="outline" onClick={addFeatureLine}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(editing.features || []).map((f, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setEditing({ ...editing, features: (editing.features || []).filter((_, j) => j !== i) })}>{f} ×</Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Feature toggles (enforced per plan)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(DEFAULT_TOGGLES).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <span>{label}</span>
                      <Switch checked={!!editing.featureToggles?.[key]} onCheckedChange={v => toggleFeature(key, v)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button disabled={!editing?.name || saveMutation.isPending} onClick={() => editing && saveMutation.mutate(editing as Plan & { id: string })}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
              Save Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
