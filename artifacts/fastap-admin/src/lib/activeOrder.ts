// Persists the guest's current (unbilled) orders so closing and reopening the site brings them
// back — the running tab, with the live timer and the ordered items. Each round the guest places
// is a separate order, so we keep a LIST of them (newest first), not just the latest.
const KEY = "fastap_active_order";        // latest ref (kept for backward compatibility)
const KEY_LIST = "fastap_active_orders";  // every recent order round the guest placed

// Keep a round only while it's fresh. After this idle window we treat the sitting as finished and
// drop it. Matches the server tab window (ORDER_MERGE_WINDOW_MIN, 120m).
const ACTIVE_ORDER_TTL_MS = 120 * 60 * 1000;
const MAX_ORDERS = 8;

export type ActiveOrderRef = { id: string; slug: string | null; table: string | null; at: number };

export function loadActiveOrders(): ActiveOrderRef[] {
  try {
    const raw = localStorage.getItem(KEY_LIST);
    let list: ActiveOrderRef[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    // One-time migration from the old single-ref key.
    if (list.length === 0) {
      const single = localStorage.getItem(KEY);
      if (single) { const s = JSON.parse(single); if (s?.id) list = [s]; }
    }
    return list.filter(r => r && r.id && !(typeof r.at === "number" && Date.now() - r.at > ACTIVE_ORDER_TTL_MS));
  } catch { return []; }
}

export function saveActiveOrder(o: ActiveOrderRef): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
    const list = [o, ...loadActiveOrders().filter(r => r.id !== o.id)].slice(0, MAX_ORDERS);
    localStorage.setItem(KEY_LIST, JSON.stringify(list));
  } catch { /* private mode / blocked */ }
}

// Latest round (newest) — used where a single running order is expected.
export function loadActiveOrder(): ActiveOrderRef | null {
  return loadActiveOrders()[0] ?? null;
}

// Drop a single round from the list once it's no longer open (billed / cancelled).
export function removeActiveOrder(id: string): void {
  try {
    const list = loadActiveOrders().filter(r => String(r.id) !== String(id));
    localStorage.setItem(KEY_LIST, JSON.stringify(list));
    const single = localStorage.getItem(KEY);
    if (single) { try { if (String(JSON.parse(single)?.id) === String(id)) localStorage.removeItem(KEY); } catch { /* ignore */ } }
  } catch { /* ignore */ }
}

export function clearActiveOrder(): void {
  try { localStorage.removeItem(KEY); localStorage.removeItem(KEY_LIST); } catch { /* ignore */ }
}
