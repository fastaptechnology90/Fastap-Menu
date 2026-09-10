/**

 * Is the venue open right now?

 *

 * Source of truth (in order):

 * 1. Per-day schedule in restaurant settings (`appSettings.hours` / `hours` / `tradingHours.days`)

 *    — what Restaurant Settings → Operating Hours saves.

 * 2. Fallback: `restaurants.open_time` / `close_time` columns (seed defaults were 11:00–23:00).

 *

 * Timezone: `restaurants.timezone`, then `settings.timezone` / `settings.appSettings.timezone`,

 * else Asia/Kolkata. A Dubai kitchen must not be judged by the server's clock.

 *

 * Ordering outside published hours can still be allowed for local demos:

 * - restaurant `settings.alwaysOpen` / `settings.ignoreTradingHours` / `settings.tradingHours.enforce === false`

 * - or env `ALLOW_ORDERS_OUTSIDE_HOURS=true` / `IGNORE_VENUE_HOURS=1`

 * - or non-production when `ENFORCE_VENUE_HOURS` is not set to `true` (default local convenience)

 * Displayed `isOpen` stays honest to the clock; use `ordersAllowed()` for write gates.

 */



export interface VenueHoursInput {

  openTime?: string | null;

  closeTime?: string | null;

  timezone?: string | null;

  isActive?: boolean | null;

  settings?: unknown;

}



export interface VenueHours {

  /** false only when the venue publishes hours and we are outside them. */

  isOpen: boolean;

  /** false when the venue has not published opening hours — then `isOpen` is true. */

  hoursPublished: boolean;

  openTime: string | null;

  closeTime: string | null;

  timezone: string;

  /** Local wall clock at the venue, "HH:MM", for the guest-facing copy. */

  localTime: string;

  /** True when the venue closes after midnight (e.g. 18:00 → 02:00). */

  overnight: boolean;

  /** One line a guest screen can show as-is. */

  message: string;

}



export type OrdersAllowedResult = {

  allowed: boolean;

  hours: VenueHours;

  /** Why orders are accepted while the clock says closed — omitted when genuinely open or refused. */

  bypass?: "restaurant_setting" | "env_flag" | "dev_default";

};



/** Accepts "6:00", "06:00", and HTML time "06:00:00". */
const TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;



const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;



export type DayHoursRow = {

  day: string;

  open: boolean;

  from: string;

  to: string;

};



function toMinutes(value: string | null | undefined): number | null {

  if (typeof value !== "string") return null;

  const m = TIME_RE.exec(value.trim());

  if (!m) return null;

  const h = Number(m[1]);

  const min = Number(m[2]);

  if (!Number.isInteger(h) || !Number.isInteger(min) || h > 23 || min > 59) return null;

  return h * 60 + min;

}



function pad(n: number): string {

  return String(n).padStart(2, "0");

}



function asRecord(value: unknown): Record<string, unknown> | null {

  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

}



/** Normalize "06:00" / "6:00" → "06:00". */

export function normalizeClock(value: string | null | undefined): string | null {

  const mins = toMinutes(value);

  if (mins == null) return null;

  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

}



/**

 * Pull the per-day schedule the Settings UI saves.

 * Accepts `appSettings.hours`, top-level `hours`, or `tradingHours.days` / `tradingHours.hours`.

 */

export function extractScheduleHours(settings: unknown): DayHoursRow[] | null {

  const root = asRecord(settings);

  if (!root) return null;

  const app = asRecord(root.appSettings);

  const trading = asRecord(root.tradingHours);

  const candidates: unknown[] = [

    app?.hours,

    root.hours,

    trading?.days,

    trading?.hours,

  ];

  for (const c of candidates) {

    if (!Array.isArray(c) || c.length === 0) continue;

    const rows: DayHoursRow[] = [];

    for (const raw of c) {

      const row = asRecord(raw);

      if (!row) continue;

      const day = String(row.day ?? row.name ?? "").trim();

      if (!day) continue;

      const from = normalizeClock(String(row.from ?? row.open ?? row.openTime ?? ""));

      const to = normalizeClock(String(row.to ?? row.close ?? row.closeTime ?? ""));

      const openFlag = row.open;

      const open = openFlag === false || openFlag === "false" ? false : Boolean(from && to);

      if (!from || !to) {

        rows.push({ day, open: false, from: from ?? "00:00", to: to ?? "00:00" });

        continue;

      }

      rows.push({ day, open, from, to });

    }

    if (rows.length) return rows;

  }

  return null;

}



