import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, RefreshCw, Loader2, Search, TrendingUp, Phone, Calendar, MessageSquare, Star, Zap } from "lucide-react";

export default function VendorCRM() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ vendorName: "", type: "Meeting Log", notes: "", followUpDate: "", outcome: "Positive", upsellPlan: "" });

  const { data: crm, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["vendor-crm"],
    queryFn: api.vendorCrm.get,
  });

  const createLog = useMutation({
    mutationFn: api.vendorCrm.createLog,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-crm"] }); setOpen(false); toast({ title: "CRM log added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const completeFollowUp = useMutation({
    mutationFn: api.vendorCrm.completeLog,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-crm"] }); toast({ title: "Follow-up marked complete" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remindVendor = useMutation({
    mutationFn: api.vendorCrm.remind,
    onSuccess: () => toast({ title: "Renewal reminder sent" }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const renewVendor = useMutation({
    mutationFn: api.vendorCrm.renew,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-crm"] }); toast({ title: "Manual renewal completed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Follow-up rows carry no dedicated phone field from the backend, so dial when a
  // contact number is present and otherwise record the outreach via the CRM log API.
  const callFollowUp = (fu: any) => {
    const phone = fu.phone || fu.contactPhone || fu.vendorPhone || fu.ownerPhone;
    if (phone) {
      window.location.href = `tel:${String(phone).replace(/[^\d+]/g, "")}`;
      return;
    }
    createLog.mutate({
      vendorName: fu.vendorName,
      type: "Phone Call",
      notes: `Call logged for follow-up: ${fu.notes || "—"}`,
      outcome: "Pending Follow-up",
      followUpDate: "",
      vendorId: fu.restaurantId ?? fu.vendorId,
    });
  };

  const logs = crm?.logs || [];
  const followUps = crm?.followUps || [];
  const upsellOpportunities = crm?.upsellOpportunities || [];
  const renewalAlerts = crm?.renewalAlerts || [];

  const filteredLogs = logs.filter((l: any) => l.vendorName?.toLowerCase().includes(search.toLowerCase()));

  const lifecycleStages = [
    { stage: "Trial", count: crm?.lifecycle?.trial || 0, color: "bg-blue-500" },
    { stage: "Active", count: crm?.lifecycle?.active || 0, color: "bg-green-500" },
    { stage: "Growth", count: crm?.lifecycle?.growth || 0, color: "bg-teal-500" },
    { stage: "Enterprise", count: crm?.lifecycle?.enterprise || 0, color: "bg-purple-500" },
    { stage: "Dormant", count: crm?.lifecycle?.dormant || 0, color: "bg-gray-500" },
    { stage: "Churn Risk", count: crm?.lifecycle?.churnRisk || 0, color: "bg-red-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vendor Success CRM</h2>
          <p className="text-muted-foreground">Meeting logs, follow-ups, renewal reminders, and upsell opportunities.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Log Interaction</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Log Vendor Interaction</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createLog.mutate(form); }} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Vendor Name</Label>
                  <Input placeholder="Vendor business name" value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Interaction Type</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Meeting Log", "Phone Call", "Email", "Follow-up", "Renewal Discussion", "Upsell Pitch", "Complaint"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Outcome</Label>
                    <Select value={form.outcome} onValueChange={v => setForm(f => ({ ...f, outcome: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Positive">Positive</SelectItem>
                        <SelectItem value="Neutral">Neutral</SelectItem>
                        <SelectItem value="Negative">Negative</SelectItem>
                        <SelectItem value="Pending Follow-up">Pending Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Meeting notes, key points discussed..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Follow-up Date</Label>
                    <Input type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Upsell Plan (if any)</Label>
                    <Select value={form.upsellPlan} onValueChange={v => setForm(f => ({ ...f, upsellPlan: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select plan..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="starter">→ Starter</SelectItem>
                        <SelectItem value="pro">→ Pro</SelectItem>
                        <SelectItem value="enterprise">→ Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createLog.isPending}>
                  {createLog.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Log Interaction
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Interactions" value={logs.length} icon={<MessageSquare className="h-4 w-4 text-primary" />} />
        <KpiCard title="Pending Follow-ups" value={followUps.length} icon={<Calendar className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Upsell Opportunities" value={upsellOpportunities.length} icon={<Zap className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Renewals Due (30d)" value={renewalAlerts.length} icon={<Star className="h-4 w-4 text-orange-500" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        {lifecycleStages.map((stage, i) => (
          <Card key={i} className="text-center">
            <CardContent className="pt-4">
              <div className={`w-3 h-3 rounded-full ${stage.color} mx-auto mb-2`} />
              <p className="text-2xl font-bold">{stage.count}</p>
              <p className="text-xs text-muted-foreground">{stage.stage}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Interaction Logs</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="upsell">Upsell Pipeline</TabsTrigger>
          <TabsTrigger value="renewals">Renewal Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search vendor…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                <DataTable data={filteredLogs} pageSize={10} columns={[
                  { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
                  { header: "Type", cell: (row: any) => <Badge variant="outline" className="text-xs">{row.type}</Badge> },
                  { header: "Notes", cell: (row: any) => <span className="text-xs text-muted-foreground max-w-[200px] truncate block">{row.notes}</span> },
                  { header: "Outcome", cell: (row: any) => (
                    <Badge variant={row.outcome === "Positive" ? "default" : row.outcome === "Negative" ? "destructive" : "secondary"} className="text-xs">{row.outcome}</Badge>
                  )},
                  { header: "Follow-up", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.followUpDate || "None"}</span> },
                  { header: "Logged By", cell: (row: any) => <span className="text-sm">{row.loggedBy}</span> },
                  { header: "Date", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.loggedAt).toLocaleDateString()}</span> },
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                <div className="space-y-3">
                  {followUps.map((fu: any) => (
                    <div key={fu.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <p className="font-medium">{fu.vendorName}</p>
                        <p className="text-xs text-muted-foreground">{fu.notes}</p>
                        <p className="text-xs text-yellow-400 mt-1">Due: {fu.followUpDate ? new Date(fu.followUpDate).toLocaleDateString() : "—"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={createLog.isPending} onClick={() => callFollowUp(fu)}><Phone className="h-3 w-3 mr-1" /> Call</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-green-400" disabled={completeFollowUp.isPending} onClick={() => completeFollowUp.mutate(fu.id)}>Done</Button>
                      </div>
                    </div>
                  ))}
                  {followUps.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No pending follow-ups</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upsell" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                <DataTable data={upsellOpportunities} pageSize={10} columns={[
                  { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
                  { header: "Current Plan", cell: (row: any) => <Badge variant="outline" className="text-xs capitalize">{row.currentPlan}</Badge> },
                  { header: "Target Plan", cell: (row: any) => <Badge className="text-xs capitalize">{row.targetPlan}</Badge> },
                  { header: "MRR Uplift", cell: (row: any) => <span className="font-bold text-green-400">+₹{row.mrrUplift?.toLocaleString("en-IN")}/mo</span> },
                  { header: "Probability", cell: (row: any) => <span className={`font-bold ${row.probability > 70 ? "text-green-400" : "text-yellow-400"}`}>{row.probability}%</span> },
                  { header: "Action", cell: (row: any) => <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => createLog.mutate({ vendorName: row.vendorName, type: "Upsell Pitch", notes: `Pitch ${row.targetPlan} plan`, outcome: "Scheduled", vendorId: Number(String(row.id).replace("UP-", "")) })}>Pitch</Button> },
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renewals" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                <DataTable data={renewalAlerts} pageSize={10} columns={[
                  { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
                  { header: "Plan", cell: (row: any) => <Badge variant="outline" className="text-xs capitalize">{row.plan}</Badge> },
                  { header: "MRR", cell: (row: any) => <span className="font-bold">₹{row.mrr?.toLocaleString("en-IN")}/mo</span> },
                  { header: "Renewal Date", cell: (row: any) => <span className="text-xs font-medium text-yellow-400">{row.renewalDate}</span> },
                  { header: "Days Left", cell: (row: any) => <span className={`font-bold ${row.daysLeft <= 7 ? "text-red-400" : "text-yellow-400"}`}>{row.daysLeft}d</span> },
                  { header: "Actions", cell: (row: any) => (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={remindVendor.isPending} onClick={() => remindVendor.mutate({ vendorId: row.vendorId, vendorName: row.vendorName })}>Remind</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-green-400" disabled={renewVendor.isPending} onClick={() => renewVendor.mutate(row.vendorId)}>Renew</Button>
                    </div>
                  )},
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
