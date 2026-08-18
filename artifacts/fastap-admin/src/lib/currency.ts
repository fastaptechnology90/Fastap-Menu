/** Platform-wide currency — Indian Rupee only. */
export const PLATFORM_CURRENCY = "INR" as const;
export const PLATFORM_CURRENCY_SYMBOL = "₹" as const;

export function normalizeCurrencyCode(_value?: string | null): typeof PLATFORM_CURRENCY {
  return PLATFORM_CURRENCY;
}

export function currencyDisplayLabel(): string {
  return `${PLATFORM_CURRENCY} (${PLATFORM_CURRENCY_SYMBOL})`;
}
