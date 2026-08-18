import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/shared/KpiCard";
import { Wallet, ShieldAlert, ArrowRightLeft, Lock, Loader2, Plus } from "lucide-react";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function Escrow() {
  const qc = useQueryClient();
  const [reserveDialog, setReserveDialog] = useState(false);
  const [freezeDialog, setFreezeDialog] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [freezeVendorId, setFreezeVendorId] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["escrow"], queryFn: api.escrow.get, refetchInterval: 30000 });
  const { data: vendors = [] } = useQuery({ queryKey: ["superadmin-vendors"], queryFn: api.vendors.list });

  const metrics = data?.metrics;
  const ledger = data?.ledger ?? [];

  const addReserveMutation = useMutation({
    mutationFn: ({ amount, reason }: { amount: number; reason: string }) => api.escrow.addReserve(amount, reason),
    onSuccess: () => { toast.success(`Reserve of ${fmt(Number(amount))} added`); setReserveDialog(false); setAmount(""); setReason(""); qc.invalidateQueries({ queryKey: ["escrow"] }); },
    onError: () => toast.error("Failed to add reserve"),
  });

  const freezeMutation = useMutation({
    mutationFn: (vendorId: string) => api.escrow.freeze(vendorId),
    onSuccess: (_, v) => { toast.success(`Vendor ${v} payouts frozen`); setFreezeDialog(false); setFreezeVendorId(""); qc.invalidateQueries({ queryKey: ["escrow"] }); },
    onError: () => toast.error("Failed to freeze"),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">Escrow Wallet</h2><p className="text-muted-foreground">Manage centralized platform funds and reserves.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-yellow-500 border-yellow-500/30" onClick={() => setReserveDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Reserve
          </Button>
          <Button variant="outline" className="text-red-500 border-red-500/30" onClick={() => setFreezeDialog(true)}>
            <ShieldAlert className="mr-2 h-4 w-4" /> Freeze Account
          </Button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard title="Total Escrow" value={fmt(metrics?.totalEscrow ?? 0)} icon={<Wallet className="h-4 w-4 text-primary" />} />
            <KpiCard title="Active Holds" value={fmt(metrics?.activeHolds ?? 0)} icon={<Lock className="h-4 w-4 text-yellow-500" />} />
            <KpiCard title="Pending Releases" value={fmt(metrics?.pendingReleases ?? 0)} icon={<ArrowRightLeft className="h-4 w-4 text-green-500" />} />
            <KpiCard title="Locked Disputes" value={fmt(metrics?.lockedDisputes ?? 0)} icon={<ShieldAlert className="h-4 w-4 text-red-500" />} />
          </div>
          <Card>
            <CardHeader><CardTitle>Escrow Ledger</CardTitle></CardHeader>
            <CardContent>
              <DataTable data={ledger} pageSize={10} columns={[
                { header: "Entry ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
                { header: "Vendor", accessorKey: "vendorName" },
                { header: "Type", cell: (row: any) => <span className={`text-xs font-medium ${row.type === "Release" ? "text-green-500" : row.type === "Dispute Lock" ? "text-red-500" : "text-muted-foreground"}`}>{row.type}</span> },
                { header: "Amount", cell: (row: any) => <span className="font-medium">{fmt(row.amount)}</span> },
                { header: "Balance After", cell: (row: any) => <span className="font-bold">{fmt(row.balance)}</span> },
                { header: "Date", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.date}</span> },
                { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
              ]} />
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={reserveDialog} onOpenChange={setReserveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Escrow Reserve</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Amount (₹)</Label><Input type="number" placeholder="50000" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="space-y-1"><Label>Reason</Label><Textarea placeholder="e.g. Festival season reserve buffer" value={reason} onChange={e => setReason(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReserveDialog(false)}>Cancel</Button>
            <Button disabled={!amount || !reason || addReserveMutation.isPending} onClick={() => addReserveMutation.mutate({ amount: Number(amount), reason })}>
              {addReserveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add Reserve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={freezeDialog} onOpenChange={setFreezeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Freeze Vendor Payouts</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Select Vendor</Label>
              <Select value={freezeVendorId} onValueChange={setFreezeVendorId}>
                <SelectTrigger><SelectValue placeholder="Choose vendor..." /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.name} (#{v.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeDialog(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!freezeVendorId || freezeMutation.isPending} onClick={() => freezeMutation.mutate(freezeVendorId)}>
              {freezeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Freeze Payouts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
