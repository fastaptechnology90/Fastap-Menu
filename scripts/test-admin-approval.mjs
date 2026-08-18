/**
 * Admin approval on open registration (BUG #2).
 *
 * A self-service POST /auth/register account lands as "pending" and cannot sign in
 * until a super admin approves it. Existing and admin-created accounts default to
 * "approved", so real admins are never caught by the gate. Needs the API running;
 * API_BASE defaults to http://127.0.0.1:3001/api.
 */
import "./load-env.mjs";

const API = process.env.API_BASE || "http://127.0.0.1:3001/api";
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

const j = async r => { try { return await r.json(); } catch { return {}; } };

// 1. Register a fresh owner through the public route.
const email = `approval.test.${Date.now()}@example.com`;
const password = "Test@123456";
const reg = await fetch(`${API}/auth/register`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Approval Test", email, password }),
});
const regBody = await j(reg);
check("register accepted", reg.status === 201, `status ${reg.status}`);
check("register says approval required", regBody.approvalRequired === true, String(regBody.approvalRequired));
check("register does NOT sign in (no cookie)", !(/connect\.sid|session/i.test(reg.headers.get("set-cookie") || "")),
  reg.headers.get("set-cookie") ? "cookie present" : "no cookie");

// 2. Try to log in while still pending — must be blocked.
const login1 = await fetch(`${API}/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const l1 = await j(login1);
check("pending owner cannot log in", login1.status === 403 && l1.code === "ACCOUNT_PENDING_APPROVAL",
  `${login1.status} ${l1.code}`);

// 3. Sign in as super admin and find the pending owner.
const jar = [];
const grab = r => { const c = r.headers.get("set-cookie"); if (c) jar.push(c.split(";")[0]); };
const adminLogin = await fetch(`${API}/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.SMOKE_ADMIN_EMAIL || "superadmin@fastapmenu.com",
    password: process.env.SMOKE_ADMIN_PASSWORD || "Admin@123",
  }),
});
grab(adminLogin);
check("super admin logs in", adminLogin.status === 200, `status ${adminLogin.status}`);
const cookie = jar.join("; ");

const pendRes = await fetch(`${API}/superadmin/pending-owners`, { headers: { Cookie: cookie } });
const pending = await j(pendRes);
const mine = Array.isArray(pending) ? pending.find(u => u.email === email) : null;
check("pending owner appears in the queue", !!mine, mine ? `id ${mine.id}` : "not found");

// 4. Approve, then the owner can log in.
if (mine) {
  const appr = await fetch(`${API}/superadmin/owners/${mine.id}/approve`, { method: "POST", headers: { Cookie: cookie } });
  check("approve succeeds", appr.status === 200, `status ${appr.status}`);

  const login2 = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  check("approved owner can log in", login2.status === 200, `status ${login2.status}`);
}

// 5. A rejected owner is refused with the right code.
const email2 = `reject.test.${Date.now()}@example.com`;
await fetch(`${API}/auth/register`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Reject Test", email: email2, password }),
});
const pend2 = await j(await fetch(`${API}/superadmin/pending-owners`, { headers: { Cookie: cookie } }));
const mine2 = Array.isArray(pend2) ? pend2.find(u => u.email === email2) : null;
if (mine2) {
  await fetch(`${API}/superadmin/owners/${mine2.id}/reject`, { method: "POST", headers: { Cookie: cookie } });
  const login3 = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email2, password }),
  });
  const l3 = await j(login3);
  check("rejected owner is refused", login3.status === 403 && l3.code === "ACCOUNT_REJECTED", `${login3.status} ${l3.code}`);
}

console.log(`\n  ${pass}/${pass + fail} pass`);
process.exit(fail ? 1 : 0);