/** Derive column open/close from a schedule (today if available, else first open day). */

export function deriveOpenCloseFromSchedule(

  schedule: DayHoursRow[] | null | undefined,

  timezone: string,

  now: Date = new Date(),

): { openTime: string | null; closeTime: string | null; closedToday: boolean } {

  if (!schedule?.length) return { openTime: null, closeTime: null, closedToday: false };

  const dayName = weekdayInTimezone(timezone, now);

  const today = schedule.find(d => d.day.toLowerCase() === dayName.toLowerCase());

  if (today) {

    if (!today.open) return { openTime: today.from, closeTime: today.to, closedToday: true };

    return { openTime: today.from, closeTime: today.to, closedToday: false };

  }

  const firstOpen = schedule.find(d => d.open);

  if (firstOpen) return { openTime: firstOpen.from, closeTime: firstOpen.to, closedToday: false };

  return { openTime: schedule[0].from, closeTime: schedule[0].to, closedToday: true };

}



export function resolveVenueTimezone(venue: VenueHoursInput | null | undefined): string {

  const root = asRecord(venue?.settings);

  const app = asRecord(root?.appSettings);

  // Prefer settings (what Operating Hours saves) over the column default "UTC".
  const fromSettings =

    (typeof app?.timezone === "string" && app.timezone.trim()) ||

    (typeof root?.timezone === "string" && root.timezone.trim()) ||

    "";

  if (fromSettings) return fromSettings;

  const col = venue?.timezone && String(venue.timezone).trim();

  if (col && col !== "UTC") return col;

  if (col) return col;

  return "Asia/Kolkata";

}



function weekdayInTimezone(timezone: string, now: Date): string {

  try {

    const label = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(now);

    if (WEEKDAY_NAMES.some(d => d === label)) return label;

  } catch {

    // fall through

  }

  return WEEKDAY_NAMES[now.getDay()];

}



/** "HH:MM" at the given IANA timezone, falling back to the server clock if it is unknown. */

function localClock(timezone: string, now: Date): { minutes: number; label: string } {

  try {

    const parts = new Intl.DateTimeFormat("en-GB", {

      timeZone: timezone,

      hour: "2-digit",

      minute: "2-digit",

      hour12: false,

    }).formatToParts(now);

    const h = Number(parts.find(p => p.type === "hour")?.value ?? NaN);

    const min = Number(parts.find(p => p.type === "minute")?.value ?? NaN);

    if (Number.isInteger(h) && Number.isInteger(min)) {

      // Intl renders midnight as "24" in some ICU builds.

      const hour = h === 24 ? 0 : h;

      return { minutes: hour * 60 + min, label: `${pad(hour)}:${pad(min)}` };

    }

  } catch {

    // An unrecognised timezone string is not a reason to refuse the order.

  }

  const h = now.getHours();

  const min = now.getMinutes();

  return { minutes: h * 60 + min, label: `${pad(h)}:${pad(min)}` };

}



function resolveOpenClose(

  venue: VenueHoursInput | null | undefined,

  timezone: string,

  now: Date,

): { openTime: string | null; closeTime: string | null; closedAllDay: boolean; fromSchedule: boolean } {

  const schedule = extractScheduleHours(venue?.settings);

  if (schedule) {

    const derived = deriveOpenCloseFromSchedule(schedule, timezone, now);

    return {

      openTime: derived.openTime,

      closeTime: derived.closeTime,

      closedAllDay: derived.closedToday,

      fromSchedule: true,

    };

  }

  return {

    openTime: normalizeClock(venue?.openTime) ?? (venue?.openTime ? String(venue.openTime).trim() : null),

    closeTime: normalizeClock(venue?.closeTime) ?? (venue?.closeTime ? String(venue.closeTime).trim() : null),

    closedAllDay: false,

    fromSchedule: false,

  };

}



