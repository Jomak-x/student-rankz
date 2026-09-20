import assert from "node:assert/strict";
import test from "node:test";

import { reviewDrafts } from "@/db/draft-schema";
import type { DraftServiceErrorCode } from "@/server/drafts";
import {
  createReviewDraft,
  deleteReviewDraft,
  DraftServiceError,
  getReviewDraft,
  listReviewDrafts,
  updateReviewDraft,
} from "@/server/drafts";

import {
  COURSES,
  INSTRUCTORS,
  OWNERS,
  UNIVERSITIES,
  createDraftsDatabase,
  dropDraftsDatabase,
  setupBaselineDirectory,
} from "./helpers.js";

async function expectDraftError(
  promise: Promise<unknown>,
  code: DraftServiceErrorCode,
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(
      error instanceof DraftServiceError,
      `expected DraftServiceError, got: ${String(error)}`,
    );
    assert.equal(error.code, code);
    return true;
  });
}

const WESTHAVEN_UNIVERSITY_INPUT = {
  universityId: UNIVERSITIES.westhaven,
  targetType: "university" as const,
  title: "Great campus",
  body: "Solid teaching overall.",
  rating: 4,
  clientRequestKey: "key-university-1",
};

test("owned draft CRUD: create, get, list, update, delete", async () => {
  const handle = await createDraftsDatabase();
  try {
    await setupBaselineDirectory(handle.db);

    const created = await createReviewDraft(
      handle.db,
      OWNERS.alice,
      WESTHAVEN_UNIVERSITY_INPUT,
    );

    // Complete DTO, private fields never leak.
    assert.deepEqual(Object.keys(created).sort(), [
      "body",
      "courseId",
      "createdAt",
      "id",
      "instructorId",
      "rating",
      "revision",
      "targetType",
      "title",
      "universityId",
      "updatedAt",
    ]);
    assert.equal(created.targetType, "university");
    assert.equal(created.universityId, UNIVERSITIES.westhaven);
    assert.equal(created.courseId, null);
    assert.equal(created.instructorId, null);
    assert.equal(created.title, "Great campus");
    assert.equal(created.rating, 4);
    assert.equal(created.revision, 1);
    assert.equal(created.body, "Solid teaching overall.");
    const createdJson = JSON.parse(JSON.stringify(created)) as Record<string, unknown>;
    assert.ok(!("ownerSubject" in createdJson));
    assert.ok(!("owner_subject" in createdJson));
    assert.ok(!("clientRequestKey" in createdJson));

    const fetched = await getReviewDraft(handle.db, OWNERS.alice, created.id);
    assert.deepEqual(fetched, created);

    const listed = await listReviewDrafts(handle.db, OWNERS.alice);
    assert.equal(listed.items.length, 1);
    assert.deepEqual(listed.items[0], created);
    assert.equal(listed.hasMore, false);
    assert.equal(listed.nextOffset, null);

    const updated = await updateReviewDraft(handle.db, OWNERS.alice, created.id, {
      title: "Updated title",
      body: "Updated body with more detail.",
      rating: 2,
      revision: created.revision,
    });
    assert.equal(updated.revision, 2);
    assert.equal(updated.title, "Updated title");
    assert.equal(updated.rating, 2);
    assert.ok(new Date(updated.updatedAt) >= new Date(updated.createdAt));

    const refetched = await getReviewDraft(handle.db, OWNERS.alice, created.id);
    assert.equal(refetched.revision, 2);
    assert.equal(refetched.body, "Updated body with more detail.");

    const deleted = await deleteReviewDraft(handle.db, OWNERS.alice, created.id);
    assert.equal(deleted.id, created.id);

    await expectDraftError(
      getReviewDraft(handle.db, OWNERS.alice, created.id),
      "NOT_FOUND",
    );
    // Deleting again is NOT_FOUND, never a duplicate success.
    await expectDraftError(
      deleteReviewDraft(handle.db, OWNERS.alice, created.id),
      "NOT_FOUND",
    );
  } finally {
    await dropDraftsDatabase(handle);
  }
});

