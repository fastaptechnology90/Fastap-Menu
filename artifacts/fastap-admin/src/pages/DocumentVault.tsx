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

export default function DocumentVault() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("all");

  const { data: documents = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["documents"],
    queryFn: api.documents.list,
  });

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
    GST: <Shield className="h-4 w-4 text-blue-400" />,
    PAN: <FileText className="h-4 w-4 text-green-400" />,
    Agreement: <FileText className="h-4 w-4 text-purple-400" />,
    License: <Shield className="h-4 w-4 text-orange-400" />,
    FSSAI: <Shield className="h-4 w-4 text-yellow-400" />,
    "Bank Proof": <FileText className="h-4 w-4 text-pink-400" />,
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Document Vault</h2>
          <p className="text-muted-foreground">Secure storage for GST, PAN, agreements, licenses, and KYC proofs with expiry alerts.</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Documents" value={documents.length} icon={<FolderOpen className="h-4 w-4 text-primary" />} />
        <KpiCard title="Expiring Soon" value={expiringDocs.length} icon={<Clock className="h-4 w-4 text-yellow-500" />} subtitle="within 30 days" />
        <KpiCard title="Expired" value={expiredDocs.length} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Verified" value={documents.filter((d: any) => d.status === "Verified").length} icon={<Shield className="h-4 w-4 text-green-500" />} />
      </div>

      {expiringDocs.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-yellow-500" /> Expiring Documents (next 30 days)</CardTitle>
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
                      <p className="text-xs text-yellow-400 font-medium">Expires in {daysLeft} days</p>
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
                <SelectItem value="GST">GST</SelectItem>
                <SelectItem value="PAN">PAN</SelectItem>
                <SelectItem value="Agreement">Agreement</SelectItem>
                <SelectItem value="License">License</SelectItem>
                <SelectItem value="FSSAI">FSSAI</SelectItem>
                <SelectItem value="Bank Proof">Bank Proof</SelectItem>
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
                return <span className={`text-xs font-medium ${daysLeft < 0 ? "text-red-400" : daysLeft <= 30 ? "text-yellow-400" : "text-muted-foreground"}`}>{row.expiryDate}</span>;
              }},
              { header: "Status", cell: (row: any) => (
                <Badge variant={row.status === "Verified" ? "default" : row.status === "Expired" ? "destructive" : "secondary"} className="text-xs">{row.status}</Badge>
              )},
              { header: "Actions", cell: (row: any) => (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => row.fileUrl ? window.open(row.fileUrl, "_blank") : toast({ title: `${row.docType} — ${row.docNumber}` })}><Eye className="h-3.5 w-3.5" /></Button>
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
