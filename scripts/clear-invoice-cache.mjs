#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "db", "package.json"));
const pg = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const res = await client.query(
  `DELETE FROM platform_settings WHERE key = 'subscription_invoices' RETURNING key`,
);
await client.end();
console.log(res.rowCount ? "Removed subscription_invoices cache" : "No invoice cache row found");
