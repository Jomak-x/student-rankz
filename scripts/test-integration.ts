import { spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  // Set before importing the helper: its administrative URL is captured on load.
  process.env.TEST_DATABASE_URL ??= "postgres://postgres:postgres@localhost:63346/postgres";
  const { createEphemeralDatabase, dropEphemeralDatabase } = await import("../tests/db/helpers");
  const { createSeedClient, seedDatabase } = await import("../db/seed");
  const { seedDemoRatings } = await import("../db/demo-ratings-seed");
  const { courses } = await import("../db/schema");
  const { paginationCourses } = await import("../tests/integration/pagination-data");
  const owned = new Set<string>();
  let child: ChildProcess | undefined;
  let interrupted: NodeJS.Signals | undefined;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const signalGroup = (signal: NodeJS.Signals) => {
    if (!child?.pid) return;
    try { process.kill(-child.pid, signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  };
  const interrupt = (signal: NodeJS.Signals) => {
    interrupted = signal;
    process.exitCode = signal === "SIGINT" ? 130 : 143;
    signalGroup("SIGTERM");
    killTimer ??= setTimeout(() => signalGroup("SIGKILL"), 5_000);
    killTimer.unref();
  };
  const onInt = () => interrupt("SIGINT");
  const onTerm = () => interrupt("SIGTERM");
  process.on("SIGINT", onInt);
  process.on("SIGTERM", onTerm);
  const checkInterrupted = () => {
    if (interrupted) throw new Error("Integration run interrupted.");
  };
  const create = async () => {
    checkInterrupted();
    // The consolidated Drizzle journal applies every migration exactly once.
    const db = await createEphemeralDatabase(path.join(root, "drizzle"));
    owned.add(db.databaseName);
    checkInterrupted();
    return db;
  };

  try {
    await access(path.join(root, ".next/BUILD_ID")).catch(() => {
      throw new Error("Production build missing. Run npm run build before test:integration.");
    });
    const demo = await create();
    const empty = await create();
    const outage = await create();
    const db = createSeedClient(demo.connectionString);
    try {
      await seedDatabase(db);
      await seedDemoRatings(db);
      await db.insert(courses).values(paginationCourses);
    } finally {
      await db.$client.end();
    }
    // A real unavailable database on the same server, not a mocked DB client.
    await dropEphemeralDatabase(outage.databaseName);
    owned.delete(outage.databaseName);
    checkInterrupted();

    console.log("Integration: seeded demo :3128, migrated empty :3129, dropped database :3130; auth disabled.");
    child = spawn(process.execPath, [
      path.join(root, "node_modules/@playwright/test/cli.js"),
      "test", "--config", "playwright.integration.config.ts",
      ...process.argv.slice(2),
    ], {
      cwd: root,
      detached: true,
      stdio: "inherit",
      env: {
        ...process.env,
        INTEGRATION_DEMO_DATABASE_URL: demo.connectionString,
        INTEGRATION_EMPTY_DATABASE_URL: empty.connectionString,
        INTEGRATION_OUTAGE_DATABASE_URL: outage.connectionString,
        NEON_AUTH_BASE_URL: "",
        NEON_AUTH_COOKIE_SECRET: "",
      },
    });
    const code = await new Promise<number>((resolve, reject) => {
      child!.once("error", reject);
      child!.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
    process.exitCode = interrupted === "SIGINT" ? 130 : interrupted ? 143 : code;
  } finally {
    if (killTimer) clearTimeout(killTimer);
    // Playwright normally stops all three servers; also reap descendants after
    // startup errors, abrupt runner exits, and SIGINT/SIGTERM.
    try {
      signalGroup("SIGTERM");
      if (child?.pid) {
        await delay(500);
        signalGroup("SIGKILL");
      }
    } finally {
      const results = await Promise.allSettled([...owned].map(dropEphemeralDatabase));
      process.off("SIGINT", onInt);
      process.off("SIGTERM", onTerm);
      const failures = results.filter(result => result.status === "rejected");
      if (failures.length) throw new Error(`Failed to remove ${failures.length} owned integration databases.`);
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Integration harness failed.");
  process.exitCode ||= 1;
});
