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

// ── initiate: email/domain validation ────────────────────────────────────────

test("initiate: rejects malformed email", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    const { service } = makeService(db);
    assert.deepEqual(await service.initiate("sub|1", "not-an-email"), { ok: false, error: "INVALID_EMAIL" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: rejects email with IPv4 domain", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    const { service } = makeService(db);
    assert.deepEqual(await service.initiate("sub|1", "user@192.168.1.1"), { ok: false, error: "INVALID_EMAIL" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: rejects port in domain (colon stripping attack)", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const { service } = makeService(db);
    // "student.westhaven.nl:443" → would normalize to "student.westhaven.nl" in a naive parser
    assert.deepEqual(await service.initiate("sub|1", `user@${DOMAINS.westhavenStudent}:443`), { ok: false, error: "INVALID_EMAIL" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: rejects path in domain (path stripping attack)", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const { service } = makeService(db);
    assert.deepEqual(await service.initiate("sub|1", `user@${DOMAINS.westhavenStudent}/evil`), { ok: false, error: "INVALID_EMAIL" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: rejects percent-encoded domain", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const { service } = makeService(db);
    assert.deepEqual(await service.initiate("sub|1", "user@evil.com%40student.westhaven.nl"), { ok: false, error: "INVALID_EMAIL" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: rejects domain not in registry", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const { service } = makeService(db);
    assert.deepEqual(await service.initiate("sub|1", "user@fakewesthaven.nl"), { ok: false, error: "UNKNOWN_DOMAIN" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("initiate: rejects suffix-spoofed domain", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const { service } = makeService(db);
    // ends with registered domain string but is a different label
    assert.deepEqual(
      await service.initiate("sub|1", `user@evil-student.westhaven.nl`),
      { ok: false, error: "UNKNOWN_DOMAIN" },
    );
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── domain constraint: DB-level rejection ────────────────────────────────────

test("domain constraint: DB rejects IPv4 address inserted directly", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  const { universityDomains } = await import("@/db/affiliation-schema");
  try {
    await seedFixtures(db);
    await assert.rejects(
      () =>
        db.insert(universityDomains).values({
          universityId: UNIVERSITIES.westhaven,
          domain: "192.168.1.1",
        }),
      (err: unknown) => {
        // Expect check constraint violation (23514)
        const candidates = [err, (err as { cause?: unknown }).cause];
        return candidates.some(
          (c) => c && typeof c === "object" && "code" in c && (c as { code: string }).code === "23514",
        );
      },
    );
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("domain constraint: DB rejects label starting with hyphen", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  const { universityDomains } = await import("@/db/affiliation-schema");
  try {
    await seedFixtures(db);
    await assert.rejects(
      () =>
        db.insert(universityDomains).values({
          universityId: UNIVERSITIES.westhaven,
          domain: "-evil.westhaven.nl",
        }),
      (err: unknown) => {
        const candidates = [err, (err as { cause?: unknown }).cause];
        return candidates.some(
          (c) => c && typeof c === "object" && "code" in c && (c as { code: string }).code === "23514",
        );
      },
    );
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
    const service = new AffiliationService({ db, transport: new FailingTransport(), hmacSecret: SECRET });

    const result = await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    assert.deepEqual(result, { ok: false, error: "SEND_FAILED" });

    const status = await service.getStatus("sub|alice", UNIVERSITIES.westhaven);
    assert.ok(status !== null);
    assert.equal(status.verified, false);

    // No pending challenge — consume must fail with NOT_PENDING.
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

// ── consume: delivery-state guard ────────────────────────────────────────────

test("consume: challenge with delivery_state=pending is not consumable", async () => {
  // Manually insert a record with delivery_state='pending' to simulate the
  // window between a challenge being written and the send being confirmed.
  const { db, databaseName } = await createAffiliationTestDb();
  const { accountVerifications } = await import("@/db/affiliation-schema");
  try {
    await seedFixtures(db);

    await db.insert(accountVerifications).values({
      accountSubject: "sub|alice",
      universityId: UNIVERSITIES.westhaven,
      emailAddress: `alice@${DOMAINS.westhavenStudent}`,
      challengeId: "00000000-0000-4000-9000-eeeeeeee0001",
      deliveryState: "pending",
      codeHmac: "deadbeef".repeat(8), // not a real HMAC
      codeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      sendWindowStartsAt: new Date(),
      sendCount: 1,
    });

    const { service } = makeService(db);
    const result = await service.consume(
      "sub|alice",
      `alice@${DOMAINS.westhavenStudent}`,
      "123456",
    );
    assert.deepEqual(result, { ok: false, error: "NOT_PENDING" });
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

    const result = await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code);
    assert.ok(result.ok, `Expected ok but got: ${JSON.stringify(result)}`);
    assert.equal(result.universityId, UNIVERSITIES.westhaven);
    // accountSubject must not appear in the public DTO
    assert.ok(!("accountSubject" in result));

    const status = await service.getStatus("sub|alice", UNIVERSITIES.westhaven);
    assert.ok(status?.verified);
    assert.ok(status?.verifiedAt instanceof Date);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── consume: context-bound HMAC ───────────────────────────────────────────────

test("consume: HMAC is bound to principal — wrong principal cannot use correct code", async () => {
  // Alice's HMAC is HMAC(secret, "sub|alice\0univ\0email\0code").
  // Bob cannot reuse Alice's code even if he supplies Alice's email and code.
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    // Bob initiates his own challenge (different row, different HMAC context)
    await service.initiate("sub|bob", `bob@${DOMAINS.westhavenStudent}`);

    // Bob tries to consume with Alice's code — the HMAC context differs
    // (principal "sub|bob" was used to derive Bob's HMAC, not Alice's)
    const result = await service.consume("sub|bob", `bob@${DOMAINS.westhavenStudent}`, code);
    assert.ok(!result.ok);
    // INVALID_CODE (wrong HMAC), not any info leak
    assert.equal(result.error, "INVALID_CODE");
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("consume: HMAC is bound to university — same code at different university fails", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    // Alice initiates for Westhaven
    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    // Alice also initiates for Ostbrück — completely separate HMAC context
    await service.initiate("sub|alice", `alice@${DOMAINS.ostbruckStudent}`);

    // Try to use Westhaven's code for Ostbrück — universityId differs in HMAC
    const result = await service.consume("sub|alice", `alice@${DOMAINS.ostbruckStudent}`, code);
    assert.ok(!result.ok);
    assert.equal(result.error, "INVALID_CODE");
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── consume: replay ───────────────────────────────────────────────────────────

test("consume: replaying the same code fails with ALREADY_VERIFIED", async () => {
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
    const service = new AffiliationService({
      db,
      transport,
      hmacSecret: SECRET,
      codeExpiryMinutes: 0,
    });

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    await new Promise((r) => setTimeout(r, 5));

    const result = await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code);
    assert.deepEqual(result, { ok: false, error: "INVALID_CODE" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── consume: brute-force lockout ──────────────────────────────────────────────

test("consume: wrong code increments attempt count and locks after maxAttempts", async () => {
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

    for (let i = 0; i < 3; i++) {
      const r = await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, "000000");
      assert.deepEqual(r, { ok: false, error: "INVALID_CODE" });
    }

    // After maxAttempts, the correct code is also locked out.
    const correctCode = transport.sent[0].code;
    const locked = await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, correctCode);
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

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const oldCode = transport.sent[0].code;

    await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, "000000");

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const newCode = transport.sent[1].code;

    // Old code fails (different HMAC context, different challenge).
    const oldResult = await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, oldCode);
    assert.ok(!oldResult.ok);

    // New code works.
    const newResult = await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, newCode);
    assert.ok(newResult.ok);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── rate limiting: per-account ────────────────────────────────────────────────

test("initiate: per-account rate-limits after maxSendsPerHour", async () => {
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

    assert.ok((await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`)).ok);
    assert.ok((await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`)).ok);
    assert.deepEqual(
      await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`),
      { ok: false, error: "RATE_LIMITED" },
    );
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── rate limiting: per-email (cross-account) ──────────────────────────────────

test("initiate: per-email rate-limits cross-account sends", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    // maxSendsPerEmailPerHour=2 means at most 2 concurrent active challenges
    // to the same address across all accounts.
    const service = new AffiliationService({
      db,
      transport: new MockTransport(),
      hmacSecret: SECRET,
      maxSendsPerHour: 10,           // high per-account limit
      maxSendsPerEmailPerHour: 2,    // low per-email limit
    });

    // sub|alice and sub|bob both send to alice@domain (different accounts, same address)
    assert.ok((await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`)).ok);
    assert.ok((await service.initiate("sub|alice2", `alice@${DOMAINS.westhavenStudent}`)).ok);

    // Third account trying the same address hits the per-email limit
    const r3 = await service.initiate("sub|alice3", `alice@${DOMAINS.westhavenStudent}`);
    assert.deepEqual(r3, { ok: false, error: "RATE_LIMITED" });
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── cross-account / cross-university / cross-address ─────────────────────────

test("consume: mismatched principal returns NOT_PENDING", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;

    // Bob has no record for this domain — NOT_PENDING.
    const result = await service.consume("sub|bob", `alice@${DOMAINS.westhavenStudent}`, code);
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

    const result = await service.consume("sub|alice", `alice.other@${DOMAINS.westhavenStudent}`, code);
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

    await service.initiate("sub|alice", `alice@${DOMAINS.westhavenStudent}`);
    const code = transport.sent[0].code;
    await service.consume("sub|alice", `alice@${DOMAINS.westhavenStudent}`, code);

    const ostStatus = await service.getStatus("sub|alice", UNIVERSITIES.ostbruck);
    assert.ok(ostStatus === null || !ostStatus.verified);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("consume: staff domain verifies same university", async () => {
  const { db, databaseName } = await createAffiliationTestDb();
  try {
    await seedFixtures(db);
    const transport = new MockTransport();
    const { service } = makeService(db, transport);

    await service.initiate("sub|prof", `prof@${DOMAINS.westhavenStaff}`);
    const code = transport.sent[0].code;
    const result = await service.consume("sub|prof", `prof@${DOMAINS.westhavenStaff}`, code);
    assert.ok(result.ok);
    assert.equal(result.universityId, UNIVERSITIES.westhaven);
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

test("consume: unknown domain returns UNKNOWN_DOMAIN", async () => {
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
    assert.equal(await service.getStatus("sub|nobody", UNIVERSITIES.westhaven), null);
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
    // Private fields must not appear in the DTO
    assert.ok(!("codeHmac" in status));
    assert.ok(!("challengeId" in status));
    assert.ok(!("accountSubject" in status));
  } finally {
    await dropAffiliationTestDb(db, databaseName);
  }
});

// ── migration schema validation ───────────────────────────────────────────────

test("affiliation migration: expected tables, columns, and constraints exist", async () => {
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

    // New columns present.
    const cols = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'account_verifications'
         AND column_name IN ('challenge_id', 'delivery_state')`,
    );
    assert.equal(cols.rows.length, 2, "challenge_id and delivery_state columns missing");

    // Required constraints.
    const constraints = await client.query<{ constraint_name: string }>(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND constraint_name IN (
           'university_domains_domain_unique',
           'account_verifications_account_university_unique',
           'university_domains_university_id_universities_id_fk',
           'account_verifications_university_id_universities_id_fk',
           'account_verifications_delivery_state_check'
         )
       ORDER BY constraint_name`,
    );
    assert.equal(constraints.rows.length, 5, "Expected 5 affiliation constraints");
  } finally {
    await client.end();
    await dropAffiliationTestDb(db, databaseName);
  }
});
