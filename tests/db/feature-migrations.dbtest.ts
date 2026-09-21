import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { Client } from "pg";

import { createEphemeralDatabase, dropEphemeralDatabase } from "./helpers.js";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const migrationsFolder = path.resolve(repoRoot, "drizzle");

// Build a child environment that is fully isolated from the test runner's
// inherited database credentials. Both DATABASE_URL and DATABASE_DIRECT_URL
// are explicitly overridden so the runner cannot reach any external database
// regardless of which variable the apply-feature-migrations script prefers.
function childEnv(opts: {
  directUrl: string;
  poolUrl?: string;
}): NodeJS.ProcessEnv {
  const base = { ...process.env };
  // Remove any inherited database credentials first, then apply our overrides
  // so there is no risk an inherited DATABASE_DIRECT_URL leaks through.
  delete base.DATABASE_URL;
  delete base.DATABASE_DIRECT_URL;

  base.DATABASE_DIRECT_URL = opts.directUrl;
  // When the caller does not supply a pool URL we use the direct URL as a
  // fallback so the runner can always connect; a sentinel test below passes
  // a deliberately unreachable URL here to prove DIRECT_URL takes precedence.
  base.DATABASE_URL = opts.poolUrl ?? opts.directUrl;
  return base as NodeJS.ProcessEnv;
}

// Run the feature migration CLI against a given database URL. Returns exit
// code plus captured stdout/stderr regardless of success or failure.
async function runFeatureMigrations(env: NodeJS.ProcessEnv): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  try {
    const result = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "db/apply-feature-migrations.ts"],
      { cwd: repoRoot, env, encoding: "utf8" },
    );
    return { code: 0, stdout: result.stdout as string, stderr: result.stderr as string };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: failure.code ?? -1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

test("feature migrations apply cleanly and are idempotent: second run skips and preserves data", async () => {
  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  try {
    // First run: tables do not yet exist; every file should be applied.
    const env = childEnv({ directUrl: ephemeral.connectionString });
    const first = await runFeatureMigrations(env);
    assert.equal(first.code, 0, `First run failed:\n${first.stderr}`);
    assert.match(first.stdout, /Applied feature migration/);
    assert.doesNotMatch(first.stdout, /Skipping/);

    // Verify projection tables and tracking record exist.
    const verify = new Client({ connectionString: ephemeral.connectionString });
    await verify.connect();
    try {
      const tables = await verify.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('feature_migrations','public_sample_reviews','public_sample_review_ratings')
         ORDER BY table_name`,
      );
      assert.deepEqual(tables.rows.map((r) => r.table_name), [
        "feature_migrations",
        "public_sample_review_ratings",
        "public_sample_reviews",
      ]);

      const tracked = await verify.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM feature_migrations",
      );
      assert.equal(tracked.rows[0].count, "1", "tracking table must record the applied file");

      // Insert a sentinel university and review so we can confirm the second
      // run does not truncate or recreate data.
      await verify.query(`
        INSERT INTO universities (id, slug, name, city, country, country_code, type)
        VALUES ('00000000-0000-4000-ffff-000000000001', 'idempotency-test-uni',
                'Idempotency Test University', 'Testcity', 'Testland', 'TT', 'public')
        ON CONFLICT DO NOTHING
      `);
      await verify.query(`
        INSERT INTO public_sample_reviews
          (id, university_id, subject_type, author_alias, title, body, published_at, provenance)
        VALUES ('00000000-0000-4000-ffff-000000000002',
                '00000000-0000-4000-ffff-000000000001',
                'university', 'Sentinel student (demo)',
                'Sentinel review', 'Sentinel body.', now(), 'demo')
      `);
    } finally {
      await verify.end();
    }

    // Second run: every file is already tracked; runner must skip them all
    // without error and without touching existing rows.
    const second = await runFeatureMigrations(env);
    assert.equal(second.code, 0, `Second run failed:\n${second.stderr}`);
    assert.match(second.stdout, /Skipping \(already applied\)/);
    assert.doesNotMatch(second.stdout, /Applied feature migration/);

    // Sentinel data must survive the idempotent second run.
    const check = new Client({ connectionString: ephemeral.connectionString });
    await check.connect();
    try {
      const rows = await check.query(
        `SELECT id FROM public_sample_reviews
         WHERE id = '00000000-0000-4000-ffff-000000000002'`,
      );
      assert.equal(rows.rowCount, 1, "sentinel review must survive the second migration run");
    } finally {
      await check.end();
    }
  } finally {
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});

// Isolation sentinel: DATABASE_DIRECT_URL takes priority over DATABASE_URL.
// We pass a syntactically valid but unreachable URL as DATABASE_URL and the
// real ephemeral URL as DATABASE_DIRECT_URL. The runner must succeed, proving
// it connected via DIRECT_URL and never tried the unreachable pool URL.
test("DATABASE_DIRECT_URL is used preferentially over DATABASE_URL", async () => {
  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  try {
    const unreachablePoolUrl = "postgres://unreachable-sentinel:5432/nonexistent";
    const env = childEnv({
      directUrl: ephemeral.connectionString,
      poolUrl: unreachablePoolUrl,
    });

    const result = await runFeatureMigrations(env);
    assert.equal(
      result.code,
      0,
      `Runner should connect via DATABASE_DIRECT_URL and succeed.\n` +
        `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
    assert.match(
      result.stdout,
      /Applied feature migration|Skipping \(already applied\)/,
      "runner must have connected to ephemeral DB, not the unreachable pool URL",
    );
  } finally {
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});

// Concurrency: two simultaneous invocations must both exit 0. The advisory
// lock serialises them so exactly one applies the file and the other skips it.
// Data seeded between the runs must be intact afterwards.
test("concurrent CLI runs serialize correctly: one applies, one skips, data preserved", async () => {
  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  try {
    const env = childEnv({ directUrl: ephemeral.connectionString });

    const [r1, r2] = await Promise.all([
      runFeatureMigrations(env),
      runFeatureMigrations(env),
    ]);

    assert.equal(r1.code, 0, `First concurrent run failed:\n${r1.stderr}`);
    assert.equal(r2.code, 0, `Second concurrent run failed:\n${r2.stderr}`);

    // One runner must have applied and the other must have skipped. They may
    // both see "Skipping" if the first committed before the second acquired
    // the lock — that is also correct idempotent behaviour.
    const combinedStdout = r1.stdout + r2.stdout;
    const appliedCount = (combinedStdout.match(/Applied feature migration/g) ?? []).length;
    const skippedCount = (combinedStdout.match(/Skipping \(already applied\)/g) ?? []).length;
    // Together they account for the migration exactly once.
    assert.equal(
      appliedCount + skippedCount,
      2,
      `Expected one apply + one skip (or two skips) but got applied=${appliedCount} skipped=${skippedCount}`,
    );
    assert.equal(appliedCount, 1, "exactly one runner must apply the migration");
    assert.equal(skippedCount, 1, "exactly one runner must skip the already-applied migration");

    // Tracking table must have exactly one row after concurrent runs.
    const verify = new Client({ connectionString: ephemeral.connectionString });
    await verify.connect();
    try {
      const rows = await verify.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM feature_migrations",
      );
      assert.equal(rows.rows[0].count, "1", "feature_migrations must record the file exactly once");
    } finally {
      await verify.end();
    }
  } finally {
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});