test("create is idempotent per owner request key, including concurrent retries", async () => {
  const handle = await createDraftsDatabase();
  try {
    await setupBaselineDirectory(handle.db);

    const first = await createReviewDraft(
      handle.db,
      OWNERS.alice,
      WESTHAVEN_UNIVERSITY_INPUT,
    );

    // Plain retry: same owner + key returns the original draft.
    const retry = await createReviewDraft(
      handle.db,
      OWNERS.alice,
      WESTHAVEN_UNIVERSITY_INPUT,
    );
    assert.equal(retry.id, first.id);

    // Retry with a different payload must NOT overwrite the original.
    const retryDifferentPayload = await createReviewDraft(handle.db, OWNERS.alice, {
      ...WESTHAVEN_UNIVERSITY_INPUT,
      title: "Different title",
      body: "Different body.",
      rating: 1,
    });
    assert.equal(retryDifferentPayload.id, first.id);
    assert.equal(retryDifferentPayload.title, "Great campus");
    assert.equal(retryDifferentPayload.rating, 4);

    // Concurrent duplicate retries all converge on one stored draft.
    const concurrent = await Promise.all([
      createReviewDraft(handle.db, OWNERS.alice, WESTHAVEN_UNIVERSITY_INPUT),
      createReviewDraft(handle.db, OWNERS.alice, WESTHAVEN_UNIVERSITY_INPUT),
      createReviewDraft(handle.db, OWNERS.alice, WESTHAVEN_UNIVERSITY_INPUT),
    ]);
    for (const dto of concurrent) {
      assert.equal(dto.id, first.id);
    }

    // A different request key creates a second draft; the same key under a
    // different owner does not collide with Alice's.
    const second = await createReviewDraft(handle.db, OWNERS.alice, {
      ...WESTHAVEN_UNIVERSITY_INPUT,
      clientRequestKey: "key-university-2",
    });
    assert.notEqual(second.id, first.id);
    const bobs = await createReviewDraft(handle.db, OWNERS.bob, {
      ...WESTHAVEN_UNIVERSITY_INPUT,
    });
    assert.notEqual(bobs.id, first.id);

    const rows = await listReviewDrafts(handle.db, OWNERS.alice, { limit: 50 });
    assert.equal(rows.items.length, 2);
    const all = await handle.db.select().from(reviewDrafts);
    assert.equal(all.length, 3);
  } finally {
    await dropDraftsDatabase(handle);
  }
});

test("list pagination and ordering by most recent update", async () => {
  const handle = await createDraftsDatabase();
  try {
    await setupBaselineDirectory(handle.db);

    // now() is transaction time, so give each create its own instant —
    // otherwise identical timestamps make the id tie-break decide order.
    const pause = () => new Promise((resolve) => setTimeout(resolve, 10));
    const a = await createReviewDraft(handle.db, OWNERS.alice, {
      ...WESTHAVEN_UNIVERSITY_INPUT,
      clientRequestKey: "k1",
      title: "oldest",
    });
    await pause();
    await createReviewDraft(handle.db, OWNERS.alice, {
      ...WESTHAVEN_UNIVERSITY_INPUT,
      clientRequestKey: "k2",
      title: "middle",
    });
    await pause();
    await createReviewDraft(handle.db, OWNERS.alice, {
      ...WESTHAVEN_UNIVERSITY_INPUT,
      clientRequestKey: "k3",
      title: "newest-created",
    });
    // Touching the oldest draft makes it the most recently updated.
    await updateReviewDraft(handle.db, OWNERS.alice, a.id, {
      title: "oldest-but-just-touched",
      revision: a.revision,
    });

    // Most recently updated first: the touched draft, then k3 (created
    // last), then k2.
    const page1 = await listReviewDrafts(handle.db, OWNERS.alice, {
      limit: 2,
    });
    assert.equal(page1.items.length, 2);
    assert.equal(page1.hasMore, true);
    assert.equal(page1.nextOffset, 2);
    assert.equal(page1.items[0].title, "oldest-but-just-touched");
    assert.equal(page1.items[1].title, "newest-created");

    const page2 = await listReviewDrafts(handle.db, OWNERS.alice, {
      limit: 2,
      offset: page1.nextOffset ?? 0,
    });
    assert.equal(page2.items.length, 1);
    assert.equal(page2.items[0].title, "middle");
    assert.equal(page2.hasMore, false);
    assert.equal(page2.nextOffset, null);

    // Bob's list never contains Alice's drafts.
    const bobList = await listReviewDrafts(handle.db, OWNERS.bob);
    assert.equal(bobList.items.length, 0);
  } finally {
    await dropDraftsDatabase(handle);
  }
});

