import pg from "../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pg;
const c = new Client({ host: "localhost", port: 5455, user: "fastapmenu", password: "fastapmenu", database: "fastapmenu" });
await c.connect();
const sql = process.argv.slice(2).join(" ");
try {
  const r = await c.query(sql);
  if (Array.isArray(r)) { for (const x of r) console.log(JSON.stringify(x.rows ?? x.rowCount, null, 1)); }
  else console.log(JSON.stringify(r.rows ?? r.rowCount, null, 1));
} catch (e) { console.log("DBERR: " + e.message); }
await c.end();
