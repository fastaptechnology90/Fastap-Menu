import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api, type CreateVendorData } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { KpiCard } from "@/components/shared/KpiCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, MoreVertical, Eye, ShieldBan, ShieldCheck, Loader2, RefreshCcw, Download, Building2, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const VENDOR_TAGS: Record<string, { label: string; color: string }> = {
  vip: { label: "VIP", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  enterprise: { label: "Enterprise", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  high_risk: { label: "High Risk", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  dormant: { label: "Dormant", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

function getHealthScore(vendor: any) {
  let score = 50;
  if (vendor.isActive) score += 20;
  if ((vendor.totalOrders || 0) > 500) score += 20;
  if ((vendor.totalOrders || 0) > 100) score += 10;
  if (!vendor.isActive) score -= 30;
  return Math.min(100, Math.max(10, score));
}

function getHealthColor(score: number) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function getVendorTag(vendor: any) {
  if (!vendor.isActive) return "dormant";
  if (vendor.plan === "enterprise") return "enterprise";
  if ((vendor.totalOrders || 0) > 1000) return "vip";
  return null;
}

export default function Vendors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [form, setForm] = useState<CreateVendorData>({ name: "", email: "", ownerName: "", phone: "", businessType: "Restaurant", plan: "starter" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: vendors = [], isLoading, refetch } = useQuery({
    queryKey: ["superadmin-vendors", showDeleted],
    queryFn: () => api.vendors.list(showDeleted),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.vendors.restore(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-vendors"] }); toast({ title: "Vendor restored" }); },
    onError: (e: any) => toast({ title: "Restore failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.vendors.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-vendors"] }); toast({ title: "Vendor archived" }); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => api.vendors.toggle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-vendors"] }); toast({ title: "Vendor status updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const freezeMutation = useMutation({
    mutationFn: (vendorId: number) => api.vendors.freezePayouts(vendorId),
    onSuccess: () => { toast({ title: "Payouts frozen for vendor" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (vendorId: number) => api.vendors.resetPassword(vendorId),
    onSuccess: (data) => toast({ title: "Password reset", description: `Temporary password: ${data.temporaryPassword}` }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateVendorData) => api.vendors.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-vendors"] });
      setAddOpen(false);
      setForm({ name: "", email: "", ownerName: "", phone: "", businessType: "Restaurant", plan: "starter" });
      toast({ title: "Vendor created successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: (action: string) => api.vendors.bulkAction(selected, action),
    onSuccess: (_, action) => { setSelected([]); qc.invalidateQueries({ queryKey: ["superadmin-vendors"] }); toast({ title: `Bulk ${action} applied to ${selected.length} vendors` }); },
    onError: (e: any) => toast({ title: "Bulk action failed", description: e.message, variant: "destructive" }),
  });

  const handleExportCSV = () => {
    const headers = ["ID", "Business Name", "Owner", "Email", "Type", "Plan", "Status", "Orders", "Health Score", "Joined"];
    const rows = filteredVendors.map(v => [v.id, v.name, v.ownerName, v.ownerEmail, v.businessType || "Restaurant", v.plan, v.isActive ? "Active" : "Suspended", v.totalOrders, getHealthScore(v), new Date(v.createdAt).toLocaleDateString()]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "vendors.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Vendor export downloaded" });
  };

  const filteredVendors = vendors.filter(v => {
    const matchSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) || (v.ownerEmail ?? "").toLowerCase().includes(searchTerm.toLowerCase()) || String(v.id).includes(searchTerm);
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? v.isActive : !v.isActive);
    const matchType = typeFilter === "all" || (v.businessType || "Restaurant") === typeFilter;
    const matchPlan = planFilter === "all" || v.plan === planFilter;
    return matchSearch && matchStatus && matchType && matchPlan;
  });

  const toggleSelect = (id: number) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelected(selected.length === filteredVendors.length ? [] : filteredVendors.map(v => v.id));

  const activeCount = vendors.filter(v => v.isActive).length;
  const suspendedCount = vendors.filter(v => !v.isActive).length;
  const enterpriseCount = vendors.filter(v => v.plan === "enterprise").length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vendor Management</h2>
          <p className="text-muted-foreground">{isLoading ? "Loading…" : `${vendors.length} vendors on platform`}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" onClick={handleExportCSV}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Vendor</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Add New Vendor</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4 pt-2">
                <div className="space-y-2"><Label>Business Name *</Label><Input placeholder="The Grand Hotel" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>Owner Name</Label><Input placeholder="John Smith" value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Owner Email *</Label><Input type="email" placeholder="owner@hotel.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Type</Label>
                    <Select value={form.businessType} onValueChange={v => setForm(f => ({ ...f, businessType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Restaurant", "Hotel", "Café", "Bar", "Resort", "Cloud Kitchen", "Lounge", "Food Court"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["free", "starter", "pro", "enterprise"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Phone</Label><Input placeholder="+1 555 000 0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create Vendor
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Vendors" value={vendors.length} icon={<Building2 className="h-4 w-4 text-primary" />} />
        <KpiCard title="Active" value={activeCount} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Suspended" value={suspendedCount} icon={<XCircle className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Enterprise" value={enterpriseCount} icon={<TrendingUp className="h-4 w-4 text-purple-500" />} />
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vendors, email, ID…" className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {["Restaurant", "Hotel", "Café", "Bar", "Resort", "Cloud Kitchen"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            {["free", "starter", "pro", "enterprise"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={showDeleted ? "secondary" : "outline"} size="sm" onClick={() => setShowDeleted(v => !v)}>
          {showDeleted ? "Hide archived" : "Show archived"}
        </Button>
        {(statusFilter !== "all" || typeFilter !== "all" || planFilter !== "all" || searchTerm) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setPlanFilter("all"); setSearchTerm(""); }}>Clear filters</Button>
        )}
        {selected.length > 0 && (
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate("activate")}>Activate ({selected.length})</Button>
            <Button size="sm" variant="outline" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate("suspend")}>Suspend</Button>
            <Button size="sm" variant="outline" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate("freeze_payouts")}>Freeze Payouts</Button>
          </div>
        )}
        <span className="text-sm text-muted-foreground ml-auto">{filteredVendors.length} results</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <DataTable
          data={filteredVendors}
          pageSize={15}
          columns={[
            { header: <input type="checkbox" checked={selected.length === filteredVendors.length && filteredVendors.length > 0} onChange={toggleSelectAll} />, cell: (row) => <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} /> },
            { header: "#", cell: (row) => <span className="text-xs text-muted-foreground font-mono">#{row.id}</span> },
            {
              header: "Business",
              cell: (row) => {
                const tag = getVendorTag(row);
                const tagInfo = tag ? VENDOR_TAGS[tag] : null;
                return (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      {tagInfo && <span className={`px-1.5 py-0.5 text-[10px] rounded border font-medium ${tagInfo.color}`}>{tagInfo.label}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{row.businessType ?? "Restaurant"} · {row.ownerName}</span>
                  </div>
                );
              }
            },
            { header: "Email", cell: (row) => <span className="text-xs text-muted-foreground">{row.ownerEmail}</span> },
            { header: "Plan", cell: (row) => <Badge variant="outline" className="capitalize text-xs">{row.plan}</Badge> },
            { header: "Status", cell: (row) => {
              const deleted = Boolean((row as any).platformControls?.deletedAt);
              // A not-yet-approved registration is "Pending Approval", not "Suspended".
              const pending = !row.isActive && (row as any).kycStatus === "pending";
              return <StatusBadge status={deleted ? "Deleted" : row.isActive ? "Active" : pending ? "Pending Approval" : "Suspended"} />;
            } },
            { header: "Health", cell: (row) => { const s = getHealthScore(row); return <span className={`font-bold text-sm ${getHealthColor(s)}`}>{s}</span>; } },
            { header: "Orders", cell: (row) => <span className="font-medium">{row.totalOrders}</span> },
            { header: "Joined", cell: (row) => <span className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString()}</span> },
            {
              header: "Actions",
              cell: (row) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={`/vendors/${row.id}`} className="cursor-pointer flex items-center"><Eye className="mr-2 h-4 w-4" /> View Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => freezeMutation.mutate(row.id)}>Freeze Payout</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => resetPasswordMutation.mutate(row.id)}>Reset Password</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {(row as any).platformControls?.deletedAt ? (
                      <DropdownMenuItem className="text-green-500 cursor-pointer" onClick={() => restoreMutation.mutate(row.id)}>
                        <ShieldCheck className="mr-2 h-4 w-4" /> Restore vendor
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem className={`cursor-pointer ${row.isActive ? "text-destructive" : "text-green-500"}`} onClick={() => toggleMutation.mutate(row.id)}>
                          {row.isActive ? <><ShieldBan className="mr-2 h-4 w-4" /> Suspend</> : <><ShieldCheck className="mr-2 h-4 w-4" /> Activate</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => deleteMutation.mutate(row.id)}>
                          Archive vendor
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            },
          ]}
        />
      )}
    </div>
  );
}