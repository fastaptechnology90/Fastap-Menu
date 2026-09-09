/**
 * Is the venue open right now?
 *
 * `restaurants.open_time`, `close_time` and `timezone` have been in the database since
 * the first migration and were populated for every venue — and nothing on the server
 * ever read them. A 4 a.m. order reached the kitchen exactly like a 1 p.m. one, and no
 * guest surface said when the place opens. The guest-facing routes now carry this
 * answer so the app can say "we open at 11:00" instead of taking an order nobody is
 * there to cook.
 *
 * Times are stored as bare "HH:MM" wall-clock strings with no date, so they are read in
 * the venue's own timezone — a Dubai kitchen must not be judged by the server's clock.
 */

export interface VenueHoursInput {
  openTime?: string | null;
  closeTime?: string | null;
  timezone?: string | null;
  isActive?: boolean | null;
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

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

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

export function venueHours(venue: VenueHoursInput | null | undefined, now: Date = new Date()): VenueHours {
  const timezone = (venue?.timezone && String(venue.timezone).trim()) || "Asia/Kolkata";
  const { minutes, label } = localClock(timezone, now);
  const open = toMinutes(venue?.openTime);
  const close = toMinutes(venue?.closeTime);
  const openLabel = open == null ? null : String(venue?.openTime).trim();
  const closeLabel = close == null ? null : String(venue?.closeTime).trim();

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
