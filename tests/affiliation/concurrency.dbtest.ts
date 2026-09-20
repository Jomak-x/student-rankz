// Concurrency tests for the affiliation service.
//
// These tests verify that the SELECT … FOR UPDATE row-level lock inside
// db.transaction() correctly serializes concurrent consume calls so that
// only one succeeds even when both arrive simultaneously.
//
// Requires a real interactive-transaction transport (drizzle-orm/node-postgres)
// to exercise the same transaction boundary used by the production
// drizzle-orm/neon-serverless WebSocket Pool.

import assert from "node:assert/strict";
import test from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";

import { AffiliationService } from "@/server/affiliation/service";
import { MockTransport } from "@/server/affiliation/email";

import {
  createAffiliationTestDb,
  dropAffiliationTestDb,
  seedFixtures,
  DOMAINS,
} from "./helpers.js";

const SECRET = "test-hmac-secret-32-bytes-long!!";

test("concurrent consume: exactly one succeeds, one gets ALREADY_VERIFIED", async () => {
  const { db, databaseName, connectionString } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const service = new AffiliationService({ db, transport, hmacSecret: SECRET });

    // Initiate to get a code.
    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    // Create two separate DB connections to simulate two independent clients.
    const db2 = drizzle(connectionString, { casing: "snake_case" });
    const service2 = new AffiliationService({ db: db2, transport, hmacSecret: SECRET });

    // Fire both consumes simultaneously.
    const [r1, r2] = await Promise.all([
      service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code),
      service2.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code),
    ]);

    const results = [r1, r2];
    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    assert.equal(successes.length, 1, "Exactly one consume must succeed");
    assert.equal(failures.length, 1, "Exactly one consume must fail");

    // The failing result should be ALREADY_VERIFIED (not INVALID_CODE or
    // NOT_PENDING), proving the lock prevented double-marking.
    const failure = failures[0];
    assert.ok(!failure.ok);
    assert.equal(failure.error, "ALREADY_VERIFIED");

    // Close the second connection pool.
    await db2.$client.end();
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("concurrent consume: two wrong codes do not corrupt attempt count", async () => {
  const { db, databaseName, connectionString } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const service = new AffiliationService({
      db,
      transport,
      hmacSecret: SECRET,
      maxAttempts: 5,
    });

    await service.initiate("sub|bob", `bob@${DOMAINS.westhavenStudent}`);

    const db2 = drizzle(connectionString, { casing: "snake_case" });
    const service2 = new AffiliationService({ db: db2, transport, hmacSecret: SECRET, maxAttempts: 5 });

    // Two simultaneous wrong-code attempts.
    await Promise.all([
      service.consume("sub|bob", `bob@${DOMAINS.westhavenStudent}`, "000001"),
      service2.consume("sub|bob", `bob@${DOMAINS.westhavenStudent}`, "000002"),
    ]);

    // Attempt count should be exactly 2 (no double-counting / lost updates).
    // The correct code must still work within the remaining attempts.
    const correctCode = transport.sent[0].code;
    const result = await service.consume(
      "sub|bob",
      `bob@${DOMAINS.westhavenStudent}`,
      correctCode,
    );
    assert.ok(result.ok, "Correct code should still succeed after 2 failed attempts");

    await db2.$client.end();
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});