test("cross-owner access is rejected and indistinguishable from nonexistent", async () => {
  const handle = await createDraftsDatabase();
  try {
    await setupBaselineDirectory(handle.db);

    const aliceDraft = await createReviewDraft(
      handle.db,
      OWNERS.alice,
      WESTHAVEN_UNIVERSITY_INPUT,
    );
    const nonexistentId = "00000000-0000-4000-9000-00000000dead";

    // Bob gets the identical NOT_FOUND for Alice's draft and for a
    // nonexistent one: foreign records cannot be detected.
    await expectDraftError(
      getReviewDraft(handle.db, OWNERS.bob, aliceDraft.id),
      "NOT_FOUND",
    );
    await expectDraftError(
      getReviewDraft(handle.db, OWNERS.bob, nonexistentId),
      "NOT_FOUND",
    );

    // List never leaks foreign drafts.
    const bobList = await listReviewDrafts(handle.db, OWNERS.bob);
    assert.equal(bobList.items.length, 0);

    // Update with the correct revision still fails for a foreign draft.
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.bob, aliceDraft.id, {
        body: "Bob was here.",
        revision: aliceDraft.revision,
      }),
      "NOT_FOUND",
    );

    // Foreign delete is NOT_FOUND and leaves the draft intact.
    await expectDraftError(
      deleteReviewDraft(handle.db, OWNERS.bob, aliceDraft.id),
      "NOT_FOUND",
    );
    const stillThere = await getReviewDraft(handle.db, OWNERS.alice, aliceDraft.id);
    assert.equal(stillThere.id, aliceDraft.id);

    // The owner keeps full access.
    const updated = await updateReviewDraft(handle.db, OWNERS.alice, aliceDraft.id, {
      body: "Only Alice can do this.",
      revision: aliceDraft.revision,
    });
    assert.equal(updated.revision, 2);

    // Bob's own draft is isolated from Alice's list.
    const bobDraft = await createReviewDraft(handle.db, OWNERS.bob, {
      ...WESTHAVEN_UNIVERSITY_INPUT,
      clientRequestKey: "bobs-own",
    });
    const aliceList = await listReviewDrafts(handle.db, OWNERS.alice);
    assert.deepEqual(
      aliceList.items.map((d) => d.id),
      [aliceDraft.id],
    );
    await expectDraftError(
      getReviewDraft(handle.db, OWNERS.alice, bobDraft.id),
      "NOT_FOUND",
    );
  } finally {
    await dropDraftsDatabase(handle);
  }
});

test("targets must exist and belong to the draft's university", async () => {
  const handle = await createDraftsDatabase();
  try {
    await setupBaselineDirectory(handle.db);

    // Nonexistent university.
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        ...WESTHAVEN_UNIVERSITY_INPUT,
        universityId: "00000000-0000-4000-9000-00000000beef",
      }),
      "INVALID_TARGET",
    );

    // Nonexistent course at an existing university.
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        universityId: UNIVERSITIES.westhaven,
        targetType: "course",
        targetId: "00000000-0000-4000-9000-00000000beef",
        body: "Ghost course.",
        rating: 3,
        clientRequestKey: "ghost-course",
      }),
      "INVALID_TARGET",
    );

    // Cross-university mismatch: Ostbrück course claimed under Westhaven.
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        universityId: UNIVERSITIES.westhaven,
        targetType: "course",
        targetId: COURSES.ostbruckAlgorithms,
        body: "Wrong university.",
        rating: 3,
        clientRequestKey: "cross-uni-course",
      }),
      "INVALID_TARGET",
    );

    // Cross-university instructor mismatch.
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        universityId: UNIVERSITIES.westhaven,
        targetType: "instructor",
        targetId: INSTRUCTORS.ostbruckRoe,
        body: "Wrong university.",
        rating: 3,
        clientRequestKey: "cross-uni-instructor",
      }),
      "INVALID_TARGET",
    );

    // Valid same-university course draft.
    const courseDraft = await createReviewDraft(handle.db, OWNERS.alice, {
      universityId: UNIVERSITIES.westhaven,
      targetType: "course",
      targetId: COURSES.westhavenAlgorithms,
      body: "Rigorous but fair.",
      rating: 5,
      clientRequestKey: "good-course",
    });
    assert.equal(courseDraft.courseId, COURSES.westhavenAlgorithms);
    assert.equal(courseDraft.instructorId, null);

    // Valid same-university instructor draft.
    const instructorDraft = await createReviewDraft(handle.db, OWNERS.alice, {
      universityId: UNIVERSITIES.westhaven,
      targetType: "instructor",
      targetId: INSTRUCTORS.westhavenDoe,
      body: "Explains clearly.",
      rating: 5,
      clientRequestKey: "good-instructor",
    });
    assert.equal(instructorDraft.instructorId, INSTRUCTORS.westhavenDoe);
    assert.equal(instructorDraft.courseId, null);

    // University draft may state the matching targetId explicitly.
    const uniDraft = await createReviewDraft(handle.db, OWNERS.alice, {
      ...WESTHAVEN_UNIVERSITY_INPUT,
      targetId: UNIVERSITIES.westhaven,
      clientRequestKey: "uni-with-target",
    });
    assert.equal(uniDraft.targetType, "university");
  } finally {
    await dropDraftsDatabase(handle);
  }
});

