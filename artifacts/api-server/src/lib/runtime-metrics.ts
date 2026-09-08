import os from "node:os";

/**
 * What the server can honestly say about itself.
 *
 * The monitoring screen was fed `Math.random()` for CPU, memory, request counts, error
 * counts, latency, sessions and queue depth, with a fixed "99.87%" uptime beside them.
 * An operator watching that page was watching a random number generator, so a real
 * problem was invisible and a healthy server could look like it was failing.
 *
 * Everything below is measured. CPU and memory come from the process itself; request
 * counts, errors and latency come from a counter on the API router, so they describe
 * traffic this process actually served. Nothing here is estimated, and anything that
 * cannot be measured is reported as null rather than filled in.
 */

let lastCpu = process.cpuUsage();
let lastCpuAt = Date.now();

/** Process CPU as a percentage of one core-second per wall-second, since the last read. */
function sampleCpuPercent(): number {
  const now = Date.now();
  const usage = process.cpuUsage(lastCpu);
  const elapsedMs = Math.max(1, now - lastCpuAt);
  lastCpu = process.cpuUsage();
  lastCpuAt = now;
  const cores = Math.max(1, os.cpus()?.length ?? 1);
  const usedMs = (usage.user + usage.system) / 1000;
  return Math.min(100, Math.round((usedMs / (elapsedMs * cores)) * 1000) / 10);
}

type DayCounters = {
  day: string;
  requests: number;
  errors: number;
  latencyTotalMs: number;
  latencySamples: number;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

let counters: DayCounters = { day: today(), requests: 0, errors: 0, latencyTotalMs: 0, latencySamples: 0 };
let inFlight = 0;
let peakInFlight = 0;
const startedAt = Date.now();

function rollDay() {
  const d = today();
  if (counters.day !== d) {
    counters = { day: d, requests: 0, errors: 0, latencyTotalMs: 0, latencySamples: 0 };
    peakInFlight = 0;
  }
}

/** Called once per API request, from the router the whole API is mounted behind. */
export function recordRequest(statusCode: number, durationMs: number): void {
  rollDay();
  counters.requests += 1;
  if (statusCode >= 500) counters.errors += 1;
  counters.latencyTotalMs += durationMs;
  counters.latencySamples += 1;
}

export function requestStarted(): void {
  inFlight += 1;
  if (inFlight > peakInFlight) peakInFlight = inFlight;
}

export function requestFinished(): void {
  inFlight = Math.max(0, inFlight - 1);
}

export type RuntimeSnapshot = {
  uptimeSeconds: number;
  startedAt: string;
  cpuPercent: number;
  memoryPercent: number;
  memoryRssBytes: number;
  heapUsedBytes: number;
  requestsToday: number;
  errorsToday: number;
  avgResponseMs: number | null;
  requestsInFlight: number;
  peakConcurrentRequests: number;
  loadAverage1m: number | null;
};

export function runtimeSnapshot(): RuntimeSnapshot {
  rollDay();
  const mem = process.memoryUsage();
  const totalMem = os.totalmem() || 1;
  // A load average is only meaningful where the OS keeps one; Windows reports zeroes.
  const load = os.loadavg?.()[0];
  return {
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: new Date(startedAt).toISOString(),
    cpuPercent: sampleCpuPercent(),
    memoryPercent: Math.round((mem.rss / totalMem) * 1000) / 10,
    memoryRssBytes: mem.rss,
    heapUsedBytes: mem.heapUsed,
    requestsToday: counters.requests,
    errorsToday: counters.errors,
    avgResponseMs: counters.latencySamples
      ? Math.round(counters.latencyTotalMs / counters.latencySamples)
      : null,
    requestsInFlight: inFlight,
    peakConcurrentRequests: peakInFlight,
    loadAverage1m: typeof load === "number" && load > 0 ? Math.round(load * 100) / 100 : null,
  };
}
