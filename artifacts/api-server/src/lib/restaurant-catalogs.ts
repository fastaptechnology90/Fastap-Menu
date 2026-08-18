import { getSettingsSection } from "./restaurant-settings.js";

export async function loadCatalogSection<T>(restaurantId: number, key: string, defaults: T): Promise<T> {
  const stored = await getSettingsSection<Partial<T>>(restaurantId, key, {});
  if (!stored || typeof stored !== "object") return defaults;
  return { ...defaults, ...stored };
}

export function billingFromSettings(settings: Record<string, unknown> | null | undefined) {
  const billing = (settings?.billing && typeof settings.billing === "object" ? settings.billing : {}) as Record<string, string>;
  return {
    gstin: billing.gstin ?? "27AABCU9603R1ZM",
    legalName: billing.legalName ?? "",
    address: billing.address ?? "",
    upiId: billing.upiId ?? "",
  };
}