test("invalid payloads are rejected with INVALID_INPUT; anonymous access with UNAUTHENTICATED", async () => {
  const handle = await createDraftsDatabase();
  try {
    await setupBaselineDirectory(handle.db);

    const base = { ...WESTHAVEN_UNIVERSITY_INPUT };

    // Rating bounds and types.
    for (const rating of [0, 6, 2.5, "5", null]) {
      await expectDraftError(
        createReviewDraft(handle.db, OWNERS.alice, { ...base, rating }),
        "INVALID_INPUT",
      );
    }

    // Body requirements and limits.
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, { ...base, body: undefined }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, { ...base, body: "" }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, { ...base, body: "   " }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        ...base,
        body: "x".repeat(5001),
      }),
      "INVALID_INPUT",
    );

    // Title limit.
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        ...base,
        title: "x".repeat(141),
      }),
      "INVALID_INPUT",
    );

    // Unknown keys are rejected outright — ownership cannot be smuggled in,
    // and neither can lifecycle state or identity.
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        ...base,
        ownerSubject: OWNERS.bob,
      }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, { ...base, id: "x" }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        ...base,
        status: "published",
      }),
      "INVALID_INPUT",
    );

    // Structural fields.
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        ...base,
        universityId: "not-a-uuid",
      }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        ...base,
        targetType: "programme",
      }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        universityId: UNIVERSITIES.westhaven,
        targetType: "course",
        body: "No target id.",
        rating: 3,
        clientRequestKey: "no-target",
      }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, { ...base, clientRequestKey: "" }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        ...base,
        clientRequestKey: "x".repeat(101),
      }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      createReviewDraft(handle.db, OWNERS.alice, {
        ...base,
        targetId: UNIVERSITIES.ostbruck,
      }),
      "INVALID_INPUT",
    );

    // Draft id shape.
    for (const bad of ["not-a-uuid", "123", null, 42]) {
      await expectDraftError(
        getReviewDraft(handle.db, OWNERS.alice, bad),
        "INVALID_INPUT",
      );
      await expectDraftError(
        updateReviewDraft(handle.db, OWNERS.alice, bad, {
          body: "x",
          revision: 1,
        }),
        "INVALID_INPUT",
      );
      await expectDraftError(
        deleteReviewDraft(handle.db, OWNERS.alice, bad),
        "INVALID_INPUT",
      );
    }

    // Update payload rules.
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, "00000000-0000-4000-9000-00000000beef", {}),
      "INVALID_INPUT",
    );
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, "00000000-0000-4000-9000-00000000beef", {
        body: "x",
      }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, "00000000-0000-4000-9000-00000000beef", {
        body: "x",
        revision: 0,
      }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, "00000000-0000-4000-9000-00000000beef", {
        body: "x",
        revision: "1",
      }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, "00000000-0000-4000-9000-00000000beef", {
        title: "",
        revision: 1,
      }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, "00000000-0000-4000-9000-00000000beef", {
        body: null,
        revision: 1,
      }),
      "INVALID_INPUT",
    );
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, "00000000-0000-4000-9000-00000000beef", {
        rating: 9,
        revision: 1,
      }),
      "INVALID_INPUT",
    );
    // Target changes are not an accepted update field.
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, "00000000-0000-4000-9000-00000000beef", {
        targetId: COURSES.westhavenAlgorithms,
        revision: 1,
      }),
      "INVALID_INPUT",
    );

    // Pagination rules.
    for (const options of [{ limit: 0 }, { limit: 51 }, { limit: 1.5 }, { limit: "5" }, { offset: -1 }, { offset: "0" }]) {
      await expectDraftError(
        listReviewDrafts(handle.db, OWNERS.alice, options),
        "INVALID_INPUT",
      );
    }

    // Anonymous or malformed principals are rejected before any query, for
    // every operation.
    for (const subject of ["", "   ", null, undefined, 42, "x".repeat(256)]) {
      await expectDraftError(
        createReviewDraft(handle.db, subject, base),
        "UNAUTHENTICATED",
      );
      await expectDraftError(
        getReviewDraft(handle.db, subject, "00000000-0000-4000-9000-00000000beef"),
        "UNAUTHENTICATED",
      );
      await expectDraftError(listReviewDrafts(handle.db, subject), "UNAUTHENTICATED");
      await expectDraftError(
        updateReviewDraft(handle.db, subject, "00000000-0000-4000-9000-00000000beef", {
          body: "x",
          revision: 1,
        }),
        "UNAUTHENTICATED",
      );
      await expectDraftError(
        deleteReviewDraft(handle.db, subject, "00000000-0000-4000-9000-00000000beef"),
        "UNAUTHENTICATED",
      );
    }

    // Boundary values that MUST be accepted: 5000-char body, 140-char title,
    // 50-item page size.
    const boundary = await createReviewDraft(handle.db, OWNERS.alice, {
      ...base,
      body: "y".repeat(5000),
      title: "y".repeat(140),
      clientRequestKey: "boundary",
    });
    assert.equal(boundary.body.length, 5000);
    assert.equal(boundary.title?.length, 140);
    const boundaryPage = await listReviewDrafts(handle.db, OWNERS.alice, {
      limit: 50,
    });
    assert.equal(boundaryPage.hasMore, false);
  } finally {
    await dropDraftsDatabase(handle);
  }
});

