import FeatureUnavailable from "@/pages/FeatureUnavailable";

/**
 * The "AI" endpoints behind this screen build template descriptions and count-based
 * tips from order/menu rows — not a model. Marketing-asset buttons only toasted
 * "coming soon". Showing that as live AI would mislead an owner in a demo.
 */
export default function AIFeatures() {
  return (
    <FeatureUnavailable
      title="AI Features"
      summary="This screen is not connected to an AI model. Nothing here generates real insights or marketing assets."
      details={[
        "Menu drafts and co-pilot answers were templates and simple counts from your orders — not machine learning.",
        "Poster, reel and banner buttons never wrote a file; they only showed a placeholder toast.",
        "Until a real model and asset pipeline are wired, this area stays off the sidebar.",
      ]}
      workaround={
        <>
          <span className="font-semibold text-foreground">Until this ships:</span> edit dishes in Menu
          Management, and check peak hours and top sellers in Analytics and Revenue Overview.
        </>
      }
    />
  );
}
