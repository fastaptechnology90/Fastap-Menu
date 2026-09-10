import FeatureUnavailable from "@/pages/FeatureUnavailable";

/**
 * Sandbox toggles stored flags only. They did not isolate payments or clone a trial
 * venue — switching to "Sandbox" left live data and real gateways untouched in name only.
 */
export default function SandboxDemo() {
  return (
    <FeatureUnavailable
      title="Sandbox / Demo Environment"
      summary="There is no isolated sandbox here. These switches never redirected payments or protected live data."
      details={[
        "Demo payment / test UPI / test card flags were saved as settings only — they did not change the payment path.",
        "Environment switches did not create a separate restaurant or database.",
        "Using this screen during a demo would imply safe test charges that were never isolated.",
      ]}
      workaround={
        <>
          <span className="font-semibold text-foreground">Until this ships:</span> use a dedicated
          test venue and your payment provider’s test mode from their dashboard, not this page.
        </>
      }
    />
  );
}
