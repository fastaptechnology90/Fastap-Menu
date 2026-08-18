/**
 * Start embedded PostgreSQL for local development (Windows/macOS/Linux).
 * Credentials match .env: fastapmenu / fastapmenu @ localhost:5432/fastapmenu
 */
import "./load-env.mjs";
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".pgdata");
const port = Number(process.env.PGPORT) || 5432;

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    setTimeout(() => { socket.destroy(); resolve(false); }, 1500);
  });
}

async function main() {
  if (await portOpen(port)) {
    console.log(`PostgreSQL already running on port ${port}.`);
    return;
  }

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "fastapmenu",
    password: "fastapmenu",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  console.log("Starting embedded PostgreSQL…");
  const hasCluster = fs.existsSync(path.join(dataDir, "PG_VERSION"));
  if (hasCluster) {
    await pg.start();
  } else {
    await pg.initialise();
    await pg.start();
  }
  try {
    await pg.createDatabase("fastapmenu");
    console.log("Created database: fastapmenu");
  } catch (err) {
    if (!String(err).includes("already exists")) throw err;
  }
  console.log(`PostgreSQL ready: postgresql://fastapmenu:fastapmenu@localhost:${port}/fastapmenu`);
  console.log("Data directory:", dataDir);
  console.log("Run `pnpm db:setup` in another terminal, then `pnpm dev:user`.");
  console.log("Press Ctrl+C to stop.");

  const stop = async () => {
    console.log("\nStopping PostgreSQL…");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
