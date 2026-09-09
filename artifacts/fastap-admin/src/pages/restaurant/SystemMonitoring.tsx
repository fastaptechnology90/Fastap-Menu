import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Cpu, Database, Gauge, HardDrive, RefreshCw, Timer } from "lucide-react";

import { useRestaurant } from "@/contexts/RestaurantContext";
import { monitoringApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

/**
 * What the service is actually doing right now.
 *
 * Every figure this screen used to plot came from `Math.random()` on the server, against
 * a hardcoded 99.87% uptime and a fixed list of invented incidents — so it reported "All
 * Systems Healthy" whether or not anything was up, which is worse during an outage than
 * showing nothing. The server now measures process CPU and memory, counts requests,
 * errors and latency through the router, and pings the database.
 *
 * The rule this screen keeps: a number appears only if something measured it. Anything
 * the server cannot measure comes back null and is shown as "Not measured", never as a
 * zero or a plausible-looking figure — an operator has to be able to tell "healthy" from
 * "we don't know".
 */

type Metrics = {
  uptime: number | null;
  uptime_seconds?: number;
  started_at?: string;
  cpu_usage?: string | number;
  memory_usage?: string | number;
  memory_rss_bytes?: number;
  db_connections: number | null;
  db_response_ms?: number | null;
  api_requests_today?: number;
  api_errors_today?: number;
  avg_response_ms?: number | null;
  requests_in_flight?: number;
  peak_concurrent_requests?: number;
  load_average_1m: number | null;
  active_sessions?: number;
  queue_size?: number;
  last_checked?: string;
};

type Health = {
  status: string;
  components: Record<string, { status: string; latency_ms?: number; pending?: number }>;
};

type LogRow = { id: number; level: string; message: string; service: string; timestamp: string; count: number; resolved: boolean };

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

function duration(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function Tile({
  label, value, sub, icon: Icon, tone = "text-foreground",
}: {
  label: string; value: string; sub?: string; icon: typeof Cpu; tone?: string;
}) {
  const measured = value !== "Not measured";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${measured ? tone : "text-muted-foreground"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const LEVEL_TONE: Record<string, string> = {
  error: "bg-danger-subtle text-danger",
  warn: "bg-primary/15 text-primary",
  warning: "bg-primary/15 text-primary",
  info: "bg-muted text-muted-foreground",
};

export default function SystemMonitoring() {
  const { restaurantId } = useRestaurant();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (announce = false) => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [m, h, l] = await Promise.all([
        monitoringApi.metrics(restaurantId),
        monitoringApi.health(restaurantId),
        monitoringApi.logs(restaurantId).catch(() => []),
      ]);
      setMetrics(m);
      setHealth(h);
      setLogs(Array.isArray(l) ? l : []);
      setError(null);
      if (announce) toast({ title: "Refreshed", description: "Readings taken just now." });
    } catch (e) {
      // The one screen that must not claim health it cannot verify: an unreachable
      // server is itself the finding, so it is stated rather than hidden.
      setError(e instanceof Error ? e.message : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  if (loading && !metrics) return <div className="p-6 text-center text-sm text-muted-foreground">Reading system state…</div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-danger-border bg-danger-subtle p-5 text-sm text-danger">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Could not read system state</div>
          <p className="mt-2 text-danger">{error}</p>
          <p className="mt-1 text-danger">Treat this as a possible outage rather than as healthy — nothing here has been checked.</p>
          <button onClick={() => load(true)} className="mt-4 rounded-lg border border-danger-border px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-subtle">Try again</button>
        </div>
      </div>
    );
  }

  const cpu = num(metrics?.cpu_usage);
  const mem = num(metrics?.memory_usage);
  const rss = metrics?.memory_rss_bytes;
  const requests = metrics?.api_requests_today;
  const errors = metrics?.api_errors_today;
  const errorRate = requests && requests > 0 && errors != null ? (errors / requests) * 100 : null;
  const healthy = health?.status === "healthy";

  return (
    <div className="space-y-4 p-4 text-foreground sm:p-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">System Monitoring</h1>
          <p className="text-xs text-muted-foreground">
            {metrics?.last_checked ? `Read at ${new Date(metrics.last_checked).toLocaleTimeString("en-IN")}` : "Live readings"}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className={`rounded-lg border p-4 ${healthy ? "border-success-border bg-success-subtle" : "border-primary/25 bg-primary/10"}`}>
        <div className="flex items-center gap-2">
          <Activity className={`h-4 w-4 ${healthy ? "text-success" : "text-primary"}`} />
          <span className={`font-semibold ${healthy ? "text-success" : "text-primary"}`}>
            {healthy ? "All checks passing" : `Status: ${health?.status ?? "unknown"}`}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(health?.components ?? {}).map(([name, c]) => (
            <span
              key={name}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${c.status === "up" ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}
            >
              {name}: {c.status}
              {c.latency_ms != null && ` · ${c.latency_ms}ms`}
              {c.pending != null && ` · ${c.pending} pending`}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={Cpu} label="CPU" tone="text-info"
          value={cpu == null ? "Not measured" : `${cpu}%`}
          sub="This process"
        />
        <Tile
          icon={HardDrive} label="Memory" tone="text-muted-foreground"
          value={mem == null ? "Not measured" : `${mem}%`}
          sub={rss ? `${(rss / 1024 / 1024).toFixed(0)} MB resident` : undefined}
        />
        <Tile
          icon={Timer} label="Uptime" tone="text-success"
          value={metrics?.uptime_seconds ? duration(metrics.uptime_seconds) : "Not measured"}
          sub={metrics?.started_at ? `Since ${new Date(metrics.started_at).toLocaleString("en-IN")}` : "Process uptime, not service uptime"}
        />
        <Tile
          icon={Database} label="Database" tone="text-primary"
          value={metrics?.db_response_ms == null ? "Not measured" : `${metrics.db_response_ms} ms`}
          sub={metrics?.db_connections == null ? "Pool size not exposed" : `${metrics.db_connections} connections`}
        />
        <Tile
          icon={Gauge} label="Requests today" tone="text-foreground"
          value={requests == null ? "Not measured" : requests.toLocaleString("en-IN")}
          sub={metrics?.requests_in_flight != null ? `${metrics.requests_in_flight} in flight now` : undefined}
        />
        <Tile
          icon={AlertTriangle} label="Errors today" tone={errors ? "text-danger" : "text-success"}
          value={errors == null ? "Not measured" : String(errors)}
          sub={errorRate == null ? undefined : `${errorRate.toFixed(2)}% of requests`}
        />
        <Tile
          icon={Timer} label="Avg response" tone="text-info"
          value={metrics?.avg_response_ms == null ? "Not measured" : `${metrics.avg_response_ms} ms`}
          sub={metrics?.peak_concurrent_requests != null ? `Peak ${metrics.peak_concurrent_requests} concurrent` : undefined}
        />
        <Tile
          icon={Activity} label="Active sessions" tone="text-foreground"
          value={metrics?.active_sessions == null ? "Not measured" : metrics.active_sessions.toLocaleString("en-IN")}
          sub={metrics?.queue_size != null ? `${metrics.queue_size} queued` : undefined}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Recent activity</p>
        {logs.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <div className="mt-3 max-h-80 overflow-y-auto">
            <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {logs.slice(0, 40).map(l => (
                    <tr key={l.id}>
                      <td className="py-2 pr-2 w-20">
                        <span className={`rounded-md px-2 py-0.5 text-2xs font-semibold uppercase ${LEVEL_TONE[l.level] ?? LEVEL_TONE.info}`}>{l.level}</span>
                      </td>
                      <td className="py-2 pr-2 text-foreground">{l.message}</td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">{l.service}</td>
                      <td className="py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.timestamp).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Uptime here is how long this server process has been running, not a service-level
        uptime figure — nothing on the platform records outage history yet, so no percentage
        is claimed.
      </p>
    </div>
  );
}
