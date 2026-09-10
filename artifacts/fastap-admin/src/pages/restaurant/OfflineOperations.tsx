import FeatureUnavailable from "@/pages/FeatureUnavailable";

/**
 * Offline toggles only wrote settings rows. They did not queue POS tickets, keep the
 * till working without internet, or sync pending orders — so "Offline POS enabled"
 * was a lie an owner would trust during an outage.
 */
export default function OfflineOperations() {
  return (
    <FeatureUnavailable
      title="Offline Mode & Failover"
      summary="This screen does not run offline POS or order sync. Toggles here never kept the till working without internet."
      details={[
        "No local queue writes bills or kitchen tickets when the network drops.",
        "Sync Now only updated a timestamp in settings — it did not push pending orders.",
        "The controls this page used to show were configuration placeholders, not a failover system.",
      ]}
      workaround={
        <>
          <span className="font-semibold text-foreground">Until this ships:</span> keep a stable
          connection for Billing & POS and Live Orders. For a short outage, take cash orders on
          paper and enter them when the link returns.
        </>
      }
    />
  );
}
