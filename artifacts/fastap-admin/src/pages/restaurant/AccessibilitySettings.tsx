import FeatureUnavailable from "@/pages/FeatureUnavailable";

/**
 * Venue "defaults" saved here never reached the guest menu. Guests set language and
 * accessibility on their own profile — so this screen only stored unused flags.
 */
export default function AccessibilitySettings() {
  return (
    <FeatureUnavailable
      title="Accessibility & Languages"
      summary="These venue defaults are not applied to the guest menu. Saving here did not change what diners see."
      details={[
        "Large text, high contrast and language defaults were stored only in restaurant settings.",
        "The guest app reads each diner’s own profile preferences, not this screen.",
        "Voice menu and screen-reader toggles here were not wired to the public menu.",
      ]}
      workaround={
        <>
          <span className="font-semibold text-foreground">Until this ships:</span> guests can set
          language and accessibility under their profile in the guest menu. Keep menu copy clear
          and high-contrast in Menu Management.
        </>
      }
    />
  );
}
