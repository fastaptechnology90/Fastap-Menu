import FeatureUnavailable from "@/pages/FeatureUnavailable";

/**
 * The corporate routes (`api-server/src/routes/corporate.ts`) are an
 * in-process fixture seeded with invented client companies, invoices and
 * employee wallets. Accounts created here vanish on the next restart, invoice
 * download and send have no route at all, and the outstanding balances shown
 * were never owed by anyone. Nothing here should be used to bill a client.
 */
export default function CorporateBilling() {
  return (
    <FeatureUnavailable
      title="Corporate Billing"
      summary="Corporate accounts, invoices and employee wallets are not stored yet, so this screen cannot bill anyone."
      details={[
        "The client companies, invoices and wallet balances this page used to list were sample data, not your accounts.",
        "Accounts and invoices created here were held in memory only and did not survive a restart.",
        "Downloading an invoice, sending one to a client, and topping up or blocking an employee card have no backing service.",
      ]}
      workaround={
        <>
          <span className="font-semibold text-white/85">Until this ships:</span> bill corporate clients
          outside the platform. Orders placed against a company still appear in Orders and Revenue
          Overview, so you can export the period and invoice from those figures.
        </>
      }
    />
  );
}
