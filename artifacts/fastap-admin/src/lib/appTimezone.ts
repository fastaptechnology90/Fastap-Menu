// Pin every date/time the app DISPLAYS to the BUSINESS (restaurant/venue) timezone, so the
// clock a user sees never depends on their device or — for a wrapped APK — the WebView
// timezone. Otherwise a device/WebView set to another zone shows the hours shifted (e.g. UTC,
// several hours off), which is exactly what the order screens were doing.
//
// The active zone is read live from window.__APP_TZ__, which the app sets from the logged-in
// restaurant's / loaded venue's configured timezone (see setAppTimezone). Until that's known
// we fall back to India time. Reading it per-call (not once at load) means the zone follows
// whichever venue is active, so a Dubai venue shows Dubai time and an India venue shows IST.
//
// Done globally by defaulting the `timeZone` (and an en-IN locale) on the three Date DISPLAY
// methods when the caller didn't pass one. Calls that DO pass an explicit timeZone/locale are
// left as-is. Only Date.prototype is touched — Number.prototype.toLocaleString (money, counts)
// is untouched, so revenue/amount formatting never changes.
const DEFAULT_TZ = "Asia/Kolkata";

function currentTz(): string {
  try {
    const tz = (window as unknown as { __APP_TZ__?: string }).__APP_TZ__;
    return tz && typeof tz === "string" ? tz : DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

// Point the whole app at a venue's timezone (e.g. after login, or when a guest venue loads).
// Invalid/empty values are ignored so we never break formatting with a bad zone.
export function setAppTimezone(tz: string | null | undefined): void {
  if (!tz || typeof tz !== "string") return;
  try {
    // Validate the zone once; an unknown zone throws here and we keep the previous one.
    new Date().toLocaleString("en-IN", { timeZone: tz });
    (window as unknown as { __APP_TZ__?: string }).__APP_TZ__ = tz;
  } catch { /* ignore invalid timezone */ }
}

type LocaleArg = string | string[] | undefined;
type DateFmt = (locales?: LocaleArg, options?: Intl.DateTimeFormatOptions) => string;

function patch(method: "toLocaleString" | "toLocaleDateString" | "toLocaleTimeString"): void {
  const proto = Date.prototype as unknown as Record<string, DateFmt & { __appTz?: boolean }>;
  const original = proto[method];
  if (original.__appTz) return; // already patched (hot reload / double import)
  const wrapped = function (this: Date, locales?: LocaleArg, options?: Intl.DateTimeFormatOptions): string {
    const opts: Intl.DateTimeFormatOptions = options ? { ...options } : {};
    if (opts.timeZone == null) opts.timeZone = currentTz();
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
