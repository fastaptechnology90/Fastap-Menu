import { type Request } from "express";
import { eq, and } from "drizzle-orm";
import { db, restaurantsTable, usersTable } from "@workspace/db";

/** Returns restaurant row if the session may access it, else null. */
export async function getAccessibleRestaurant(req: Request, restaurantId: number) {
  if (req.session.staffSession?.restaurantId === restaurantId) {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
    return r ?? null;
  }
  if (!req.session.userId) return null;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (user?.role === "super_admin") {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
    return r ?? null;
  }

  const [r] = await db.select().from(restaurantsTable).where(
    and(eq(restaurantsTable.id, restaurantId), eq(restaurantsTable.userId, req.session.userId)),
  );
  return r ?? null;
}

export async function assertRestaurantAccess(req: Request, restaurantId: number) {
  return (await getAccessibleRestaurant(req, restaurantId)) !== null;
}
