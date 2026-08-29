// Persists the guest's current (unbilled) order so that closing and reopening the site
// brings them back to it — the running tab, with the live timer and the ordered items.
const KEY = "fastap_active_order";

export type ActiveOrderRef = { id: string; slug: string | null; table: string | null; at: number };

export function saveActiveOrder(o: ActiveOrderRef): void {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* private mode / blocked */ }
}

export function loadActiveOrder(): ActiveOrderRef | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && o.id ? o as ActiveOrderRef : null;
  } catch { return null; }
}

export function clearActiveOrder(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
