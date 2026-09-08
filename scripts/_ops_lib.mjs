import pg from "./node_modules/pg/lib/index.js";
export const API = process.env.API_BASE || "http://localhost:8080/api";

export function session() {
  const jar = new Map();
  return {
    jar,
    async call(method, path, body, extraHeaders = {}) {
      const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
      const res = await fetch(`${API}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
      for (const c of sc) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); }
      const text = await res.text();
      let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { status: res.status, body: parsed };
    },
  };
}

export async function q(sqlText, params = []) {
  const { Client } = pg;
  const c = new Client({ host: "localhost", port: 5455, user: "fastapmenu", password: "fastapmenu", database: "fastapmenu" });
  await c.connect();
  try { const r = await c.query(sqlText, params); return r.rows; } finally { await c.end(); }
}

export function j(x) { return JSON.stringify(x, null, 2); }
export function short(x, n = 400) { const s = typeof x === "string" ? x : JSON.stringify(x); return s && s.length > n ? s.slice(0, n) + "…" : s; }
