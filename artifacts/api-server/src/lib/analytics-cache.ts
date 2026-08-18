const metricHistory: Record<number, { timestamp: string; cpu: number; mem: number; rps: number; latency: number }[]> = {};
const peakStats: Record<number, { peakCpu: number; peakMem: number; peakRps: number; slowestLatency: number }> = {};
const errorLogs: Record<number, unknown[]> = {};

export function invalidateRestaurantAnalyticsCache(restaurantId: number): void {
  delete metricHistory[restaurantId];
  delete peakStats[restaurantId];
  delete errorLogs[restaurantId];
}

export function getMetricHistory(restaurantId: number) {
  return metricHistory[restaurantId] ?? [];
}

export function setMetricHistory(restaurantId: number, history: typeof metricHistory[number]) {
  metricHistory[restaurantId] = history;
}

export function getPeakStats(restaurantId: number) {
  return peakStats[restaurantId];
}

export function setPeakStats(restaurantId: number, peaks: NonNullable<typeof peakStats[number]>) {
  peakStats[restaurantId] = peaks;
}

export function getErrorLogs(restaurantId: number) {
  return errorLogs[restaurantId];
}

export function setErrorLogs(restaurantId: number, logs: unknown[]) {
  errorLogs[restaurantId] = logs;
}
