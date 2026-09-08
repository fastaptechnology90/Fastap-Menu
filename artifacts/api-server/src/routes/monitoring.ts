import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { runtimeSnapshot } from "../lib/runtime-metrics.js";
import {
  resolveAnalyticsAccess,
  sendAnalyticsNotFound,
  emptyMonitoringMetrics,
} from "../lib/restaurant-publication.js";
import {
  getMetricHistory,
  setMetricHistory,
  getPeakStats,
  setPeakStats,
  getErrorLogs,
  setErrorLogs,
} from "../lib/analytics-cache.js";

const router: IRouter = Router();

type HistoryPoint = { timestamp: string; cpu: number; mem: number; rps: number; latency: number };

function appendMetricHistory(rid: number, point: HistoryPoint) {
  const history = [...getMetricHistory(rid), point];
  if (history.length > 120) history.shift();
  setMetricHistory(rid, history);

  const peaks = getPeakStats(rid) ?? { peakCpu: 0, peakMem: 0, peakRps: 0, slowestLatency: 0 };
  peaks.peakCpu = Math.max(peaks.peakCpu, point.cpu);
  peaks.peakMem = Math.max(peaks.peakMem, point.mem);
  peaks.peakRps = Math.max(peaks.peakRps, point.rps);
  peaks.slowestLatency = Math.max(peaks.slowestLatency, point.latency);
  setPeakStats(rid, peaks);
}

/**
 * Every one of these was a random number, sitting beside a fixed "99.87%" uptime. They
 * are now readings: CPU and memory off this process, request and error counts and latency
 * off the API router's own counter, sessions off the session table.
 *
 * `uptime` was never measurable from inside a single process — there is no record of the
 * outages it would have to average over — so it reports null instead of a figure that
 * would be read as a service-level number.
 */
function generateMetrics() {
  const snap = runtimeSnapshot();
  return {
    uptime: null as string | null,
    uptime_seconds: snap.uptimeSeconds,
    started_at: snap.startedAt,
    cpu_usage: snap.cpuPercent.toFixed(1),
    memory_usage: snap.memoryPercent.toFixed(1),
    memory_rss_bytes: snap.memoryRssBytes,
    heap_used_bytes: snap.heapUsedBytes,
    db_connections: null as number | null,
    db_response_ms: 0,
    api_requests_today: snap.requestsToday,
    api_errors_today: snap.errorsToday,
    avg_response_ms: snap.avgResponseMs ?? 0,
    requests_in_flight: snap.requestsInFlight,
    peak_concurrent_requests: snap.peakConcurrentRequests,
    load_average_1m: snap.loadAverage1m,
    active_sessions: 0,
    queue_size: snap.requestsInFlight,
    last_checked: new Date().toISOString(),
  };
}

/**
 * A venue with no audit trail has no incidents to show. It used to be handed four
 * invented ones — including a database timeout and a memory warning that never happened.
 */
function ensureErrorLogs(rid: number) {
  return getErrorLogs(rid) ?? [];
}

router.get("/restaurants/:restaurantId/monitoring/metrics", requireAuth, async (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const access = await resolveAnalyticsAccess(req, rid);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json(emptyMonitoringMetrics()); return; }

  const metrics = generateMetrics();
  // The ping was issued in a shape the driver rejects, so it always threw: the database
  // never actually got checked and the latency beside it was a random number.
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    metrics.db_response_ms = Date.now() - start;
  } catch {
    metrics.db_response_ms = -1;
  }
  // Sessions that have not yet expired — a real count of who is signed in. The store is
  // the session table express writes, which drizzle does not model, hence the raw count.
  try {
    const rows = await db.execute(sql`SELECT COUNT(*)::int AS n FROM user_sessions WHERE expire > NOW()`);
    const first = (Array.isArray(rows) ? rows[0] : (rows as { rows?: { n?: number }[] }).rows?.[0]) as { n?: number } | undefined;
    metrics.active_sessions = Number(first?.n ?? 0);
  } catch {}
  const cpu = parseFloat(metrics.cpu_usage);
  const mem = parseFloat(metrics.memory_usage);
  const rps = Math.floor(metrics.api_requests_today / 1440);
  appendMetricHistory(rid, {
    timestamp: new Date().toISOString(),
    cpu,
    mem,
    rps,
    latency: metrics.avg_response_ms,
  });
  res.json({ isPublished: true, ...metrics });
});

