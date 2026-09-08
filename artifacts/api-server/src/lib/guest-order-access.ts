import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db, ordersTable, guestUsersTable, guestSessionsTable } from "@workspace/db";
import type { Order } from "@workspace/db";

/**
 * Decide whether the caller is allowed to act on one guest order.
 *
 * Several public routes looked an order up by its integer id and then acted on it with
 * no check at all — pay it, add a deposit, cancel it, read the customer's name and
 * phone. Ids are sequential, so anyone could walk them and settle or read strangers'
 * orders.
 *
 * An order belongs to the caller when any of these hold:
 *  - it was placed in this browser session (the guest session's restaurant and the
 *    order's table/session line up), or
 *  - the caller is signed in as a guest whose phone or email is on the order.
 *
 * Staff act on orders through the panel routes, which are tenant-scoped separately.
 */
export async function guestOwnsOrder(req: Request, order: Order): Promise<boolean> {
  // Signed-in guest: match on the contact details recorded against the order.
  const guestUserId = req.session.guestUserId;
  if (guestUserId) {
    const [guest] = await db
      .select()
      .from(guestUsersTable)
      .where(eq(guestUsersTable.id, guestUserId))
      .limit(1);
    if (guest) {
      if (guest.phone && order.customerPhone && guest.phone === order.customerPhone) return true;
      if (guest.email && order.customerEmail && guest.email === order.customerEmail) return true;
    }
  }

  // Anonymous guest at a table: the order must have been placed in this same session.
  const sessionId = req.session.guestSessionId;
  if (sessionId) {
    const [guestSession] = await db
      .select()
      .from(guestSessionsTable)
      .where(eq(guestSessionsTable.id, sessionId))
      .limit(1);
    if (guestSession && guestSession.restaurantId === order.restaurantId) {
      const meta = (order.metadata ?? {}) as Record<string, unknown>;
      if (Number(meta.guestSessionId) === sessionId) return true;
      // Fall back to the table: a diner may pay for the order at the table they are
      // seated at even if the session id was not stamped on it.
      if (
        guestSession.tableId != null &&
        order.tableId != null &&
        guestSession.tableId === order.tableId
      ) {
        return true;
      }
    }
  }

  return false;
}

/** Load an order and confirm the caller may act on it. Returns null when they may not. */
export async function loadOwnedOrder(req: Request, orderId: number): Promise<Order | null> {
  if (!Number.isInteger(orderId) || orderId <= 0) return null;
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) return null;
  return (await guestOwnsOrder(req, order)) ? order : null;
}
