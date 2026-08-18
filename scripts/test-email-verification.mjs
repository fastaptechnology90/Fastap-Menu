/**
 * End-to-end check of the email verification flow.
 *
 * Runs a throwaway SMTP server on port 2525 so the mail is really delivered over a
 * socket — this proves nodemailer is wired up, not just that a function returned.
 * Points the platform's SMTP integration at it, walks the whole flow, then puts the
 * settings back exactly as they were.
 */
import "./load-env.mjs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(path.resolve(__dirname, ".."), "lib", "db", "package.json"));
const pg = require("pg");

const API = "http://127.0.0.1:8080/api";
const stamp = Date.now();
const EMAIL = `verify-${stamp}@fake.test`;
const PASSWORD = "Kuch@12345";

// ── throwaway SMTP server ────────────────────────────────────────────────────
const inbox = [];
const smtp = net.createServer(sock => {
  let body = "", inData = false;
  sock.write("220 localhost fake\r\n");
  sock.on("data", chunk => {
    if (inData) {
      body += chunk.toString();
      if (body.includes("\r\n.\r\n")) {
        inbox.push(body);
        inData = false; body = "";
        sock.write("250 OK\r\n");
      }
      return;
    }
    for (const line of chunk.toString().split("\r\n").filter(Boolean)) {
      const cmd = line.toUpperCase();
      if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) sock.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n");
      else if (cmd.startsWith("AUTH")) sock.write("235 OK\r\n");
      else if (cmd.startsWith("MAIL") || cmd.startsWith("RCPT")) sock.write("250 OK\r\n");
      else if (cmd.startsWith("DATA")) { inData = true; sock.write("354 go\r\n"); }
      else if (cmd.startsWith("QUIT")) { sock.write("221 bye\r\n"); sock.end(); }
      else sock.write("250 OK\r\n");
    }
  });
  sock.on("error", () => {});
});
await new Promise(r => smtp.listen(2525, "127.0.0.1", r));

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

// ── point the platform at it, remembering what was there ─────────────────────
const before = (await c.query(`select value from platform_settings where key='config'`)).rows[0]?.value ?? null;
const cfg = JSON.parse(JSON.stringify(before ?? {}));
cfg.integrations = cfg.integrations ?? { defaultPaymentGateway: "razorpay", services: {} };
cfg.integrations.services = cfg.integrations.services ?? {};
cfg.integrations.services.smtp = {
  enabled: true, host: "127.0.0.1", port: "2525",
  username: "u", password: "p", secure: false, fromEmail: "noreply@fastap.test",
};
await c.query(
  `insert into platform_settings (key, value) values ('config', $1)
   on conflict (key) do update set value = $1`,
  [JSON.stringify(cfg)],
);

const ok = (b) => (b ? "PASS" : "FAIL");
const results = [];
let rateLimited = false;
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`  ${ok(pass)}  ${name}${detail ? ` — ${detail}` : ""}`);
};

try {
  console.log("\n═══ SMTP set hai — ab verification lagni chahiye ═══\n");

  // 1. register
  const regRes = await fetch(`${API}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Verify Test", email: EMAIL, password: PASSWORD }),
  });
  if (regRes.status === 429) {
    // Sign-up is capped at 5 per hour per IP. Running this test repeatedly uses that
    // budget up. The counter lives in memory, so restarting the API clears it.
    console.log("\n  SKIPPED — sign-up rate limit reached (5/hour per IP).");
    console.log("  Restart the API to reset the counter, then run this again.\n");
    throw new Error("RATE_LIMITED");
  }
  const reg = await regRes.json();
  check("register 201 aur verification maangi gayi", regRes.status === 201 && reg.emailVerificationRequired === true,
    `HTTP ${regRes.status}`);
  check("email sach me bheji gayi (SMTP socket par aayi)", reg.verificationEmailSent === true);

  await new Promise(r => setTimeout(r, 300));
  check("nakli SMTP server ko mail mila", inbox.length === 1, `${inbox.length} message`);
  // Bodies arrive quoted-printable encoded: soft line breaks as "=\r\n" and any
  // literal "=" as "=3D", so `?token=` appears on the wire as `?token=3D`.
  const decoded = (inbox[0] ?? "")
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const gotLink = /verify-email\?token=([a-f0-9]{64})/.exec(decoded);
  check("mail ke andar verification link hai", Boolean(gotLink));

  // 2. login must be refused
  const l1 = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const l1b = await l1.json();
  check("bina confirm kiye login rukta hai", l1.status === 403 && l1b.code === "EMAIL_NOT_VERIFIED", `${l1.status} ${l1b.code}`);

  // 3. wrong password must still look the same as before (no leak)
  const bad = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: "GalatPassword1!" }),
  });
  check("galat password par ab bhi 401 (koi jaankari leak nahi)", bad.status === 401, String(bad.status));

  // 4. open the link
  const token = (await c.query(`select email_verification_token t from users where email=$1`, [EMAIL])).rows[0].t;
  const v = await fetch(`${API}/auth/verify-email?token=${token}`, { redirect: "manual" });
  check("link kholne par login page par bheja gaya", v.status === 302 && (v.headers.get("location") ?? "").includes("verified=ok"),
    v.headers.get("location") ?? String(v.status));

  // Admin approval is now a second gate on open registration (BUG #2): a confirmed
  // email alone is no longer enough — a super admin must approve the account too.
  // Approve it directly here so this test stays about the email gate, not approval
  // (the approval flow has its own test, test:admin-approval).
  await c.query(`update users set approval_status='approved' where email=$1`, [EMAIL]);

  // 5. login now works
  const l2 = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  check("confirm karne ke baad login chalta hai", l2.status === 200, String(l2.status));

  // 6. the same link must not work twice
  const again = await fetch(`${API}/auth/verify-email?token=${token}`, { redirect: "manual" });
  check("wahi link dobara nahi chalta", (again.headers.get("location") ?? "").includes("verified=invalid"),
    again.headers.get("location") ?? "");

  // 7. old accounts keep working
  const admin = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "superadmin@fastapmenu.com", password: "Admin@123" }),
  });
  check("purana super admin SMTP on hone par bhi login karta hai", admin.status === 200, String(admin.status));

  // 8. resend does not reveal whether an address exists
  const r1 = await fetch(`${API}/auth/resend-verification`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "koi-hai-hi-nahi@fake.test" }),
  });
  const r2 = await fetch(`${API}/auth/resend-verification`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL }),
  });
  check("resend dono halat me ek jaisa jawab deta hai",
    r1.status === r2.status && JSON.stringify(await r1.json()) === JSON.stringify(await r2.json()));

  console.log("\n─── mail ka asli content (nakli server ne pakda) ───");
  const raw = (inbox[0] ?? "").replace(/=\r\n/g, "");
  for (const line of raw.split("\r\n")) {
    if (/^(From|To|Subject):/i.test(line)) console.log("   " + line);
  }
  if (gotLink) console.log("   link: " + gotLink[0].slice(0, 60) + "…");
} catch (err) {
  if (err?.message !== "RATE_LIMITED") throw err;
  rateLimited = true;
} finally {
  // put the settings back exactly as they were
  if (before === null) await c.query(`delete from platform_settings where key='config'`);
  else await c.query(`update platform_settings set value=$1 where key='config'`, [JSON.stringify(before)]);
  await c.end();
  smtp.close();
}

if (rateLimited) {
  console.log("settings wapas purani kar di gayi.");
  process.exit(2);
}

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} pass${failed ? `  — ${failed} FAIL` : ""}`);
console.log("settings wapas purani kar di gayi.");
process.exit(failed ? 1 : 0);
