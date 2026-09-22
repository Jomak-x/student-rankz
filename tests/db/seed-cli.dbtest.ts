import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Regression coverage for db/seed-cli.ts configuration loading: the CLI must
// pick up a project .env file (documented copy-.env.example workflow) while
// still requiring BOTH explicit confirmations, and exported environment
// variables must take precedence over .env values. All connection strings
// are fake (unroutable host/port); the CLI refuses before ever connecting.

const repoRoot = path.resolve(import.meta.dirname, "../..");
const seedCliPath = path.join(repoRoot, "db", "seed-cli.ts");
const tsxBin = path.join(repoRoot, "node_modules", ".bin", "tsx");

// Minimal environment: nothing DATABASE_URL/SEED_SCOPE-related is exported,
// so any configuration must come from the .env file in the cwd.
function cliEnv(): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test" };
}

function runSeedCli(
  cwd: string,
  args: string[] = [],
  env: NodeJS.ProcessEnv = cliEnv(),
) {
  // --tsconfig pins path-alias resolution to the repository tsconfig while
  // cwd (and therefore .env discovery) stays in the isolated temp directory.
  return spawnSync(
    tsxBin,
    ["--tsconfig", path.join(repoRoot, "tsconfig.json"), seedCliPath, ...args],
    {
      cwd,
      env,
      encoding: "utf8",
    },
  );
}

function withEnvDir(dotenv: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "sr-seed-cli-"));
  writeFileSync(path.join(dir, ".env"), dotenv);
  return dir;
}

test("seed CLI reads .env for the connection but still refuses without --yes", () => {
  const dir = withEnvDir(
    [
      "DATABASE_URL=postgres://seed-fake:seed-fake@localhost:65535/fake_db",
      "SEED_SCOPE=demo",
      "",
    ].join("\n"),
  );
  try {
    const result = runSeedCli(dir);
    assert.notEqual(result.status, 0);
    // .env was loaded (DATABASE_URL found) but the confirmation is missing.
    assert.match(result.stderr, /--yes confirmation flag is missing/);
    assert.doesNotMatch(result.stderr, /DATABASE_URL is not set/);
    // Refusal happens before any connection attempt to the fake URL.
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|Seed failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("seed CLI refuses when .env lacks SEED_SCOPE even with --yes", () => {
  const dir = withEnvDir(
    "DATABASE_URL=postgres://seed-fake:seed-fake@localhost:65535/fake_db\n",
  );
  try {
    const result = runSeedCli(dir, ["--yes"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SEED_SCOPE/);
    assert.doesNotMatch(result.stderr, /Seed failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("exported environment takes precedence over .env for seed scope", () => {
  const dir = withEnvDir(
    [
      "DATABASE_URL=postgres://seed-fake:seed-fake@localhost:65535/fake_db",
      "SEED_SCOPE=demo",
      "",
    ].join("\n"),
  );
  try {
    const result = runSeedCli(dir, ["--yes"], {
      ...cliEnv(),
      SEED_SCOPE: "production",
    });
    assert.notEqual(result.status, 0);
    // The exported "production" scope won over the .env "demo" value and was
    // rejected; the connection from .env was still discovered.
    assert.match(result.stderr, /"production"/);
    assert.doesNotMatch(result.stderr, /DATABASE_URL is not set/);
    assert.doesNotMatch(result.stderr, /Seed failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
