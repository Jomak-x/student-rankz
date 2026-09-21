import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(import.meta.dirname, "../..");

// The demo ratings CLI is explicitly opt-in and must refuse to run without
// every confirmation. These tests spawn the real CLI (refusal happens before
// any connection) and assert the guard order.

type CliOutcome = { code: number; stderr: string; stdout: string };

async function runCli(env: Record<string, string | undefined>, args: string[] = []): Promise<CliOutcome> {
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...process.env, ...env })) {
    if (value !== undefined) {
      childEnv[key] = value;
    }
  }
  try {
    const result = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "db/demo-ratings-seed-cli.ts", ...args],
      { cwd: repoRoot, env: childEnv as NodeJS.ProcessEnv, encoding: "utf8" },
    );
    return { code: 0, stderr: result.stderr as string, stdout: result.stdout as string };
  } catch (error) {
    const failure = error as { code?: number; stderr?: string; stdout?: string };
    return {
      code: failure.code ?? -1,
      stderr: failure.stderr ?? "",
      stdout: failure.stdout ?? "",
    };
  }
}

const FULLY_CONFIRMED = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:15432/postgres",
  SEED_SCOPE: "demo",
};

test("CLI refuses without any confirmation", async () => {
  const outcome = await runCli({ SEED_SCOPE: undefined, DATABASE_URL: undefined });
  assert.notEqual(outcome.code, 0);
  assert.match(outcome.stderr, /Refusing to seed demo ratings/);
  assert.equal(outcome.stdout, "");
});

test("CLI refuses unless SEED_SCOPE is exactly demo", async () => {
  const development = await runCli(
    { ...FULLY_CONFIRMED, SEED_SCOPE: "development" },
    ["--yes", "--acknowledge-demo-data"],
  );
  assert.notEqual(development.code, 0);
  assert.match(development.stderr, /SEED_SCOPE must be exactly "demo"/);

  const missing = await runCli({ ...FULLY_CONFIRMED, SEED_SCOPE: undefined }, [
    "--yes",
    "--acknowledge-demo-data",
  ]);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /SEED_SCOPE must be exactly "demo"/);
});

test("CLI refuses without --yes", async () => {
  const outcome = await runCli(FULLY_CONFIRMED, []);
  assert.notEqual(outcome.code, 0);
  assert.match(outcome.stderr, /--yes confirmation flag is missing/);
});

test("CLI refuses without the demo-data acknowledgment", async () => {
  const outcome = await runCli(FULLY_CONFIRMED, ["--yes"]);
  assert.notEqual(outcome.code, 0);
  assert.match(outcome.stderr, /--acknowledge-demo-data acknowledgment is missing/);
});

test("CLI refuses in production-looking environments even with all confirmations", async () => {
  const nodeEnv = await runCli(
    { ...FULLY_CONFIRMED, NODE_ENV: "production" },
    ["--yes", "--acknowledge-demo-data"],
  );
  assert.notEqual(nodeEnv.code, 0);
  assert.match(nodeEnv.stderr, /production runtime/);

  const vercelEnv = await runCli(
    { ...FULLY_CONFIRMED, VERCEL_ENV: "production" },
    ["--yes", "--acknowledge-demo-data"],
  );
  assert.notEqual(vercelEnv.code, 0);
  assert.match(vercelEnv.stderr, /production runtime/);
});

test("refusal guidance never claims a URL proves the target database", async () => {
  const outcome = await runCli({ SEED_SCOPE: undefined, DATABASE_URL: undefined });
  // The guidance states the limitation explicitly.
  assert.match(outcome.stderr, /cannot prove/);
  // …and never asserts the opposite.
  assert.doesNotMatch(outcome.stderr, /url (proves|confirms|guarantees)/i);
});
