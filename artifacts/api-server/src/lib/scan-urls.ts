/**
 * The address a QR code sends a guest to.
 *
 * This fell back to a hardcoded domain that no longer resolves, so in production every
 * table and room QR generated without PUBLIC_URL set pointed at nothing — a guest
 * scanning the code on their table got a browser error, and there was no sign of it
 * anywhere in the product.
 *
 * The deployment's own domain is used when the platform supplies one (Railway sets
 * RAILWAY_PUBLIC_DOMAIN), and there is no invented fallback: a QR pointing at the wrong
 * host is worse than a startup that says its address is not configured.
 */
export function getPublicBaseUrl(): string {
  const fromEnv = process.env.PUBLIC_URL?.replace(/\/$/, "");
  if (fromEnv && !/localhost|127\.0\.0\.1/i.test(fromEnv)) return fromEnv;

  const platformDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (platformDomain) return `https://${platformDomain}`;

  const railwayStatic = process.env.RAILWAY_STATIC_URL?.replace(/\/$/, "");
  if (railwayStatic) return railwayStatic.startsWith("http") ? railwayStatic : `https://${railwayStatic}`;

  const port = process.env.PORT ?? "8080";
  return `http://localhost:${port}`;
}

export function buildScanUrl(slug: string, opts: { table?: string; room?: string; entry?: string } = {}): string {
  const qs = new URLSearchParams();
  if (opts.table) qs.set("table", opts.table);
  if (opts.room) qs.set("room", opts.room);
  qs.set("entry", opts.entry ?? (opts.room ? "room_qr" : "qr"));
  const q = qs.toString();
  return `${getPublicBaseUrl()}/scan/${slug}${q ? `?${q}` : ""}`;
}
