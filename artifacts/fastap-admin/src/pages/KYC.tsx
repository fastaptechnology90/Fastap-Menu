import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, FileCheck, XCircle, RotateCcw, Search, Loader2 } from "lucide-react";
import { api, type KYCRecord } from "@/lib/apiClient";
import { toast } from "sonner";
import { KpiCard } from "@/components/shared/KpiCard";

export default function KYC() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
  const [rejectReason, setRejectReason] = useState("");

  const { data: kycData = [], isLoading } = useQuery({ queryKey: ["kyc"], queryFn: api.kyc.list, refetchInterval: 30000 });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.kyc.approve(id),
    onSuccess: (_, id) => { toast.success(`Approved — owner can now sign in to ${kycData.find(k => k.id === id)?.vendorName}`); qc.invalidateQueries({ queryKey: ["kyc"] }); },
    onError: () => toast.error("Failed to approve KYC"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.kyc.reject(id, reason),
    onSuccess: () => { toast.success("KYC rejected — vendor notified"); setRejectDialog({ open: false, id: "", name: "" }); setRejectReason(""); qc.invalidateQueries({ queryKey: ["kyc"] }); },
    onError: () => toast.error("Failed to reject"),
  });

  const requestMoreMutation = useMutation({
    mutationFn: (id: string) => api.kyc.requestMore(id),
    onSuccess: (_, id) => { toast.info(`Document re-upload requested from ${kycData.find(k => k.id === id)?.vendorName}`); qc.invalidateQueries({ queryKey: ["kyc"] }); },
    onError: () => toast.error("Failed to send request"),
  });

  const filtered = kycData
    .filter(k => k.vendorName.toLowerCase().includes(search.toLowerCase()) || k.status.toLowerCase().includes(search.toLowerCase()) || (k.ownerEmail ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const rank = (s: string) => (s === "Pending Review" ? 0 : s === "Action Required" ? 1 : 2);
      return rank(a.status) - rank(b.status) || new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  const DocStatus = ({ status }: { status: string }) => {
    const color = status === "Verified" ? "text-green-500" : status === "Pending" ? "text-yellow-500" : status === "Rejected" ? "text-red-500" : "text-gray-400";
    return <span className={`text-xs font-medium ${color}`}>{status}</span>;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div><h2 className="text-2xl font-bold tracking-tight">KYC & Compliance</h2><p className="text-muted-foreground">Review new restaurant registrations and approve owners before they can access the dashboard.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Pending Review" value={kycData.filter(k => k.status === "Pending Review").length} icon={<RotateCcw className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Approved" value={kycData.filter(k => k.status === "Approved").length} icon={<FileCheck className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Action Required" value={kycData.filter(k => k.status === "Action Required").length} icon={<XCircle className="h-4 w-4 text-red-500" />} />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search vendor..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable data={filtered} columns={[
              { header: "Vendor", cell: (row: KYCRecord) => (
                <div>
                  <span className="font-medium block">{row.vendorName}</span>
                  {row.ownerEmail && <span className="text-xs text-muted-foreground">{row.ownerEmail}</span>}
                </div>
              ) },
              { header: "PAN", cell: (row: KYCRecord) => <DocStatus status={row.documents.pan} /> },
              { header: "GST/Tax ID", cell: (row: KYCRecord) => <DocStatus status={row.documents.gst} /> },
              { header: "Bank", cell: (row: KYCRecord) => <DocStatus status={row.documents.bank} /> },
              { header: "FSSAI", cell: (row: KYCRecord) => <DocStatus status={row.documents.fssai} /> },
              { header: "Status", cell: (row: KYCRecord) => <StatusBadge status={row.status} /> },
              { header: "Actions", cell: (row: KYCRecord) => (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title="View application" onClick={() => setLocation(`/vendors/${row.vendorId}`)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-green-500" title="Approve All" disabled={row.status === "Approved"} onClick={() => approveMutation.mutate(row.id)}><FileCheck className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-red-500" title="Reject" onClick={() => { setRejectDialog({ open: true, id: row.id, name: row.vendorName }); setRejectReason(""); }}><XCircle className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-yellow-500" title="Request Re-upload" onClick={() => requestMoreMutation.mutate(row.id)}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
      <Dialog open={rejectDialog.open} onOpenChange={open => setRejectDialog({ open, id: "", name: "" })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject KYC — {rejectDialog.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Provide a rejection reason. The vendor will be notified.</p>
          <Textarea placeholder="e.g. Document image blurry, PAN mismatch..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: "", name: "" })}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || rejectMutation.isPending} onClick={() => rejectMutation.mutate({ id: rejectDialog.id, reason: rejectReason })}>
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Reject & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
