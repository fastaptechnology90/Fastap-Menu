import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "wouter";
import { Check, Users, TrendingUp, Loader2, RefreshCcw, AlertTriangle, Pause, Play, ArrowUp, ArrowDown, Layers } from "lucide-react";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

export default function Subscriptions() {
  const { data: subs = [], isLoading, refetch } = useQuery({ queryKey: ["subscriptions"], queryFn: api.subscriptions.list });
  const { data: plans = [] } = useQuery({ queryKey: ["plans"], queryFn: api.plans.list });
  const [actionVendor, setActionVendor] = useState<any>(null);
  const [actionType, setActionType] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const actionMutation = useMutation({
    mutationFn: ({ vendorId, action, plan }: { vendorId: number; action: string; plan?: string }) =>
      api.subscriptions.action(vendorId, { action, plan }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["superadmin-vendors"] });
      toast({ title: "Subscription updated" });
      setActionVendor(null);
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const planCounts = plans.map((p: any) => ({
    ...p,
    count: subs.filter((s: any) => s.plan === p.id).length,
    color: p.id === "enterprise" ? "text-orange-500" : p.id === "pro" ? "text-purple-500" : p.id === "starter" ? "text-blue-500" : "text-muted-foreground",
  }));

  const activeCount = subs.filter((s: any) => s.status === "Active").length;
  const trialCount = subs.filter((s: any) => s.plan === "free" && s.status === "Active").length;
  const cancelledCount = subs.filter((s: any) => s.status === "Canceled" || s.status === "Cancelled").length;
  const mrr = subs.filter((s: any) => s.status === "Active").reduce((sum: number, s: any) => sum + (s.amount || 0), 0);

  const expiringSoon = subs
    .filter((s: any) => s.status === "Active" && s.renewal)
    .map((s: any) => {
      const daysLeft = Math.ceil((new Date(s.renewal).getTime() - Date.now()) / 86400000);
      return { ...s, name: s.vendorName, daysLeft, mrr: s.amount };
    })
    .filter((s: any) => s.daysLeft >= 0 && s.daysLeft <= 14)
    .sort((a: any, b: any) => a.daysLeft - b.daysLeft);

  const handleAction = (vendor: any, type: string) => {
    setActionVendor(vendor);
    setActionType(type);
    if (type === "upgrade" || type === "downgrade") setSelectedPlan(vendor.plan);
  };

  const confirmAction = () => {
    if (!actionVendor) return;
    const plan = (actionType === "upgrade" || actionType === "downgrade") ? selectedPlan : undefined;
    actionMutation.mutate({ vendorId: actionVendor.vendorId, action: actionType, plan });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">Subscription & SaaS Management</h2><p className="text-muted-foreground">Manage vendor plans, lifecycle, and recurring billing.</p></div>
        <div className="flex gap-2">
          <Link href="/plans"><Button variant="outline" size="sm"><Layers className="mr-2 h-4 w-4" /> Plan Builder</Button></Link>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCcw className="mr-2 h-4 w-4" /> Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Active Subscriptions" value={activeCount} icon={<Users className="h-4 w-4 text-primary" />} />
        <KpiCard title="Trial (Free) Vendors" value={trialCount} icon={<TrendingUp className="h-4 w-4 text-blue-500" />} />
        <KpiCard title="Cancelled" value={cancelledCount} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Monthly MRR" value={`₹${mrr.toLocaleString("en-IN")}`} icon={<TrendingUp className="h-4 w-4 text-green-500" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {planCounts.map((plan: any) => (
          <Card key={plan.id} className={plan.id === "pro" ? "border-primary/50 ring-1 ring-primary/20" : ""}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className={`text-base ${plan.color}`}>{plan.name}</CardTitle>
                <Badge variant={plan.id === "pro" ? "default" : "secondary"} className="text-xs">{plan.count} vendors</Badge>
              </div>
              <CardDescription>
                <span className="text-2xl font-bold text-foreground">₹{plan.price}</span>
                {plan.price > 0 && <span className="text-xs text-muted-foreground"> /month</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-xs">
                {(plan.features as string[] || []).slice(0, 5).map((f, i) => (
                  <li key={i} className="flex items-center text-muted-foreground"><Check className="mr-2 h-3 w-3 text-primary flex-shrink-0" />{f}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Expiring Soon</CardTitle>
          <CardDescription>Subscriptions renewing in the next 14 days</CardDescription>
        </CardHeader>
        <CardContent>
          {expiringSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No subscriptions expiring in the next 14 days.</p>
          ) : (
            <div className="space-y-3">
              {expiringSoon.map((v: any) => (
                <div key={v.vendorId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{v.name}</p>
                    <p className="text-xs text-muted-foreground">Renews in <span className="text-red-500 font-semibold">{v.daysLeft} days</span> · ₹{v.mrr}/mo</p>
                  </div>
                  <Button size="sm" className="text-xs" onClick={() => handleAction(v, "renew")}>Renew Now</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Vendor Subscriptions</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable data={subs} pageSize={10} columns={[
              { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
              { header: "Plan", cell: (row: any) => <Badge variant="outline" className="capitalize">{row.plan}</Badge> },
              { header: "Amount", cell: (row: any) => <span className="font-medium">{row.amount > 0 ? `₹${row.amount}/mo` : "Free"}</span> },
              { header: "Renewal", cell: (row: any) => <span className="text-sm text-muted-foreground">{row.renewal}</span> },
              { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
              { header: "Auto-Renew", cell: (row: any) => <Switch checked={row.autoRenew} disabled /> },
              { header: "Actions", cell: (row: any) => (
                <div className="flex gap-1 flex-wrap">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleAction(row, "upgrade")} title="Change plan"><ArrowUp className="h-3 w-3" /></Button>
                  {row.status === "Active" ? (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-yellow-500" onClick={() => handleAction(row, "pause")} title="Pause"><Pause className="h-3 w-3" /></Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-green-500" onClick={() => handleAction(row, "resume")} title="Resume"><Play className="h-3 w-3" /></Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => handleAction(row, "renew")} title="Renew"><RefreshCcw className="h-3 w-3" /></Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!actionVendor} onOpenChange={() => setActionVendor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionType} Subscription — {actionVendor?.vendorName}</DialogTitle>
          </DialogHeader>
          {(actionType === "upgrade" || actionType === "downgrade") && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Current plan: <Badge variant="outline" className="capitalize ml-1">{actionVendor?.plan}</Badge></p>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger><SelectValue placeholder="Select new plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} — ₹{p.price}/mo</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionVendor(null)}>Cancel</Button>
            <Button onClick={confirmAction} disabled={actionMutation.isPending}>
              {actionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
