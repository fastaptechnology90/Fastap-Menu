import FeatureUnavailable from "@/pages/FeatureUnavailable";

/**
 * The backup service behind this screen (`api-server/src/routes/backup.ts`)
 * keeps its rows in a plain in-process object and seeds them with four
 * invented backups. Nothing is ever written to storage, and "Restore" restores
 * nothing — so the old screen told an owner their restaurant was recoverable
 * when it was not. Until a real backup job exists, say so.
 */
export default function BackupRecovery() {
  return (
    <FeatureUnavailable
      title="Backup & Recovery"
      summary="This screen is not connected to a backup system. Your data is not being backed up here."
      details={[
        "No scheduled or manual backup runs. Nothing on this screen ever wrote a copy of your data.",
        "There is no archive to restore from, so restore and download would have nothing to return.",
        "The backup history and schedule this page used to show were placeholders, not records of real runs.",
      ]}
      workaround={
        <>
          <span className="font-semibold text-foreground">Until this ships:</span> take your own copies of
          anything you cannot lose. Menu, staff, customers, orders and invoices can each be exported to a
          file from their own screens, and your payment provider keeps an independent record of every
          settled transaction.
        </>
      }
    />
  );
}
