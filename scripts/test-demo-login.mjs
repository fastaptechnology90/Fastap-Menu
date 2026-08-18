#!/usr/bin/env node
/**
 * Verifies all 12 restaurant demo role logins against the API.
 * Usage: API_BASE=http://localhost:8080/api node scripts/test-demo-login.mjs
 */
const BASE = process.env.API_BASE || "http://localhost:8080/api";
const PASSWORD = process.env.DEMO_PASSWORD || "Staff@123";

const ROLES = [
  { role: "owner", email: "owner@spicegarden.com" },
  { role: "manager", email: "manager@spicegarden.com" },
  { role: "cashier", email: "cashier@spicegarden.com" },
  { role: "waiter", email: "waiter@spicegarden.com" },
  { role: "chef", email: "chef@spicegarden.com" },
  { role: "kitchen", email: "kitchen@spicegarden.com" },
  { role: "reception", email: "reception@spicegarden.com" },
  { role: "finance", email: "finance@spicegarden.com" },
  { role: "housekeeping", email: "housekeeping@spicegarden.com" },
  { role: "bar", email: "bar@spicegarden.com" },
  { role: "spa", email: "spa@spicegarden.com" },
  { role: "hr", email: "hr@spicegarden.com" },
  { role: "franchise", email: "franchise@spicegarden.com" },
];

let cookie = "";

async function req(method, path, body) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const part = c.split(";")[0];
    if (part) cookie = cookie ? `${cookie}; ${part}` : part;
  }
  const data = res.headers.get("content-type")?.includes("json")
    ? await res.json().catch(() => null)
    : null;
  return { status: res.status, data };
}

async function main() {
  console.log(`\nDemo role login test — ${BASE}\n`);
  let passed = 0;
  let failed = 0;

  for (const { role, email } of ROLES) {
    cookie = "";
    const login = await req("POST", "/restaurant-auth/login", { email, password: PASSWORD });
    if (login.status !== 200) {
      console.log(`FAIL  ${role.padEnd(14)} login ${login.status} — ${login.data?.error || "unknown"}`);
      failed++;
      continue;
    }
    if (login.data?.staff?.role !== role) {
      console.log(`FAIL  ${role.padEnd(14)} wrong role returned: ${login.data?.staff?.role}`);
      failed++;
      continue;
    }
    const me = await req("GET", "/restaurant-auth/me");
    if (me.status !== 200 || me.data?.staff?.role !== role) {
      console.log(`FAIL  ${role.padEnd(14)} session/me failed ${me.status}`);
      failed++;
      continue;
    }
    console.log(`PASS  ${role.padEnd(14)} ${email}`);
    passed++;
  }

  console.log(`\n${passed}/${ROLES.length} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
