import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import test from "node:test";
import { sql } from "drizzle-orm";

import { recipientSendLog } from "@/db/affiliation-schema";
import { cleanupRecipientSendLog } from "@/server/affiliation/cleanup";
import { createAffiliationTestDb, dropAffiliationTestDb } from "./helpers.js";

const execFileAsync = promisify(execFile);
const cli = new URL("../../server/affiliation/cleanup-cli.ts", import.meta.url).pathname;

function runCli(args: string[], databaseUrl?: string) {
  return execFileAsync(process.execPath, ["--import", "tsx", cli, ...args], {
    // Do not inherit real database, email, or provider credentials.
    env: { NODE_ENV: "test", PATH: process.env.PATH, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) },
    timeout: 15_000,
  });
}

test("cleanup: removes untouched expired recipients globally and preserves active rows at the exact boundary", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    // One transaction fixes now() so the exact hourly boundary is deterministic.
    await db.transaction(async (tx) => {
      await tx.insert(recipientSendLog).values([
        { recipientEmail: "abandoned-a@example.test", challengeId: randomUUID(), sentAt: sql`now() - interval '2 hours'` },
        { recipientEmail: "abandoned-b@example.test", challengeId: randomUUID(), sentAt: sql`now() - interval '30 days'` },
        { recipientEmail: "boundary@example.test", challengeId: randomUUID(), sentAt: sql`now() - interval '1 hour'` },
        { recipientEmail: "active-a@example.test", challengeId: randomUUID(), sentAt: sql`now() - interval '1 hour' + interval '1 microsecond'` },
        { recipientEmail: "active-b@example.test", challengeId: randomUUID(), sentAt: sql`now()` },
      ]);
      const before = await tx.select().from(recipientSendLog);
      const expected = before.filter((row) => row.recipientEmail.startsWith("active-"));
      assert.equal(await cleanupRecipientSendLog(tx), 3);
      const remaining = await tx.select().from(recipientSendLog);
      assert.deepEqual(remaining.sort((a, b) => a.id.localeCompare(b.id)), expected.sort((a, b) => a.id.localeCompare(b.id)));
      assert.equal(await cleanupRecipientSendLog(tx), 0);
    });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("cleanup CLI: refuses missing confirmation and recipient/cutoff options without deleting", async () => {
  const { db, databaseName, connectionString } = await createAffiliationTestDb();
  try {
    await db.insert(recipientSendLog).values({
      recipientEmail: "untouched@example.test", challengeId: randomUUID(), sentAt: sql`now() - interval '2 hours'`,
    });
    for (const args of [[], ["--yes", "untouched@example.test"], ["--yes", "--cutoff=tomorrow"]]) {
      await assert.rejects(runCli(args, connectionString));
      assert.equal((await db.select().from(recipientSendLog)).length, 1);
    }
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("cleanup CLI: confirmed global sweep prints only count and closes connection", async () => {
  const { db, databaseName, connectionString } = await createAffiliationTestDb();
  try {
    await db.insert(recipientSendLog).values([
      { recipientEmail: "old-a@example.test", challengeId: randomUUID(), sentAt: sql`now() - interval '2 hours'` },
      { recipientEmail: "old-b@example.test", challengeId: randomUUID(), sentAt: sql`now() - interval '3 hours'` },
      { recipientEmail: "active@example.test", challengeId: randomUUID() },
    ]);
    const result = await runCli(["--yes"], connectionString);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, "Deleted 2 expired recipient send reservations.\n");
    const remaining = await db.select().from(recipientSendLog);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].recipientEmail, "active@example.test");
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("cleanup CLI: missing configuration and database failures do not leak input", async () => {
  for (const url of [undefined, "invalid-private-target", "postgres://private-user:private-password@127.0.0.1:1/private-db"]) {
    await assert.rejects(runCli(["--yes"], url), (error: unknown) => {
      const result = error as { stdout: string; stderr: string; code: number };
      assert.equal(result.code, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /^Affiliation cleanup failed\./);
      assert.doesNotMatch(result.stderr, /private|127\.0\.0\.1|Error:|\n\s+at /);
      return true;
    });
  }
});
