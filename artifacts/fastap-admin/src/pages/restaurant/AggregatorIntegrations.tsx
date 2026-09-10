import FeatureUnavailable from "@/pages/FeatureUnavailable";

/**
 * Enable/Sync only flipped settings. Partner APIs are not connected. "Simulate order"
 * inserted a fake delivery into Live Orders — easy to mistake for a real Swiggy ticket.
 */
export default function AggregatorIntegrations() {
  return (
    <FeatureUnavailable
      title="Aggregator Integrations"
      summary="Swiggy, Zomato and ONDC are not connected. Nothing on this screen syncs a real partner catalog or order feed."
      details={[
        "Enable and Sync only updated local flags — no partner API keys are configured.",
        "Simulate order created a normal kitchen order marked as an aggregator source, which looks like live delivery traffic.",
        "Until partner credentials and webhooks exist, this area stays off the sidebar.",
      ]}
      workaround={
        <>
          <span className="font-semibold text-foreground">Until this ships:</span> take delivery
          orders in Live Orders or Billing & POS, or run each aggregator’s own tablet beside the till.
        </>
      }
    />
  );
}
