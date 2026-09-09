import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader, Section } from "@/components/shared/Page";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertTriangle, Building2, Activity, Loader2, RefreshCw, Download, CreditCard,
  IndianRupee, Search, CheckCircle2, ShieldAlert, Ticket, RotateCcw, Wallet, FileCheck,
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
 * shown next to the total and the count says what it counts.
 */
function GrossTakings({ commission }: { commission: number }) {
  const today = new Date();
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const PRESETS: { key: string; label: string; from?: string; to?: string }[] = [
    { key: "today", label: "Today", from: ymd(today), to: ymd(today) },
    { key: "7d", label: "7 days", from: ymd(daysAgo(6)), to: ymd(today) },
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

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["superadmin-revenue", isAll ? "all" : from, isAll ? "all" : to],
    queryFn: () => api.dashboard.revenue(isAll ? {} : { from, to }),
  });

  const parts = [
    { label: "Orders", value: data?.orderRevenue },
    { label: "Spa & wellness", value: data?.spaRevenue },
    { label: "Event advances", value: data?.banquetRevenue },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <IndianRupee className="h-3.5 w-3.5" />
            What came in · {data?.from ? `${data.from}${data.to && data.to !== data.from ? ` to ${data.to}` : ""}` : "all time"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <Button key={p.key} variant={preset === p.key ? "default" : "outline"} size="sm" onClick={() => applyPreset(p)}>{p.label}</Button>
            ))}
            <Button variant={preset === "custom" ? "default" : "outline"} size="sm" onClick={() => setPreset("custom")}>Custom</Button>
          </div>
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="takings-from">From</label>
            <Input id="takings-from" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="h-9 w-auto" />
            <label className="text-xs text-muted-foreground" htmlFor="takings-to">To</label>
            <Input id="takings-to" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="h-9 w-auto" />
          </div>
        )}

        {/* The two numbers a platform owner confuses: what the venues took, and what the
            platform earned from it. They sit side by side, labelled, at the same size. */}
        <div className="grid gap-4 border-y py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Taken by the venues</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {isFetching ? <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /> : fmtINRFull(data?.revenue ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(data?.totalOrders ?? 0).toLocaleString()} orders placed in this range, paid or not.
            </p>
          </div>
          <div className="sm:border-l sm:pl-4">
            <p className="text-xs text-muted-foreground">Earned by the platform</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-success">{fmtINRFull(commission)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Commission on settled orders, all time.</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {parts.map(p => (
            <div key={p.label} className="rounded-md border px-3 py-2">
              <p className="text-xs text-muted-foreground">{p.label}</p>
              <p className="text-sm font-medium tabular-nums">{fmtINRFull(p.value ?? 0)}</p>
            </div>
          ))}
        </div>

        {isError && (
          <Alert variant="destructive">
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

/** One line of the morning queue: a count, what it means, and where to go and fix it. */
function QueueRow({ icon: Icon, count, label, detail, href, action, tone }: {
  icon: typeof AlertTriangle; count: number; label: string; detail: string;
  href: string; action: string; tone: "danger" | "warning";
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-0">
      <span className={tone === "danger"
        ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-danger-subtle text-danger"
        : "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning-subtle text-warning"}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-xl font-semibold tabular-nums">{count}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <Link href={href}><Button variant="outline" size="sm">{action}</Button></Link>
    </div>
  );
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [txnSearch, setTxnSearch] = useState("");

  const { data: stats, isLoading, isError: statsError, refetch, isFetching } = useQuery({
    queryKey: ["superadmin-stats"], queryFn: api.dashboard.stats, refetchInterval: 60_000,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["superadmin-payments"], queryFn: () => api.payments.list({ limit: 20 }), staleTime: 30_000,
  });
  const { data: refunds = [] } = useQuery({ queryKey: ["refunds"], queryFn: api.refunds.list, staleTime: 30_000 });
  const { data: fraudAlerts = [] } = useQuery({ queryKey: ["fraud"], queryFn: api.fraud.list, staleTime: 60_000 });
  const { data: revenueData = [] } = useQuery({ queryKey: ["revenue-series"], queryFn: api.analytics.revenueSeries, staleTime: 120_000 });
  const { data: extended } = useQuery({ queryKey: ["analytics-extended"], queryFn: api.analytics.extended, staleTime: 120_000 });

  const refreshAll = () => { refetch(); qc.invalidateQueries(); toast({ title: "Dashboard refreshed" }); };

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
  const pendingKyc = stats?.pendingKycVendors ?? 0;
  const heldSettlements = stats?.heldSettlements ?? 0;
  const failedPayments = stats?.failedPayments ?? 0;
  const openTickets = stats?.totalSupportTickets ?? 0;

  // The morning queue: only the rows that actually want a decision today. A tile reading
  // "0 pending refunds" is not information, so nothing at zero is drawn at all.
  const queue = [
    pendingKyc > 0 && { icon: FileCheck, count: pendingKyc, label: "Venues waiting to be approved", detail: "Their owners cannot sign in until KYC is reviewed.", href: "/kyc", action: "Review", tone: "warning" as const },
    activeFraud > 0 && { icon: ShieldAlert, count: activeFraud, label: "Open fraud alerts", detail: "Repeated payment failures tripped the risk rule.", href: "/fraud", action: "Investigate", tone: "danger" as const },
    pendingRefunds > 0 && { icon: RotateCcw, count: pendingRefunds, label: "Refunds awaiting a decision", detail: "Money is not returned to the guest until one of these is approved.", href: "/refunds", action: "Decide", tone: "warning" as const },
    heldSettlements > 0 && { icon: Wallet, count: heldSettlements, label: "Settlements on hold", detail: "Payouts a venue is owed but is not receiving.", href: "/settlements", action: "Release", tone: "warning" as const },
    failedPayments > 0 && { icon: CreditCard, count: failedPayments, label: "Failed payments", detail: "Orders where the guest's money never arrived.", href: "/payments", action: "Open", tone: "danger" as const },
    openTickets > 0 && { icon: Ticket, count: openTickets, label: "Open support tickets", detail: "Raised by venues and not yet closed.", href: "/support", action: "Open", tone: "warning" as const },
  ].filter(Boolean) as Parameters<typeof QueueRow>[0][];

  const estate = [
    { label: "Venues on the platform", value: stats?.totalRestaurants ?? 0, detail: `${stats?.activeRestaurants ?? 0} trading · ${stats?.inactiveRestaurants ?? 0} not trading` },
    { label: "On a paid plan", value: stats?.activeSubscriptions ?? 0, detail: `${stats?.enterpriseVendors ?? 0} enterprise · ${stats?.trialVendors ?? 0} on trial` },
    { label: "Orders all time", value: (stats?.totalOrders ?? 0).toLocaleString(), detail: `${(stats?.totalBookings ?? 0).toLocaleString()} bookings · ${(stats?.totalCustomers ?? 0).toLocaleString()} guests` },
    { label: "Payment success", value: `${stats?.paymentSuccessRate ?? 100}%`, detail: `${failedPayments} failed` },
  ];

  const churnRisk = extended?.forecastSummary?.churnRiskMrr ?? 0;
  const atRiskVendors = extended?.churnRiskVendors ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="What needs a decision this morning, what came in, and who is paying."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={isFetching}>
              <RefreshCw className={isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportReport}><Download className="mr-2 h-4 w-4" /> Export</Button>
            <Link href="/live-monitoring"><Button size="sm"><Activity className="mr-2 h-4 w-4" /> Live panel</Button></Link>
          </>
        }
      />

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

      {/* 1 — What needs you. The screen opens with the answer, not with tiles. */}
      <Section title="Needs a decision" description="Everything here is stopping someone from trading, being paid, or being helped.">
        <Card>
          {isLoading ? (
            <CardContent className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent>
          ) : queue.length === 0 ? (
            <CardContent className="flex items-center gap-3 py-6">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium">Nothing is waiting on you</p>
                <p className="text-xs text-muted-foreground">No approvals, refunds, held payouts, fraud alerts or open tickets.</p>
              </div>
            </CardContent>
          ) : (
            <div>{queue.map(q => <QueueRow key={q.label} {...q} />)}</div>
          )}
        </Card>
      </Section>

      {/* 2 — What came in. */}
      <Section title="Money">
        <GrossTakings commission={stats?.platformCommission ?? 0} />
      </Section>

      {/* 3 — Who signed up and who is paying. */}
      <Section title="The estate">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {estate.map(s => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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

        {/* 4 — What is at risk. Real plan prices from platform_plans, not a flat per-venue guess. */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Subscription revenue at risk</CardTitle>
            <p className="text-xs text-muted-foreground">Monthly plan value of venues showing churn signals.</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{fmtINRFull(churnRisk)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {atRiskVendors.length === 0 ? "No venue is showing churn signals." : `across ${atRiskVendors.length} ${atRiskVendors.length === 1 ? "venue" : "venues"} · per month`}
            </p>
            <div className="mt-4 space-y-2">
              {atRiskVendors.slice(0, 5).map((v: any) => (
                <div key={v.name} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{(v.signals ?? []).join(" · ")}</p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">{fmtINRFull(v.mrr ?? 0)}</span>
                </div>
              ))}
            </div>
            <Link href="/vendors"><Button variant="outline" size="sm" className="mt-3 w-full"><Building2 className="mr-2 h-4 w-4" /> Open vendors</Button></Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent transactions</CardTitle>
          <p className="text-xs text-muted-foreground">
            Open a transaction to see how it was paid, the UPI id or UTR, and who collected it.
          </p>
          <div className="relative mt-2 max-w-sm">
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
              <DataTable data={filtered.slice(0, q ? 20 : 8)} pageSize={8} onRowClick={row => setSelectedTxn(row)} columns={[
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

      <Dialog open={!!selectedTxn} onOpenChange={open => { if (!open) setSelectedTxn(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Transaction details</DialogTitle>
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
