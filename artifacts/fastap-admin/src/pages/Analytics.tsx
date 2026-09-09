import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageHeader } from "@/components/shared/Page";
import { EmptyState } from "@/components/shared/EmptyState";
import { Download, Loader2, TrendingUp, TrendingDown, Users, IndianRupee, AlertTriangle, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const AXIS = "hsl(var(--muted-foreground))";
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "var(--radius-surface)",
};

// The health buckets arrive from the API carrying raw hex (#22c55e / #eab308 / #ef4444),
// which is the one place a page cannot honour the theme. Mapped to the semantic tokens
// by band so the same three colours mean the same three things everywhere.
const HEALTH_TONE: { match: RegExp; fill: string; badge: "success" | "warning" | "danger" }[] = [
  { match: /healthy/i, fill: "hsl(var(--success))", badge: "success" },
  { match: /risk/i, fill: "hsl(var(--warning))", badge: "warning" },
  { match: /critical/i, fill: "hsl(var(--danger))", badge: "danger" },
];
function healthTone(name: string) {
  return HEALTH_TONE.find(t => t.match.test(name)) ?? { fill: COLORS[0], badge: "muted" as const };
}

function fmt(n: number) {
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtKpiValue(v: number | string) {
  return typeof v === "number" ? fmt(v) : v;
}

const REVENUE_PERIODS: [string, string][] = [["all","All time"],["today","Today"],["week","7 Days"],["fortnight","15 Days"],["month","30 Days"],["year","1 Year"]];

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("revenue");
  const [period, setPeriod] = useState("all");
  const { toast } = useToast();

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ["superadmin-analytics-summary", period],
    queryFn: () => api.analytics.summary(period),
  });

  const { data: revenueSeries = [] } = useQuery({
    queryKey: ["revenue-series"],
    queryFn: api.analytics.revenueSeries,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["superadmin-vendors"],
    // Must stay wrapped: passed bare, react-query hands the query context in as the
    // `includeDeleted` argument, and every count below then silently includes
    // soft-deleted vendors that no other screen shows.
    queryFn: () => api.vendors.list(),
  });

  const { data: plans = [] } = useQuery({ queryKey: ["plans"], queryFn: api.plans.list });

  const { data: extended } = useQuery({
    queryKey: ["analytics-extended"],
    queryFn: api.analytics.extended,
  });

  const revenueData = revenueSeries.map(r => ({
    name: r.name,
    revenue: r.value,
    commission: r.commission,
    orders: r.orders,
  }));

  const vendorTypeMap = vendors.reduce((acc: Record<string, number>, v: any) => {
    const t = v.businessType || "Restaurant";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const vendorTypes = Object.entries(vendorTypeMap).map(([name, value]) => ({ name, value }));

  // Plan prices, so a plan's monthly value is the plan's price — not, as before, the
  // sum of its vendors' *order* takings. That put ₹90,765 of guests' money under a
  // heading reading "Total MRR from subscriptions", nearly double the real ₹49,496.
  const planPrice: Record<string, number> = Object.fromEntries(
    (plans as any[]).map((p: any) => [p.id, Number(p.price) || 0]),
  );
  const planMap = vendors.reduce((acc: Record<string, { value: number; sales: number; mrr: number }>, v: any) => {
    const p = v.plan || "free";
    if (!acc[p]) acc[p] = { value: 0, sales: 0, mrr: 0 };
    acc[p].value += 1;
    acc[p].sales += Number(v.revenue) || 0;
    acc[p].mrr += v.isActive === false ? 0 : (planPrice[p] ?? 0);
    return acc;
  }, {});
  const planData = Object.entries(planMap).map(([name, data]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: data.value,
    sales: data.sales,
    mrr: data.mrr,
  }));

  const forecastData = extended?.forecastData ?? [];
  const churnData = extended?.churnData ?? [];
  const healthData = extended?.healthData ?? [];
  const churnRiskVendors = extended?.churnRiskVendors ?? [];
  const revenueKpis = extended?.revenueKpis ?? [];
  const forecastSummary = extended?.forecastSummary;

  const dormant = vendors.filter((v: any) => !v.isActive || (v.totalOrders ?? 0) === 0);
  const dormantList = dormant.slice(0, 10).map((v: any) => ({
    id: v.id,
    name: v.name,
    lastOrder: v.totalOrders ? `${v.totalOrders} orders` : "none",
    plan: v.plan || "free",
    // The plan's monthly value — what stops being invoiced if this venue leaves.
    mrr: v.isActive === false ? 0 : (planPrice[v.plan || "free"] ?? 0),
  }));

  const dormantCount = dormant.length;
  const dormantMrr = dormant.reduce(
    (s: number, v: any) => s + (v.isActive === false ? 0 : (planPrice[v.plan || "free"] ?? 0)),
    0,
  );

  const handleExport = async (format: string) => {
    try {
      await api.exportCenter.create({ module: "analytics", format, filters: {} });
      toast({ title: `Export queued as ${format.toUpperCase()}`, description: "Check the Export Centre for status." });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Takings, plan mix, churn signals and vendor health across the platform."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="mr-2 h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("excel")}><Download className="mr-2 h-4 w-4" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}><Download className="mr-2 h-4 w-4" /> PDF</Button>
          </>
        }
      />

      {/* Revenue period selector — scopes the revenue/commission KPIs (7/15/30 days …). */}
      <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-md bg-muted p-1">
        {REVENUE_PERIODS.map(([p, label]) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={`shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>These figures could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            The dashes below are missing data, not zeroes.
            <Button variant="outline" size="sm" onClick={() => { void refetch(); }}>Try again</Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Vendors" value={summary ? summary.totalVendors.toLocaleString() : "—"} icon={<Users />} />
          <KpiCard title="Venue sales" value={summary ? fmt(summary.totalRevenue) : "—"} icon={<IndianRupee />} subtitle="Orders and spa, all venues" />
          <KpiCard title="Platform commission" value={summary ? fmt(summary.platformCommission) : "—"} icon={<TrendingUp />} subtitle="The platform's own income" />
          <KpiCard title="Contracted MRR" value={summary ? fmt(summary.mrr) : "—"} icon={<BarChart3 />} subtitle="Plan value, not collected" />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="churn">Churn</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="dormant">Dormant</TabsTrigger>
        </TabsList>

        {/* REVENUE TAB */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Monthly takings and commission</CardTitle></CardHeader>
              <CardContent>
                {revenueData.length === 0 ? (
                  <EmptyState title="No months to chart yet" description="This fills once a month of paid orders has closed." />
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => fmt(v)} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, ""]} />
                        <Bar dataKey="revenue" name="Takings" fill="hsl(var(--chart-1))" radius={[4,4,0,0]} />
                        <Bar dataKey="commission" name="Commission" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Monthly orders</CardTitle></CardHeader>
              <CardContent>
                {revenueData.length === 0 ? (
                  <EmptyState title="No months to chart yet" description="This fills once a month of paid orders has closed." />
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Area type="monotone" dataKey="orders" name="Orders" stroke="hsl(var(--chart-3))" fill="url(#colorOrders)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {revenueKpis.map((item: any, i: number) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{fmtKpiValue(item.value)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.trend}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* FORECAST TAB */}
        <TabsContent value="forecast" className="mt-4 space-y-4">
          {/* The forecast is a straight-line projection off the trailing months. With
              under two months of history — which is the case today — it falls back to a
              flat 8% month-on-month step, so the curve is a constant, not a measurement.
              It used to be labelled "AI-powered revenue prediction". */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>This projection is arithmetic, not a measurement</AlertTitle>
            <AlertDescription>
              It extends the trailing months forward at a fixed growth step. With less than two
              months of trading history it uses a default rate, so the curve says more about the
              assumption than about the business.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Projected takings — next 6 months</CardTitle>
            </CardHeader>
            <CardContent>
              {forecastData.length === 0 ? (
                <EmptyState title="Not enough history to project" description="A projection needs at least one closed month of trading." />
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecastData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => fmt(v)} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => v ? [`₹${Number(v).toLocaleString("en-IN")}`, ""] : ["—", ""]} />
                      <Legend />
                      <Line type="monotone" dataKey="actual" name="Actual" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="forecast" name="Projected" stroke="hsl(var(--chart-3))" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Projected takings (6mo)", value: forecastSummary ? fmt(forecastSummary.projectedRevenue) : "—", note: "At the assumed growth step" },
              { title: "Commission projected", value: forecastSummary ? fmt(forecastSummary.commissionForecast) : "—", note: "At the platform commission rate" },
              { title: "Vendors", value: forecastSummary ? String(forecastSummary.vendorCount) : "—", note: "Registered on the platform" },
              { title: "MRR at churn risk", value: forecastSummary ? fmt(forecastSummary.churnRiskMrr) : "—", note: "Plan value of at-risk venues" },
            ].map((item, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.title}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* VENDORS TAB */}
        <TabsContent value="vendors" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Vendors by venue type</CardTitle></CardHeader>
              <CardContent>
                {vendorTypes.length === 0 ? (
                  <EmptyState title="No vendors yet" description="Onboard a venue and it appears here." />
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={vendorTypes} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                          {vendorTypes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Plan mix</CardTitle>
              </CardHeader>
              <CardContent>
                {planData.length === 0 ? (
                  <EmptyState title="No plans in use" description="Assign a vendor to a plan and it appears here." />
                ) : (
                  <div className="space-y-3">
                    {planData.map((plan, i) => (
                      <div key={i} className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-sm font-medium">{plan.name}</span>
                          <Badge variant="muted">{plan.value} {plan.value === 1 ? "vendor" : "vendors"}</Badge>
                        </div>
                        <div className="text-right text-sm">
                          <span className="tabular-nums font-medium">{plan.mrr > 0 ? `${fmt(plan.mrr)}/mo` : "Free"}</span>
                          <p className="text-xs text-muted-foreground tabular-nums">{fmt(plan.sales)} venue sales</p>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Contracted MRR</p>
                      <p className="text-xl font-semibold tabular-nums">{fmt(planData.reduce((s, p) => s + p.mrr, 0))}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        The value of the plans venues are on. Nothing has been collected against it.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CHURN TAB */}
        <TabsContent value="churn" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Vendors gained and lost</CardTitle></CardHeader>
            <CardContent>
              {churnData.length === 0 ? (
                <EmptyState title="No months to compare" description="This fills once the platform has a month of history." />
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={churnData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend />
                      <Bar dataKey="new" name="New" fill="hsl(var(--chart-1))" radius={[4,4,0,0]} />
                      <Bar dataKey="churned" name="Churned" fill="hsl(var(--danger))" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Vendors at risk of leaving</CardTitle>
            </CardHeader>
            <CardContent>
              {churnRiskVendors.length === 0 ? (
                <EmptyState title="No vendors flagged" description="Nothing currently trips the churn signals." />
              ) : (
                <div className="space-y-3">
                  {churnRiskVendors.map((v: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{v.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {v.signals.map((s: string, j: number) => <Badge key={j} variant="warning">{s}</Badge>)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium tabular-nums text-danger">{v.score}% risk</p>
                        <Badge variant="outline" className="capitalize">{v.plan}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HEALTH SCORE TAB */}
        <TabsContent value="health" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {healthData.map((h: any, i: number) => {
              const tone = healthTone(h.name);
              return (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">{h.name}</p>
                        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{h.value}</p>
                        <p className="text-xs text-muted-foreground">vendors</p>
                      </div>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tone.fill }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Health score distribution</CardTitle></CardHeader>
            <CardContent>
              {healthData.length === 0 ? (
                <EmptyState title="No health scores yet" description="Scores appear once vendors have trading history." />
              ) : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={healthData} cx="50%" cy="50%" outerRadius={100} paddingAngle={4} dataKey="value">
                        {healthData.map((h: any, i: number) => <Cell key={i} fill={healthTone(h.name).fill} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DORMANT TAB */}
        <TabsContent value="dormant" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard title="Dormant vendors" value={dormantCount} icon={<Users />} subtitle="Switched off, or no orders" />
            <KpiCard title="MRR at risk" value={fmt(dormantMrr)} icon={<IndianRupee />} subtitle="Plan value of those venues" />
            <KpiCard title="Trading vendors" value={vendors.length - dormantCount} icon={<TrendingUp />} />
          </div>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">Dormant vendors</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => api.communications.send({ channel: "email", subject: "We miss you", message: "Your restaurant account has been inactive.", target: "dormant_vendors" }).then(() => toast({ title: `Reminder queued for ${dormantCount} dormant vendors` })).catch(() => toast({ title: "Failed to send", variant: "destructive" }))}>Send reminder to all</Button>
                  <Button variant="outline" size="sm" onClick={() => api.tasks.create({ title: "Follow up dormant vendors", module: "CRM", priority: "medium" }).then(() => toast({ title: "Follow-up task created" })).catch(() => toast({ title: "Failed", variant: "destructive" }))}>Create follow-up task</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dormantList.length === 0 ? (
                <EmptyState title="No dormant vendors" description="Every venue is switched on and trading." />
              ) : (
                <div className="space-y-3">
                  {dormantList.map((v, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground">Orders: {v.lastOrder}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge variant="outline" className="capitalize">{v.plan}</Badge>
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">₹{v.mrr.toLocaleString("en-IN")}/mo</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => api.vendorCrm.remind({ vendorId: v.id, vendorName: v.name }).then(() => toast({ title: `Reminder sent to ${v.name}` })).catch(() => toast({ title: "Failed to send", variant: "destructive" }))}>Remind</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
