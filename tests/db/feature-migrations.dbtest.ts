import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";
import { setTimeout } from "node:timers/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

import { closeDb, createEphemeralDatabase, dropEphemeralDatabase } from "./helpers.js";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const migrationsFolder = path.resolve(repoRoot, "drizzle");
const featureFiles = ["demo-public-reviews.sql", "private-drafts.sql"];
const connections = new WeakMap<TestContext, Client[]>();

function childEnv(directUrl: string, poolUrl = directUrl): NodeJS.ProcessEnv {
  return { ...process.env, DATABASE_DIRECT_URL: directUrl, DATABASE_URL: poolUrl };
}

async function runFeatureMigrations(env: NodeJS.ProcessEnv) {
  try {
    const result = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "db/apply-feature-migrations.ts"],
      { cwd: repoRoot, env, encoding: "utf8", timeout: 30_000 },
    );
    return { code: 0, ...result };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? -1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
  }
}

// A journal prefix models the source foundation before consolidation. Tests
// never edit shared migration files or connect using inherited app credentials.
async function databaseAt(t: TestContext, count = 3, legacyDrafts = false) {
  const folder = await mkdtemp(path.join(tmpdir(), "sr-feature-upgrade-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await mkdir(path.join(folder, "meta"));
  const journal = JSON.parse(await readFile(path.join(migrationsFolder, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.slice(0, count);
  for (const entry of journal.entries) {
    await copyFile(path.join(migrationsFolder, `${entry.tag}.sql`), path.join(folder, `${entry.tag}.sql`));
  }
  if (legacyDrafts) {
    // Same draft schema, as installed before 0001 gained feature tracking.
    await copyFile(path.join(repoRoot, "db/feature-migrations/private-drafts.sql"), path.join(folder, "0001_private_drafts.sql"));
  }
  await writeFile(path.join(folder, "meta/_journal.json"), JSON.stringify(journal));
  const ephemeral = await createEphemeralDatabase(folder);
  t.after(async () => {
    // node:test after hooks run in registration order. Close readers before
    // dropping any database, including when an assertion fails.
    for (const client of connections.get(t) ?? []) await client.end();
    connections.delete(t);
    await dropEphemeralDatabase(ephemeral.databaseName);
  });
  return ephemeral;
}

async function connect(t: TestContext, connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  const clients = connections.get(t) ?? [];
  clients.push(client);
  connections.set(t, clients);
  return client;
}

async function consolidate(connectionString: string) {
  const db = drizzle(connectionString);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await closeDb(db);
  }
}

// Force real contention and verify both workers wait on the shared lock.
// This fails if either runner drops its lock even when lucky timing would
// otherwise make two ordinary Promise.all calls look serialized.
async function behindMigrationLock<T>(client: Client, jobs: (() => Promise<T>)[]): Promise<T[]> {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(5731)");
  const pending = Promise.allSettled(jobs.map((job) => job()));
  let results: Awaited<typeof pending>;
  try {
    const deadline = Date.now() + 10_000;
    let waiters = 0;
    while (Date.now() < deadline) {
      const locks = await client.query(`SELECT count(*) FROM pg_locks
        WHERE locktype = 'advisory' AND objid = 5731 AND NOT granted
        AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`);
      waiters = Number(locks.rows[0].count);
      if (waiters === jobs.length) break;
      await setTimeout(20);
    }
    assert.equal(waiters, jobs.length, "both runners must queue on transaction lock 5731");
  } finally {
    await client.query("ROLLBACK");
    results = await pending;
  }
  return results.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
}

async function tracked(client: Client) {
  return (await client.query("SELECT filename, applied_at FROM public.feature_migrations ORDER BY filename")).rows;
}

async function assertTracked(client: Client) {
  assert.deepEqual((await tracked(client)).map((row) => row.filename), featureFiles);
}

async function insertSentinels(client: Client) {
  await client.query(`
    INSERT INTO universities (id, slug, name, city, country, country_code, type)
    VALUES ('00000000-0000-4000-ffff-000000000001', 'migration-sentinel',
            'Synthetic migration institution', 'Test', 'Test', 'XX', 'public');
    INSERT INTO public_sample_reviews
      (id, university_id, subject_type, author_alias, title, body, published_at)
    VALUES ('00000000-0000-4000-ffff-000000000002',
            '00000000-0000-4000-ffff-000000000001', 'university',
            'Sentinel student (demo)', 'Sentinel review', 'Sentinel body', now());
    INSERT INTO public_sample_review_ratings (review_id, dimension, value)
    VALUES ('00000000-0000-4000-ffff-000000000002', 'overall', 4);
    INSERT INTO review_drafts
      (owner_subject, target_type, university_id, title, body, rating, client_request_key)
    VALUES ('synthetic-owner', 'university', '00000000-0000-4000-ffff-000000000001',
            'Private sentinel', 'Private sentinel body', 3, 'migration-sentinel');
  `);
}

async function content(client: Client) {
  const result = [];
  for (const table of ["universities", "public_sample_reviews", "public_sample_review_ratings", "review_drafts"]) {
    result.push((await client.query(`SELECT * FROM ${table}`)).rows);
  }
  return result;
}

async function schema(client: Client) {
  // Compare PostgreSQL's canonical definitions, including FK names/actions,
  // check constraints, column defaults, nullability and index ordering.
  const columns = await client.query(`SELECT table_name, column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, column_name`);
  const constraints = await client.query(`SELECT c.relname, con.conname, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
    ORDER BY c.relname, con.conname`);
  const indexes = await client.query(`SELECT tablename, indexname, indexdef
    FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`);
  return [columns.rows, constraints.rows, indexes.rows];
}

test("consolidated migration first: feature CLI skips both assets and preserves data and tracking", async (t) => {
  const ephemeral = await databaseAt(t);
  const client = await connect(t, ephemeral.connectionString);
  await assertTracked(client);
  await insertSentinels(client);
  const before = await content(client);
  const beforeTracking = await tracked(client);
  for (let i = 0; i < 2; i++) {
    const result = await runFeatureMigrations(childEnv(ephemeral.connectionString));
    assert.equal(result.code, 0, result.stderr);
    for (const file of featureFiles) assert.ok(result.stdout.includes(`Skipping (already applied): ${file}`));
    assert.doesNotMatch(result.stdout, /Applied feature migration/);
  }
  await consolidate(ephemeral.connectionString);
  assert.deepEqual(await content(client), before);
  assert.deepEqual(await tracked(client), beforeTracking);
});

test("source feature runner first: upgrade preserves rows, tracking and matches clean schema", async (t) => {
  const source = await databaseAt(t, 1);
  const result = await runFeatureMigrations(childEnv(source.connectionString));
  assert.equal(result.code, 0, result.stderr);
  for (const file of featureFiles) assert.ok(result.stdout.includes(`Applied feature migration: ${file}`));
  assert.doesNotMatch(result.stdout, /Skipping/);
  const client = await connect(t, source.connectionString);
  await insertSentinels(client);
  const before = await content(client);
  const beforeTracking = await tracked(client);
  await consolidate(source.connectionString);
  assert.deepEqual(await content(client), before);
  assert.deepEqual(await tracked(client), beforeTracking);
  const clean = await databaseAt(t);
  const cleanClient = await connect(t, clean.connectionString);
  assert.deepEqual(await schema(client), await schema(cleanClient));
  const applied = await client.query("SELECT count(*) FROM drizzle.__drizzle_migrations");
  assert.equal(applied.rows[0].count, "3");
});

test("pre-bridge 0001 upgrades and backfills draft tracking without replaying DDL", async (t) => {
  const ephemeral = await databaseAt(t, 2, true);
  const client = await connect(t, ephemeral.connectionString);
  assert.equal((await client.query("SELECT to_regclass('public.feature_migrations') AS tracker")).rows[0].tracker, null);
  await consolidate(ephemeral.connectionString);
  await assertTracked(client);
  const result = await runFeatureMigrations(childEnv(ephemeral.connectionString));
  assert.equal(result.code, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Applied feature migration/);
});

test("DATABASE_DIRECT_URL takes precedence over an unreachable DATABASE_URL", async (t) => {
  const ephemeral = await databaseAt(t, 1);
  const result = await runFeatureMigrations(childEnv(ephemeral.connectionString, "postgres://postgres:postgres@127.0.0.1:1/unreachable"));
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Applied feature migration/);
});

test("concurrent feature CLIs apply each asset exactly once and skip each exactly once", async (t) => {
  const ephemeral = await databaseAt(t, 1);
  const client = await connect(t, ephemeral.connectionString);
  const results = await behindMigrationLock(client, [
    () => runFeatureMigrations(childEnv(ephemeral.connectionString)),
    () => runFeatureMigrations(childEnv(ephemeral.connectionString)),
  ]);
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  const lines = results.flatMap((result) => result.stdout.split("\n"));
  for (const file of featureFiles) {
    assert.equal(lines.filter((line) => line === `Applied feature migration: ${file}`).length, 1);
    assert.equal(lines.filter((line) => line === `Skipping (already applied): ${file}`).length, 1);
  }
  await assertTracked(client);
});

test("feature CLI and Drizzle consolidation can run concurrently on the foundation", async (t) => {
  const ephemeral = await databaseAt(t, 1);
  const client = await connect(t, ephemeral.connectionString);
  const results = await behindMigrationLock(client, [
    () => runFeatureMigrations(childEnv(ephemeral.connectionString)),
    async () => {
      await consolidate(ephemeral.connectionString);
      return { code: 0, stdout: "", stderr: "" };
    },
  ]);
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  await assertTracked(client);
  await insertSentinels(client);
  const clean = await databaseAt(t);
  assert.deepEqual(await schema(client), await schema(await connect(t, clean.connectionString)));
});

test("failed later feature DDL rolls back earlier DDL and tracking, then can retry", async (t) => {
  const ephemeral = await databaseAt(t, 1);
  const client = await connect(t, ephemeral.connectionString);
  // The drafts asset reaches its indexes and fails after demo DDL succeeded.
  await client.query("CREATE TABLE review_drafts (id uuid PRIMARY KEY)");
  const failed = await runFeatureMigrations(childEnv(ephemeral.connectionString));
  assert.notEqual(failed.code, 0);
  assert.match(failed.stderr, /rolled back/);
  const remaining = await client.query(`SELECT to_regclass('public.public_sample_reviews') AS reviews,
    to_regclass('public.public_sample_review_ratings') AS ratings,
    to_regclass('public.feature_migrations') AS tracker,
    to_regtype('public.draft_target_type') AS draft_type`);
  assert.deepEqual(remaining.rows[0], { reviews: null, ratings: null, tracker: null, draft_type: null });
  await client.query("DROP TABLE review_drafts");
  const retry = await runFeatureMigrations(childEnv(ephemeral.connectionString));
  assert.equal(retry.code, 0, retry.stderr);
  await assertTracked(client);
});

test("untracked demo collision fails consolidation atomically instead of adopting unknown tables", async (t) => {
  const ephemeral = await databaseAt(t, 1);
  const client = await connect(t, ephemeral.connectionString);
  await client.query("CREATE TABLE public_sample_reviews (id uuid PRIMARY KEY)");
  await assert.rejects(consolidate(ephemeral.connectionString));
  const remaining = await client.query(`SELECT to_regclass('public.review_drafts') AS drafts,
    to_regclass('public.feature_migrations') AS tracker,
    to_regclass('public.public_sample_review_ratings') AS ratings`);
  assert.deepEqual(remaining.rows[0], { drafts: null, tracker: null, ratings: null });
  assert.equal((await client.query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count, "1");
  await client.query("DROP TABLE public_sample_reviews");
  await consolidate(ephemeral.connectionString);
  await assertTracked(client);
});


test("db:migrate CLI installs the complete journal and feature CLI skips it", async (t) => {
  const ephemeral = await databaseAt(t, 0);
  const env = childEnv(ephemeral.connectionString);
  // Exercise the operator entry point, with both URL variables pinned to
  // this test's fresh database even if a local .env exists.
  await execFileAsync("npm", ["run", "db:migrate"], {
    cwd: repoRoot, env, encoding: "utf8", timeout: 30_000,
  });
  const result = await runFeatureMigrations(env);
  assert.equal(result.code, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Applied feature migration/);
  const client = await connect(t, ephemeral.connectionString);
  await assertTracked(client);
  const clean = await databaseAt(t);
  assert.deepEqual(await schema(client), await schema(await connect(t, clean.connectionString)));
});
