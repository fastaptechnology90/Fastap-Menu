import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db, guestSessionsTable } from "@workspace/db";

/**
 * Which hotel room, if any, the caller's browser session is bound to.
 *
 * The room endpoints identified a guest by nothing more than the room number in the
 * URL. Room numbers run 101, 102, 103…, so counting upward handed out the occupant's
 * name, phone, check-in and check-out dates, and let a stranger switch someone else's
 * lights and air conditioning. A room number is a location, not a credential.
 *
 * The binding comes from the session row created when the room QR was scanned
 * (`/public/venue/<slug>?room=101` records `roomNumber` on the guest session), so a
 * guest standing in the room keeps everything they had.
 */
export async function callerRoomNumber(req: Request): Promise<{ restaurantId: number | null; roomNumber: string | null }> {
  const sessionId = req.session.guestSessionId;
  if (!sessionId) return { restaurantId: null, roomNumber: null };
  const [row] = await db
    .select({ restaurantId: guestSessionsTable.restaurantId, roomNumber: guestSessionsTable.roomNumber })
    .from(guestSessionsTable)
    .where(eq(guestSessionsTable.id, sessionId))
    .limit(1);
  if (!row) return { restaurantId: null, roomNumber: null };
  return { restaurantId: row.restaurantId ?? null, roomNumber: row.roomNumber ?? null };
}

/** True when this browser session was opened from the QR code inside that very room. */
export async function callerIsInRoom(req: Request, restaurantId: number, roomNumber: string): Promise<boolean> {
  const bound = await callerRoomNumber(req);
  if (!bound.roomNumber) return false;
  return bound.restaurantId === restaurantId && bound.roomNumber === roomNumber;
}
