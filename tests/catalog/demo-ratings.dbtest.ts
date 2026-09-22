import assert from "node:assert/strict";
import test from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";

import {
  createDemoRatingsSeedClient,
  demoReviews,
  seedDemoRatings,
} from "@/db/demo-ratings-seed";
import {
  publicSampleReviewRatings,
  publicSampleReviews,
} from "@/db/demo-review-schema";
import { seedDatabase } from "@/db/seed";
import { closeDb } from "../db/helpers.js";
import { withCatalogDatabase } from "./helpers.js";

// Demo ratings seed: repeatability, drift convergence, demo provenance and
// integrity of the public sample projection.

async function snapshot(db: Awaited<ReturnType<typeof drizzle>>) {
  const order = <T>(rows: T[]): T[] =>
    [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  // Nothing is excluded: demo rows carry fixed published_at/created_at, so
  // repeated runs must be byte-identical.
  return JSON.stringify({
    reviews: order(await db.select().from(publicSampleReviews)),
    ratings: order(await db.select().from(publicSampleReviewRatings)),
  });
}

test("demo ratings seed is repeatable: two runs produce identical state", async () => {
  await withCatalogDatabase(async ({ db, ephemeral }) => {
    await seedDatabase(db);
    const seedClient = createDemoRatingsSeedClient(ephemeral.connectionString);
    try {
      const first = await seedDemoRatings(seedClient);
      const firstSnapshot = await snapshot(db);
      const second = await seedDemoRatings(seedClient);
      const secondSnapshot = await snapshot(db);

      assert.equal(firstSnapshot, secondSnapshot);
      assert.deepEqual(second, first);

      assert.equal(
        (await db.select().from(publicSampleReviews)).length,
        demoReviews.length,
        "no duplicate review rows across runs",
      );
      const ratingRows = await db.select().from(publicSampleReviewRatings);
      assert.equal(ratingRows.length, first.ratings);
    } finally {
      await closeDb(seedClient);
    }
  });
});

test("demo ratings seed converges after local drift", async () => {
  await withCatalogDatabase(async ({ db, ephemeral }) => {
    await seedDatabase(db);
    const seedClient = createDemoRatingsSeedClient(ephemeral.connectionString);
    try {
      await seedDemoRatings(seedClient);
      const baseline = await snapshot(db);

      // Simulate drift: mangled ratings and a deleted review.
      await db.execute(
        "update public_sample_review_ratings set value = 1 where dimension = 'overall' and value = 5",
      );
      await db.execute(`delete from public_sample_reviews where id = '${demoReviews[0].id}'`);

      await seedDemoRatings(seedClient);
      assert.equal(await snapshot(db), baseline, "seed must repair drifted demo rows");
    } finally {
      await closeDb(seedClient);
    }
  });
});

test("demo rows are provenance-marked and reference only seeded fictional subjects", async () => {
  await withCatalogDatabase(async ({ db, ephemeral }) => {
    await seedDatabase(db);
    const seedClient = createDemoRatingsSeedClient(ephemeral.connectionString);
    try {
      await seedDemoRatings(seedClient);

      const reviews = await db.select().from(publicSampleReviews);
      assert.ok(reviews.length > 0);
      for (const review of reviews) {
        assert.equal(review.provenance, "demo", `review ${review.id} must be demo-provenance`);
        // Fictional role labels only — never an email-like or account-like
        // value.
        assert.ok(!review.authorAlias.includes("@"));
        assert.ok(review.authorAlias.endsWith("(demo)"));
        assert.equal(review.subjectType === "course", review.courseId !== null);
        assert.equal(review.subjectType === "instructor", review.instructorId !== null);
        assert.equal(
          review.subjectType === "university",
          review.courseId === null && review.instructorId === null,
        );
      }

      // Every review rates `overall` exactly once, and values stay in the
      // 1..5 domain the schema enforces.
      const ratings = await db.select().from(publicSampleReviewRatings);
      const overallByReview = new Map<string, number>();
      for (const rating of ratings) {
        assert.ok(rating.value >= 1 && rating.value <= 5);
        if (rating.dimension === "overall") {
          overallByReview.set(rating.reviewId, rating.value);
        }
      }
      assert.equal(overallByReview.size, reviews.length);
    } finally {
      await closeDb(seedClient);
    }
  });
});

test("demo seed fails atomically when directory targets are missing", async () => {
  await withCatalogDatabase(async ({ db, ephemeral }) => {
    // Directory seed deliberately NOT run: every demo review references a
    // missing university, so the seed must fail and leave no partial rows.
    const seedClient = createDemoRatingsSeedClient(ephemeral.connectionString);
    try {
      await assert.rejects(() => seedDemoRatings(seedClient));
      const rows = await db.select().from(publicSampleReviews);
      assert.equal(rows.length, 0, "failed seed must leave no partial rows");
    } finally {
      await closeDb(seedClient);
    }
  });
});
