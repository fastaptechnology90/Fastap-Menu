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
import { Eye, FileCheck, XCircle, RotateCcw, Search, Loader2, FileText } from "lucide-react";
import { api, type KYCRecord } from "@/lib/apiClient";
import { toast } from "sonner";
import { KpiCard } from "@/components/shared/KpiCard";

// Renders a KYC document preview. A real uploaded image has a long base64 payload;
// dummy / truncated uploads (e.g. "data:image/png;base64,iVBOR") or broken files can't
// render — so instead of a blank box we show a clear "re-upload needed" message.
function DocPreview({ d }: { d: any }) {
  const [imgError, setImgError] = useState(false);
  const url: string = d.fileUrl || "";
  if (!url) return <p className="text-xs text-muted-foreground">No file uploaded.</p>;
  const isImg = String(d.fileType || "").startsWith("image") || /\.(png|jpe?g|webp|gif)$/i.test(url) || url.startsWith("data:image");
  const isPdf = String(d.fileType || "").includes("pdf") || /\.pdf($|\?)/i.test(url) || url.startsWith("data:application/pdf");
  // A usable data-URL image needs real base64 after the comma. Anything tiny is a dummy/truncated upload.
  const looksBroken = url.startsWith("data:") && (url.split(",")[1]?.length ?? 0) < 100;

  if (isImg && !imgError && !looksBroken) {
    return <img src={url} alt={d.type} onError={() => setImgError(true)} className="max-h-64 w-full rounded border object-contain bg-black/20" />;
  }
  if (isImg) {
    return (
      <div className="rounded border border-dashed border-yellow-500/40 bg-yellow-500/5 p-4 text-center">
        <p className="text-xs font-medium text-yellow-600">Image preview not available</p>
        <p className="text-[11px] text-muted-foreground mt-1">The uploaded file looks empty or corrupted. Reject it and ask the vendor to re-upload a clear photo/scan.</p>
        <a href={url} target="_blank" rel="noreferrer" className="inline-block text-xs text-blue-500 underline mt-2">Try opening it ↗</a>
      </div>
    );
  }
  if (isPdf) return <iframe src={url} title={d.type} className="w-full h-64 rounded border bg-white" />;
  return <a href={url} target="_blank" rel="noreferrer" className="inline-block text-xs text-blue-500 underline">Open document ↗</a>;
}

export default function KYC() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
  const [rejectReason, setRejectReason] = useState("");
  const [docsVendor, setDocsVendor] = useState<{ id: string; name: string } | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  async function openDocs(vendorId: string, name: string) {
    setDocsVendor({ id: vendorId, name }); setDocs([]); setDocsLoading(true);
    try { setDocs(await api.kyc.documents(vendorId)); } catch { setDocs([]); }
    setDocsLoading(false);
  }
  async function verifyDoc(docId: number, status: "verified" | "rejected") {
    try {
      await api.kyc.verifyDocument(docId, status);
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: status === "verified" ? "Verified" : "Rejected" } : d));
      qc.invalidateQueries({ queryKey: ["kyc"] });
      toast.success(status === "verified" ? "Document approved" : "Document rejected");
    } catch { toast.error("Failed to update document"); }
  }

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
                  <Button variant="ghost" size="icon" title="View documents" onClick={() => openDocs(row.vendorId, row.vendorName)}><FileText className="h-4 w-4" /></Button>
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

      <Dialog open={!!docsVendor} onOpenChange={o => !o && setDocsVendor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>KYC Documents — {docsVendor?.name}</DialogTitle></DialogHeader>
          {docsLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No documents uploaded by this vendor.</p>
          ) : (
            <div className="space-y-4">
              {docs.map((d) => {
                return (
                  <div key={d.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm capitalize">{String(d.docType || d.type).replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.type}</p>
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                    <DocPreview d={d} />
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="text-green-600 border-green-500/30" disabled={d.status === "Verified"} onClick={() => verifyDoc(d.id, "verified")}><FileCheck className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                      <Button size="sm" variant="outline" className="text-red-500 border-red-500/30" disabled={d.status === "Rejected"} onClick={() => verifyDoc(d.id, "rejected")}><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
