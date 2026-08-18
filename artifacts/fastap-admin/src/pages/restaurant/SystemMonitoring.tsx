import { useState, useEffect, useRef } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { monitoringApi } from "@/lib/api";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { publicationEmptyMessage } from "@/lib/restaurantPublication";
import { Activity, Cpu, Database, Server, AlertTriangle, CheckCircle, RefreshCw, Clock, Wifi, AlertOctagon, BarChart3, TrendingUp, TrendingDown, Eye } from "lucide-react";

type ErrorLog = { id: string; level: string; service: string; message: string; timestamp: string; count: number };
type HistoryPoint = { time: string; cpu: number; mem: number; rps: number; latency: number };

type Tab = "overview"|"services"|"logs"|"performance";

export default function SystemMonitoring() {
  const { restaurantId, restaurant, isRestaurantPublished } = useRestaurant();
  const [tab, setTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState({ cpu:0, mem:0, dbLatency:0, apiLatency:0, rps:0, activeSessions:0, uptime:"—" });
  const [services, setServices] = useState<{ name: string; status: string; uptime: string; responseTime: number; port: number | null }[]>([]);
  const [healthStatus, setHealthStatus] = useState("healthy");
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [logFilter, setLogFilter] = useState("all");
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [metricHistory, setMetricHistory] = useState<HistoryPoint[]>([]);
  const [peaks, setPeaks] = useState<Record<string, string>>({});
  const intervalRef = useRef<any>(null);

  async function loadHistory() {
    if (!restaurantId) return;
    try {
      const data = await monitoringApi.history(restaurantId);
      if (Array.isArray(data?.history)) setMetricHistory(data.history);
      if (data?.peaks) setPeaks(data.peaks);
    } catch {}
  }

  async function loadLogs() {
    if (!restaurantId) return;
    try {
      const rows = await monitoringApi.logs(restaurantId);
      if (Array.isArray(rows)) {
        setErrorLogs(rows.map((l: any) => ({
          id: String(l.id),
          level: l.level || "info",
          service: l.service || "API Server",
          message: l.message || l.action || "",
          timestamp: l.timestamp ? formatLogTime(l.timestamp) : "—",
          count: l.count ?? 1,
        })));
      } else setErrorLogs([]);
    } catch {}
  }

  function formatLogTime(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  async function refreshMetrics() {
    if (!restaurantId) return;
    if (!isRestaurantPublished) {
      setMetrics({ cpu: 0, mem: 0, dbLatency: 0, apiLatency: 0, rps: 0, activeSessions: 0, uptime: "—" });
      setServices([]);
      setHealthStatus("standby");
      setMetricHistory([]);
      setPeaks({});
      setErrorLogs([]);
      setLastRefresh(new Date());
      return;
    }
    setLoading(true);
    try {
      const [d, health] = await Promise.all([
        monitoringApi.metrics(restaurantId),
        monitoringApi.health(restaurantId).catch(() => null),
      ]);
      if (d && !d.error) {
        setMetrics(m => ({
          ...m,
          cpu: parseFloat(d.cpu_usage ?? m.cpu),
          mem: parseFloat(d.memory_usage ?? m.mem),
          dbLatency: d.db_response_ms ?? m.dbLatency,
          apiLatency: d.avg_response_ms ?? m.apiLatency,
          rps: d.api_requests_today ? Math.floor(d.api_requests_today / 1440) : m.rps,
          activeSessions: d.active_sessions ?? m.activeSessions,
          uptime: d.uptime_seconds ? `${Math.floor(d.uptime_seconds / 86400)}d ${Math.floor((d.uptime_seconds % 86400) / 3600)}h` : m.uptime,
        }));
      }
      if (health?.components) {
        setHealthStatus(health.status || "healthy");
        const c = health.components;
        setServices([
          { name: "API Server", status: c.api?.status === "up" ? "healthy" : "down", uptime: "Live", responseTime: c.api?.latency_ms ?? 0, port: 8080 },
          { name: "Database", status: c.database?.status === "up" ? "healthy" : "down", uptime: "Live", responseTime: c.database?.latency_ms ?? 0, port: 5432 },
          { name: "Sessions", status: c.sessions?.status === "up" ? "healthy" : "degraded", uptime: "Live", responseTime: 0, port: null },
          { name: "Queue", status: c.queue?.status === "up" ? "healthy" : "degraded", uptime: "Live", responseTime: 0, port: null },
          { name: "Notifications", status: c.notifications?.status === "up" ? "healthy" : "degraded", uptime: "Live", responseTime: 0, port: null },
        ]);
      }
    } catch {}
    setLastRefresh(new Date());
    setLoading(false);
    await loadHistory();
  }

  useEffect(() => {
    if (!restaurantId) return;
    refreshMetrics();
    if (isRestaurantPublished) {
      loadLogs();
      loadHistory();
    }
    intervalRef.current = setInterval(() => {
      refreshMetrics();
      if (isRestaurantPublished) loadLogs();
    }, 30000);
    return () => clearInterval(intervalRef.current);
  }, [restaurantId, isRestaurantPublished]);

  const logList = errorLogs;
  const filteredLogs = logFilter==="all" ? logList : logList.filter(l=>l.level===logFilter);
  const serviceList = services;
  const overallHealth = serviceList.length ? (serviceList.every(s=>s.status==="healthy") ? "healthy" : serviceList.some(s=>s.status==="down") ? "down" : "degraded") : healthStatus;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold">System Monitoring</h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${overallHealth==="healthy"?"bg-emerald-500/20 text-emerald-400":overallHealth==="degraded"?"bg-yellow-500/20 text-yellow-400":"bg-red-500/20 text-red-400"}`}>
              <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${overallHealth==="healthy"?"bg-emerald-400":overallHealth==="degraded"?"bg-yellow-400":"bg-red-400"}`}/>
              {overallHealth==="healthy"?"All Systems Healthy":overallHealth==="degraded"?"Degraded":"System Down"}
            </div>
          </div>
          <p className="text-xs text-white/40">Last refresh: {lastRefresh.toLocaleTimeString()}</p>
        </div>
        <button onClick={refreshMetrics} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold disabled:opacity-50 transition-all">
          <RefreshCw className={`h-4 w-4 text-amber-400 ${loading?"animate-spin":""}`}/>{loading?"Refreshing...":"Refresh"}
        </button>
      </div>

      {!isRestaurantPublished && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
          <p className="text-sm font-semibold text-amber-200">Monitoring metrics unavailable</p>
          <p className="text-xs text-white/50 mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"CPU Usage",value:`${metrics.cpu}%`,icon:Cpu,color:metrics.cpu>80?"text-red-400":metrics.cpu>60?"text-yellow-400":"text-emerald-400",bg:metrics.cpu>80?"bg-red-500/10":metrics.cpu>60?"bg-yellow-500/10":"bg-emerald-500/10",bar:metrics.cpu},
          {label:"Memory",value:`${metrics.mem}%`,icon:Server,color:metrics.mem>85?"text-red-400":metrics.mem>70?"text-yellow-400":"text-blue-400",bg:metrics.mem>85?"bg-red-500/10":metrics.mem>70?"bg-yellow-500/10":"bg-blue-500/10",bar:metrics.mem},
          {label:"Req/sec",value:metrics.rps,icon:Activity,color:"text-violet-400",bg:"bg-violet-500/10",bar:Math.min(100,metrics.rps)},
          {label:"API Latency",value:`${metrics.apiLatency}ms`,icon:Clock,color:metrics.apiLatency>200?"text-red-400":metrics.apiLatency>100?"text-yellow-400":"text-teal-400",bg:"bg-teal-500/10",bar:Math.min(100,metrics.apiLatency/5)},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`h-4 w-4 ${s.color}`}/>
              <span className="text-xs text-white/40">{s.label}</span>
            </div>
            <p className={`text-2xl font-extrabold ${s.color} mb-2`}>{s.value}</p>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full bg-current transition-all`} style={{width:`${s.bar}%`,color:"inherit"}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {label:"DB Response",value:`${metrics.dbLatency}ms`,color:"text-blue-400"},
          {label:"Active Sessions",value:metrics.activeSessions,color:"text-emerald-400"},
          {label:"Server Uptime",value:metrics.uptime,color:"text-amber-400"},
        ].map(s=>(
          <div key={s.label} className="bg-white/[0.03] border border-white/8 rounded-xl p-3 text-center">
            <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["overview","Overview"],["services","Services"],["logs","Error Logs"],["performance","Performance"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab==="overview"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Service Health</h3>
            <div className="space-y-2">
              {serviceList.length === 0 ? <EmptyState title="Loading services…" /> : serviceList.map(s=>(
                <div key={s.name} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${s.status==="healthy"?"bg-emerald-400 animate-pulse":s.status==="degraded"?"bg-yellow-400":"bg-red-400"}`}/>
                  <span className="flex-1 text-sm">{s.name}</span>
                  <span className="text-xs text-white/30">{s.uptime}</span>
                  <span className={`text-xs font-semibold ${s.responseTime>200?"text-red-400":s.responseTime>100?"text-yellow-400":"text-emerald-400"}`}>{s.responseTime}ms</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Recent Errors</h3>
            <div className="space-y-2">
              {logList.length === 0 ? <EmptyState title="No recent errors" /> : logList.slice(0,4).map(log=>(
                <div key={log.id} className={`p-3 rounded-xl text-xs ${log.level==="error"?"bg-red-500/8 border border-red-500/15":log.level==="warn"?"bg-yellow-500/8 border border-yellow-500/15":"bg-white/5 border border-white/8"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold uppercase ${log.level==="error"?"text-red-400":log.level==="warn"?"text-yellow-400":"text-blue-400"}`}>{log.level}</span>
                    <span className="text-white/30">{log.timestamp}</span>
                  </div>
                  <p className="text-white/60 truncate">{log.message}</p>
                  <p className="text-white/30 mt-0.5">{log.service} · {log.count} occurrence{log.count!==1?"s":""}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==="services"&&(
        <div className="space-y-3">
              {serviceList.length === 0 ? <EmptyState title="No service health data" /> : serviceList.map(s=>(
            <div key={s.name} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${s.status==="healthy"?"bg-emerald-500/15":s.status==="degraded"?"bg-yellow-500/15":"bg-red-500/15"}`}>
                  <Server className={`h-6 w-6 ${s.status==="healthy"?"text-emerald-400":s.status==="degraded"?"text-yellow-400":"text-red-400"}`}/>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold">{s.name}</h3>
                    {s.port&&<span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-md">:{s.port}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/40">
                    <span>Uptime: <span className="text-emerald-400 font-semibold">{s.uptime}</span></span>
                    <span>Response: <span className={`font-semibold ${s.responseTime>200?"text-red-400":s.responseTime>100?"text-yellow-400":"text-emerald-400"}`}>{s.responseTime}ms</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-bold capitalize ${s.status==="healthy"?"bg-emerald-500/20 text-emerald-400":s.status==="degraded"?"bg-yellow-500/20 text-yellow-400":"bg-red-500/20 text-red-400"}`}>{s.status}</span>
                  <button onClick={refreshMetrics} className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold hover:bg-white/5">Refresh</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="logs"&&(
        <div className="space-y-3">
          <div className="flex gap-2">
            {["all","error","warn","info"].map(l=>(
              <button key={l} onClick={()=>setLogFilter(l)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${logFilter===l?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>
                {l==="all"?"All Levels":l}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredLogs.map(log=>(
              <div key={log.id} className={`p-4 rounded-xl border ${log.level==="error"?"bg-red-500/8 border-red-500/15":log.level==="warn"?"bg-yellow-500/8 border-yellow-500/15":"bg-blue-500/8 border-blue-500/15"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded-md ${log.level==="error"?"bg-red-500/20 text-red-400":log.level==="warn"?"bg-yellow-500/20 text-yellow-400":"bg-blue-500/20 text-blue-400"}`}>{log.level}</span>
                      <span className="text-xs text-white/40">{log.service}</span>
                      {log.count>1&&<span className="text-xs bg-white/10 text-white/40 px-1.5 py-0.5 rounded-full">×{log.count}</span>}
                    </div>
                    <p className="text-sm text-white/80 font-mono text-xs">{log.message}</p>
                  </div>
                  <span className="text-xs text-white/30 shrink-0">{log.timestamp}</span>
                </div>
              </div>
            ))}
            {filteredLogs.length===0&&<div className="text-center py-12 text-white/30"><CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400/40"/><p>No {logFilter} logs found</p></div>}
          </div>
        </div>
      )}

      {tab==="performance"&&(
        <div className="space-y-4">
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Last 20 Minutes — CPU & Memory</h3>
            {metricHistory.length === 0 ? <EmptyState title="Collecting performance data…" description="Refresh to record live metrics." /> : (
            <div className="flex items-end gap-1 h-32">
              {metricHistory.map((m,i)=>(
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5" style={{height:"100px"}}>
                    <div className="flex-1 bg-blue-500/30 rounded-sm self-end" style={{height:`${Math.min(100, m.cpu)}%`}} title={`CPU: ${m.cpu}%`}/>
                    <div className="flex-1 bg-violet-500/30 rounded-sm self-end" style={{height:`${Math.min(100, m.mem)}%`}} title={`Mem: ${m.mem}%`}/>
                  </div>
                  {i%4===0&&<span className="text-xs text-white/20">{m.time}</span>}
                </div>
              ))}
            </div>
            )}
            <div className="flex gap-4 mt-2 text-xs text-white/40">
              <span className="flex items-center gap-1"><div className="h-2 w-4 rounded-sm bg-blue-500/30"/>CPU</span>
              <span className="flex items-center gap-1"><div className="h-2 w-4 rounded-sm bg-violet-500/30"/>Memory</span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {label:"Peak CPU Today",value:peaks.peakCpu ?? "—",color:"text-blue-400",trend:"up"},
              {label:"Peak Memory Today",value:peaks.peakMem ?? "—",color:"text-violet-400",trend:"up"},
              {label:"Peak RPS Today",value:peaks.peakRps ?? "—",color:"text-emerald-400",trend:"up"},
              {label:"Slowest Endpoint",value:peaks.slowestEndpoint ?? "—",sub:peaks.slowestLatency,color:"text-yellow-400",trend:"down"},
            ].map(s=>(
              <div key={s.label} className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-white/40">{s.label}</p>
                  {s.trend==="up" ? <TrendingUp className="h-3.5 w-3.5 text-red-400"/> : <TrendingDown className="h-3.5 w-3.5 text-emerald-400"/>}
                </div>
                <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                {(s as any).sub&&<p className="text-xs text-white/30">{(s as any).sub}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
