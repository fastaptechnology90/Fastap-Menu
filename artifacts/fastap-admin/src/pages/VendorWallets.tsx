import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { fmtINR, fmtINRFull } from "@/lib/format";
import { Wallet, Lock, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function VendorWallets() {
  const { data: wallets = [], isLoading, refetch, isFetching } = useQuery({ queryKey: ["vendor-wallets"], queryFn: api.vendorWallets.list, refetchInterval: 60000 });

  const totalBalance = wallets.reduce((s: number, w: any) => s + (w.walletBalance || 0), 0);
  const frozen = wallets.filter((w: any) => w.payoutsFrozen).length;
  const negative = wallets.filter((w: any) => w.negativeBalance).length;

  return (
    <PageShell title="Vendor Wallets" description="Wallet balances, locked funds, reserves, and penalty deductions per vendor." icon={<Wallet className="h-6 w-6" />} accent="emerald" loading={isLoading} onRefresh={() => refetch()} refreshing={isFetching}>
      <div className="admin-stat-grid">
        <KpiCard title="Total Balance" value={fmtINR(totalBalance)} accent="emerald" icon={<Wallet className="h-4 w-4 text-emerald-500" />} />
        <KpiCard title="Frozen Payouts" value={frozen} accent="amber" icon={<Lock className="h-4 w-4 text-amber-500" />} />
        <KpiCard title="Negative Balances" value={negative} accent="rose" icon={<AlertCircle className="h-4 w-4 text-rose-500" />} />
      </div>
      <PanelCard title="Wallet Ledger" description="Click vendor to open full profile">
        <div className="admin-data-table-wrap">
          <DataTable data={wallets} columns={[
            { header: "Vendor", cell: (row: any) => <Link href={`/vendors/${row.vendorId}`} className="font-semibold hover:text-primary transition-colors">{row.vendorName}</Link> },
            { header: "Plan", cell: (row: any) => <Badge variant="outline" className="capitalize text-xs">{row.plan}</Badge> },
            { header: "Balance", cell: (row: any) => <span className={`font-semibold ${row.negativeBalance ? "text-rose-500" : "text-emerald-600"}`}>{fmtINRFull(row.walletBalance)}</span> },
            { header: "Locked", cell: (row: any) => fmtINRFull(row.lockedBalance) },
            { header: "Reserve", cell: (row: any) => fmtINRFull(row.reserveBalance) },
            { header: "Penalties", cell: (row: any) => <span className="text-rose-500">{fmtINRFull(row.penaltyDeductions)}</span> },
            { header: "Status", cell: (row: any) => row.payoutsFrozen ? <Badge variant="destructive" className="text-xs">Frozen</Badge> : <Badge className="text-xs bg-emerald-500/15 text-emerald-600 border-emerald-500/30" variant="outline">Active</Badge> },
          ]} />
        </div>
      </PanelCard>
    </PageShell>
  );
}
