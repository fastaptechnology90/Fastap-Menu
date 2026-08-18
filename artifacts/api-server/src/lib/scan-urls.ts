export function getPublicBaseUrl(): string {
  const fromEnv = process.env.PUBLIC_URL?.replace(/\/$/, "");
  if (fromEnv && !/localhost|127\.0\.0\.1/i.test(fromEnv)) return fromEnv;
  if (process.env.NODE_ENV === "production") return "https://digitalrestuarants.thefingo.com";
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
