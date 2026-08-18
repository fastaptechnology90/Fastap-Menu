#!/usr/bin/env node
/** Smoke test mobile kitchen API for kitchen, waiter, and housekeeping roles */
const BASE = process.env.API_BASE || "http://127.0.0.1:8080";
const ROOT = `${BASE}/api/v1`;

const ROLE_SPECS = [
  {
    label: "kitchen (headChef)",
    role: "headChef",
    staffCode: process.env.MOBILE_STAFF_CHEF || "chef@spicegarden.com",
    boards: ["/dashboard?section=All", "/kds?section=All", "/orders/processing", "/live-alerts/board", "/chef-tasks/board?section=All", "/inventory/board?section=All"],
  },
  {
    label: "waiter",
    role: "waiter",
    staffCode: process.env.MOBILE_STAFF_WAITER || "waiter@spicegarden.com",
    boards: ["/dashboard?section=All", "/waiter-auto-assignment/board?section=All", "/live-alerts/board"],
  },
  {
    label: "housekeeping",
    role: "housekeeping",
    staffCode: process.env.MOBILE_STAFF_HK || "housekeeping@spicegarden.com",
    boards: ["/dashboard?section=All", "/hygiene/board?section=All", "/room-service/board?section=All"],
  },
];

async function req(method, path, body, token) {
  const res = await fetch(`${ROOT}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function smokeRole(spec) {
  console.log(`\n── ${spec.label} (${spec.staffCode}) ──`);

  const login = await req("POST", "/auth/password", {
    staffCode: spec.staffCode,
    password: process.env.MOBILE_PASS || "Staff@123",
    deviceId: "smoke-device-1",
    role: spec.role,
  });
  console.log("POST /auth/password", login.status, login.status === 200 ? "OK" : login.json);
  if (login.status !== 200) return false;

  const token = login.json?.data?.token;
  if (!token) {
    console.error("No token in login response");
    return false;
  }

  const session = await req("GET", "/auth/session", null, token);
  console.log("GET /auth/session", session.status, session.status === 200 ? "OK" : session.json);
  if (session.status !== 200) return false;

  for (const path of spec.boards) {
    const r = await req("GET", path, null, token);
    console.log(`GET ${path}`, r.status, r.status === 200 ? "OK" : r.json);
    if (r.status !== 200) return false;
  }

  return true;
}

async function main() {
  console.log(`Mobile API smoke: ${ROOT}`);

  for (const spec of ROLE_SPECS) {
    const ok = await smokeRole(spec);
    if (!ok) process.exit(1);
  }

  console.log("\nAll mobile API role checks passed (kitchen, waiter, housekeeping).");
}

main().catch((e) => { console.error(e); process.exit(1); });
