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

/* ────────────────────────────────────────────────────────────────────────────
 * Dates, counts and percentages.
 *
 * These sit next to the money helpers for the same reason those exist: a screen
 * that formats a date inline gets it slightly different from the screen beside
 * it, and a bad value takes the page down. Every function here returns a string
 * for any input, including null, undefined and an unparseable date — formatting
 * is never allowed to be the thing that breaks a screen.
 * ──────────────────────────────────────────────────────────────────────────── */

/** What to show where there is genuinely nothing. An em dash, not "N/A" or "-". */
export const EMPTY = "—";

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 9 Sep 2026 — day first, month named. Unambiguous for an Indian audience. */
export function fmtDate(value: Date | string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** 7:45 pm. 12-hour, because that is how the floor talks about service times. */
export function fmtTime(value: Date | string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** 9 Sep 2026, 7:45 pm. */
export function fmtDateTime(value: Date | string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  return `${fmtDate(d)}, ${fmtTime(d)}`;
}

const RELATIVE_STEPS: ReadonlyArray<readonly [number, Intl.RelativeTimeFormatUnit]> = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
  [4.348, "week"],
  [12, "month"],
  [Number.POSITIVE_INFINITY, "year"],
];

/**
 * "2 minutes ago", "in 3 days". Used on order and ticket screens where how long
 * ago something happened matters more than when.
 */
export function fmtRelative(value: Date | string | number | null | undefined, now = Date.now()): string {
  const d = toDate(value);
  if (!d) return EMPTY;

  let delta = (d.getTime() - now) / 1000;
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [size, unit] of RELATIVE_STEPS) {
    if (Math.abs(delta) < size) return formatter.format(Math.round(delta), unit);
    delta /= size;
  }
  return formatter.format(Math.round(delta), "year");
}

/** 1,20,450 — Indian grouping, matching the money helpers. */
export function fmtCount(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  return n.toLocaleString("en-IN");
}

/**
 * 12.5%. Pass a percentage, not a ratio — the values on these screens arrive
 * from the API already scaled, and doubling the convention is how a 0.15 ends up
 * displayed as 0%.
 */
export function fmtPercent(value: number | string | null | undefined, digits = 1): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  return `${Number(n.toFixed(digits))}%`;
}

/** 1h 25m, for prep times and durations. Minutes in, never seconds. */
export function fmtDuration(minutes: number | string | null | undefined): string {
  const n = typeof minutes === "number" ? minutes : Number(minutes);
  if (!Number.isFinite(n) || n < 0) return EMPTY;
  const whole = Math.round(n);
  if (whole < 60) return `${whole}m`;
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Falls back to the em dash for anything blank, so cells never render empty. */
export function orEmpty(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY;
  const text = String(value).trim();
  return text === "" ? EMPTY : text;
}
