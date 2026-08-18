/** Non-interactive drizzle-kit push for CI/VPS (auto-answers rename prompts). */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 180_000;

const child = spawn(
  "pnpm",
  ["--filter", "@workspace/db", "run", "push-force"],
  { cwd: root, stdio: ["pipe", "inherit", "inherit"], shell: true, env: { ...process.env, CI: "true" } },
);

const timer = setInterval(() => {
  try {
    child.stdin.write("\n");
  } catch {
    /* stdin closed */
  }
}, 400);

const killTimer = setTimeout(() => {
  clearInterval(timer);
  child.kill("SIGTERM");
  console.error("db-push-ci: timed out");
  process.exit(1);
}, TIMEOUT_MS);

child.on("close", (code) => {
  clearInterval(timer);
  clearTimeout(killTimer);
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  clearInterval(timer);
  clearTimeout(killTimer);
  console.error(err);
  process.exit(1);
});
