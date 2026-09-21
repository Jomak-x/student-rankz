/**
 * Concurrency regression tests for the affiliation service.
 *
 * Each test creates two *separate* AffiliationService instances backed by
 * independent database connections to the same ephemeral database.  This
 * exercises the real serialization guarantees of the FOR UPDATE lock and the
 * INSERT ON CONFLICT DO NOTHING pattern — in-process mocks could hide races.
 *
 * ControlledTransport is used where tests need to hold one request in the
 * "challenge written to DB, email not yet confirmed" window while a second
 * request races ahead.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";

import { AffiliationService } from "@/server/affiliation/service";
import { ControlledTransport, MockTransport } from "@/server/affiliation/email";

import {
  createAffiliationTestDb,
  dropAffiliationTestDb,
  seedFixtures,
  UNIVERSITIES,
  DOMAINS,
  type TestDb,
} from "./helpers.js";

const SECRET = "test-hmac-secret-32-bytes-long!!";

// Create a second independent DB connection to the same database.
function makeSecondDb(connectionString: string): TestDb {
  return drizzle(connectionString, { casing: "snake_case" });
}

async function closeDb(db: TestDb): Promise<void> {
  await db.$client.end();
}

// ── Concurrent first initiations ─────────────────────────────────────────────

test("concurrency: two concurrent first-initiations serialize; both succeed or one gets RATE_LIMITED", async () => {
  // Two service instances share the same DB (separate connections).
  // maxSendsPerHour=1 means only one initiation per hour-window is permitted.
  // With the FOR UPDATE lock the second concurrent initiation must see
  // sendCount=1 and return RATE_LIMITED rather than both winning.
  const { db: db1, databaseName, connectionString } = await createAffiliationTestDb();
  const db2 = makeSecondDb(connectionString);
  try {
    await seedFixtures(db1);

    const s1 = new AffiliationService({ db: db1, transport: new MockTransport(), hmacSecret: SECRET, maxSendsPerHour: 1 });
    const s2 = new AffiliationService({ db: db2, transport: new MockTransport(), hmacSecret: SECRET, maxSendsPerHour: 1 });

    const [r1, r2] = await Promise.all([
      s1.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`),
      s2.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`),
    ]);

    const successes = [r1, r2].filter((r) => r.ok).length;
    const rateLimited = [r1, r2].filter((r) => !r.ok && r.error === "RATE_LIMITED").length;

    // Exactly one succeeds; the other is serialized out as RATE_LIMITED.
    assert.equal(successes, 1, `Expected exactly 1 success; got ${JSON.stringify([r1, r2])}`);
    assert.equal(rateLimited, 1, `Expected exactly 1 RATE_LIMITED; got ${JSON.stringify([r1, r2])}`);
  } finally {
    await closeDb(db2);
    await dropAffiliationTestDb(db1, databaseName);
  }
});

test("concurrency: two concurrent first-initiations for same account+university result in consistent DB state", async () => {
  // Both succeed when the send limit is not exhausted (maxSendsPerHour≥2).
  // The atomic INSERT ON CONFLICT DO NOTHING + SELECT FOR UPDATE ensures
  // only one slot row is created and challenges overwrite each other in order.
  const { db: db1, databaseName, connectionString } = await createAffiliationTestDb();
  const db2 = makeSecondDb(connectionString);
  try {
    await seedFixtures(db1);

    const t1 = new MockTransport();
    const t2 = new MockTransport();
    const s1 = new AffiliationService({ db: db1, transport: t1, hmacSecret: SECRET, maxSendsPerHour: 5 });
    const s2 = new AffiliationService({ db: db2, transport: t2, hmacSecret: SECRET, maxSendsPerHour: 5 });

    const [r1, r2] = await Promise.all([
      s1.initiate("sub|race", `race@${DOMAINS.westhavenStudent}`),
      s2.initiate("sub|race", `race@${DOMAINS.westhavenStudent}`),
    ]);

    // Both should succeed (different challenges, same slot row).
    assert.ok(r1.ok, `r1 failed: ${JSON.stringify(r1)}`);
    assert.ok(r2.ok, `r2 failed: ${JSON.stringify(r2)}`);
    assert.equal(r1.universityId, UNIVERSITIES.westhaven);
    assert.equal(r2.universityId, UNIVERSITIES.westhaven);

    // The last confirmed challenge is the one consumable.
    // One of the two codes must verify successfully; the other is stale.
    const allSent = [...t1.sent, ...t2.sent];
    assert.equal(allSent.length, 2, "Expected two emails sent");

    // Exactly one code verifies; the other is INVALID_CODE.
    let verified = 0;
    for (const sent of allSent) {
      const r = await s1.consume("sub|race", `race@${DOMAINS.westhavenStudent}`, sent.code);
      if (r.ok) verified++;
    }
    assert.equal(verified, 1, "Exactly one of the two concurrent codes should verify");
  } finally {
    await closeDb(db2);
    await dropAffiliationTestDb(db1, databaseName);
  }
});

// ── Initiate vs consume race ──────────────────────────────────────────────────

test("concurrency: consume cannot race to grant verification before delivery is confirmed", async () => {
  // A starts initiate; its challenge is written as 'pending'.
  // While the transport is held (not yet confirmed), a concurrent consume
  // attempt must return NOT_PENDING (not grant verification).
  const { db: db1, databaseName, connectionString } = await createAffiliationTestDb();
  const db2 = makeSecondDb(connectionString);
  try {
    await seedFixtures(db1);

    const controlled = new ControlledTransport();
    const s1 = new AffiliationService({ db: db1, transport: controlled, hmacSecret: SECRET });
    const s2 = new AffiliationService({ db: db2, transport: new MockTransport(), hmacSecret: SECRET });

    // Start initiate — it will pause once the challenge is in the DB.
    const initiatePromise = s1.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);

    // Wait for the challenge to be committed with delivery_state='pending'.
    await controlled.sending;

    // Attempt consume while delivery_state is still 'pending'.
    // The correct code is unknown here — but the delivery state guard fires
    // before HMAC check so any code returns NOT_PENDING.
    const consumeResult = await s2.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      "000000",
    );

    // Now let the transport succeed so initiate can finish.
    controlled.succeed();
    const initiateResult = await initiatePromise;

    assert.ok(initiateResult.ok, `Initiate should have succeeded: ${JSON.stringify(initiateResult)}`);
    assert.deepEqual(consumeResult, { ok: false, error: "NOT_PENDING" });
  } finally {
    await closeDb(db2);
    await dropAffiliationTestDb(db1, databaseName);
  }
});

// ── Scoped cleanup: A-fail does not clobber B-success ─────────────────────────

test("concurrency: A-fail cleanup does not clobber concurrent B-success challenge", async () => {
  // Sequence:
  //   1. A starts initiate → challenge_id=A written as 'pending', transport held.
  //   2. B starts initiate (resend) → challenge_id=B written as 'pending' (overwrites A's),
  //      transport completes immediately → delivery_state='sent', B is now consumable.
  //   3. A's transport fails → cleanup WHERE challenge_id=A AND delivery_state='pending'.
  //      Since the row now has challenge_id=B AND delivery_state='sent', neither
  //      predicate matches A → B's challenge is NOT cleared.
  //   4. B's code verifies successfully.
  const { db: db1, databaseName, connectionString } = await createAffiliationTestDb();
  const db2 = makeSecondDb(connectionString);
  try {
    await seedFixtures(db1);

    const transportA = new ControlledTransport();
    const transportB = new MockTransport();

    const sA = new AffiliationService({ db: db1, transport: transportA, hmacSecret: SECRET, maxSendsPerHour: 5 });
    const sB = new AffiliationService({ db: db2, transport: transportB, hmacSecret: SECRET, maxSendsPerHour: 5 });

    // Step 1: A initiates — pauses at transport with challenge_id=A in DB as 'pending'.
    const initiateA = sA.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    await transportA.sending;

    // Step 2: B initiates (resend) — overwrites challenge_id with B's UUID, transport succeeds.
    const resultB = await sB.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    assert.ok(resultB.ok, `B initiate should succeed: ${JSON.stringify(resultB)}`);

    // Step 3: A's transport fails → scoped cleanup WHERE challenge_id=A AND delivery_state='pending'.
    transportA.fail("simulated failure for A");
    const resultA = await initiateA;
    assert.deepEqual(resultA, { ok: false, error: "SEND_FAILED" });

    // Step 4: B's code must still work (A's cleanup did NOT clear B's challenge).
    assert.equal(transportB.sent.length, 1, "B transport should have one sent message");
    const codeB = transportB.sent[0].code;
    const consume = await sA.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, codeB);
    assert.ok(consume.ok, `B's code should verify after A-fail: ${JSON.stringify(consume)}`);
    assert.equal(consume.universityId, UNIVERSITIES.westhaven);
  } finally {
    await closeDb(db2);
    await dropAffiliationTestDb(db1, databaseName);
  }
});

// ── Concurrent cross-account initiate to same email (advisory lock) ──────────

test("concurrency: concurrent cross-account initiates to same email respect per-email limit", async () => {
  const { db: db1, databaseName, connectionString } = await createAffiliationTestDb();
  const db2 = makeSecondDb(connectionString);
  try {
    await seedFixtures(db1);

    const s1 = new AffiliationService({ db: db1, transport: new MockTransport(), hmacSecret: SECRET, maxSendsPerHour: 10, maxSendsPerEmailPerHour: 1 });
    const s2 = new AffiliationService({ db: db2, transport: new MockTransport(), hmacSecret: SECRET, maxSendsPerHour: 10, maxSendsPerEmailPerHour: 1 });

    const [r1, r2] = await Promise.all([
      s1.initiate("sub|attacker1", `victim@${DOMAINS.westhavenStudent}`),
      s2.initiate("sub|attacker2", `victim@${DOMAINS.westhavenStudent}`),
    ]);

    const successes = [r1, r2].filter((r) => r.ok).length;
    const rateLimited = [r1, r2].filter((r) => !r.ok && r.error === "RATE_LIMITED").length;

    assert.equal(successes, 1, `Expected exactly 1 success; got ${JSON.stringify([r1, r2])}`);
    assert.equal(rateLimited, 1, `Expected exactly 1 RATE_LIMITED; got ${JSON.stringify([r1, r2])}`);
  } finally {
    await closeDb(db2);
    await dropAffiliationTestDb(db1, databaseName);
  }
});

// ── Initiate/consume race with DB state assertion ────────────────────────────

test("concurrency: consume during pending delivery does not alter stored address", async () => {
  const { db: db1, databaseName, connectionString } = await createAffiliationTestDb();
  const db2 = makeSecondDb(connectionString);
  const { accountVerifications } = await import("@/db/affiliation-schema");
  const { eq, and } = await import("drizzle-orm");
  try {
    await seedFixtures(db1);

    const controlled = new ControlledTransport();
    const s1 = new AffiliationService({ db: db1, transport: controlled, hmacSecret: SECRET });
    const s2 = new AffiliationService({ db: db2, transport: new MockTransport(), hmacSecret: SECRET });

    const initiatePromise = s1.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    await controlled.sending;

    const consumeResult = await s2.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      "000000",
    );
    assert.deepEqual(consumeResult, { ok: false, error: "NOT_PENDING" });

    controlled.succeed();
    const initiateResult = await initiatePromise;
    assert.ok(initiateResult.ok);

    // Assert DB state: address is correct, delivery confirmed, not verified.
    const [row] = await db1.select().from(accountVerifications).where(
      and(
        eq(accountVerifications.accountSubject, "sub|alice"),
        eq(accountVerifications.universityId, UNIVERSITIES.westhaven),
      ),
    );
    assert.equal(row.emailAddress, `alice@${DOMAINS.westhavenStudent}`);
    assert.equal(row.deliveryState, "sent");
    assert.equal(row.verified, false);
  } finally {
    await closeDb(db2);
    await dropAffiliationTestDb(db1, databaseName);
  }
});

// ── Consume-before-delivery then fail ────────────────────────────────────────

test("concurrency: transport fails after challenge is written — verification is NOT granted", async () => {
  // Regression for the original P1-C finding:
  // Even if a consumer reads the 'pending' challenge window just before
  // the send confirmation, consume must not grant verification.
  // After transport failure the challenge is cleared — verified stays false.
  const { db: db1, databaseName, connectionString } = await createAffiliationTestDb();
  const db2 = makeSecondDb(connectionString);
  try {
    await seedFixtures(db1);

    const controlled = new ControlledTransport();
    const s1 = new AffiliationService({ db: db1, transport: controlled, hmacSecret: SECRET });
    const s2 = new AffiliationService({ db: db2, transport: new MockTransport(), hmacSecret: SECRET });

    const initiatePromise = s1.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    await controlled.sending;

    // Attempt consume while still 'pending'.
    const consumePending = await s2.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      "000000",
    );
    assert.deepEqual(consumePending, { ok: false, error: "NOT_PENDING" });

    // Now fail the transport.
    controlled.fail("simulated failure");
    const initiateResult = await initiatePromise;
    assert.deepEqual(initiateResult, { ok: false, error: "SEND_FAILED" });

    // Post-failure: no active challenge.
    const status = await s2.getStatus("sub|alice", UNIVERSITIES.westhaven);
    assert.ok(status !== null);
    assert.equal(status.verified, false);

    const consumeAfter = await s2.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      "000000",
    );
    assert.deepEqual(consumeAfter, { ok: false, error: "NOT_PENDING" });
  } finally {
    await closeDb(db2);
    await dropAffiliationTestDb(db1, databaseName);
  }
});

// ── Concurrent consume replay (double-spend) ─────────────────────────────────

test("concurrency: two concurrent consumes with correct code — only one grants verification", async () => {
  const { db: db1, databaseName, connectionString } = await createAffiliationTestDb();
  const db2 = makeSecondDb(connectionString);
  try {
    await seedFixtures(db1);

    const transport = new MockTransport();
    const s1 = new AffiliationService({ db: db1, transport, hmacSecret: SECRET });
    const s2 = new AffiliationService({ db: db2, transport, hmacSecret: SECRET });

    await s1.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    const [c1, c2] = await Promise.all([
      s1.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code),
      s2.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code),
    ]);

    const successes = [c1, c2].filter((r) => r.ok).length;
    const alreadyVerified = [c1, c2].filter((r) => !r.ok && r.error === "ALREADY_VERIFIED").length;

    assert.equal(successes, 1, `Expected exactly 1 success; got ${JSON.stringify([c1, c2])}`);
    assert.equal(alreadyVerified, 1, `Expected exactly 1 ALREADY_VERIFIED; got ${JSON.stringify([c1, c2])}`);
  } finally {
    await closeDb(db2);
    await dropAffiliationTestDb(db1, databaseName);
  }
});

// ── Verified address is immutable after grant ─────────────────────────────────

test("concurrency: verified address cannot be changed by a concurrent initiate for a different address", async () => {
  // Once verified, the row has verified=true.  Any subsequent initiate for
  // the same account+university returns ALREADY_VERIFIED and must NOT update
  // emailAddress in the DB.
  const { db: db1, databaseName, connectionString } = await createAffiliationTestDb();
  const db2 = makeSecondDb(connectionString);
  try {
    await seedFixtures(db1);

    const transport = new MockTransport();
    const s1 = new AffiliationService({ db: db1, transport, hmacSecret: SECRET });
    const s2 = new AffiliationService({ db: db2, transport, hmacSecret: SECRET });

    await s1.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;
    await s1.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code);

    // Verified — now try to re-initiate with a staff-domain email.
    const reinitiate = await s2.initiate("sub|alice", `alice@${DOMAINS.westhavenStaff}`);
    assert.deepEqual(reinitiate, { ok: false, error: "ALREADY_VERIFIED" });

    // Status still shows the original verified address (getStatus doesn't expose it,
    // but verified=true must remain and no new challenge was written).
    const status = await s1.getStatus("sub|alice", UNIVERSITIES.westhaven);
    assert.ok(status?.verified);
  } finally {
    await closeDb(db2);
    await dropAffiliationTestDb(db1, databaseName);
  }
});

// ── Concurrent consume vs address-changing initiate ─────────────────────────

test("concurrency: consume grants verification while concurrent initiate tries address change — verified address is stored", async () => {
  // Sequence with real concurrent barrier:
  //   1. Alice initiates for student email → challenge created, delivery confirmed.
  //   2. Concurrently: Alice consumes the code AND re-initiates with staff email.
  //   3. If consume wins the FOR UPDATE lock first, the row becomes verified=true
  //      with the student email. The initiate then sees ALREADY_VERIFIED.
  //   4. If initiate wins first, it overwrites the challenge — consume then
  //      returns INVALID_CODE (stale challenge). Either way, the DB row must be
  //      internally consistent.
  //   5. Assert the stored emailAddress matches verified or the active challenge.
  const { db: db1, databaseName, connectionString } = await createAffiliationTestDb();
  const db2 = makeSecondDb(connectionString);
  const { accountVerifications } = await import("@/db/affiliation-schema");
  const { eq, and } = await import("drizzle-orm");
  try {
    await seedFixtures(db1);

    const transport = new MockTransport();
    const s1 = new AffiliationService({ db: db1, transport, hmacSecret: SECRET });
    const s2 = new AffiliationService({ db: db2, transport, hmacSecret: SECRET });

    await s1.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    // Fire both concurrently — real FOR UPDATE serialization.
    const [consumeResult, initiateResult] = await Promise.all([
      s1.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code),
      s2.initiate("sub|alice", `alice@${DOMAINS.westhavenStaff}`),
    ]);

    // Read the row's final state.
    const [row] = await db1.select().from(accountVerifications).where(
      and(
        eq(accountVerifications.accountSubject, "sub|alice"),
        eq(accountVerifications.universityId, UNIVERSITIES.westhaven),
      ),
    );

    if (consumeResult.ok) {
      // Consume won — row must be verified with the student address.
      assert.equal(row.verified, true);
      assert.equal(row.emailAddress, `alice@${DOMAINS.westhavenStudent}`);
      assert.deepEqual(initiateResult, { ok: false, error: "ALREADY_VERIFIED" });
    } else {
      // Initiate won — the challenge was overwritten; consume got stale HMAC.
      assert.equal(consumeResult.error, "INVALID_CODE");
      assert.ok(initiateResult.ok);
      assert.equal(row.emailAddress, `alice@${DOMAINS.westhavenStaff}`);
      assert.equal(row.verified, false);
    }
  } finally {
    await closeDb(db2);
    await dropAffiliationTestDb(db1, databaseName);
  }
});
