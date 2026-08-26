import "./load-env.js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

/**
 * Creates (or repairs) one login account per manageable admin team role so the
 * super-admin Roles & Permissions page can be tested end-to-end: assign page
 * access to a role, then sign in as that role and see the effect.
 *
 * All use password Admin@123 and are pre-approved + email-verified so they can
 * sign in immediately on a local/demo box.
 */
const ADMIN_ROLE_ACCOUNTS: Array<[email: string, name: string, role: string]> = [
  ["financeadmin@fastapmenu.com", "Finance Admin", "finance_admin"],
  ["supportadmin@fastapmenu.com", "Support Admin", "support_admin"],
  ["complianceadmin@fastapmenu.com", "Compliance Admin", "compliance_admin"],
  ["salesadmin@fastapmenu.com", "Sales Admin", "sales_admin"],
  ["operationsadmin@fastapmenu.com", "Operations Admin", "operations_admin"],
];

async function main() {
  const hash = await bcrypt.hash("Admin@123", 12);
  for (const [email, name, role] of ADMIN_ROLE_ACCOUNTS) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing) {
      await db.update(usersTable)
        .set({ role, passwordHash: hash, approvalStatus: "approved", isEmailVerified: true })
        .where(eq(usersTable.id, existing.id));
      console.log(`updated  ${role.padEnd(18)} ${email}`);
    } else {
      await db.insert(usersTable).values({
        name, email, passwordHash: hash, role,
        approvalStatus: "approved", isEmailVerified: true,
      });
      console.log(`created  ${role.padEnd(18)} ${email}`);
    }
  }
  console.log("Done. Password for all: Admin@123");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
