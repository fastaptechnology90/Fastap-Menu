/** Ensure DATABASE_URL database is reachable (VPS uses fastap_os). */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "db", "package.json"));
const pg = require("pg");

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.log("skip"); return; }
  const c = new pg.Client({ connectionString: dbUrl, connectionTimeoutMillis: 8000 });
  await c.connect();
  await c.end();
  console.log("DB OK");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
