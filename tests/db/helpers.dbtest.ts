import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { Client } from "pg";

import { createEphemeralDatabase, TEST_DATABASE_URL } from "./helpers.js";

test("failed migration setup drops its own database and preserves the original error", async () => {
  let failedDatabaseName: string | undefined;

  await assert.rejects(
    createEphemeralDatabase(
      path.resolve(import.meta.dirname, "../../drizzle-does-not-exist"),
    ),
    (error: unknown) => {
      // The original migration error must surface, not a cleanup error.
      assert.match(
        String((error as Error).message),
        /meta\/_journal\.json|ENOENT|drizzle-does-not-exist/,
      );
      assert.equal(
        (error as { cleanupError?: unknown }).cleanupError,
        undefined,
      );
      failedDatabaseName = (error as { ephemeralDatabaseName?: string })
        .ephemeralDatabaseName;
      assert.match(failedDatabaseName ?? "", /^sr_test_/);
      return true;
    },
  );

  // The failed call must have dropped exactly the database it created.
  assert.ok(failedDatabaseName);
  const admin = new Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  try {
    const result = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [failedDatabaseName],
    );
    assert.equal(
      result.rowCount,
      0,
      "failed setup must drop its own created database",
    );
  } finally {
    await admin.end();
  }
});
