import assert from "node:assert/strict";
import test from "node:test";

import { AffiliationService } from "@/server/affiliation/service";
import { FailingTransport, MockTransport } from "@/server/affiliation/email";

import {
  createAffiliationTestDb,
  dropAffiliationTestDb,
  seedFixtures,
  UNIVERSITIES,
  DOMAINS,
  type TestDb,
} from "./helpers.js";

const SECRET = "test-hmac-secret-32-bytes-long!!";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeService(db: TestDb, transport: MockTransport | FailingTransport = new MockTransport()) {
  return { service: new AffiliationService({ db, transport, hmacSecret: SECRET }), transport };
}

// ── construction ──────────────────────────────────────────────────────────────

test("AffiliationService: throws on empty hmacSecret", () => {
  const { db } = { db: null as unknown as TestDb };
  assert.throws(
    () => new AffiliationService({ db, transport: new MockTransport(), hmacSecret: "" }),
    /hmacSecret is required/,
  );
});

// ── initiate: validation ──────────────────────────────────────────────────────

test("initiate: rejects malformed email", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    const { service } = makeService(db);
    const result = await service.initiate("sub|123", "not-an-email");
    assert.deepEqual(result, { ok: false, error: "INVALID_EMAIL" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: rejects email with IP address domain", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    const { service } = makeService(db);
    const result = await service.initiate("sub|123", "user@192.168.1.1");
    assert.deepEqual(result, { ok: false, error: "INVALID_EMAIL" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: rejects domain not in registry", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const { service } = makeService(db);
    // Suffix of a registered domain — must be rejected (no suffix matching).
    const result = await service.initiate("sub|123", "user@fakewesthaven.nl");
    assert.deepEqual(result, { ok: false, error: "UNKNOWN_DOMAIN" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: rejects suffix-spoofed domain", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const { service } = makeService(db);
    // "evil-student.westhaven.nl" ends with the registered domain but is not it.
    const result = await service.initiate("sub|123", "user@evil-student.westhaven.nl");
    assert.deepEqual(result, { ok: false, error: "UNKNOWN_DOMAIN" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── initiate: happy path ──────────────────────────────────────────────────────

test("initiate: happy path sends code and returns universityId", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    const result = await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    assert.ok(result.ok, `Expected ok but got: ${JSON.stringify(result)}`);
    assert.equal(result.universityId, UNIVERSITIES.westhaven);
    assert.equal(transport.sent.length, 1);
    assert.equal(transport.sent[0].to, `alice@${DOMAINS.westhavenStudent}`);
    assert.match(transport.sent[0].code, /^\d{6}$/);
    assert.equal(transport.sent[0].universityName, "Westhaven University");
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: EU domain (non-.edu) is accepted", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    const result = await service.initiate("sub|bob", `bob@${DOMAINS.ostbruckStudent}`);
    assert.ok(result.ok);
    assert.equal(result.universityId, UNIVERSITIES.ostbruck);
    assert.equal(transport.sent.length, 1);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: returns ALREADY_VERIFIED if already done", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    // First initiate + consume to reach verified state.
    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;
    await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code);

    const result = await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    assert.deepEqual(result, { ok: false, error: "ALREADY_VERIFIED" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── initiate: send failure ────────────────────────────────────────────────────

test("initiate: send failure does not mark verified and clears HMAC", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const failing = new FailingTransport();
    const service = new AffiliationService({ db, transport: failing, hmacSecret: SECRET });

    const result = await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    assert.deepEqual(result, { ok: false, error: "SEND_FAILED" });

    // Status must still be unverified; no code can be consumed.
    const status = await service.getStatus("sub|alice", UNIVERSITIES.westhaven);
    assert.ok(status !== null);
    assert.equal(status.verified, false);

    // Consuming any code after a failed send returns NOT_PENDING.
    const consumeResult = await service.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      "000000",
    );
    assert.deepEqual(consumeResult, { ok: false, error: "NOT_PENDING" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── consume: happy path ───────────────────────────────────────────────────────

test("consume: correct code marks verified", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    const result = await service.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      code,
    );
    assert.ok(result.ok);
    assert.equal(result.universityId, UNIVERSITIES.westhaven);
    assert.equal(result.accountSubject, "sub|alice");

    const status = await service.getStatus("sub|alice", UNIVERSITIES.westhaven);
    assert.ok(status?.verified);
    assert.ok(status?.verifiedAt instanceof Date);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── consume: replay ───────────────────────────────────────────────────────────

test("consume: replaying the same code fails", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    const first = await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code);
    assert.ok(first.ok);

    const second = await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code);
    assert.deepEqual(second, { ok: false, error: "ALREADY_VERIFIED" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── consume: expiry ───────────────────────────────────────────────────────────

test("consume: expired code returns INVALID_CODE", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    // 0-minute expiry for testing.
    const service = new AffiliationService({
      db,
      transport,
      hmacSecret: SECRET,
      codeExpiryMinutes: 0,
    });

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    // Wait 1 ms so the zero-minute expiry triggers.
    await new Promise((r) => setTimeout(r, 5));

    const result = await service.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      code,
    );
    assert.deepEqual(result, { ok: false, error: "INVALID_CODE" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── consume: wrong code / brute-force ────────────────────────────────────────

test("consume: wrong code increments attempt count", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const service = new AffiliationService({
      db,
      transport,
      hmacSecret: SECRET,
      maxAttempts: 3,
    });

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);

    // Wrong code attempts 1–3.
    for (let i = 0; i < 3; i++) {
      const r = await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, "000000");
      assert.deepEqual(r, { ok: false, error: "INVALID_CODE" });
    }

    // After maxAttempts, correct code is also locked out.
    const correctCode = transport.sent[0].code;
    const locked = await service.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      correctCode,
    );
    assert.deepEqual(locked, { ok: false, error: "INVALID_CODE" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── resend ───────────────────────────────────────────────────────────────────

test("resend: invalidates previous code and resets attempt counter", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    // First send.
    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const oldCode = transport.sent[0].code;

    // Use one wrong attempt on the first code.
    await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, "000000");

    // Resend.
    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const newCode = transport.sent[1].code;

    // Old code no longer works.
    const oldResult = await service.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      oldCode,
    );
    assert.deepEqual(oldResult, { ok: false, error: "INVALID_CODE" });

    // New code works.
    const newResult = await service.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      newCode,
    );
    assert.ok(newResult.ok);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── rate limiting ─────────────────────────────────────────────────────────────

test("initiate: rate-limits after maxSendsPerHour", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const service = new AffiliationService({
      db,
      transport,
      hmacSecret: SECRET,
      maxSendsPerHour: 2,
    });

    const r1 = await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    assert.ok(r1.ok);
    const r2 = await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    assert.ok(r2.ok);
    const r3 = await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    assert.deepEqual(r3, { ok: false, error: "RATE_LIMITED" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── cross-account / cross-university / cross-address ─────────────────────────

test("consume: mismatched principal returns NOT_PENDING (not other account's code)", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    // Bob tries to consume Alice's code using Alice's email address.
    const result = await service.consume(
      "sub|bob",
      `alice@${DOMAINS.westhavenStudent}`,
      code,
    );
    // Bob has no record → NOT_PENDING (not a cross-account leak).
    assert.deepEqual(result, { ok: false, error: "NOT_PENDING" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("consume: mismatched address returns INVALID_CODE", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    // Alice uses a different address at the same university domain.
    const result = await service.consume(
      "sub|alice",
      `alice.other@${DOMAINS.westhavenStudent}`,
      code,
    );
    assert.deepEqual(result, { ok: false, error: "INVALID_CODE" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("consume: one university does not grant another", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    // Alice verifies for Westhaven.
    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;
    await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code);

    // Westhaven verification must not affect Ostbrück status.
    const ostStatus = await service.getStatus("sub|alice", UNIVERSITIES.ostbruck);
    assert.ok(ostStatus === null || !ostStatus.verified);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("consume: staff domain verifies same university, not the student domain's twin", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    // Westhaven staff domain is also mapped to Westhaven — should succeed.
    await service.initiate("sub|prof", `prof@${DOMAINS.westhavenStaff}`);
    const code = transport.sent[0].code;
    const result = await service.consume("sub|prof", `prof@${DOMAINS.westhavenStaff}`, code);
    assert.ok(result.ok);
    assert.equal(result.universityId, UNIVERSITIES.westhaven);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── domain validation ─────────────────────────────────────────────────────────

test("consume: unknown domain in consume returns UNKNOWN_DOMAIN", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const { service } = makeService(db);

    const result = await service.consume("sub|alice", "alice@unknown-uni.com", "123456");
    assert.deepEqual(result, { ok: false, error: "UNKNOWN_DOMAIN" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── getStatus ─────────────────────────────────────────────────────────────────

test("getStatus: returns null when no record exists", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const { service } = makeService(db);
    const status = await service.getStatus("sub|nobody", UNIVERSITIES.westhaven);
    assert.equal(status, null);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("getStatus: returns unverified status after initiate", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const status = await service.getStatus("sub|alice", UNIVERSITIES.westhaven);
    assert.ok(status !== null);
    assert.equal(status.verified, false);
    assert.equal(status.verifiedAt, null);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── migration schema validation ───────────────────────────────────────────────

test("affiliation migration: expected tables and constraints exist", async () => {
  const { db, databaseName, connectionString } = await createAffiliationTestDb();
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const names = tables.rows.map((r) => r.table_name);
    assert.ok(names.includes("university_domains"), "university_domains table missing");
    assert.ok(names.includes("account_verifications"), "account_verifications table missing");

    const constraints = await client.query<{ constraint_name: string }>(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_schema = 'public'
       AND constraint_name IN (
         'university_domains_domain_unique',
         'account_verifications_account_university_unique',
         'university_domains_university_id_universities_id_fk',
         'account_verifications_university_id_universities_id_fk'
       )
       ORDER BY constraint_name`,
    );
    assert.equal(constraints.rows.length, 4, "Expected 4 affiliation constraints");
  } finally {
    await client.end();
    await dropAffiliationTestDb(db, databaseName);
  }
});