export function venueHours(venue: VenueHoursInput | null | undefined, now: Date = new Date()): VenueHours {

  const timezone = resolveVenueTimezone(venue);

  const { minutes, label } = localClock(timezone, now);

  const resolved = resolveOpenClose(venue, timezone, now);

  const openLabel = resolved.openTime;

  const closeLabel = resolved.closeTime;

  const open = toMinutes(openLabel);

  const close = toMinutes(closeLabel);



  if (resolved.closedAllDay) {

    return {

      isOpen: false,

      hoursPublished: true,

      openTime: openLabel,

      closeTime: closeLabel,

      timezone,

      localTime: label,

      overnight: false,

      message: `Closed today (local time at the venue is ${label}).`,

    };

  }



  // No published hours means we cannot say the venue is shut. Silently refusing orders

  // for a venue that never filled the field in would be worse than the original bug.

  if (open == null || close == null || open === close) {

    return {

      isOpen: true,

      hoursPublished: false,

      openTime: openLabel,

      closeTime: closeLabel,

      timezone,

      localTime: label,

      overnight: false,

      message: "",

    };

  }



  const overnight = close < open;

  const isOpen = overnight ? minutes >= open || minutes < close : minutes >= open && minutes < close;



  return {

    isOpen,

    hoursPublished: true,

    openTime: openLabel,

    closeTime: closeLabel,

    timezone,

    localTime: label,

    overnight,

    message: isOpen

      ? `Open until ${closeLabel}`

      : `Closed right now — we open at ${openLabel} (local time at the venue is ${label}).`,

  };

}



/** The error body a guest-facing write returns when the venue is shut. */

export function closedResponse(hours: VenueHours): { error: string; venueClosed: true; hours: VenueHours } {

  return {

    error: hours.message || "The venue is closed right now.",

    venueClosed: true,

    hours,

  };

}



function settingsAllowOutsideHours(settings: unknown): boolean {

  if (!settings || typeof settings !== "object") return false;

  const s = settings as Record<string, unknown>;

  if (s.alwaysOpen === true || s.ignoreTradingHours === true) return true;

  const trading = s.tradingHours;

  if (trading && typeof trading === "object" && (trading as { enforce?: unknown }).enforce === false) {

    return true;

  }

  return false;

}



/**

 * Env / local bypass for taking orders while the clock says closed.

 *

 * - `ALLOW_ORDERS_OUTSIDE_HOURS=true` or `IGNORE_VENUE_HOURS=1` — explicit (any NODE_ENV)

 * - Non-production default: allowed unless `ENFORCE_VENUE_HOURS=true`

 * Production never bypasses unless the explicit flag is set.

 */

function envAllowsOutsideHours(): { ok: boolean; bypass?: OrdersAllowedResult["bypass"] } {

  const explicit = String(process.env.ALLOW_ORDERS_OUTSIDE_HOURS ?? process.env.IGNORE_VENUE_HOURS ?? "")

    .trim()

    .toLowerCase();

  if (explicit === "1" || explicit === "true" || explicit === "yes") {

    return { ok: true, bypass: "env_flag" };

  }

  if (process.env.NODE_ENV !== "production" && String(process.env.ENFORCE_VENUE_HOURS ?? "").toLowerCase() !== "true") {

    return { ok: true, bypass: "dev_default" };

  }

  return { ok: false };

}



/**

 * Whether guest/kiosk writes may place an order right now.

 * Clock display stays in `hours`; this only decides the write gate.

 */

export function ordersAllowed(

  venue: VenueHoursInput | null | undefined,

  now: Date = new Date(),

): OrdersAllowedResult {

  const hours = venueHours(venue, now);

  if (hours.isOpen) return { allowed: true, hours };

  if (settingsAllowOutsideHours(venue?.settings)) {

    return { allowed: true, hours, bypass: "restaurant_setting" };

  }

  const env = envAllowsOutsideHours();

  if (env.ok) return { allowed: true, hours, bypass: env.bypass };

  return { allowed: false, hours };

}



/**

 * Hours blob for guest APIs: clock truth plus whether ordering is still accepted

 * (local/dev or restaurant always-open). UI must not claim "open" when `isOpen` is

 * false — use `demoOpenMessage` / `ordersAllowed` instead.

 */

export function publicHoursPayload(venue: VenueHoursInput | null | undefined, now: Date = new Date()) {

  const gate = ordersAllowed(venue, now);

  const { hours, allowed, bypass } = gate;

  const demoOpen = hours.hoursPublished && !hours.isOpen && allowed;

  return {

    ...hours,

    ordersAllowed: allowed,

    ...(bypass ? { ordersBypass: bypass } : {}),

    ...(demoOpen

      ? {

          demoOpenMessage:

            `Kitchen hours are ${hours.openTime ?? "?"}–${hours.closeTime ?? "?"} (${hours.timezone}, local ${hours.localTime}). `

            + "Demo ordering is still available — the kitchen may not be staffed.",

        }

      : {}),

  };

}


