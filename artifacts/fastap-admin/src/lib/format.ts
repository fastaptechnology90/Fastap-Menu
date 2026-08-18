import { PLATFORM_CURRENCY_SYMBOL } from "./currency";

/**
 * Coerce anything the API might send into a safe number.
 *
 * The API serialises money as JSON, and `JSON.stringify(NaN)` produces `null`.
 * A single bad row therefore arrives here as `null`, and calling
 * `.toLocaleString()` on it used to throw and take the whole page down with it
 * (see BUG.md #23). Money formatting must never be the thing that breaks a screen.
 */
function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export function fmtINR(value: number | string | null | undefined) {
  const n = toNumber(value);
  if (n >= 1_000_000) return `${PLATFORM_CURRENCY_SYMBOL}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${PLATFORM_CURRENCY_SYMBOL}${(n / 1_000).toFixed(1)}K`;
  return `${PLATFORM_CURRENCY_SYMBOL}${n.toLocaleString("en-IN")}`;
}

export function fmtINRFull(value: number | string | null | undefined) {
  const n = toNumber(value);
  return `${PLATFORM_CURRENCY_SYMBOL}${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
