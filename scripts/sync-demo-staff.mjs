#!/usr/bin/env node
/**
 * Sync spice-garden demo staff (run on VPS after deploy/seed).
 * Uses psql + bcrypt from api-server workspace — no root-level deps.
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiServerDir = path.resolve(__dirname, "../artifacts/api-server");
const require = createRequire(path.join(apiServerDir, "package.json"));
const bcrypt = require("bcryptjs");

const PASSWORD = process.env.SEED_STAFF_PASSWORD || process.env.SEED_OWNER_PASSWORD || "Staff@123";

const STAFF = [
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
];

function psql(sql) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return execSync(`psql "${url}" -v ON_ERROR_STOP=1 -t -A -c ${JSON.stringify(sql)}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const hash = bcrypt.hashSync(PASSWORD, 10);

const rid = psql(`SELECT id FROM restaurants WHERE slug = 'spice-garden' LIMIT 1`);
if (!rid) {
  console.error("spice-garden restaurant not found — run seed first");
  process.exit(1);
}

let created = 0;
let updated = 0;

for (const row of STAFF) {
  const existing = psql(
    `SELECT id FROM staff WHERE restaurant_id = ${rid} AND lower(email) = '${esc(row.email.toLowerCase())}' LIMIT 1`,
  );
  if (existing) {
    psql(
      `UPDATE staff SET name='${esc(row.name)}', phone='${esc(row.phone)}', role='${esc(row.role)}', pin_hash='${esc(hash)}', is_active=true WHERE id=${existing}`,
    );
    updated += 1;
  } else {
    psql(
      `INSERT INTO staff (restaurant_id, name, email, phone, role, pin_hash, is_active) VALUES (${rid}, '${esc(row.name)}', '${esc(row.email)}', '${esc(row.phone)}', '${esc(row.role)}', '${esc(hash)}', true)`,
    );
    created += 1;
  }
}

console.log(`Demo staff synced: ${created} created, ${updated} updated (password: ${PASSWORD})`);
