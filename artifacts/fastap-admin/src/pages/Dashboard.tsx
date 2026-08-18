import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Users, CreditCard, ShoppingCart, AlertTriangle, Building2, Activity,
  Server, Database, Cpu, Loader2, RefreshCw, Download, QrCode, Ticket,
  TrendingUp, Wallet, RotateCcw,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/apiClient";
import { fmtINR, fmtINRFull } from "@/lib/format";

export default function Dashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: stats, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["superadmin-stats"],
    queryFn: api.dashboard.stats,
    refetchInterval: 60_000,
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:p-6 shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Mission Control</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Live platform metrics and critical indicators.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="rounded-xl bg-background/60" onClick={refreshAll} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl bg-background/60" onClick={exportReport}><Download className="mr-2 h-4 w-4" /> Export</Button>
            <Link href="/live-monitoring"><Button size="sm" className="rounded-xl"><Activity className="mr-2 h-4 w-4" /> Live Panel</Button></Link>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <KpiCard title="Total Vendors" value={stats?.totalRestaurants.toLocaleString() ?? "—"} icon={<Building2 className="h-4 w-4" />} subtitle={`${stats?.activeRestaurants ?? 0} active · ${stats?.trialVendors ?? 0} trial`} />
            <KpiCard title="Enterprise" value={String(stats?.enterpriseVendors ?? 0)} icon={<TrendingUp className="h-4 w-4 text-purple-500" />} subtitle={`${stats?.inactiveRestaurants ?? 0} inactive`} />
            <KpiCard title="Today Revenue" value={fmtINR(stats?.todayRevenue ?? 0)} icon={<CreditCard className="h-4 w-4" />} subtitle={`Week: ${fmtINR(stats?.weekRevenue ?? 0)} · Month: ${fmtINR(stats?.monthRevenue ?? 0)}`} />
            <KpiCard title="Commission" value={fmtINR(stats?.platformCommission ?? 0)} icon={<Wallet className="h-4 w-4 text-green-500" />} subtitle="Platform lifetime" />
            <KpiCard title="Orders" value={stats?.totalOrders.toLocaleString() ?? "—"} icon={<ShoppingCart className="h-4 w-4" />} subtitle={`${stats?.totalBookings ?? 0} bookings`} />
            <KpiCard title="Customers" value={stats?.totalCustomers?.toLocaleString() ?? "—"} icon={<Users className="h-4 w-4" />} subtitle={`${stats?.totalQrScans ?? 0} QR scans`} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <KpiCard title="Active Subs" value={String(stats?.activeSubscriptions ?? 0)} icon={<RotateCcw className="h-4 w-4" />} />
            <KpiCard title="Pending Settlements" value={String(stats?.pendingSettlements ?? 0)} icon={<Wallet className="h-4 w-4 text-yellow-500" />} subtitle={`${stats?.heldSettlements ?? 0} held`} />
            <KpiCard title="Payment Success" value={`${stats?.paymentSuccessRate ?? 100}%`} icon={<TrendingUp className="h-4 w-4 text-green-500" />} subtitle={`${stats?.failedPayments ?? 0} failed`} />
            <KpiCard title="Refunds" value={fmtINR(stats?.refundAmount ?? 0)} icon={<CreditCard className="h-4 w-4 text-orange-500" />} subtitle={`${pendingRefunds} pending · CB ${fmtINR(stats?.chargebackAmount ?? 0)}`} />
            <KpiCard title="Pending KYC" value={String(stats?.pendingKycVendors ?? 0)} icon={<Building2 className="h-4 w-4 text-amber-500" />} subtitle="Awaiting verification" />
            <KpiCard title="Support Tickets" value={String(stats?.totalSupportTickets ?? 0)} icon={<Ticket className="h-4 w-4" />} />
            <KpiCard title="Fraud Alerts" value={String(fraudAlerts.filter(a => a.status === "Active" || a.status === "active").length)} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} />
          </div>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 admin-card-elevated">
          <CardHeader><CardTitle>Revenue & Commission Trend</CardTitle></CardHeader>
          <CardContent className="pl-2">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => fmtINR(v)} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} formatter={(v: number) => [fmtINRFull(v), ""]} />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" />
                  <Area type="monotone" dataKey="commission" stroke="hsl(var(--chart-2))" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader><CardTitle>Infrastructure · {infraMetrics?.uptime ?? "—"}{infraMetrics?.estimated ? " (derived)" : ""}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { icon: Cpu, label: "CPU", value: infraMetrics?.cpu },
              { icon: Server, label: "Memory", value: infraMetrics?.memory },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span><span className="font-bold">{value ?? "—"}%</span></div>
                <Progress value={value ?? 0} className="h-2" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t text-sm">
              <div><p className="text-muted-foreground text-xs">API RPM</p><p className="font-bold">{infraMetrics?.apiRpm ?? "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Queue</p><p className="font-bold">{infraMetrics?.queueDepth ?? "—"}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Live Payments</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {(liveFeed?.payments ?? []).slice(0, 6).map(p => (
              <div key={p.id} className="flex justify-between text-xs border-b pb-1">
                <span className="font-mono">{p.id}</span>
                <span>{fmtINRFull(p.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Live Refunds</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {(liveFeed?.refunds ?? []).slice(0, 6).map(r => (
              <div key={r.id} className="flex justify-between text-xs border-b pb-1">
                <span>{r.vendor}</span>
                <span>{fmtINRFull(r.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Live Settlements</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {(liveFeed?.settlements ?? []).slice(0, 6).map(s => (
              <div key={s.id} className="flex justify-between text-xs border-b pb-1">
                <span>{s.vendor}</span>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
          <CardContent>
            <DataTable data={payments.slice(0, 5)} pageSize={5} columns={[
              { header: "ID", cell: row => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", accessorKey: "vendorName" },
              { header: "Amount", cell: row => fmtINRFull(row.grossAmount) },
              { header: "Status", cell: row => <StatusBadge status={row.status} /> },
            ]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2 h-5 w-5" /> Fraud Alerts</CardTitle></CardHeader>
          <CardContent>
            <DataTable data={fraudAlerts.slice(0, 5)} pageSize={5} columns={[
              { header: "Vendor", accessorKey: "vendorName" },
              { header: "Risk", cell: row => <span className={row.riskScore > 80 ? "text-red-500 font-bold" : "text-yellow-500"}>{row.riskScore}</span> },
              { header: "Status", cell: row => <StatusBadge status={row.status} /> },
            ]} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
