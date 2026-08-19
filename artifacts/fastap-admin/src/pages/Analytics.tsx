import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/KpiCard";
import { Download, Loader2, TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function fmt(n: number) {
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtKpiValue(v: number | string) {
  return typeof v === "number" ? fmt(v) : v;
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("revenue");
  const { toast } = useToast();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["superadmin-analytics-summary"],
    queryFn: api.analytics.summary,
  });

  const { data: revenueSeries = [] } = useQuery({
    queryKey: ["revenue-series"],
    queryFn: api.analytics.revenueSeries,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["superadmin-vendors"],
    queryFn: api.vendors.list,
  });

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

  const planMap = vendors.reduce((acc: Record<string, { value: number; revenue: number }>, v: any) => {
    const p = v.plan || "free";
    if (!acc[p]) acc[p] = { value: 0, revenue: 0 };
    acc[p].value += 1;
    // Revenue per plan = the sum of that plan's vendors' real (paid-order) revenue.
    // It grows as orders come in — no hard-coded plan prices.
    acc[p].revenue += Number(v.revenue) || 0;
    return acc;
  }, {});
  const planData = Object.entries(planMap).map(([name, data]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: data.value,
    revenue: data.revenue,
  }));

  const forecastData = extended?.forecastData ?? [];
  const churnData = extended?.churnData ?? [];
  const healthData = extended?.healthData ?? [];
  const churnRiskVendors = extended?.churnRiskVendors ?? [];
  const revenueKpis = extended?.revenueKpis ?? [];
  const forecastSummary = extended?.forecastSummary;

  const dormantList = vendors
    .filter((v: any) => !v.isActive || (v.totalOrders ?? 0) === 0)
    .slice(0, 10)
    .map((v: any) => ({
      id: v.id,
      name: v.name,
      lastLogin: "—",
      lastOrder: v.totalOrders ? `${v.totalOrders} orders` : "none",
      plan: v.plan || "free",
      mrr: Number(v.revenue) || 0,
    }));

  const dormantCount = vendors.filter((v: any) => !v.isActive || (v.totalOrders ?? 0) === 0).length;
  const dormantMrr = dormantList.reduce((s, v) => s + v.mrr, 0);

  const handleExport = async (format: string) => {
    try {
      await api.exportCenter.create({ module: "analytics", format, filters: {} });
      toast({ title: `Export queued as ${format.toUpperCase()}`, description: "Check Export Center for status." });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics & Reporting</h2>
          <p className="text-muted-foreground">Revenue forecasts, vendor intelligence, and churn prediction.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="mr-2 h-4 w-4" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}><Download className="mr-2 h-4 w-4" /> Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}><Download className="mr-2 h-4 w-4" /> PDF</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Total Vendors" value={summary ? summary.totalVendors.toLocaleString() : "—"} icon={<Users className="h-4 w-4 text-primary" />} />
          <KpiCard title="Total Revenue" value={summary ? fmt(summary.totalRevenue) : "—"} icon={<DollarSign className="h-4 w-4 text-green-500" />} />
          <KpiCard title="Platform Commission" value={summary ? fmt(summary.platformCommission) : "—"} icon={<TrendingUp className="h-4 w-4 text-blue-500" />} />
          <KpiCard title="MRR (est.)" value={summary ? fmt(summary.mrr) : "—"} icon={<BarChart3 className="h-4 w-4 text-purple-500" />} />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="churn">Churn</TabsTrigger>
          <TabsTrigger value="health">Health Score</TabsTrigger>
          <TabsTrigger value="dormant">Dormant</TabsTrigger>
        </TabsList>

        {/* REVENUE TAB */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Monthly Revenue & Commission</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `₹${v/1000}K`} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, ""]} />
                      <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4,4,0,0]} opacity={0.8} />
                      <Bar dataKey="commission" name="Commission" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Monthly Orders</CardTitle></CardHeader>
              <CardContent>
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
                      <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                      <Area type="monotone" dataKey="orders" name="Orders" stroke="hsl(var(--chart-3))" fill="url(#colorOrders)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(revenueKpis.length ? revenueKpis : []).map((item: any, i: number) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-bold mt-1">{fmtKpiValue(item.value)}</p>
                  <p className={`text-xs mt-1 ${item.up === true ? "text-green-500" : item.up === false ? "text-red-500" : "text-muted-foreground"}`}>{item.trend}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* FORECAST TAB */}
        <TabsContent value="forecast" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Forecast — Next 6 Months</CardTitle>
              <p className="text-sm text-muted-foreground">AI-powered revenue prediction based on current growth trajectory.</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `₹${v/1000}K`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} formatter={(v: any) => v ? [`₹${Number(v).toLocaleString("en-IN")}`, ""] : ["—", ""]} />
                    <Legend />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5 }} />
                    <Line type="monotone" dataKey="forecast" name="Forecast (AI)" stroke="hsl(var(--chart-3))" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: "Projected Revenue (6mo)", value: forecastSummary ? fmt(forecastSummary.projectedRevenue) : "—", note: "Based on recent growth", up: true },
              { title: "Commission Forecast", value: forecastSummary ? fmt(forecastSummary.commissionForecast) : "—", note: "At platform commission rate", up: true },
              { title: "Active Vendors", value: forecastSummary ? String(forecastSummary.vendorCount) : "—", note: "Registered on platform", up: null },
              { title: "Churn Risk MRR", value: forecastSummary ? fmt(forecastSummary.churnRiskMrr) : "—", note: "At-risk subscription revenue", up: false },
            ].map((item, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{item.title}</p>
                  <p className="text-2xl font-bold mt-1">{item.value}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {item.up === true && <TrendingUp className="h-3 w-3 text-green-500" />}
                    {item.up === false && <TrendingDown className="h-3 w-3 text-red-500" />}
                    <p className={`text-xs ${item.up === true ? "text-green-500" : item.up === false ? "text-red-500" : "text-muted-foreground"}`}>{item.note}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* VENDORS TAB */}
        <TabsContent value="vendors" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Vendor Type Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={vendorTypes} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {vendorTypes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Plan Distribution & MRR</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {planData.map((plan, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                          <span className="font-medium">{plan.name}</span>
                          <Badge variant="outline" className="text-xs">{plan.value} vendors</Badge>
                        </div>
                        <span className="text-muted-foreground font-medium">{plan.revenue > 0 ? fmt(plan.revenue) : "Free"}</span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground">Total MRR from subscriptions</p>
                    <p className="text-xl font-bold">{fmt(planData.reduce((s, p) => s + p.revenue, 0))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CHURN TAB */}
        <TabsContent value="churn" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Vendor Acquisition vs Churn</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={churnData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                    <Legend />
                    <Bar dataKey="new" name="New Vendors" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
                    <Bar dataKey="churned" name="Churned" fill="hsl(var(--destructive))" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Churn Risk Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {churnRiskVendors.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No high-risk vendors detected.</p>
                ) : churnRiskVendors.map((v: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{v.name}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {v.signals.map((s, j) => <Badge key={j} variant="destructive" className="text-xs px-1.5">{s}</Badge>)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-500">{v.score}% risk</p>
                      <Badge variant="outline" className="text-xs capitalize">{v.plan}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HEALTH SCORE TAB */}
        <TabsContent value="health" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {healthData.map((h, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{h.name}</p>
                      <p className="text-3xl font-bold mt-1">{h.value}</p>
                      <p className="text-xs text-muted-foreground">vendors</p>
                    </div>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: h.color + "20" }}>
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: h.color }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>Health Score Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={healthData} cx="50%" cy="50%" outerRadius={100} paddingAngle={4} dataKey="value">
                      {healthData.map((h, i) => <Cell key={i} fill={h.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DORMANT TAB */}
        <TabsContent value="dormant" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="Dormant Vendors" value={dormantCount} icon={<Users className="h-4 w-4 text-yellow-500" />} />
            <KpiCard title="At-Risk MRR" value={fmt(dormantMrr)} icon={<DollarSign className="h-4 w-4 text-red-500" />} />
            <KpiCard title="Inactive / No Orders" value={dormantCount} icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} />
          </div>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Dormant Vendor List</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => api.communications.send({ channel: "email", subject: "We miss you", message: "Your restaurant account has been inactive.", target: "dormant_vendors" }).then(() => toast({ title: `Reminder queued for ${dormantCount} dormant vendors` })).catch(() => toast({ title: "Failed to send", variant: "destructive" }))}>Send Reminder (All)</Button>
                  <Button variant="outline" size="sm" onClick={() => api.tasks.create({ title: "Follow up dormant vendors", module: "CRM", priority: "medium" }).then(() => toast({ title: "Follow-up task created" })).catch(() => toast({ title: "Failed", variant: "destructive" }))}>Create Follow-up Tasks</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dormantList.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No dormant vendors.</p>
                ) : dormantList.map((v, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{v.name}</p>
                      <p className="text-xs text-muted-foreground">Last login: {v.lastLogin} · Last order: {v.lastOrder}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs capitalize">{v.plan}</Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">₹{v.mrr}/mo</p>
                      </div>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => api.vendorCrm.remind({ vendorId: v.id, vendorName: v.name }).then(() => toast({ title: `Reminder sent to ${v.name}` })).catch(() => toast({ title: "Failed to send", variant: "destructive" }))}>Remind</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