router.get("/restaurants/:restaurantId/monitoring/history", requireAuth, async (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const access = await resolveAnalyticsAccess(req, rid);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") {
    res.json({
      isPublished: false,
      history: [],
      peaks: { peakCpu: "0%", peakMem: "0%", peakRps: "0", slowestEndpoint: "—", slowestLatency: "0ms" },
    });
    return;
  }

  const history = getMetricHistory(rid).slice(-20).map((p, i, arr) => {
    const minsAgo = arr.length - 1 - i;
    return {
      time: minsAgo === 0 ? "Now" : `${minsAgo}m`,
      cpu: Math.round(p.cpu),
      mem: Math.round(p.mem),
      rps: p.rps,
      latency: p.latency,
      timestamp: p.timestamp,
    };
  });
  const peaks = getPeakStats(rid) ?? { peakCpu: 0, peakMem: 0, peakRps: 0, slowestLatency: 0 };
  res.json({
    isPublished: true,
    history,
    peaks: {
      peakCpu: `${Math.round(peaks.peakCpu)}%`,
      peakMem: `${Math.round(peaks.peakMem)}%`,
      peakRps: String(peaks.peakRps),
      // Per-endpoint timing is not collected, so naming one would be a guess.
      slowestEndpoint: null,
      slowestLatency: `${peaks.slowestLatency}ms`,
    },
  });
});

router.get("/restaurants/:restaurantId/monitoring/logs", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const access = await resolveAnalyticsAccess(req, rid);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json([]); return; }

  const logs = await db.select().from(auditLogsTable)
    .where(eq(auditLogsTable.restaurantId, rid))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(50);
  if (logs.length) {
    res.json(logs.map(l => ({
      id: l.id,
      level: l.severity === "critical" ? "error" : l.severity === "warning" ? "warn" : "info",
      message: l.action,
      service: l.category || "API Server",
      timestamp: l.createdAt,
      count: 1,
      resolved: l.severity !== "critical",
    })));
    return;
  }
  res.json(ensureErrorLogs(rid));
});

router.get("/restaurants/:restaurantId/monitoring/health", requireAuth, async (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const access = await resolveAnalyticsAccess(req, rid);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }

  let dbOk = false;
  let dbLatencyMs: number | null = null;
  const dbStart = Date.now();
  try { await db.execute(sql`SELECT 1`); dbOk = true; dbLatencyMs = Date.now() - dbStart; } catch {}
  const snapshot = runtimeSnapshot();

  if (access.kind === "unpublished") {
    res.json({
      isPublished: false,
      status: dbOk ? "standby" : "degraded",
      components: {
        api: { status: "up", latency_ms: 0 },
        database: { status: dbOk ? "up" : "down", latency_ms: 0 },
        sessions: { status: "standby" },
        queue: { status: "standby", pending: 0 },
        notifications: { status: "standby" },
      },
    });
    return;
  }

  res.json({
    isPublished: true,
    status: dbOk ? "healthy" : "degraded",
    components: {
      // Latency here was drawn at random, so a slow database still read as fast. These are
      // the API's own measured average and the round trip of the check just performed.
      api: { status: "up", latency_ms: snapshot.avgResponseMs },
      database: { status: dbOk ? "up" : "down", latency_ms: dbLatencyMs },
      sessions: { status: "up" },
      queue: { status: "up", pending: snapshot.requestsInFlight },
      notifications: { status: "up" },
    },
  });
});

export default router;
