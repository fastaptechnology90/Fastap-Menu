// The public "Try Demo Menu" link uses a neutral slug (default "demo") so the URL never
// exposes the real restaurant's slug. This maps that alias to the actual demo venue slug
// for the DB lookup. Any real slug (e.g. an actual restaurant's own QR) passes through
// unchanged. Configurable via DEMO_VENUE_ALIAS / DEMO_VENUE_SLUG env vars.
export function resolveVenueSlug(slug: string): string {
  const alias = process.env.DEMO_VENUE_ALIAS ?? "demo";
  const demoSlug = process.env.DEMO_VENUE_SLUG ?? "spice-garden";
  return slug === alias ? demoSlug : slug;
}

/** The venue the public "Try Demo Menu" link lands on. */
export function demoVenueSlug(): string {
  return process.env.DEMO_VENUE_SLUG ?? "spice-garden";
}

/**
 * Is this the marketing demo venue?
 *
 * The demo menu is a shop window on the landing page, and it points at a real row
 * in the restaurants table with a real dashboard and a real kitchen screen behind
 * it. The guest web treats the demo as view-only, but that check lived only in the
 * browser — so anything that reached POST /public/orders with the demo venue's id
 * put a live ticket on that kitchen's board. A stranger with the network tab open
 * could do it, and so could a guest whose saved scan context made the page think
 * it was on a real venue.
 *
 * Callers on the write path use this to refuse. Reads are untouched: browsing the
 * demo menu is the entire point of it.
 */
export function isDemoVenue(venue: { slug?: string | null } | null | undefined): boolean {
  const slug = venue?.slug?.trim();
  if (!slug) return false;
  return slug === demoVenueSlug();
}
