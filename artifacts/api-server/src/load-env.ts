import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  path.resolve(here, "../../../.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
]) {
  loadEnvFile(candidate);
}
