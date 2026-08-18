/**
 * Loads the repo-root .env into process.env for CLI scripts.
 *
 * The API server already does this via artifacts/api-server/src/load-env.ts,
 * but the scripts in this folder (start-db, db:push, db:seed, smoke tests) had
 * no equivalent, so they crashed unless the caller exported everything by hand
 * (see BUG.md #14).
 *
 * Import it for its side effect, before anything reads process.env:
 *
 *   import "./load-env.mjs";
 *
 * Existing environment variables always win, so `PGPORT=5433 node script.mjs`
 * and PM2's ecosystem config still override the file.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue; // caller-supplied value wins
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
  return true;
}

const here = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  path.resolve(here, "../.env"),
  path.resolve(process.cwd(), ".env"),
]) {
  if (loadEnvFile(candidate)) break;
}
