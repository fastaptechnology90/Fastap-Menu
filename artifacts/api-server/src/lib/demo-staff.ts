import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, restaurantsTable, staffTable } from "@workspace/db";

export const DEMO_STAFF_PASSWORD =
  process.env.SEED_OWNER_PASSWORD || process.env.SEED_STAFF_PASSWORD || "Staff@123";

export const DEMO_STAFF_ROWS = [
  { name: "Venue Owner", email: "owner@spicegarden.com", phone: "9876543210", role: "owner" },
  { name: "Priya Sharma", email: "manager@spicegarden.com", phone: "9876543211", role: "manager" },
  { name: "Sara Johnson", email: "cashier@spicegarden.com", phone: "9876543212", role: "cashier" },
  { name: "Ahmed Al-Rashidi", email: "waiter@spicegarden.com", phone: "9876543213", role: "waiter" },
  { name: "Chef Ravi", email: "chef@spicegarden.com", phone: "9876543214", role: "chef" },
  { name: "Kitchen Lead", email: "kitchen@spicegarden.com", phone: "9876543215", role: "kitchen" },
  { name: "Front Desk", email: "reception@spicegarden.com", phone: "9876543216", role: "reception" },
  { name: "Finance Desk", email: "finance@spicegarden.com", phone: "9876543217", role: "finance" },
  { name: "HK Supervisor", email: "housekeeping@spicegarden.com", phone: "9876543218", role: "housekeeping" },
  { name: "Bar Captain", email: "bar@spicegarden.com", phone: "9876543219", role: "bar" },
  { name: "Spa Coordinator", email: "spa@spicegarden.com", phone: "9876543220", role: "spa" },
  { name: "HR Manager", email: "hr@spicegarden.com", phone: "9876543221", role: "hr" },
  { name: "Franchise Partner", email: "franchise@spicegarden.com", phone: "9876543222", role: "franchise" },
] as const;

/** Upsert demo staff for spice-garden (restaurant login role picker). */
export async function ensureDemoStaffAccounts(): Promise<{ created: number; updated: number } | null> {
  let [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.slug, "spice-garden"))
    .limit(1);
  if (!restaurant) {
    const rows = await db
      .select({ restaurant: restaurantsTable })
      .from(staffTable)
      .innerJoin(restaurantsTable, eq(staffTable.restaurantId, restaurantsTable.id))
      .where(eq(staffTable.email, "owner@spicegarden.com"))
      .limit(1);
    restaurant = rows[0]?.restaurant;
  }
  if (!restaurant) return null;

  const demoPinHash = await bcrypt.hash(DEMO_STAFF_PASSWORD, 10);
  const existingStaff = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.restaurantId, restaurant.id));
  const byEmail = new Map(existingStaff.map(s => [String(s.email).toLowerCase(), s]));

  let created = 0;
  let updated = 0;
  for (const row of DEMO_STAFF_ROWS) {
    const key = row.email.toLowerCase();
    const existing = byEmail.get(key);
    if (existing) {
      await db.update(staffTable).set({
        name: row.name,
        phone: row.phone,
        role: row.role,
        pinHash: demoPinHash,
        isActive: true,
      }).where(eq(staffTable.id, existing.id));
      updated += 1;
      continue;
    }
    await db.insert(staffTable).values({
      restaurantId: restaurant.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      pinHash: demoPinHash,
      isActive: true,
    });
    created += 1;
  }
  return { created, updated };
}
