import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, RefreshCw, Loader2, Search, Download, CheckCircle, Clock, AlertTriangle, Upload } from "lucide-react";

export default function Agreements() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ vendorName: "", agreementType: "Service Agreement", signedDate: "", expiryDate: "", status: "Active" });

  const { data: agreements = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["agreements"],
    queryFn: api.agreements.list,
  });

  const createMutation = useMutation({
    mutationFn: api.agreements.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agreements"] }); setOpen(false); toast({ title: "Agreement added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const renewMutation = useMutation({
    mutationFn: (id: string) => api.agreements.renew(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agreements"] }); toast({ title: "Agreement renewal initiated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = agreements.filter((a: any) => {
    const matchSearch = a.vendorName?.toLowerCase().includes(search.toLowerCase()) || a.id?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || a.status?.toLowerCase() === filter;
    return matchSearch && matchFilter;
  });

  const active = agreements.filter((a: any) => a.status === "Active").length;
  const expired = agreements.filter((a: any) => a.status === "Expired").length;
  const expiringDocs = agreements.filter((a: any) => {
    if (!a.expiryDate || a.status === "Expired") return false;
    return Math.ceil((new Date(a.expiryDate).getTime() - Date.now()) / 86400000) <= 30;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agreement Management</h2>
          <p className="text-muted-foreground">Manage vendor contracts, signed agreements, and renewal tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Agreement</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Add New Agreement</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Vendor Name</Label>
                  <Input placeholder="Vendor business name" value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Agreement Type</Label>
                  <Select value={form.agreementType} onValueChange={v => setForm(f => ({ ...f, agreementType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Service Agreement", "NDA", "Commission Agreement", "White Label Agreement", "Enterprise Contract", "Partner Agreement"].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Signed Date</Label>
                    <Input type="date" value={form.signedDate} onChange={e => setForm(f => ({ ...f, signedDate: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Pending Signature">Pending Signature</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* No file-upload/storage endpoint exists (POST /superadmin/agreements stores metadata only),
                    so the dropzone is shown as unavailable rather than faking an upload. */}
                <div className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground opacity-60">
                  <Upload className="h-6 w-6 mx-auto mb-2" />
                  PDF upload unavailable — no file storage endpoint
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Agreement
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Agreements" value={agreements.length} icon={<FileText className="h-4 w-4 text-primary" />} />
        <KpiCard title="Active" value={active} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Expiring (30d)" value={expiringDocs.length} icon={<Clock className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Expired" value={expired} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search vendor or agreement ID…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending signature">Pending Signature</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <DataTable data={filtered} pageSize={10} columns={[
              { header: "Agreement ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
              { header: "Type", cell: (row: any) => <span className="text-sm">{row.agreementType}</span> },
              { header: "Signed Date", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.signedDate}</span> },
              { header: "Expiry Date", cell: (row: any) => {
                const daysLeft = row.expiryDate ? Math.ceil((new Date(row.expiryDate).getTime() - Date.now()) / 86400000) : null;
                return <span className={`text-xs font-medium ${!daysLeft ? "text-muted-foreground" : daysLeft < 0 ? "text-red-400" : daysLeft <= 30 ? "text-yellow-400" : "text-muted-foreground"}`}>{row.expiryDate || "No expiry"}</span>;
              }},
              { header: "Status", cell: (row: any) => (
                <Badge variant={row.status === "Active" ? "default" : row.status === "Expired" ? "destructive" : "secondary"} className="text-xs">{row.status}</Badge>
              )},
              { header: "Actions", cell: (row: any) => (
                <div className="flex gap-1">
                  {/* No agreement PDF download endpoint exists — disabled until an API is added. */}
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="PDF download API not available" disabled><Download className="h-3.5 w-3.5" /></Button>
                  {row.status !== "Expired" && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={renewMutation.isPending} onClick={() => renewMutation.mutate(row.id)}>Renew</Button>
                  )}
                  {row.status === "Expired" && (
                    // No agreement status-update endpoint exists to mark expired — disabled until an API is added.
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" title="Mark-expired API not available" disabled>Mark Expired</Button>
                  )}
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
