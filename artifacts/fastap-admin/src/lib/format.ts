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

/**
 * Indian numbering, largest unit first. Thousands, lakh (10^5) and crore (10^7)
 * are the groupings the readers of these screens count in — a million is not one
 * of them, so ₹15,00,000 has to read "₹15L" and never "₹1.5M".
 */
const INR_UNITS: ReadonlyArray<readonly [number, string]> = [
  [10_000_000, "Cr"],
  [100_000, "L"],
  [1_000, "K"],
];

export function fmtINR(value: number | string | null | undefined) {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  for (let i = 0; i < INR_UNITS.length; i++) {
    const [divisor, suffix] = INR_UNITS[i];
    if (abs < divisor) continue;
    const scaled = Number((abs / divisor).toFixed(1));
    // 99,999 rounds to 100.0K, which reads as a lakh. Carry it into the unit
    // above rather than print a figure that has already rolled over.
    if (scaled >= 100 && i > 0) {
      const [up, upSuffix] = INR_UNITS[i - 1];
      return `${sign}${PLATFORM_CURRENCY_SYMBOL}${Number((abs / up).toFixed(1))}${upSuffix}`;
    }
    return `${sign}${PLATFORM_CURRENCY_SYMBOL}${scaled}${suffix}`;
  }

  return `${PLATFORM_CURRENCY_SYMBOL}${n.toLocaleString("en-IN")}`;
}

export function fmtINRFull(value: number | string | null | undefined) {
  const n = toNumber(value);
  return `${PLATFORM_CURRENCY_SYMBOL}${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
