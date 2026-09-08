/**
 * What an order's status is allowed to be, and where it can go from there.
 *
 * The status column is free text and nothing checked it: `status: "banana"` was accepted
 * with a 200, and an order could jump from completed back to new, or from cancelled to
 * ready. The kitchen display, the waiter board, billing and every revenue figure key off
 * this field, so a value none of them recognise makes an order invisible to all of them
 * while still sitting in the table.
 *
 * The vocabulary below is the one already in the data, not a new one — changing the words
 * would strand the rows that exist. `pending`, `new` and `confirmed` all mean "just
 * arrived" in different parts of the codebase; they are kept as aliases rather than
 * merged, because the mobile app and the panels each send their own.
 */

export const ORDER_STATUSES = [
  "pending",
  "new",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "serving",
  "served",
  "delivered",
  "billing",
  "billed",
  "completed",
  "cancelled",
  "delayed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The three ways an order can be described as "just arrived". */
const ARRIVED: OrderStatus[] = ["pending", "new", "confirmed"];

/**
 * Where each status may go next.
 *
 * Deliberately permissive about moving *forward* and about cancelling, because a real
 * floor skips steps constantly — a counter sale goes straight from arrived to completed,
 * and a takeaway never gets "served". What it refuses is going backwards from a settled
 * state, and reviving a cancelled order, since both corrupt the day's takings.
 */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending:   [...ARRIVED, "accepted", "preparing", "ready", "serving", "served", "delivered", "billing", "billed", "completed", "cancelled", "delayed"],
  new:       [...ARRIVED, "accepted", "preparing", "ready", "serving", "served", "delivered", "billing", "billed", "completed", "cancelled", "delayed"],
  confirmed: [...ARRIVED, "accepted", "preparing", "ready", "serving", "served", "delivered", "billing", "billed", "completed", "cancelled", "delayed"],
  accepted:  ["accepted", "preparing", "ready", "serving", "served", "delivered", "billing", "billed", "completed", "cancelled", "delayed"],
  preparing: ["preparing", "ready", "serving", "served", "delivered", "billing", "billed", "completed", "cancelled", "delayed"],
  // A chef who bumps the wrong ticket needs to put it back — ready to preparing is allowed.
  ready:     ["ready", "preparing", "serving", "served", "delivered", "billing", "billed", "completed", "cancelled", "delayed"],
  serving:   ["serving", "served", "delivered", "billing", "billed", "completed", "cancelled"],
  served:    ["served", "delivered", "billing", "billed", "completed", "cancelled"],
  delivered: ["delivered", "billing", "billed", "completed", "cancelled"],
  billing:   ["billing", "billed", "completed", "served", "cancelled"],
  billed:    ["billed", "completed", "cancelled"],
  // Settled. Only a cancellation can follow, and that reverses the ledger.
  completed: ["completed", "cancelled"],
  // Terminal. Reviving a cancelled order would put money back that was already reversed.
  cancelled: ["cancelled"],
  delayed:   ["delayed", "preparing", "ready", "serving", "served", "delivered", "billing", "billed", "completed", "cancelled"],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export function canTransition(from: string, to: string): TransitionResult {
  if (!isOrderStatus(to)) {
    return { ok: false, reason: `"${to}" is not an order status.` };
  }
  // An unrecognised current status can only mean data written before this existed; let it
  // move rather than trapping the order in a value nothing can act on.
  if (!isOrderStatus(from)) {
    return { ok: true };
  }
  if (NEXT[from].includes(to)) {
    return { ok: true };
  }
  return { ok: false, reason: `An order that is ${from} cannot become ${to}.` };
}
