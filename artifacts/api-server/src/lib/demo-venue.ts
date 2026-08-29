// The public "Try Demo Menu" link uses a neutral slug (default "demo") so the URL never
// exposes the real restaurant's slug. This maps that alias to the actual demo venue slug
// for the DB lookup. Any real slug (e.g. an actual restaurant's own QR) passes through
// unchanged. Configurable via DEMO_VENUE_ALIAS / DEMO_VENUE_SLUG env vars.
export function resolveVenueSlug(slug: string): string {
  const alias = process.env.DEMO_VENUE_ALIAS ?? "demo";
  const demoSlug = process.env.DEMO_VENUE_SLUG ?? "spice-garden";
  return slug === alias ? demoSlug : slug;
}
