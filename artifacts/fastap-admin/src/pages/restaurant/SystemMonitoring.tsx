import FeatureUnavailable from "@/pages/FeatureUnavailable";

/**
 * Every figure this screen used to plot came from `Math.random()` on the
 * server (`api-server/src/routes/monitoring.ts`), against a hardcoded 99.87%
 * uptime and a fixed list of invented incidents. It reported "All Systems
 * Healthy" whether or not anything was actually up, which is worse than
 * reporting nothing at all during an outage.
 */
export default function SystemMonitoring() {
  return (
    <FeatureUnavailable
      title="System Monitoring"
      summary="This screen is not wired to real telemetry, so it cannot tell you whether the system is healthy."
      details={[
        "CPU, memory, latency, request rate and uptime were generated values, not measurements of your service.",
        "The health banner was not derived from any check, so it read healthy during an outage as readily as during normal service.",
        "The incident list was a fixed sample, not a record of anything that happened to your restaurant.",
      ]}
      workaround={
        <>
          <span className="font-semibold text-white/85">Until this ships:</span> if orders, payments or the
          kitchen display stop responding, contact support directly rather than checking this page — it
          would not have shown the problem.
        </>
      }
    />
  );
}
