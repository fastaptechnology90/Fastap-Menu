import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/Page";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KpiCard } from "@/components/shared/KpiCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "wouter";
import { Check, Users, TrendingUp, Loader2, RefreshCcw, AlertTriangle, Pause, Play, ArrowUp, Layers } from "lucide-react";
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
    // Optimistic: update the affected row instantly instead of waiting for the full
    // subscriptions + vendors lists to refetch (that round-trip is what made plan
    // changes / pause / resume feel very slow).
    onMutate: async ({ vendorId, action, plan }) => {
      await qc.cancelQueries({ queryKey: ["subscriptions"] });
      const prev = qc.getQueryData<any[]>(["subscriptions"]);
      qc.setQueryData<any[]>(["subscriptions"], (old) => (old ?? []).map((s: any) => {
        if (s.vendorId !== vendorId) return s;
        const next = { ...s };
        if (plan) { next.plan = plan; next.amount = (plans as any[]).find((p: any) => p.id === plan)?.price ?? next.amount; }
        if (action === "pause" || action === "cancel") { next.status = "Canceled"; next.autoRenew = false; }
        if (action === "resume" || action === "renew") { next.status = "Active"; next.autoRenew = true; }
        return next;
      }));
      setActionVendor(null);
      return { prev };
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["subscriptions"], ctx.prev);
      toast({ title: "Action failed", description: e?.message, variant: "destructive" });
    },
    // The vendors list carries the same plan/active flags this writes.
    onSettled: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); qc.invalidateQueries({ queryKey: ["superadmin-vendors"] }); },
    onSuccess: () => toast({ title: "Subscription updated" }),
  });

  const planCounts = plans.map((p: any) => ({
    ...p,
    count: subs.filter((s: any) => s.plan === p.id).length,
  }));

  const activeCount = subs.filter((s: any) => s.status === "Active").length;
  const trialCount = subs.filter((s: any) => s.plan === "free" && s.status === "Active").length;
  const cancelledCount = subs.filter((s: any) => s.status === "Canceled" || s.status === "Cancelled").length;
  const mrr = subs.filter((s: any) => s.status === "Active").reduce((sum: number, s: any) => sum + (s.amount || 0), 0);

  const handleAction = (vendor: any, type: string) => {
    setActionVendor(vendor);
    setActionType(type);
    if (type === "upgrade" || type === "downgrade") setSelectedPlan(vendor.plan);
  };

  const isPlanChange = actionType === "upgrade" || actionType === "downgrade";
  const planUnchanged = isPlanChange && (!selectedPlan || selectedPlan === actionVendor?.plan);

  const confirmAction = () => {
    if (!actionVendor) return;
    if (planUnchanged) {
      toast({ title: "Pick a different plan", description: `${actionVendor.vendorName} is already on ${actionVendor.plan}.` });
      return;
    }
    const plan = isPlanChange ? selectedPlan : undefined;
    actionMutation.mutate({ vendorId: actionVendor.vendorId, action: actionType, plan });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Which plan every venue is on, and the monthly value of those plans."
        actions={
          <>
            <Link href="/plans"><Button variant="outline" size="sm"><Layers className="mr-2 h-4 w-4" /> Plan builder</Button></Link>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCcw className="mr-2 h-4 w-4" /> Refresh</Button>
          </>
        }
      />

      {/* Every field on a row here is derived on read: `status` means "not suspended",
          `renewal` is the venue's signup date plus 30 days and never advances, and
          `autoRenew` is the active flag under another name. No subscription payment has
          ever been recorded, so the MRR below is contracted value, not money received. */}
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>These rows are derived, not billed</AlertTitle>
        <AlertDescription>
          There is no subscription ledger behind this screen. Status means the venue is switched on,
          the renewal date is signup plus 30 days and does not move, and nothing renews on its own.
          The MRR figure is the value of the plans venues are assigned, not money collected.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Active vendors" value={activeCount} icon={<Users />} />
        <KpiCard title="On the free plan" value={trialCount} icon={<TrendingUp />} />
        <KpiCard title="Switched off" value={cancelledCount} icon={<AlertTriangle />} />
        <KpiCard title="Contracted MRR" value={`₹${mrr.toLocaleString("en-IN")}`} icon={<TrendingUp />} subtitle="Plan value, not collected" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {planCounts.map((plan: any) => (
          <Card key={plan.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">{plan.name}</CardTitle>
                <Badge variant="muted">{plan.count} {plan.count === 1 ? "vendor" : "vendors"}</Badge>
              </div>
              <CardDescription>
                <span className="text-2xl font-semibold tabular-nums text-foreground">₹{plan.price.toLocaleString("en-IN")}</span>
                {plan.price > 0 && <span className="text-xs text-muted-foreground"> /month</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-xs">
                {(plan.features as string[] || []).slice(0, 5).map((f, i) => (
                  <li key={i} className="flex items-center text-muted-foreground"><Check className="mr-2 h-3 w-3 shrink-0 text-primary" />{f}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">All vendor subscriptions</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : subs.length === 0 ? (
            <EmptyState title="No vendors yet" description="Vendors appear here as soon as they are onboarded." />
          ) : (
            <DataTable data={subs} pageSize={10} columns={[
              { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
              { header: "Plan", cell: (row: any) => <Badge variant="outline" className="capitalize">{row.plan}</Badge> },
              { header: "Amount", cell: (row: any) => <span className="tabular-nums font-medium">{row.amount > 0 ? `₹${row.amount.toLocaleString("en-IN")}/mo` : "Free"}</span> },
              // Header says "derived": this is signup + 30 days for every venue, not a
              // date anything bills on. The old column read as a real renewal schedule.
              { header: "Renews (derived)", cell: (row: any) => <span className="text-sm tabular-nums text-muted-foreground">{row.renewal}</span> },
              { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
              // Was a checked Switch for every row, which asserted automatic renewal for
              // vendors that nothing renews.
              { header: "Renewal", cell: () => <Badge variant="muted">Manual</Badge> },
              { header: "Actions", cell: (row: any) => (
                <div className="flex flex-wrap gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => handleAction(row, "upgrade")} title="Change plan" aria-label={`Change ${row.vendorName}'s plan`}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  {row.status === "Active" ? (
                    <Button size="icon-sm" variant="ghost" onClick={() => handleAction(row, "pause")} title="Pause" aria-label={`Pause ${row.vendorName}`}><Pause className="h-3.5 w-3.5" /></Button>
                  ) : (
                    <Button size="icon-sm" variant="ghost" onClick={() => handleAction(row, "resume")} title="Resume" aria-label={`Resume ${row.vendorName}`}><Play className="h-3.5 w-3.5" /></Button>
                  )}
                  <Button size="icon-sm" variant="ghost" onClick={() => handleAction(row, "renew")} title="Renew" aria-label={`Renew ${row.vendorName}`}><RefreshCcw className="h-3.5 w-3.5" /></Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!actionVendor} onOpenChange={() => setActionVendor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionType} subscription — {actionVendor?.vendorName}</DialogTitle>
          </DialogHeader>
          {(actionType === "upgrade" || actionType === "downgrade") && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Current plan: <Badge variant="outline" className="ml-1 capitalize">{actionVendor?.plan}</Badge></p>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger><SelectValue placeholder="Select new plan" /></SelectTrigger>
                <SelectContent>
                  {plans.filter((p: any) => p.isPublished !== false).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} — ₹{p.price.toLocaleString("en-IN")}/mo</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionVendor(null)}>Cancel</Button>
            <Button onClick={confirmAction} disabled={actionMutation.isPending || planUnchanged}>
              {actionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
