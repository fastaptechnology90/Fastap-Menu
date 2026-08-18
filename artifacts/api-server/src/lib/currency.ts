/** Platform-wide currency — Indian Rupee only. */
export const PLATFORM_CURRENCY = "INR" as const;
export const PLATFORM_CURRENCY_SYMBOL = "₹" as const;

export function normalizeCurrencyCode(_value?: string | null): typeof PLATFORM_CURRENCY {
  return PLATFORM_CURRENCY;
}

export function normalizeGeoSettings<T extends { currency?: string }>(regions: T[]): T[] {
  return regions.map((region) => ({ ...region, currency: PLATFORM_CURRENCY }));
}
