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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, DollarSign, RefreshCw, Plus, Loader2, Search, ShieldBan } from "lucide-react";

export default function Penalties() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ vendorId: "", vendorName: "", reason: "Fake Refund", amount: "", deductFrom: "wallet", notes: "" });

  const { data: penalties = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["penalties"],
    queryFn: api.penalties.list,
  });

  const createMutation = useMutation({
    mutationFn: api.penalties.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["penalties"] });
      setOpen(false);
      toast({ title: "Penalty applied successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reverseMutation = useMutation({
    mutationFn: api.penalties.reverse,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["penalties"] }); toast({ title: "Penalty reversed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = penalties.filter((p: any) =>
    p.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    p.reason?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPenalties = penalties.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const pending = penalties.filter((p: any) => p.status === "Pending").length;
  const applied = penalties.filter((p: any) => p.status === "Applied").length;

  const reasonColor: Record<string, string> = {
    "Fake Refund": "bg-red-500/10 text-red-400",
    "Compliance Issue": "bg-orange-500/10 text-orange-400",
    "Cash Mismatch": "bg-yellow-500/10 text-yellow-400",
    "Fraud Activity": "bg-red-600/10 text-red-500",
    "SLA Breach": "bg-purple-500/10 text-purple-400",
    "Policy Violation": "bg-blue-500/10 text-blue-400",
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Penalty & Fine Management</h2>
          <p className="text-muted-foreground">Apply penalties for fake refunds, compliance issues, and fraud activity.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive"><Plus className="mr-2 h-4 w-4" /> Apply Penalty</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Apply Penalty / Fine</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Vendor Name</Label>
                  <Input placeholder="Vendor business name" value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Penalty Reason</Label>
                  <Select value={form.reason} onValueChange={v => setForm(f => ({ ...f, reason: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Fake Refund", "Compliance Issue", "Cash Mismatch", "Fraud Activity", "SLA Breach", "Policy Violation"].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Penalty Amount (₹)</Label>
                    <Input type="number" placeholder="e.g. 500" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required min="1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Deduct From</Label>
                    <Select value={form.deductFrom} onValueChange={v => setForm(f => ({ ...f, deductFrom: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wallet">Wallet</SelectItem>
                        <SelectItem value="settlement">Settlement</SelectItem>
                        <SelectItem value="freeze">Freeze Payouts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Internal Notes</Label>
                  <Textarea placeholder="Reason for penalty (internal)..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
                </div>
                <Button type="submit" variant="destructive" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldBan className="mr-2 h-4 w-4" />}
                  Apply Penalty
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Penalties" value={penalties.length} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Total Amount" value={`₹${totalPenalties.toLocaleString("en-IN")}`} icon={<DollarSign className="h-4 w-4 text-orange-500" />} />
        <KpiCard title="Pending" value={pending} icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Applied" value={applied} icon={<ShieldBan className="h-4 w-4 text-green-500" />} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search vendor or reason…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <DataTable data={filtered} pageSize={10} columns={[
              { header: "ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", cell: (row: any) => <span className="font-medium">{row.vendorName}</span> },
              { header: "Reason", cell: (row: any) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${reasonColor[row.reason] || "bg-muted text-muted-foreground"}`}>{row.reason}</span>
              )},
              { header: "Amount", cell: (row: any) => <span className="font-bold text-red-400">₹{row.amount?.toLocaleString("en-IN")}</span> },
              { header: "Deducted From", cell: (row: any) => <Badge variant="outline" className="text-xs capitalize">{row.deductFrom}</Badge> },
              { header: "Applied At", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.appliedAt).toLocaleString()}</span> },
              { header: "Applied By", cell: (row: any) => <span className="text-sm">{row.appliedBy}</span> },
              { header: "Status", cell: (row: any) => (
                <Badge variant={row.status === "Applied" ? "default" : row.status === "Reversed" ? "secondary" : "destructive"} className="text-xs">{row.status}</Badge>
              )},
              { header: "Action", cell: (row: any) => (
                (row.status === "Applied" || row.status === "applied") && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-yellow-400" disabled={reverseMutation.isPending} onClick={() => reverseMutation.mutate(row.id)}>
                    Reverse
                  </Button>
                )
              )},
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
