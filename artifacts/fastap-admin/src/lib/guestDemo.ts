import { parseEntryFromUrl, loadEntryContext } from "./smartEntry";

/** Demo venue defaults for landing → guest navigation (legacy marketing links).
 * DEMO_SLUG is a NEUTRAL alias so the demo URL never exposes the real restaurant slug.
 * The backend maps this alias to the actual demo venue (see lib/demo-venue.ts). */
export const DEMO_SLUG = "demo";
export const DEMO_TABLE = "T-12";
export const DEMO_MENU_PATH = "/user/menu";
// Demo link is just a menu preview — no table number in the URL.
export const DEMO_MENU_URL = `/user/menu?slug=${DEMO_SLUG}`;

function usableSlug(slug: string | undefined | null): string | null {
  const s = slug?.trim();
  if (!s || s === DEMO_SLUG) return null;
  return s;
}

/** Resolve restaurant slug from URL path/query or saved guest session. */
export function resolveGuestSlug(fallback?: string): string | null {
  const parsed = parseEntryFromUrl();
  const fromUrl = usableSlug(parsed.slug);
  if (fromUrl) return fromUrl;
  const saved = usableSlug(loadEntryContext()?.params?.slug);
  if (saved) return saved;
  return usableSlug(fallback);
}

/**
 * The venue the CURRENT URL is asking for — demo alias included.
 *
 * `resolveGuestSlug` deliberately reports the demo alias as "no venue", so that
 * screens needing a real venue fall back to a saved scan. That fallback is right
 * for a reload that dropped its query string, and badly wrong for the demo link
 * itself: `?slug=demo` was thrown away and whatever venue the browser had cached
 * from an earlier scan was loaded in its place.
 *
 * The visible result was a landing-page "Try Demo Menu" that opened a real
 * paying restaurant's menu, under its own name, with ordering switched on —
 * because the venue on screen genuinely was a real one, so nothing downstream
 * had any reason to stop it.
 *
 * An address bar that names a venue is not a hint. Callers that load a menu use
 * this first and only fall back when the URL says nothing at all.
 */
export function slugFromUrl(): string | null {
  const parsed = parseEntryFromUrl();
  const fromUrl = parsed.slug?.trim();
  if (fromUrl) return fromUrl;
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("slug")?.trim();
  return q || null;
}

/** Append slug (and optional query) for guest routes opened from marketing pages */
export function guestDemoPath(path: string, query = ""): string {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  if (!params.has("slug")) params.set("slug", DEMO_SLUG);
  params.set("from", "landing");
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Preserve slug/table/room/from when navigating between guest routes */
export function withGuestQuery(
  path: string,
  venue?: { restaurantSlug?: string },
  activeTable?: string,
): string {
  const current = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  // Keep path-owned query (e.g. `/user/reserve?tab=my`). Dropping it sent every
  // Bookings tab tap to New Booking instead of My Bookings.
  const qIdx = path.indexOf("?");
  const base = qIdx >= 0 ? path.slice(0, qIdx) : path;
  const qs = new URLSearchParams(qIdx >= 0 ? path.slice(qIdx + 1) : "");
  const slug = resolveGuestSlug(venue?.restaurantSlug || undefined);
  if (slug) qs.set("slug", slug);
  const table = current.get("table") || activeTable;
  if (table) qs.set("table", table);
  const room = current.get("room");
  if (room) qs.set("room", room);
  const from = current.get("from");
  if (from) qs.set("from", from);
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}

export function isFromLanding(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("from") === "landing";
}
