import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/shared/KpiCard";
import { QrCode, Nfc, Download, RefreshCw, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";

export default function QRNFC() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ vendorId: "", count: 10, prefix: "Table", type: "table" });

  const { data: codes = [], isLoading, refetch } = useQuery({
    queryKey: ["superadmin-qr"],
    queryFn: api.qr.list,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["superadmin-vendors"],
    queryFn: api.vendors.list,
  });

  const bulkMutation = useMutation({
    mutationFn: () => api.qr.bulkGenerate({
      vendorId: parseInt(bulkForm.vendorId, 10),
      count: bulkForm.count,
      prefix: bulkForm.prefix,
      type: bulkForm.type,
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["superadmin-qr"] });
      setBulkOpen(false);
      toast.success(`Generated ${r.count} QR codes`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = codes.filter((c: any) =>
    c.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    c.label?.toLowerCase().includes(search.toLowerCase()),
  );
  const totalScans = codes.reduce((s: number, c: any) => s + (c.scans || 0), 0);
  const activeCount = codes.filter((c: any) => c.status === "active" || c.status === "Active").length;
  const nfcCount = codes.filter((c: any) => c.type === "nfc").length;

  const exportList = () => {
    const header = "vendor,label,type,url,scans,status\n";
    const rows = filtered.map((c: any) => [c.vendorName, c.label, c.type, c.url, c.scans, c.status].join(","));
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "qr-codes.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("QR list exported");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">QR & NFC Management</h2><p className="text-muted-foreground">Platform-wide QR codes — bulk generate and track scans.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportList}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          <Button onClick={() => setBulkOpen(true)}><Plus className="mr-2 h-4 w-4" /> Bulk Generate</Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Total Scans" value={totalScans.toLocaleString()} icon={<QrCode className="h-4 w-4 text-primary" />} />
        <KpiCard title="Active Codes" value={activeCount} icon={<QrCode className="h-4 w-4 text-green-500" />} />
        <KpiCard title="NFC Tags" value={nfcCount} icon={<Nfc className="h-4 w-4 text-blue-500" />} />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <Input placeholder="Search vendor or table..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No QR codes yet. Use Bulk Generate or vendor profile.</p>
          ) : (
            <DataTable data={filtered} columns={[
              { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
              { header: "Location", cell: (row: any) => <span className="text-sm">{row.label}</span> },
              { header: "Type", cell: (row: any) => (
                <div className="flex items-center gap-1">
                  {row.type === "nfc" ? <Nfc className="h-3.5 w-3.5 text-blue-500" /> : <QrCode className="h-3.5 w-3.5" />}
                  <span className="text-xs uppercase">{row.type}</span>
                </div>
              )},
              { header: "Scans", cell: (row: any) => <span className="font-medium">{row.scans?.toLocaleString()}</span> },
              { header: "Status", cell: (row: any) => <StatusBadge status={row.status === "active" ? "Active" : "Inactive"} /> },
              { header: "", cell: (row: any) => (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { window.open(row.url, "_blank"); toast.success("QR opened"); }}>
                  <Download className="h-3 w-3 mr-1" /> Open
                </Button>
              )},
            ]} />
          )}
        </CardContent>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Generate QR Codes</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Vendor</Label>
              <Select value={bulkForm.vendorId} onValueChange={v => setBulkForm(f => ({ ...f, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                <SelectContent>{vendors.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Count (max 50)</Label><Input type="number" min={1} max={50} value={bulkForm.count} onChange={e => setBulkForm(f => ({ ...f, count: parseInt(e.target.value, 10) || 1 }))} /></div>
              <div className="space-y-1"><Label>Prefix</Label><Input value={bulkForm.prefix} onChange={e => setBulkForm(f => ({ ...f, prefix: e.target.value }))} /></div>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={bulkForm.type} onValueChange={v => setBulkForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">Table QR</SelectItem>
                  <SelectItem value="room">Room QR</SelectItem>
                  <SelectItem value="nfc">NFC Tag</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button disabled={!bulkForm.vendorId || bulkMutation.isPending} onClick={() => bulkMutation.mutate()}>
              {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
