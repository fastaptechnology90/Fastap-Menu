#!/usr/bin/env node
/**
 * Clear orders, analytics, guests, and platform transaction stats while keeping:
 * - Login accounts (users, staff)
 * - Restaurant setup (restaurant, branches, menu, tables, QR)
 * - Super-admin platform config (settings, plans, roles, commission rules)
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/db-clean-stats.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(path.join(root, "lib", "db", "package.json"));
const pg = require("pg");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

/** Tables that define accounts, venue setup, and admin config — never truncated. */
const KEEP_TABLES = new Set([
  "__drizzle_migrations",
  "users",
  "restaurants",
  "staff",
  "branches",
  "categories",
  "menu_items",
  "tables_map",
  "table_areas",
  "qr_codes",
  "loyalty_programs",
  "spa_services",
  "hotel_rooms",
  "recipes",
  "recipe_ingredients",
  "inventory_items",
  "documents",
  "sop_items",
  "promo_codes",
  "campaigns",
  "platform_settings",
  "platform_plans",
  "platform_roles",
  "platform_commission_rules",
  "platform_taxes",
  "platform_api_keys",
  "platform_coupons",
  "platform_announcements",
  "platform_ip_whitelist",
]);

const RESET_COUNTERS_SQL = `
UPDATE menu_items SET view_count = 0, order_count = 0;
UPDATE qr_codes SET scans = 0;
UPDATE promo_codes SET used_count = 0;
UPDATE tables_map SET
  status = 'free',
  current_guest_count = 0,
  occupied_since = NULL,
  current_waiter_name = NULL,
  current_order_id = NULL,
  current_customer_name = NULL,
  reserved_until = NULL,
  reservation_id = NULL,
  locked_by = NULL,
  notes = NULL;
UPDATE hotel_rooms SET
  status = 'vacant',
  guest_name = NULL,
  guest_phone = NULL,
  check_in = NULL,
  check_out = NULL;
`;

async function main() {
  const client = new pg.Client({ connectionString: dbUrl, connectionTimeoutMillis: 15000 });
  await client.connect();

  const { rows } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  const toClear = rows
    .map((r) => r.tablename)
    .filter((name) => !KEEP_TABLES.has(name));

  console.log(`Keeping ${KEEP_TABLES.size - 1} config/account tables.`);
  console.log(`Clearing ${toClear.length} transactional/stat tables…`);

  if (toClear.length > 0) {
    const quoted = toClear.map((t) => `"${t.replace(/"/g, '""')}"`).join(", ");
    await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  }

  console.log("Resetting menu/table/QR counters…");
  await client.query(RESET_COUNTERS_SQL);

  const [orders] = (await client.query(`SELECT count(*)::int AS c FROM orders`)).rows;
  const [customers] = (await client.query(`SELECT count(*)::int AS c FROM customers`)).rows;
  const [users] = (await client.query(`SELECT count(*)::int AS c FROM users`)).rows;
  const [staff] = (await client.query(`SELECT count(*)::int AS c FROM staff`)).rows;
  const [restaurants] = (await client.query(`SELECT count(*)::int AS c FROM restaurants`)).rows;

  await client.end();

  console.log("Done.");
  console.log(`  users: ${users.c} | staff: ${staff.c} | restaurants: ${restaurants.c}`);
  console.log(`  orders: ${orders.c} | customers: ${customers.c}`);
  console.log("Restart API to flush in-memory analytics cache (pm2 restart fastap-api).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
