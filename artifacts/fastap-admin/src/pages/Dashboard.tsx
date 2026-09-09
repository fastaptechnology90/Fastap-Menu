import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/Page";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Users, CreditCard, ShoppingCart, AlertTriangle, Building2, Activity,
  Server, Cpu, Loader2, RefreshCw, Download, Ticket,
  TrendingUp, Wallet, RotateCcw, IndianRupee, Search,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/apiClient";
import { fmtINR, fmtINRFull } from "@/lib/format";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Gross takings for any day or range.
 *
 * This card used to print one number labelled "Revenue" next to "N orders in range",
 * and the two did not correspond: on a day with 81 orders placed and none of them
 * settled, it read "₹500 · 81 orders in range" — the ₹500 was an event advance and no
 * order had contributed a rupee. `revenue` is the sum of three separate books (orders,
 * spa, events) and `totalOrders` counts orders *placed*, paid or not, so the parts are
 * now shown next to the total and the count says what it counts.
 */
function GrossTakings() {
  const today = new Date();
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const PRESETS: { key: string; label: string; from?: string; to?: string }[] = [
    { key: "today", label: "Today", from: ymd(today), to: ymd(today) },
    { key: "7d", label: "7 days", from: ymd(daysAgo(6)), to: ymd(today) },
    { key: "15d", label: "15 days", from: ymd(daysAgo(14)), to: ymd(today) },
    { key: "30d", label: "30 days", from: ymd(daysAgo(29)), to: ymd(today) },
    { key: "all", label: "All time" },
  ];
  const [preset, setPreset] = useState("today");
  const [from, setFrom] = useState(ymd(today));
  const [to, setTo] = useState(ymd(today));

  function applyPreset(p: typeof PRESETS[0]) {
    setPreset(p.key);
    if (p.from) setFrom(p.from);
    if (p.to) setTo(p.to);
  }
  const isAll = preset === "all";
  const params = isAll ? {} : { from, to };

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["superadmin-revenue", isAll ? "all" : from, isAll ? "all" : to],
    queryFn: () => api.dashboard.revenue(params),
  });

  const parts = [
    { label: "Orders", value: data?.orderRevenue },
    { label: "Spa & wellness", value: data?.spaRevenue },
    { label: "Event advances", value: data?.banquetRevenue },
  ];

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 lg:w-72">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <IndianRupee className="h-3.5 w-3.5" />
              Gross takings {data?.from ? `${data.from}${data.to && data.to !== data.from ? ` to ${data.to}` : ""}` : "(all time)"}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {isFetching ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : fmtINRFull(data?.revenue ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Money taken by the venues. The platform's own income is the commission below.
            </p>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            {parts.map(p => (
              <div key={p.label} className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">{p.label}</p>
                <p className="text-sm font-medium tabular-nums">{fmtINRFull(p.value ?? 0)}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-3">
              {(data?.totalOrders ?? 0).toLocaleString()} orders placed in this range, paid or not.
            </p>
          </div>

          <div className="space-y-2 lg:w-64 lg:shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <Button key={p.key} variant={preset === p.key ? "default" : "outline"} size="sm" onClick={() => applyPreset(p)}>{p.label}</Button>
              ))}
              <Button variant={preset === "custom" ? "default" : "outline"} size="sm" onClick={() => setPreset("custom")}>Custom</Button>
            </div>
            {preset === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted-foreground" htmlFor="takings-from">From</label>
                <Input id="takings-from" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="h-9 w-auto" />
                <label className="text-xs text-muted-foreground" htmlFor="takings-to">To</label>
                <Input id="takings-to" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="h-9 w-auto" />
              </div>
            )}
          </div>
        </div>

        {isError && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Takings could not be loaded</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              A zero here would be a failed request, not a quiet day.
              <Button variant="outline" size="sm" onClick={() => { void refetch(); }}>Try again</Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

const PAY_LABEL: Record<string, string> = {
  upi: "UPI", card: "Card", cash: "Cash", wallet: "Wallet", nfc: "NFC",
  netbanking: "Net Banking", room_bill: "Room Bill", aggregator: "Aggregator", online: "Online",
};
function payLabel(mode?: string) {
  const m = String(mode ?? "").toLowerCase();
  return PAY_LABEL[m] ?? (mode ? String(mode).toUpperCase() : "—");
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [txnSearch, setTxnSearch] = useState("");

  const { data: stats, isLoading, isError: statsError, refetch, isFetching } = useQuery({
    queryKey: ["superadmin-stats"],
    queryFn: api.dashboard.stats,
    refetchInterval: 60_000,
  });

  // The lifetime figure on this screen comes from the same endpoint as the card above,
  // so the two agree by construction. `stats.totalRevenue` counts orders and spa but
  // NOT event advances, which put a ₹98,965 tile directly beneath a ₹470,465 headline.
  const { data: lifetime } = useQuery({
    queryKey: ["superadmin-revenue", "all", "all"],
    queryFn: () => api.dashboard.revenue({}),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["superadmin-payments"],
    queryFn: () => api.payments.list({ limit: 20 }),
    staleTime: 30_000,
  });

  const { data: refunds = [] } = useQuery({
    queryKey: ["refunds"],
    queryFn: api.refunds.list,
    staleTime: 30_000,
  });

  const { data: fraudAlerts = [] } = useQuery({
    queryKey: ["fraud"],
    queryFn: api.fraud.list,
    staleTime: 60_000,
  });

  const { data: infraMetrics } = useQuery({
    queryKey: ["metrics"],
    queryFn: api.metrics.get,
    refetchInterval: 30_000,
  });

  const { data: revenueData = [] } = useQuery({
    queryKey: ["revenue-series"],
    queryFn: api.analytics.revenueSeries,
    staleTime: 120_000,
  });

  const { data: liveFeed } = useQuery({
    queryKey: ["live-feed"],
    queryFn: api.liveFeed.get,
    refetchInterval: 20_000,
  });

  // New restaurant registrations waiting for KYC review — surfaced as a banner below.
  const { data: kycData = [] } = useQuery({
    queryKey: ["kyc"],
    queryFn: api.kyc.list,
    refetchInterval: 30_000,
  });
  const pendingRegistrations = kycData.filter((k: any) => k.status === "Pending Review").length;

  const refreshAll = () => {
    refetch();
    qc.invalidateQueries();
    toast({ title: "Dashboard refreshed" });
  };

  const exportReport = async () => {
    try {
      const r = await api.exportCenter.create({ module: "analytics", format: "csv" });
      await api.exportCenter.download(r.id);
      toast({ title: "Report exported" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const pendingRefunds = refunds.filter(r => r.status === "Pending" || r.status === "pending").length;
  const activeFraud = fraudAlerts.filter(a => a.status === "Active" || a.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mission Control"
        description="Live platform metrics and the indicators worth acting on."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportReport}><Download className="mr-2 h-4 w-4" /> Export</Button>
            <Link href="/live-monitoring"><Button size="sm"><Activity className="mr-2 h-4 w-4" /> Live panel</Button></Link>
          </>
        }
      />

      {pendingRegistrations > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {pendingRegistrations} new restaurant {pendingRegistrations === 1 ? "request is" : "requests are"} waiting for KYC review
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            Review the documents and approve so the owner can sign in.
            <Link href="/kyc"><Button variant="outline" size="sm">Review now</Button></Link>
          </AlertDescription>
        </Alert>
      )}

      <GrossTakings />

      {statsError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>These figures could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            A zero here is a failed request, not a quiet day.
            <Button variant="outline" size="sm" onClick={() => { void refetch(); }}>Try again</Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard title="Vendors" value={stats?.totalRestaurants.toLocaleString() ?? "—"} icon={<Building2 />} subtitle={`${stats?.activeRestaurants ?? 0} active · ${stats?.trialVendors ?? 0} trial`} />
            <KpiCard title="Enterprise" value={String(stats?.enterpriseVendors ?? 0)} icon={<TrendingUp />} subtitle={`${stats?.inactiveRestaurants ?? 0} inactive`} />
            <KpiCard title="Gross takings" value={fmtINR(lifetime?.revenue ?? 0)} icon={<IndianRupee />} subtitle="All venues, all time" />
            <KpiCard title="Commission earned" value={fmtINR(stats?.platformCommission ?? 0)} icon={<Wallet />} subtitle="The platform's own income" />
            <KpiCard title="Orders" value={stats?.totalOrders.toLocaleString() ?? "—"} icon={<ShoppingCart />} subtitle={`${stats?.totalBookings ?? 0} bookings`} />
            <KpiCard title="Customers" value={stats?.totalCustomers?.toLocaleString() ?? "—"} icon={<Users />} subtitle={`${(stats?.totalQrScans ?? 0).toLocaleString()} QR scans`} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard title="Active subs" value={String(stats?.activeSubscriptions ?? 0)} icon={<RotateCcw />} />
            <KpiCard title="Pending settlements" value={String(stats?.pendingSettlements ?? 0)} icon={<Wallet />} subtitle={`${stats?.heldSettlements ?? 0} held`} />
            <KpiCard title="Payment success" value={`${stats?.paymentSuccessRate ?? 100}%`} icon={<TrendingUp />} subtitle={`${stats?.failedPayments ?? 0} failed`} />
            <KpiCard title="Refunds" value={fmtINR(stats?.refundAmount ?? 0)} icon={<CreditCard />} subtitle={`${pendingRefunds} pending · chargebacks ${fmtINR(stats?.chargebackAmount ?? 0)}`} />
            <KpiCard title="Pending KYC" value={String(stats?.pendingKycVendors ?? 0)} icon={<Building2 />} subtitle="Awaiting verification" />
            <KpiCard title="Open tickets" value={String(stats?.totalSupportTickets ?? 0)} icon={<Ticket />} subtitle={`${activeFraud} active fraud alerts`} />
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader><CardTitle className="text-sm">Takings and commission by month</CardTitle></CardHeader>
          <CardContent className="pl-2">
            {revenueData.length === 0 ? (
              <EmptyState title="No settled months yet" description="This chart fills once a month of paid orders has closed." />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => fmtINR(v)} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius-surface)" }} formatter={(v: number) => [fmtINRFull(v), ""]} />
                    <Area type="monotone" name="Takings" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" />
                    <Area type="monotone" name="Commission" dataKey="commission" stroke="hsl(var(--chart-2))" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">
              Infrastructure · {infraMetrics?.uptime ?? "—"}{infraMetrics?.estimated ? " (derived)" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { icon: Cpu, label: "CPU", value: infraMetrics?.cpu },
              { icon: Server, label: "Memory", value: infraMetrics?.memory },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" />{label}</span>
                  <span className="font-medium tabular-nums">{value ?? "—"}%</span>
                </div>
                <Progress value={value ?? 0} className="h-2" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
              <div><p className="text-xs text-muted-foreground">API RPM</p><p className="font-medium tabular-nums">{infraMetrics?.apiRpm ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Queue</p><p className="font-medium tabular-nums">{infraMetrics?.queueDepth ?? "—"}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Live payments</CardTitle></CardHeader>
          <CardContent className="max-h-48 space-y-2 overflow-y-auto">
            {(liveFeed?.payments ?? []).length === 0
              ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing taken yet today.</p>
              : (liveFeed?.payments ?? []).slice(0, 6).map(p => (
                <div key={p.id} className="flex justify-between border-b pb-1 text-xs">
                  <span className="font-mono">{p.id}</span>
                  <span className="tabular-nums">{fmtINRFull(p.amount)}</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Live refunds</CardTitle></CardHeader>
          <CardContent className="max-h-48 space-y-2 overflow-y-auto">
            {(liveFeed?.refunds ?? []).length === 0
              ? <p className="py-6 text-center text-sm text-muted-foreground">No refunds raised.</p>
              : (liveFeed?.refunds ?? []).slice(0, 6).map(r => (
                <div key={r.id} className="flex justify-between border-b pb-1 text-xs">
                  <span className="truncate">{r.vendor}</span>
                  <span className="tabular-nums">{fmtINRFull(r.amount)}</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Live settlements</CardTitle></CardHeader>
          <CardContent className="max-h-48 space-y-2 overflow-y-auto">
            {(liveFeed?.settlements ?? []).length === 0
              ? <p className="py-6 text-center text-sm text-muted-foreground">No settlements in flight.</p>
              : (liveFeed?.settlements ?? []).slice(0, 6).map(s => (
                <div key={s.id} className="flex items-center justify-between gap-2 border-b pb-1 text-xs">
                  <span className="truncate">{s.vendor}</span>
                  <StatusBadge status={s.status} />
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent transactions</CardTitle>
            <p className="text-xs text-muted-foreground">
              Open a transaction to see how it was paid, the UPI id or UTR, and who collected it.
            </p>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={txnSearch}
                onChange={e => setTxnSearch(e.target.value)}
                placeholder="Search by vendor name"
                aria-label="Search transactions by vendor name"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const q = txnSearch.trim().toLowerCase();
              const filtered = q ? payments.filter(p => String((p as any).vendorName ?? "").toLowerCase().includes(q)) : payments;
              if (filtered.length === 0) {
                return q
                  ? <EmptyState tone="search" title="No matching transactions" description={`Nothing in the recent list matches "${txnSearch}".`} />
                  : <EmptyState title="No transactions yet" description="Payments appear here as venues take money." />;
              }
              return (
                <DataTable data={filtered.slice(0, q ? 20 : 5)} pageSize={q ? 10 : 5} onRowClick={row => setSelectedTxn(row)} columns={[
                  { header: "ID", cell: row => <span className="font-mono text-xs">{row.id}</span> },
                  { header: "Vendor", accessorKey: "vendorName" },
                  { header: "Amount", cell: row => <span className="tabular-nums">{fmtINRFull(row.grossAmount)}</span> },
                  { header: "Mode", cell: row => <span className="text-xs">{payLabel((row as any).paymentMode)}</span> },
                  { header: "Status", cell: row => <StatusBadge status={row.status} /> },
                ]} />
              );
            })()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-danger" /> Fraud alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fraudAlerts.length === 0 ? (
              <EmptyState title="No fraud alerts" description="Nothing has tripped the fraud rules." />
            ) : (
              <DataTable data={fraudAlerts.slice(0, 5)} pageSize={5} columns={[
                { header: "Vendor", accessorKey: "vendorName" },
                { header: "Risk", cell: row => <span className={`tabular-nums font-medium ${row.riskScore > 80 ? "text-danger" : "text-warning"}`}>{row.riskScore}</span> },
                { header: "Status", cell: row => <StatusBadge status={row.status} /> },
              ]} />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTxn} onOpenChange={open => { if (!open) setSelectedTxn(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Transaction details
            </DialogTitle>
          </DialogHeader>
          {selectedTxn && (
            <div className="space-y-3 text-sm">
              <div className="py-2 text-center">
                <p className="text-3xl font-semibold tabular-nums tracking-tight">{fmtINRFull(selectedTxn.grossAmount)}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedTxn.id} · {selectedTxn.orderId}</p>
                <div className="mt-2"><StatusBadge status={selectedTxn.status} /></div>
              </div>
              {[
                ["Vendor / hotel", selectedTxn.vendorName],
                ["Payment method", payLabel(selectedTxn.paymentMode)],
                ["UPI ID", selectedTxn.upiId || "—"],
                ["UTR / reference", selectedTxn.reference || selectedTxn.utr || "—"],
                ["Gateway txn", selectedTxn.gatewayTxnId || "—"],
                ["Collected by", selectedTxn.collectedBy || "—"],
                ["Collected from", selectedTxn.collectedFrom || "—"],
                ["Customer", selectedTxn.customerName || "—"],
                ["Table / room", selectedTxn.tableName || selectedTxn.roomNumber || "—"],
                ["Commission", fmtINRFull(selectedTxn.commission ?? 0)],
                ["Net payout", fmtINRFull(selectedTxn.netPayout ?? 0)],
                ["Date / time", selectedTxn.dateTime ? new Date(selectedTxn.dateTime).toLocaleString("en-IN") : "—"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="break-all text-right font-medium">{v as string}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
