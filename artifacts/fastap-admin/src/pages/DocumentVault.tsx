import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, FileText, Shield, AlertTriangle, Download, Search, RefreshCw, Loader2, Eye, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/Page";

export default function DocumentVault() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("all");

  const { data: documents = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["documents"],
    queryFn: api.documents.list,
  });

  // The document "type" is whatever category the vendor uploaded under (License, GST,
  // Safety, …). The filter used to offer a fixed list, so real categories that weren't
  // on it — a Safety certificate, say — could never be filtered to.
  const docTypes = Array.from(new Set(documents.map((d: any) => d.docType).filter(Boolean))).sort();
  // Statuses come straight off the row ("active" is mapped to Verified upstream, the
  // rest arrive raw), so "pending_renewal" was being printed at the admin verbatim.
  const humanStatus = (v: unknown) =>
    String(v ?? "Unknown").replace(/[_-]+/g, " ").replace(/(^|\s)\S/g, (c) => c.toUpperCase());

  const filtered = documents.filter((doc: any) => {
    const matchSearch = doc.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
      doc.docType?.toLowerCase().includes(search.toLowerCase()) ||
      doc.id?.toLowerCase().includes(search.toLowerCase());
    const matchType = docTypeFilter === "all" || doc.docType === docTypeFilter;
    return matchSearch && matchType;
  });

  const expiringDocs = documents.filter((d: any) => {
    if (!d.expiryDate) return false;
    const daysLeft = Math.ceil((new Date(d.expiryDate).getTime() - Date.now()) / 86400000);
    return daysLeft <= 30 && daysLeft > 0;
  });
  const expiredDocs = documents.filter((d: any) => d.expiryDate && new Date(d.expiryDate) < new Date());

  const docTypeIcon: Record<string, React.ReactNode> = {
    GST: <Shield className="h-4 w-4 text-info" />,
    PAN: <FileText className="h-4 w-4 text-success" />,
    Agreement: <FileText className="h-4 w-4 text-muted-foreground" />,
    License: <Shield className="h-4 w-4 text-warning" />,
    FSSAI: <Shield className="h-4 w-4 text-warning" />,
    "Bank Proof": <FileText className="h-4 w-4 text-muted-foreground" />,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Vault"
        description="Secure storage for GST, PAN, agreements, licenses, and KYC proofs with expiry alerts."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Documents" value={documents.length} icon={<FolderOpen className="h-4 w-4 text-primary" />} />
        <KpiCard title="Expiring Soon" value={expiringDocs.length} icon={<Clock className="h-4 w-4 text-warning" />} subtitle="within 30 days" />
        <KpiCard title="Expired" value={expiredDocs.length} icon={<AlertTriangle className="h-4 w-4 text-danger" />} />
        <KpiCard title="Verified" value={documents.filter((d: any) => d.status === "Verified").length} icon={<Shield className="h-4 w-4 text-success" />} />
      </div>

      {expiringDocs.length > 0 && (
        <Card className="border-warning-border bg-warning-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-warning" /> Expiring Documents (next 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {expiringDocs.slice(0, 5).map((doc: any) => {
                const daysLeft = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000);
                return (
                  <div key={doc.id} className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2">
                    {docTypeIcon[doc.docType] || <FileText className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-xs font-medium">{doc.vendorName} — {doc.docType}</p>
                      <p className="text-xs text-warning font-medium">Expires in {daysLeft} days</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-xs ml-2" onClick={() => api.documents.remind(doc.id).then(() => toast({ title: `Renewal reminder sent to ${doc.vendorName}` })).catch(() => toast({ title: "Failed", variant: "destructive" }))}>Remind</Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search vendor, doc type…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {docTypes.map((t: any) => <SelectItem key={String(t)} value={String(t)}>{String(t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <DataTable data={filtered} pageSize={10} columns={[
              { header: "Doc ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
              { header: "Type", cell: (row: any) => (
                <div className="flex items-center gap-1.5">
                  {docTypeIcon[row.docType] || <FileText className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm">{row.docType}</span>
                </div>
              )},
              { header: "Doc Number", cell: (row: any) => <span className="font-mono text-xs">{row.docNumber || "—"}</span> },
              { header: "Uploaded", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.uploadedAt).toLocaleDateString()}</span> },
              { header: "Expiry", cell: (row: any) => {
                if (!row.expiryDate) return <span className="text-xs text-muted-foreground">No expiry</span>;
                const daysLeft = Math.ceil((new Date(row.expiryDate).getTime() - Date.now()) / 86400000);
                return <span className={`text-xs font-medium ${daysLeft < 0 ? "text-danger" : daysLeft <= 30 ? "text-warning" : "text-muted-foreground"}`}>{row.expiryDate}</span>;
              }},
              { header: "Status", cell: (row: any) => (
                <Badge variant={row.status === "Verified" ? "default" : /expired|rejected/i.test(String(row.status)) ? "destructive" : "secondary"} className="text-xs">{humanStatus(row.status)}</Badge>
              )},
              { header: "Actions", cell: (row: any) => (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title={row.fileUrl ? "Open document" : "No file stored for this document"} onClick={() => row.fileUrl ? window.open(row.fileUrl, "_blank") : toast({ title: "No file stored", description: `${row.docType} — ${row.docNumber}. Ask the vendor to upload it.` })}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => api.documents.download(row.id).catch(() => toast({ title: "Download failed", variant: "destructive" }))}><Download className="h-3.5 w-3.5" /></Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
