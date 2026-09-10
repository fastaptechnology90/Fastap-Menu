import FeatureUnavailable from "@/pages/FeatureUnavailable";

/**
 * Displayed API keys were deterministic hashes (or stored strings) that the public API
 * never checked. Endpoint cards listed paths that are not an authenticated partner API.
 */
export default function ApiPlatform() {
  return (
    <FeatureUnavailable
      title="API & Integration Platform"
      summary="There is no partner API key that unlocks authenticated access. Keys shown here were never verified by the server."
      details={[
        "Displayed keys were generated for the screen only — requests are not authenticated with them.",
        "Listed endpoints are ordinary app routes, not a published integration platform.",
        "Rotate appeared to issue a new key but the live request path did not start requiring it.",
      ]}
      workaround={
        <>
          <span className="font-semibold text-foreground">Until this ships:</span> use the guest
          menu and staff apps as shipped. For custom integrations, ask platform support — do not
          paste keys from this screen into a partner portal.
        </>
      }
    />
  );
}
