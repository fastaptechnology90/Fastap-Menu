import { getSettingsSection } from "./restaurant-settings.js";

export async function loadCatalogSection<T>(restaurantId: number, key: string, defaults: T): Promise<T> {
  const stored = await getSettingsSection<Partial<T>>(restaurantId, key, {});
  if (!stored || typeof stored !== "object") return defaults;
  return { ...defaults, ...stored };
}

/**
 * A venue's billing identity, from its own record.
 *
 * The GSTIN used to fall back to a fixed number when a venue had not filled in the
 * billing section — so venues that had a registration recorded on the restaurant row
 * still had somebody else's GSTIN printed on their tax invoices. It now reads that
 * column, and a venue with no registration reports none.
 *
 * `taxRate` is the fraction the venue bills GST at, so invoices and quotes stop
 * assuming 5%.
 */
export function billingFromSettings(
  settings: Record<string, unknown> | null | undefined,
  restaurant?: { gstNumber?: string | null } | null,
) {
  const billing = (settings?.billing && typeof settings.billing === "object" ? settings.billing : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const percent = parseFloat(String(billing.taxPercent ?? ""));
  return {
    gstin: str(billing.gstin) || str(restaurant?.gstNumber) || null,
    legalName: str(billing.legalName),
    address: str(billing.address),
    upiId: str(billing.upiId),
    invoicePrefix: str(billing.invoicePrefix),
    taxRate: Number.isFinite(percent) && percent > 0 && percent <= 40 ? percent / 100 : undefined,
  };
}
