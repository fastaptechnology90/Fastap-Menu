import FeatureUnavailable from "@/pages/FeatureUnavailable";

/**
 * Expected and recorded commission were the same formula on the same paid orders,
 * so the "leakage gap" was always ₹0. That looked like an all-clear in a demo.
 */
export default function RevenueLeakage() {
  return (
    <FeatureUnavailable
      title="Revenue Leakage Detection"
      summary="This screen cannot detect missing money. The commission gap it used to show was always zero by construction."
      details={[
        "Expected and recorded commission were calculated the same way from the same paid orders.",
        "A ₹0 gap meant the arithmetic agreed with itself — not that payouts, refunds or wallets were correct.",
        "Real leakage (double payouts, refunds above sales) needs dedicated settlement and wallet checks.",
      ]}
      workaround={
        <>
          <span className="font-semibold text-foreground">Until this ships:</span> use Settlements,
          Vendor Wallets, Refunds and Restaurant Revenues for money review — not this page.
        </>
      }
    />
  );
}
