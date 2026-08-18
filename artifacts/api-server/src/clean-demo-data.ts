import "./load-env.js";
import bcrypt from "bcryptjs";
import { eq, inArray, or, like } from "drizzle-orm";
import {
  db,
  usersTable,
  restaurantsTable,
  staffTable,
  guestUsersTable,
  platformSettingsTable,
} from "@workspace/db";
import { DEMO_STAFF_ROWS } from "./lib/demo-staff.js";

/** Known demo / test markers from seed.ts and integration tests. */
export const DEMO_RESTAURANT_SLUGS = ["spice-garden"] as const;

export const DEMO_OWNER_EMAILS = ["demo@fastapmenu.com"] as const;

export const DEMO_STAFF_EMAILS = DEMO_STAFF_ROWS.map(r => r.email.toLowerCase());

export const DEMO_GUEST_PHONES = ["9876543210"] as const;

export const DEMO_GUEST_EMAILS = ["rahul@example.com"] as const;

function isConfirmed(): boolean {
  return process.env.CONFIRM_CLEAN === "1" || process.argv.includes("--confirm");
}

const SUPERADMIN_EMAIL = "superadmin@fastapmenu.com";

/** Ensure platform super admin exists after demo purge (does not re-seed restaurants). */
export async function ensureSuperAdminUser(): Promise<void> {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, SUPERADMIN_EMAIL));
  if (existing) {
    console.log("Super admin account kept:", SUPERADMIN_EMAIL);
    return;
  }
  const password = process.env.SEED_SUPERADMIN_PASSWORD || "Admin@123";
  const hash = await bcrypt.hash(password, 12);
  await db.insert(usersTable).values({
    name: "Super Admin",
    email: SUPERADMIN_EMAIL,
    passwordHash: hash,
    role: "super_admin",
  });
  console.log("Created super admin account:", SUPERADMIN_EMAIL);
}

/** Drop cached platform invoices (stale vendor rows survive restaurant deletes). */
export async function clearPlatformDemoCaches(): Promise<void> {
  await db.delete(platformSettingsTable).where(eq(platformSettingsTable.key, "subscription_invoices"));
  console.log("Cleared platform invoice cache");
}

export async function runCleanDemoData(): Promise<{ restaurants: number; users: number; guests: number }> {
  if (!isConfirmed()) {
    throw new Error(
      "Refusing to clean demo data without confirmation. Set CONFIRM_CLEAN=1 or pass --confirm.",
    );
  }

  console.log("Cleaning demo / test data from database…");

  const slugMatches = await db
    .select({ id: restaurantsTable.id, slug: restaurantsTable.slug })
    .from(restaurantsTable)
    .where(inArray(restaurantsTable.slug, [...DEMO_RESTAURANT_SLUGS]));

  const staffMatches = await db
    .select({ restaurantId: staffTable.restaurantId })
    .from(staffTable)
    .where(like(staffTable.email, "%@spicegarden.com"));

  const demoRestaurantIdSet = new Set([
    ...slugMatches.map(r => r.id),
    ...staffMatches.map(s => s.restaurantId),
  ]);
  const demoRestaurantIds = [...demoRestaurantIdSet];

  if (demoRestaurantIds.length) {
    const labels = slugMatches.length
      ? slugMatches.map(r => r.slug).join(", ")
      : demoRestaurantIds.join(", ");
    console.log(`Removing ${demoRestaurantIds.length} demo restaurant(s): ${labels}`);
    await db.delete(restaurantsTable).where(inArray(restaurantsTable.id, demoRestaurantIds));
  } else {
    console.log("No demo restaurants found");
  }

  const testOwnerRows = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(
      or(
        inArray(usersTable.email, [...DEMO_OWNER_EMAILS]),
        like(usersTable.email, "%@fastap.test"),
        like(usersTable.email, "pub-test-%"),
      ),
    );

  const testUserIds = testOwnerRows.map(u => u.id);
  if (testUserIds.length) {
    console.log(`Removing ${testUserIds.length} demo/test owner account(s)`);
    await db.delete(usersTable).where(inArray(usersTable.id, testUserIds));
  }

  const orphanOwnerRows = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.role, "restaurant_owner"));
  let orphanCount = 0;
  for (const owner of orphanOwnerRows) {
    if (owner.email === "superadmin@fastapmenu.com") continue;
    const [linked] = await db
      .select({ id: restaurantsTable.id })
      .from(restaurantsTable)
      .where(eq(restaurantsTable.userId, owner.id))
      .limit(1);
    if (!linked) {
      await db.delete(usersTable).where(eq(usersTable.id, owner.id));
      orphanCount += 1;
    }
  }
  if (orphanCount) console.log(`Removed ${orphanCount} orphan restaurant owner(s)`);

  await ensureSuperAdminUser();
  await clearPlatformDemoCaches();

  const demoGuests = await db
    .select({ id: guestUsersTable.id, email: guestUsersTable.email, phone: guestUsersTable.phone })
    .from(guestUsersTable)
    .where(
      or(
        inArray(guestUsersTable.phone, [...DEMO_GUEST_PHONES]),
        inArray(guestUsersTable.email, [...DEMO_GUEST_EMAILS]),
        like(guestUsersTable.email, "%@example.com"),
      ),
    );

  const demoGuestIds = demoGuests.map(g => g.id);
  if (demoGuestIds.length) {
    console.log(`Removing ${demoGuestIds.length} demo guest user(s)`);
    await db.delete(guestUsersTable).where(inArray(guestUsersTable.id, demoGuestIds));
  }

  console.log("Demo data cleanup complete (superadmin and real registrations kept).");
  return {
    restaurants: demoRestaurantIds.length,
    users: testUserIds.length + orphanCount,
    guests: demoGuestIds.length,
  };
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").includes("clean-demo-data");
if (invokedDirectly) {
  runCleanDemoData()
    .then(summary => {
      console.log(JSON.stringify(summary));
      process.exit(0);
    })
    .catch(err => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
