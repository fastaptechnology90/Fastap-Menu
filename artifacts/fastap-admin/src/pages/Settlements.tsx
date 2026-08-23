import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/shared/KpiCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, type Settlement } from "@/lib/apiClient";
import { PlayCircle, StopCircle, Loader2, RefreshCcw } from "lucide-react";

export default function Settlements() {
  const [holdDialog, setHoldDialog] = useState<Settlement | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settlements = [], isLoading, refetch } = useQuery({
    queryKey: ["superadmin-settlements"],
    queryFn: api.settlements.list,
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => api.settlements.release(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-settlements"] }); toast({ title: "Settlement released" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const holdMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.settlements.hold(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-settlements"] });
      setHoldDialog(null);
      setHoldReason("");
      toast({ title: "Settlement held" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pending = settlements.filter(s => s.status === "pending");
  const released = settlements.filter(s => s.status === "released");
  const held = settlements.filter(s => s.status === "held");

  const pendingTotal = pending.reduce((sum, s) => sum + s.finalPayout, 0);
  const releasedTotal = released.reduce((sum, s) => sum + s.finalPayout, 0);
  const heldTotal = held.reduce((sum, s) => sum + s.finalPayout, 0);

  function fmtMoney(n: number) {
    if (n >= 1_000_000) return `₹${(Math.floor(n / 100_000) / 10).toFixed(1)}M`;
    // One-decimal, truncated (not rounded up) — so ₹4,678 shows as ₹4.6K, not ₹5K.
    if (n >= 1_000) return `₹${(Math.floor(n / 100) / 10).toFixed(1)}K`;
    return `₹${n.toLocaleString("en-IN")}`;
  }

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.settlements.retry(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-settlements"] }); toast({ title: "Settlement retry queued" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settlement Engine</h2>
          <p className="text-muted-foreground">Manage vendor payouts and holding rules.</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Pending Settlements" value={fmtMoney(pendingTotal)} subtitle={`${pending.length} batches`} />
        <KpiCard title="Released" value={fmtMoney(releasedTotal)} subtitle={`${released.length} batches`} />
        <KpiCard title="Held Funds" value={fmtMoney(heldTotal)} subtitle={`${held.length} batches · risk triggers`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Settlement Batches</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <DataTable
              data={settlements}
              pageSize={10}
              columns={[
                { header: "Batch ID", cell: (row) => <span className="font-mono text-xs">{row.id}</span> },
                { header: "Vendor", cell: (row) => <span className="font-medium">{row.vendorName}</span> },
                { header: "Gross Sales", cell: (row) => <span>₹{row.grossSales.toLocaleString("en-IN")}</span> },
                { header: "Commission", cell: (row) => <span className="text-muted-foreground">-₹{row.commission.toLocaleString("en-IN")}</span> },
                { header: "Net Payout", cell: (row) => <span className="font-bold text-green-400">₹{row.finalPayout.toLocaleString("en-IN")}</span> },
                { header: "Cycle", cell: (row) => <span className="capitalize">{row.cycle}</span> },
                { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
                {
                  header: "Actions",
                  cell: (row) => (
                    <div className="flex items-center gap-1">
                      {row.status === "pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="text-green-500 h-8 w-8" title="Release" onClick={() => releaseMutation.mutate(row.id)} disabled={releaseMutation.isPending}>
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-yellow-500 h-8 w-8" title="Hold" onClick={() => { setHoldDialog(row); setHoldReason(""); }}>
                            <StopCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {(row.status === "held" || row.status === "failed") && (
                        <Button variant="ghost" size="icon" className="text-blue-500 h-8 w-8" title="Retry" onClick={() => retryMutation.mutate(row.id)}>
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!holdDialog} onOpenChange={() => setHoldDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Hold Settlement {holdDialog?.id}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Vendor: <strong>{holdDialog?.vendorName}</strong> · ₹{holdDialog?.finalPayout.toLocaleString("en-IN")}</p>
            <div className="space-y-2">
              <Label>Reason for hold *</Label>
              <Input placeholder="e.g. Fraud investigation, KYC pending…" value={holdReason} onChange={e => setHoldReason(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setHoldDialog(null)}>Cancel</Button>
              <Button
                variant="destructive" className="flex-1"
                disabled={!holdReason.trim() || holdMutation.isPending}
                onClick={() => holdDialog && holdMutation.mutate({ id: holdDialog.id, reason: holdReason })}
              >
                {holdMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Hold
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}