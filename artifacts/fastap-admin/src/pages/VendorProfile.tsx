import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { ShieldBan, CheckCircle, PauseCircle, Loader2, ArrowLeft, Download, FileText, Shield, Users, Smartphone, BarChart2, CreditCard, Package, MessageSquare, Activity, Edit2, Save, AlertTriangle, Key, RefreshCw, LogOut, Trash2, QrCode, Nfc, ShoppingCart, Eye } from "lucide-react";
import { api } from "@/lib/apiClient";
import { FeatureControlPanel } from "@/components/features/FeatureControlPanel";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function VendorProfile() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("Internal Note");
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [branchOpen, setBranchOpen] = useState(false);
  const [editBranchOpen, setEditBranchOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: "", address: "" });
  const [editBranch, setEditBranch] = useState({ id: "", name: "", address: "" });
  const [staffForm, setStaffForm] = useState({ name: "", email: "", role: "waiter", phone: "", password: "" });
  const [qrLabel, setQrLabel] = useState("");

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor", id],
    queryFn: () => api.vendors.get(id),
    enabled: !!id,
  });

  const { data: vendorFeatures, isLoading: featuresLoading } = useQuery({
    queryKey: ["vendor-features", id],
    queryFn: () => api.vendors.getFeatures(id),
    enabled: !!id,
  });

  const featuresMutation = useMutation({
    mutationFn: (overrides: Record<string, boolean>) => api.vendors.setFeatures(id, overrides),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-features", id] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["superadmin-payments"],
    queryFn: () => api.payments.list({ limit: 100 }),
  });

  const { data: supportTickets = [] } = useQuery({
    queryKey: ["support"],
    queryFn: api.support.list,
  });

  const { data: kyc = [] } = useQuery({
    queryKey: ["kyc"],
    queryFn: api.kyc.list,
  });

  const { data: refunds = [] } = useQuery({
    queryKey: ["refunds"],
    queryFn: api.refunds.list,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["superadmin-audit-logs"],
    queryFn: api.auditLogs.list,
  });

  const { data: vendorStaff = [] } = useQuery({
    queryKey: ["vendor-staff", id],
    queryFn: () => api.vendors.staff(id),
    enabled: !!id,
  });

  const { data: vendorBranches = [] } = useQuery({
    queryKey: ["vendor-branches", id],
    queryFn: () => api.vendors.branches(id),
    enabled: !!id,
  });

  const { data: vendorDocuments = [] } = useQuery({
    queryKey: ["vendor-documents", id],
    queryFn: () => api.vendors.documents(id),
    enabled: !!id,
  });

  const { data: vendorNotes = [] } = useQuery({
    queryKey: ["vendor-crm-logs", id],
    queryFn: () => api.vendors.crmLogs(id),
    enabled: !!id,
  });

  const { data: allQrCodes = [] } = useQuery({
    queryKey: ["superadmin-qr"],
    queryFn: api.qr.list,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: api.plans.list,
  });

  const { data: vendorSettlements = [] } = useQuery({
    queryKey: ["vendor-settlements", id],
    queryFn: () => api.vendors.settlements(id),
    enabled: !!id,
  });

  const toggleMutation = useMutation({
    mutationFn: () => api.vendors.toggle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      qc.invalidateQueries({ queryKey: ["superadmin-vendors"] });
      toast({ title: "Vendor status updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const updatePlanMutation = useMutation({
    mutationFn: (plan: string) => api.vendors.updatePlan(id, plan),
    onMutate: async (plan: string) => {
      await qc.cancelQueries({ queryKey: ["vendor", id] });
      const prev = qc.getQueryData<any>(["vendor", id]);
      qc.setQueryData<any>(["vendor", id], (old: any) => old ? { ...old, plan } : old);
      return { prev };
    },
    onError: (_e: any, _v: any, ctx: any) => { if (ctx?.prev) qc.setQueryData(["vendor", id], ctx.prev); toast({ title: "Failed to update plan", variant: "destructive" }); },
    onSuccess: () => toast({ title: "Plan updated" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["vendor", id] }),
  });

  const freezePayoutMutation = useMutation({
    mutationFn: () => api.vendors.freezePayouts(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor", id] }); toast({ title: "Payouts frozen" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const subscriptionMutation = useMutation({
    mutationFn: (action: string) => api.subscriptions.action(id, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor", id] }); toast({ title: "Subscription updated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const saveNoteMutation = useMutation({
    mutationFn: () => api.vendorCrm.createLog({ vendorName: vendor!.name, type: noteType, notes: note, vendorId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-crm-logs", id] });
      setNote("");
      toast({ title: `${noteType} saved` });
    },
  });

  const kycApproveMutation = useMutation({
    mutationFn: async () => {
      await api.kyc.approve(String(vendorKyc?.id || vendor!.id));
      // Also mark each uploaded document verified so they don't stay "Pending" after
      // the overall KYC is approved.
      await Promise.all(
        (vendorDocuments as any[])
          .filter(d => d?.id && d.status !== "Verified")
          .map(d => api.kyc.verifyDocument(d.id, "verified").catch(() => {})),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc"] });
      qc.invalidateQueries({ queryKey: ["vendor-documents", id] });
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      toast({ title: "KYC approved — documents verified" });
    },
  });

  const kycRequestMutation = useMutation({
    mutationFn: () => api.kyc.requestMore(String(vendorKyc?.id || vendor!.id)),
    onSuccess: () => toast({ title: "Re-upload request sent" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => api.vendors.resetPassword(id),
    onSuccess: (data) => toast({ title: "Password reset", description: `Temporary password: ${data.temporaryPassword}` }),
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const createBranchMutation = useMutation({
    mutationFn: () => api.vendors.createBranch(id, branchForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-branches", id] }); setBranchOpen(false); setBranchForm({ name: "", address: "" }); toast({ title: "Branch added" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const disableBranchMutation = useMutation({
    mutationFn: (branchId: string) => api.vendors.updateBranch(id, branchId, { isActive: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-branches", id] }); toast({ title: "Branch disabled" }); },
  });

  const editBranchMutation = useMutation({
    mutationFn: () => api.vendors.updateBranch(id, editBranch.id, { name: editBranch.name, address: editBranch.address }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-branches", id] }); setEditBranchOpen(false); toast({ title: "Branch updated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const createStaffMutation = useMutation({
    mutationFn: () => api.vendors.createStaff(id, staffForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-staff", id] }); setStaffOpen(false); setStaffForm({ name: "", email: "", role: "waiter", phone: "", password: "" }); toast({ title: "Staff added" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (staffId: string) => api.vendors.deleteStaff(id, staffId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-staff", id] }); toast({ title: "Staff removed" }); },
  });

  const createQrMutation = useMutation({
    mutationFn: () => api.vendors.createQr(id, { label: qrLabel || "Menu QR", type: "table" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-qr"] }); setQrLabel(""); toast({ title: "QR code generated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteQrMutation = useMutation({
    mutationFn: (qrId: string) => api.vendors.deleteQr(id, qrId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-qr"] }); toast({ title: "QR disabled" }); },
  });

  const controlsMutation = useMutation({
    mutationFn: (controls: Record<string, boolean>) => api.vendors.setControls(id, controls),
    // Optimistic: flip the switch instantly instead of waiting for the whole (heavy)
    // vendor profile to refetch — that round-trip was what made the toggle feel slow.
    onMutate: async (controls) => {
      await qc.cancelQueries({ queryKey: ["vendor", id] });
      const prev = qc.getQueryData<any>(["vendor", id]);
      qc.setQueryData<any>(["vendor", id], (old: any) =>
        old ? { ...old, platformControls: { ...(old.platformControls ?? {}), ...controls } } : old);
      return { prev };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["vendor", id], ctx.prev);
      toast({ title: "Failed to update controls", variant: "destructive" });
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["vendor", id] }); },
  });

  const forceLogoutMutation = useMutation({
    mutationFn: () => api.vendors.forceLogout(id),
    onSuccess: () => toast({ title: "All vendor sessions invalidated" }),
  });

  const deleteVendorMutation = useMutation({
    mutationFn: () => api.vendors.delete(id),
    onSuccess: () => { toast({ title: "Vendor deleted" }); window.location.href = "/vendors"; },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-muted-foreground">Vendor not found.</p>
        <Link href="/vendors"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Vendors</Button></Link>
      </div>
    );
  }

  const vendorTx = payments.filter(t => t.vendorName === vendor.name);
  const vendorTickets = supportTickets.filter(t => t.vendorName === vendor.name);
  const vendorKyc = kyc.find((k: any) => k.vendorId === String(vendor.id));
  const vendorRefunds = refunds.filter((r: any) => r.vendorName === vendor.name);
  const vendorLogs = auditLogs.filter((l: any) => l.target?.includes(String(vendor.id)));

  const planPriceMap = Object.fromEntries((plans as any[]).map(p => [p.id, p.price]));
  const mrr = planPriceMap[vendor.plan] ?? 0;
  const healthScore = vendor.isActive ? Math.min(95, 50 + (vendor.totalOrders > 50 ? 25 : vendor.totalOrders > 10 ? 15 : 5) + (vendor.plan === "enterprise" ? 20 : vendor.plan === "pro" ? 10 : 0)) : 20;
  // Paid transactions only, so this matches the vendor-list revenue and the dashboard.
  const totalRevenue = vendorTx.reduce((s, t) => s + ((t as any).isPaid ? t.grossAmount : 0), 0);
  const totalCommission = vendorTx.reduce((s, t) => s + t.commission, 0);
  const openTickets = vendorTickets.filter(t => t.status === "Open" || t.status === "In Progress" || t.status === "open" || t.status === "in_progress").length;
  const lastSettlement = vendorSettlements[0];
  const pendingSettlements = vendorSettlements.filter((s: any) => s.status === "pending");
  const heldSettlements = vendorSettlements.filter((s: any) => s.status === "held");
  const pendingPayout = pendingSettlements.reduce((s: number, x: any) => s + (x.finalPayout || 0), 0);
  const holdAmount = heldSettlements.reduce((s: number, x: any) => s + (x.finalPayout || 0), 0);
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const platformControls = vendor.platformControls ?? {};

  const BRANCHES = vendorBranches.length ? vendorBranches : (vendor.address ? [{
    id: "B-main", name: `${vendor.name} — Main`, location: vendor.address, tables: 0, rooms: 0, status: vendor.isActive ? "Active" : "Inactive",
  }] : []);

  const STAFF = vendorStaff;
  const QR_CODES = allQrCodes.filter((q: any) => String(q.vendorId) === String(vendor.id)).map((q: any) => ({
    id: q.id, tableNo: q.label || q.type, type: q.type, scans: q.scans ?? 0,
    lastScan: q.lastScan || null, status: q.status || "Active", url: q.url,
  }));
  const DOCUMENTS = vendorDocuments.length ? vendorDocuments : (vendorKyc ? [
    { type: "KYC Status", number: vendorKyc.status || "pending", status: vendorKyc.status || "Pending", uploaded: "—", expires: null },
  ] : []);
  const NOTES = vendorNotes;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2">
        <Link href="/vendors"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Vendors</Button></Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">{vendor.name}</h2>
            <StatusBadge status={vendor.isActive ? "Active" : "Suspended"} />
            <Badge variant="outline" className="capitalize">{vendor.plan}</Badge>
            {vendor.plan === "enterprise" && <Badge className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">Enterprise</Badge>}
          </div>
          <p className="text-muted-foreground">ID: #{vendor.id} · {vendor.businessType || "Restaurant"} · Joined {new Date(vendor.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => forceLogoutMutation.mutate()} disabled={forceLogoutMutation.isPending}><LogOut className="mr-2 h-3.5 w-3.5" /> Force Logout</Button>
          <Button variant="outline" size="sm" disabled={resetPasswordMutation.isPending} onClick={() => resetPasswordMutation.mutate()}><Key className="mr-2 h-3.5 w-3.5" /> Reset Password</Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => { if (confirm("Soft-delete this vendor?")) deleteVendorMutation.mutate(); }}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</Button>
          <Button variant="outline" size="sm" className="text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/10"
            onClick={() => freezePayoutMutation.mutate()} disabled={freezePayoutMutation.isPending || (vendor as any).payoutsFrozen}>
            <PauseCircle className="mr-2 h-3.5 w-3.5" /> {(vendor as any).payoutsFrozen ? "Payouts Frozen" : "Freeze Payout"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={vendor.isActive ? "text-red-500 border-red-500/20 hover:bg-red-500/10" : "text-green-500 border-green-500/20 hover:bg-green-500/10"}
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          >
            {toggleMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : vendor.isActive ? <ShieldBan className="mr-2 h-3.5 w-3.5" /> : <CheckCircle className="mr-2 h-3.5 w-3.5" />}
            {vendor.isActive ? "Suspend" : "Activate"}
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Health Score</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className={`text-3xl font-bold ${healthScore >= 80 ? "text-green-400" : healthScore >= 60 ? "text-yellow-400" : "text-red-400"}`}>{healthScore}</div>
              <Progress value={healthScore} className={`flex-1 h-2.5 ${healthScore < 60 ? "[&>div]:bg-red-500" : healthScore < 80 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{healthScore >= 80 ? "Healthy" : healthScore >= 60 ? "Risk" : "Critical"}</p>
          </CardContent>
        </Card>
        <KpiCard title="MRR" value={`₹${mrr.toLocaleString("en-IN")}/mo`} icon={<CreditCard className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString("en-IN")}`} icon={<CreditCard className="h-4 w-4 text-blue-500" />} />
        <KpiCard title="Total Orders" value={vendor.totalOrders.toLocaleString()} icon={<Package className="h-4 w-4 text-primary" />} />
        <KpiCard title="Open Tickets" value={openTickets} icon={<AlertTriangle className={`h-4 w-4 ${openTickets > 0 ? "text-red-500" : "text-muted-foreground"}`} />} />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="kitchen-features">Kitchen Features</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="transactions">Transactions ({vendorTx.length})</TabsTrigger>
          <TabsTrigger value="refunds">Refunds ({vendorRefunds.length})</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="qrnfc">QR/NFC</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="support">Support ({vendorTickets.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          <TabsTrigger value="notes">Internal Notes</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Platform Controls</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {[
                { key: "orderingDisabled", label: "Disable Ordering", icon: ShoppingCart },
                { key: "qrDisabled", label: "Disable QR", icon: QrCode },
                { key: "nfcDisabled", label: "Disable NFC", icon: Nfc },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-muted-foreground" />{label}</div>
                  <Switch
                    checked={!!platformControls[key]}
                    onCheckedChange={v => controlsMutation.mutate({ [key]: v })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Business Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Business Name", value: vendor.name },
                  { label: "Owner", value: vendor.ownerName || "—" },
                  { label: "Email", value: vendor.ownerEmail || "—" },
                  { label: "Phone", value: vendor.phone || "—" },
                  { label: "Business Type", value: vendor.businessType || "Restaurant" },
                  { label: "Plan", value: <Badge variant="outline" className="capitalize">{vendor.plan}</Badge> },
                  { label: "Address", value: vendor.address || "—" },
                  { label: "Vendor ID", value: <span className="font-mono text-xs">#{vendor.id}</span> },
                  { label: "Status", value: <StatusBadge status={vendor.isActive ? "Active" : "Suspended"} /> },
                  { label: "Joined", value: new Date(vendor.createdAt).toLocaleDateString() },
                  { label: "Total Orders", value: vendor.totalOrders.toLocaleString() },
                  { label: "Commission Paid", value: fmt(totalCommission) },
                ].map((item, i) => (
                  <div key={i}>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <div className="font-medium text-sm mt-0.5">{typeof item.value === "string" ? item.value : item.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Risk Status</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">KYC Status</p>
                  <StatusBadge status={vendorKyc?.status || "Pending"} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Risk Level</p>
                  <Badge variant={healthScore < 60 ? "destructive" : healthScore < 80 ? "outline" : "default"} className="text-xs w-fit">
                    {healthScore < 60 ? "High Risk" : healthScore < 80 ? "Medium" : "Low"}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Fraud Alerts</p>
                  <span className="font-bold text-sm">0</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FINANCIALS TAB */}
        <TabsContent value="financials" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard title="Gross Revenue" value={fmt(totalRevenue)} icon={<CreditCard className="h-4 w-4 text-green-500" />} />
            <KpiCard title="Commission Paid" value={fmt(totalCommission)} icon={<CreditCard className="h-4 w-4 text-orange-500" />} />
            <KpiCard title="Net Payout" value={fmt(totalRevenue - totalCommission)} icon={<CreditCard className="h-4 w-4 text-blue-500" />} />
            <KpiCard title="Total Refunds" value={vendorRefunds.length} icon={<CreditCard className="h-4 w-4 text-red-500" />} />
          </div>
          <Card>
            <CardHeader><CardTitle>Wallet & Reserve</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Wallet Balance", value: fmt(pendingPayout) },
                  { label: "Locked Balance", value: fmt(holdAmount) },
                  { label: "Reserve Balance", value: fmt(Math.max(0, totalRevenue - totalCommission - pendingPayout)) },
                  { label: "Negative Balance", value: fmt(0) },
                ].map((item, i) => (
                  <div key={i} className="text-center p-4 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-xl font-bold mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Settlement Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: "Last Settlement", value: lastSettlement ? fmt(lastSettlement.finalPayout) : "—", date: lastSettlement ? new Date(lastSettlement.createdAt).toLocaleDateString() : "No settlements" },
                  { label: "Pending Settlement", value: fmt(pendingPayout), date: pendingSettlements[0] ? new Date(pendingSettlements[0].dueDate).toLocaleDateString() : "None pending" },
                  { label: "Hold Amount", value: fmt(holdAmount), date: heldSettlements.length ? `${heldSettlements.length} on hold` : "No holds" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div><p className="text-sm font-medium">{s.label}</p><p className="text-xs text-muted-foreground">{s.date}</p></div>
                    <span className="font-bold">{s.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUBSCRIPTION TAB */}
        <TabsContent value="subscription" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div><CardTitle>Current Subscription</CardTitle><CardDescription>Manage vendor plan and billing</CardDescription></div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Current Plan", value: <Badge className="capitalize text-sm">{vendor.plan}</Badge> },
                  { label: "Monthly Price", value: `₹${mrr.toLocaleString("en-IN")}/mo` },
                  { label: "Member Since", value: new Date(vendor.createdAt).toLocaleDateString() },
                  { label: "Status", value: <StatusBadge status={vendor.isActive ? "Active" : "Suspended"} /> },
                ].map((item, i) => (
                  <div key={i}><p className="text-xs text-muted-foreground mb-1">{item.label}</p>{typeof item.value === "string" ? <p className="font-bold">{item.value}</p> : item.value}</div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["free", "starter", "pro", "enterprise"].map(plan => (
                  <Button key={plan} variant={vendor.plan === plan ? "default" : "outline"} className="capitalize" size="sm" onClick={() => { if (vendor.plan !== plan) updatePlanMutation.mutate(plan); }}>
                    {vendor.plan === plan ? "Current: " : ""}{plan}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => subscriptionMutation.mutate("pause")} disabled={subscriptionMutation.isPending}>Pause Subscription</Button>
                <Button variant="outline" size="sm" onClick={() => subscriptionMutation.mutate("renew")} disabled={subscriptionMutation.isPending}>Renew Manually</Button>
                <Button variant="outline" size="sm" className="text-red-400" onClick={() => subscriptionMutation.mutate("cancel")} disabled={subscriptionMutation.isPending}>Cancel Subscription</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kitchen-features" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border p-3">
            <div className="text-sm">
              <p className="font-medium">Full control (all features)</p>
              <p className="text-xs text-muted-foreground">Turn on every module for this vendor regardless of plan — e.g. give a free-plan restaurant full access.</p>
            </div>
            <Button size="sm" disabled={featuresMutation.isPending || featuresLoading} onClick={() => {
              const all: Record<string, boolean> = {};
              for (const m of ((vendorFeatures?.modules ?? []) as any[])) all[m.key] = true;
              if (Object.keys(all).length) featuresMutation.mutate(all);
            }}>
              Grant Full Control
            </Button>
          </div>
          <FeatureControlPanel
            title="Kitchen app & module entitlements"
            description="Control all 49 enterprise kitchen systems for this vendor. Overrides apply on top of the subscription plan and sync to the mobile kitchen app and restaurant panel."
            mode="superadmin"
            loading={featuresLoading}
            modules={vendorFeatures?.modules ?? []}
            onSave={async (changes) => {
              const overrides: Record<string, boolean> = {};
              for (const [key, on] of Object.entries(changes)) {
                overrides[key] = on;
              }
              await featuresMutation.mutateAsync(overrides);
            }}
          />
        </TabsContent>

        {/* BRANCHES TAB */}
        <TabsContent value="branches" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Branches ({BRANCHES.length})</CardTitle>
              <Button size="sm" onClick={() => setBranchOpen(true)}><span className="mr-1">+</span> Add Branch</Button>
            </CardHeader>
            <CardContent>
              <DataTable data={BRANCHES} pageSize={10} columns={[
                { header: "Branch ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
                { header: "Branch Name", cell: (row: any) => <span className="font-medium">{row.name}</span> },
                { header: "Location", accessorKey: "location" },
                { header: "Tables", cell: (row: any) => <span>{row.tables}</span> },
                { header: "Rooms", cell: (row: any) => <span>{row.rooms}</span> },
                { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
                { header: "Actions", cell: (row: any) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditBranch({ id: row.id, name: row.name, address: row.location || "" }); setEditBranchOpen(true); }}>Edit</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400" onClick={() => disableBranchMutation.mutate(row.id)}>Disable</Button>
                  </div>
                )},
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRANSACTIONS TAB */}
        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
            <CardContent>
              {vendorTx.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No transactions for this vendor.</p>
              ) : (
                <DataTable data={vendorTx} pageSize={10} columns={[
                  { header: "TXN ID", cell: (row) => <span className="font-mono text-xs">{row.id}</span> },
                  { header: "Gross", cell: (row) => <span className="font-medium">{fmt(row.grossAmount)}</span> },
                  { header: "Commission", cell: (row) => <span className="text-orange-400">-{fmt(row.commission)}</span> },
                  { header: "Net", cell: (row) => <span className="text-green-400 font-bold">{fmt(row.netPayout)}</span> },
                  { header: "Mode", accessorKey: "paymentMode" },
                  { header: "Date", cell: (row) => <span className="text-xs text-muted-foreground">{new Date(row.dateTime).toLocaleDateString()}</span> },
                  { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REFUNDS TAB */}
        <TabsContent value="refunds" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Refund History</CardTitle></CardHeader>
            <CardContent>
              {vendorRefunds.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No refunds for this vendor.</p>
              ) : (
                <DataTable data={vendorRefunds} pageSize={10} columns={[
                  { header: "Refund ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
                  { header: "Customer", accessorKey: "customerName" },
                  { header: "Amount", cell: (row: any) => <span className="text-red-400 font-medium">-{fmt(row.amount || 0)}</span> },
                  { header: "Reason", accessorKey: "reason" },
                  { header: "Type", cell: (row: any) => <Badge variant="outline" className="text-xs">{row.type}</Badge> },
                  { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
                  { header: "Date", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.requestedAt).toLocaleDateString()}</span> },
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* STAFF TAB */}
        <TabsContent value="staff" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Staff Members ({STAFF.length})</CardTitle>
              <Button size="sm" onClick={() => setStaffOpen(true)}><span className="mr-1">+</span> Add Staff</Button>
            </CardHeader>
            <CardContent>
              <DataTable data={STAFF} pageSize={10} columns={[
                { header: "Staff ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
                { header: "Name", cell: (row: any) => <span className="font-medium">{row.name}</span> },
                { header: "Role", cell: (row: any) => <Badge variant="outline" className="text-xs">{row.role}</Badge> },
                { header: "Branch", accessorKey: "branch" },
                { header: "Last Login", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.lastLogin).toLocaleString()}</span> },
                { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
                { header: "Actions", cell: (row: any) => (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400" onClick={() => deleteStaffMutation.mutate(row.id)}>Remove</Button>
                )},
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* QR/NFC TAB */}
        <TabsContent value="qrnfc" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>QR Codes & NFC Tags ({QR_CODES.length})</CardTitle>
              <div className="flex gap-2 items-center">
                <Input placeholder="QR label" className="h-8 w-32 text-xs" value={qrLabel} onChange={e => setQrLabel(e.target.value)} />
                <Button size="sm" disabled={createQrMutation.isPending} onClick={() => createQrMutation.mutate()}>Generate QR</Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable data={QR_CODES} pageSize={10} columns={[
                { header: "QR ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
                { header: "Location", accessorKey: "tableNo" },
                { header: "Type", cell: (row: any) => <Badge variant="outline" className="text-xs">{row.type}</Badge> },
                { header: "Total Scans", cell: (row: any) => <span className="font-bold">{row.scans}</span> },
                { header: "Last Scan", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.lastScan).toLocaleString()}</span> },
                { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
                { header: "Actions", cell: (row: any) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => row.url && window.open(row.url, "_blank")}><Download className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400" onClick={() => deleteQrMutation.mutate(row.id)}>Disable</Button>
                  </div>
                )},
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTS TAB */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader><CardTitle>KYC & Compliance Documents</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {DOCUMENTS.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{doc.type}</p>
                        <p className="text-xs text-muted-foreground font-mono">{doc.number}</p>
                        <p className="text-xs text-muted-foreground">Uploaded: {doc.uploaded}{doc.expires ? ` · Expires: ${doc.expires}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.status} />
                      {(doc as any).fileUrl && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="View document" onClick={() => setPreviewDoc(doc)}><Eye className="h-3.5 w-3.5" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" onClick={() => doc.id && api.documents.download(`DOC-${doc.id}`).catch(() => toast({ title: "Download failed", variant: "destructive" }))}><Download className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => kycApproveMutation.mutate()} disabled={!vendorKyc}><CheckCircle className="mr-2 h-3.5 w-3.5 text-green-400" /> Approve KYC</Button>
                <Button variant="outline" size="sm" onClick={() => kycRequestMutation.mutate()} disabled={!vendorKyc}><Shield className="mr-2 h-3.5 w-3.5" /> Request Re-upload</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUPPORT TAB */}
        <TabsContent value="support" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Support Tickets</CardTitle></CardHeader>
            <CardContent>
              {vendorTickets.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No tickets for this vendor.</p>
              ) : (
                <DataTable data={vendorTickets} pageSize={10} columns={[
                  { header: "ID", cell: (row) => <span className="font-mono text-xs">{row.id}</span> },
                  { header: "Subject", accessorKey: "subject" },
                  { header: "Priority", cell: (row) => <Badge variant={row.priority === "Critical" ? "destructive" : "outline"} className="text-xs">{row.priority}</Badge> },
                  { header: "SLA Deadline", cell: (row) => <span className="text-xs text-muted-foreground">{row.slaDeadline}</span> },
                  { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
                  { header: "Date", cell: (row) => <span className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString()}</span> },
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(totalRevenue)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{vendor.totalOrders?.toLocaleString() ?? 0}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Order Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(vendor.totalOrders > 0 ? Math.round(totalRevenue / Math.max(vendor.totalOrders, 1)) : 0)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Health Score</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${healthScore >= 80 ? "text-green-500" : healthScore >= 60 ? "text-yellow-500" : "text-red-500"}`}>{healthScore}/100</div></CardContent></Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Refund Rate</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Payment Success Rate", value: 96.4, color: "text-green-500" },
                    { label: "Refund Rate", value: vendorRefunds.length > 0 ? Math.round((vendorRefunds.length / Math.max(vendorTx.length, 1)) * 100) : 3.2, color: "text-yellow-500" },
                    { label: "Chargeback Rate", value: 0.8, color: "text-red-500" },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">{item.label}</span><span className={`font-bold ${item.color}`}>{item.value}%</span></div>
                      <Progress value={Math.min(item.value, 100)} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Health Score Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Order Volume", score: Math.min(100, vendor.totalOrders > 500 ? 100 : vendor.totalOrders > 100 ? 80 : 50) },
                    { label: "Payment Health", score: 95 },
                    { label: "KYC Compliance", score: 90 },
                    { label: "Support Quality", score: Math.max(40, 100 - vendorTickets.length * 5) },
                    { label: "Refund Control", score: Math.max(60, 100 - vendorRefunds.length * 3) },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">{item.label}</span><span className="font-bold">{item.score}%</span></div>
                      <Progress value={item.score} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Transaction Trend (Last 10)</CardTitle></CardHeader>
            <CardContent>
              <DataTable data={vendorTx.slice(0, 10)} pageSize={10} columns={[
                { header: "Date", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.createdAt || Date.now()).toLocaleDateString()}</span> },
                { header: "Amount", cell: (row: any) => <span className="font-medium">{fmt(row.grossAmount || 0)}</span> },
                { header: "Commission", cell: (row: any) => <span className="text-muted-foreground">{fmt(row.platformCommission || row.commission || 0)}</span> },
                { header: "Mode", cell: (row: any) => <Badge variant="outline" className="text-xs">{row.paymentMode || "UPI"}</Badge> },
                { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITY LOGS TAB */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { action: "Vendor registered", by: "System", date: new Date(vendor.createdAt).toLocaleString(), icon: "🚀" },
                  { action: `Plan set to ${vendor.plan}`, by: "Admin", date: new Date(vendor.createdAt).toLocaleString(), icon: "📦" },
                  { action: "KYC documents submitted", by: "Vendor", date: new Date(Date.now() - 86400000 * 5).toLocaleString(), icon: "📄" },
                  { action: "KYC verification pending", by: "System", date: new Date(Date.now() - 86400000 * 4).toLocaleString(), icon: "⏳" },
                  ...vendorLogs.slice(0, 5).map(l => ({ action: l.action, by: l.user, date: new Date(l.dateTime).toLocaleString(), icon: "🔧" })),
                ].map((event, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-lg">{event.icon}</span>
                    <div className="flex-1 border-b pb-3 last:border-0">
                      <p className="text-sm font-medium">{event.action}</p>
                      <p className="text-xs text-muted-foreground">By {event.by} · {event.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INTERNAL NOTES TAB */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Add Note</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {["Internal Note", "Risk Note", "Compliance Note", "Sales Note", "Finance Note"].map(type => (
                  <Button key={type} variant={noteType === type ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setNoteType(type)}>{type}</Button>
                ))}
              </div>
              <Textarea placeholder={`Write ${noteType.toLowerCase()}...`} value={note} onChange={e => setNote(e.target.value)} rows={3} />
              <Button size="sm" onClick={() => saveNoteMutation.mutate()} disabled={!note.trim() || saveNoteMutation.isPending}>
                <Save className="mr-2 h-3.5 w-3.5" /> Save Note
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Note History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {NOTES.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No notes yet.</p>
                ) : NOTES.map(n => (
                  <div key={n.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">{n.type}</Badge>
                      <span className="text-xs text-muted-foreground">{n.author} · {n.date}</span>
                    </div>
                    <p className="text-sm">{n.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document preview */}
      <Dialog open={!!previewDoc} onOpenChange={o => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="capitalize">{String(previewDoc?.docType || previewDoc?.type || "Document").replace(/_/g, " ")}</DialogTitle></DialogHeader>
          {(() => {
            const url: string = previewDoc?.fileUrl || "";
            const isImg = String(previewDoc?.fileType || "").startsWith("image") || /\.(png|jpe?g|webp|gif)$/i.test(url) || url.startsWith("data:image");
            const isPdf = String(previewDoc?.fileType || "").includes("pdf") || /\.pdf($|\?)/i.test(url) || url.startsWith("data:application/pdf");
            const broken = url.startsWith("data:") && (url.split(",")[1]?.length ?? 0) < 100;
            if (!url) return <p className="text-sm text-muted-foreground py-6 text-center">No file uploaded.</p>;
            if (isImg && !broken) return <img src={url} alt="document" className="max-h-[60vh] w-full rounded border object-contain bg-black/20" />;
            if (isPdf) return <iframe src={url} title="document" className="w-full h-[60vh] rounded border bg-white" />;
            return (
              <div className="rounded border border-dashed border-yellow-500/40 bg-yellow-500/5 p-4 text-center">
                <p className="text-xs font-medium text-yellow-600">Preview not available</p>
                <p className="text-[11px] text-muted-foreground mt-1">The uploaded file looks empty or corrupt — ask the vendor to re-upload.</p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={branchOpen} onOpenChange={setBranchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Branch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Branch Name</Label><Input value={branchForm.name} onChange={e => setBranchForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={branchForm.address} onChange={e => setBranchForm(f => ({ ...f, address: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchOpen(false)}>Cancel</Button>
            <Button disabled={!branchForm.name.trim() || createBranchMutation.isPending} onClick={() => createBranchMutation.mutate()}>Add Branch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editBranchOpen} onOpenChange={setEditBranchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Branch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Branch Name</Label><Input value={editBranch.name} onChange={e => setEditBranch(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={editBranch.address} onChange={e => setEditBranch(f => ({ ...f, address: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBranchOpen(false)}>Cancel</Button>
            <Button disabled={!editBranch.name.trim() || editBranchMutation.isPending} onClick={() => editBranchMutation.mutate()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={staffForm.name} onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={staffForm.email} onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={staffForm.role} onValueChange={v => setStaffForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["waiter", "cashier", "kitchen", "chef", "manager"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={staffForm.password} onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffOpen(false)}>Cancel</Button>
            <Button disabled={!staffForm.name || !staffForm.email || createStaffMutation.isPending} onClick={() => createStaffMutation.mutate()}>Add Staff</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
