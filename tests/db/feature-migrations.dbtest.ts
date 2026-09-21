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

// Run the feature migration CLI against a given database URL. Returns exit
// code plus captured stdout/stderr regardless of success or failure.
async function runFeatureMigrations(connectionString: string): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  try {
    const result = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "db/apply-feature-migrations.ts"],
      {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_URL: connectionString } as NodeJS.ProcessEnv,
        encoding: "utf8",
      },
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
    const first = await runFeatureMigrations(ephemeral.connectionString);
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
    const second = await runFeatureMigrations(ephemeral.connectionString);
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
