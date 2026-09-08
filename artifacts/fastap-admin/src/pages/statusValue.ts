/**
 * The API and the database disagree with the UI about how a status is spelled:
 * the DB stores `pending_response`, older screens compared against
 * `"Pending Response"`, and a plain `!==` between the two silently disables
 * every action on the row. Compare through these helpers instead of inventing
 * another casing convention per page.
 */

/** `"Pending Response"`, `"pending_response"` and `"PENDING-RESPONSE"` all become `pending_response`. */
export function normalizeStatus(status: unknown): string {
  if (typeof status !== "string") return "";
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** True when `status` matches any of the accepted spellings. */
export function statusIs(status: unknown, ...accepted: string[]): boolean {
  const value = normalizeStatus(status);
  return accepted.some(candidate => normalizeStatus(candidate) === value);
}

/** Turns a stored status into something worth showing a human: `pending_response` → `Pending Response`. */
export function statusLabel(status: unknown): string {
  const value = normalizeStatus(status);
  if (!value) return "—";
  return value.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
