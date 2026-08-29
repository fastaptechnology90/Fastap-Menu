// Persists the guest's current (unbilled) order so that closing and reopening the site
// brings them back to it — the running tab, with the live timer and the ordered items.
const KEY = "fastap_active_order";

// Keep the guest's running tab only while it's fresh. After this idle window we treat it as
// a finished sitting and drop it, so a returning guest starts a clean order instead of seeing
// the previous party's stale tab. Matches the server merge window (ORDER_MERGE_WINDOW_MIN, 120m).
const ACTIVE_ORDER_TTL_MS = 120 * 60 * 1000;

export type ActiveOrderRef = { id: string; slug: string | null; table: string | null; at: number };

export function saveActiveOrder(o: ActiveOrderRef): void {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* private mode / blocked */ }
}

export function loadActiveOrder(): ActiveOrderRef | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.id) return null;
    if (typeof o.at === "number" && Date.now() - o.at > ACTIVE_ORDER_TTL_MS) {
      clearActiveOrder();
      return null;
    }
    return o as ActiveOrderRef;
  } catch { return null; }
}

export function clearActiveOrder(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