test("stale writes are rejected and delete wins over in-flight updates", async () => {
  const handle = await createDraftsDatabase();
  try {
    await setupBaselineDirectory(handle.db);

    const draft = await createReviewDraft(handle.db, OWNERS.alice, {
      ...WESTHAVEN_UNIVERSITY_INPUT,
      clientRequestKey: "races",
    });

    const v2 = await updateReviewDraft(handle.db, OWNERS.alice, draft.id, {
      body: "Version 2.",
      revision: 1,
    });
    assert.equal(v2.revision, 2);

    // Stale revision cannot overwrite the newer state.
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, draft.id, {
        body: "Stale overwrite attempt.",
        revision: 1,
      }),
      "CONFLICT",
    );
    const unchanged = await getReviewDraft(handle.db, OWNERS.alice, draft.id);
    assert.equal(unchanged.body, "Version 2.");
    assert.equal(unchanged.revision, 2);

    // A future revision the service never issued is also a conflict.
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, draft.id, {
        body: "Time traveller.",
        revision: 99,
      }),
      "CONFLICT",
    );

    // Current revision wins.
    const v3 = await updateReviewDraft(handle.db, OWNERS.alice, draft.id, {
      body: "Version 3.",
      revision: 2,
    });
    assert.equal(v3.revision, 3);

    // Delete wins: after deletion, an in-flight stale (or even current)
    // update finds nothing and cannot resurrect the draft.
    await deleteReviewDraft(handle.db, OWNERS.alice, draft.id);
    await expectDraftError(
      updateReviewDraft(handle.db, OWNERS.alice, draft.id, {
        body: "Resurrection attempt.",
        revision: 3,
      }),
      "NOT_FOUND",
    );
    const rows = await listReviewDrafts(handle.db, OWNERS.alice);
    assert.equal(rows.items.length, 0);
  } finally {
    await dropDraftsDatabase(handle);
  }
});

test("hostile text is stored and returned verbatim through parameterized queries", async () => {
  const handle = await createDraftsDatabase();
  try {
    await setupBaselineDirectory(handle.db);

    const hostile = {
      universityId: UNIVERSITIES.westhaven,
      targetType: "university" as const,
      title: "'; DROP TABLE review_drafts; --",
      body: "Body with 'quotes', \"double quotes\", $1 placeholders, %s formats, emoji 🎓 and \\ backslashes.",
      rating: 3,
      clientRequestKey: "'; DELETE FROM review_drafts WHERE '1'='1",
    };

    const draft = await createReviewDraft(handle.db, OWNERS.alice, hostile);
    assert.equal(draft.title, hostile.title);
    assert.equal(draft.body, hostile.body);

    const refetched = await getReviewDraft(handle.db, OWNERS.alice, draft.id);
    assert.equal(refetched.body, hostile.body);

    // The table survived the hostile payload.
    const listed = await listReviewDrafts(handle.db, OWNERS.alice);
    assert.equal(listed.items.length, 1);

    const updated = await updateReviewDraft(handle.db, OWNERS.alice, draft.id, {
      title: "100%'); INSERT INTO review_drafts --",
      revision: draft.revision,
    });
    assert.equal(updated.title, "100%'); INSERT INTO review_drafts --");
  } finally {
    await dropDraftsDatabase(handle);
  }
});
