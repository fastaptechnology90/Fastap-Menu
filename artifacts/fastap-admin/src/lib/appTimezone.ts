// Pin every date/time the app DISPLAYS to the business timezone (India by default), so the
// clock a user sees never depends on their device or — for a wrapped APK — the WebView
// timezone. Otherwise a device/WebView set to another zone shows the hours shifted
// (e.g. UTC → 5.5h off IST), which is exactly what the order screens were doing.
//
// Done once, globally, by defaulting the `timeZone` (and an en-IN locale) on the three Date
// DISPLAY methods when the caller didn't pass one. Calls that DO pass an explicit timeZone or
// locale are left exactly as they were. Only Date.prototype is touched — Number.prototype
// .toLocaleString (money, counts) is untouched, so revenue/amount formatting never changes.
// This covers every panel — guest, staff, owner and super admin — without editing call sites.
// To change the zone, set window.__APP_TZ__ before the app boots, or edit APP_TZ below.
const APP_TZ: string =
  (typeof window !== "undefined" && (window as unknown as { __APP_TZ__?: string }).__APP_TZ__) || "Asia/Kolkata";

type LocaleArg = string | string[] | undefined;
type DateFmt = (locales?: LocaleArg, options?: Intl.DateTimeFormatOptions) => string;

function patch(method: "toLocaleString" | "toLocaleDateString" | "toLocaleTimeString"): void {
  const proto = Date.prototype as unknown as Record<string, DateFmt & { __appTz?: boolean }>;
  const original = proto[method];
  if (original.__appTz) return; // already patched (hot reload / double import)
  const wrapped = function (this: Date, locales?: LocaleArg, options?: Intl.DateTimeFormatOptions): string {
    const opts: Intl.DateTimeFormatOptions = options ? { ...options } : {};
    if (opts.timeZone == null) opts.timeZone = APP_TZ;
    const loc: LocaleArg = locales == null ? "en-IN" : locales;
    return original.call(this, loc, opts);
  } as DateFmt & { __appTz?: boolean };
  wrapped.__appTz = true;
  proto[method] = wrapped;
}

let applied = false;
export function applyAppTimezone(): void {
  if (applied) return;
  applied = true;
  patch("toLocaleString");
  patch("toLocaleDateString");
  patch("toLocaleTimeString");
}

// Apply immediately on import so it's in effect before any component formats a date.
applyAppTimezone();
