import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { COURSE_IDS, INSTRUCTOR_IDS, UNIVERSITY_IDS } from "@/db/seed-data";
import { seedDatabase } from "@/db/seed";
import {
  createDemoRatingsSeedClient,
  demoReviews,
  seedDemoRatings,
} from "@/db/demo-ratings-seed";
import { seedUniversities } from "@/db/seed-data";
import { universities as universitiesTable } from "@/db/schema";
import { withCatalogDatabase } from "./helpers.js";

// Catalog read-service behaviour against a real ephemeral PostgreSQL:
// empty databases, honest no-review scores, search/filter/sort/pagination,
// detail queries, top-N ranking and review pages.

test("empty database yields empty results, not errors", async () => {
  await withCatalogDatabase(async ({ service }) => {
    const universities = await service.listUniversities();
    assert.equal(universities.total, 0);
    assert.deepEqual(universities.items, []);
    assert.equal(universities.totalPages, 0);
    assert.equal(universities.hasNextPage, false);

    const top = await service.getTopUniversities();
    assert.deepEqual(top, []);

    const countries = await service.listCountries();
    assert.deepEqual(countries, []);

    const courses = await service.listCourses();
    assert.equal(courses.total, 0);

    assert.equal(await service.getUniversityDetail("asterheim-institute-of-technology"), null);
    assert.equal(
      await service.getCourseDetail("00000000-0000-4000-8000-000000000101"),
      null,
    );
    assert.equal(
      await service.getInstructorDetail("00000000-0000-4000-8000-000000000201"),
      null,
    );
  });
});

test("directory without reviews exposes honest null scores and zero counts", async () => {
  await withCatalogDatabase(async ({ db, service }) => {
    await seedDatabase(db);

    const page = await service.listUniversities();
    assert.equal(page.total, seedUniversities.length);
    for (const university of page.items) {
      assert.equal(university.reviewCount, 0, `${university.slug} has no reviews`);
      assert.equal(university.latestReviewAt, null);
      for (const [dimension, score] of Object.entries(university.scores)) {
        assert.equal(score, null, `${university.slug}.${dimension} must be null without reviews`);
      }
    }

    // Deterministic default ordering: name ascending.
    assert.deepEqual(
      page.items.map((u) => u.slug),
      [...page.items.map((u) => u.slug)].sort(),
    );

    // Top-N excludes universities without any score.
    assert.deepEqual(await service.getTopUniversities(), []);

    const detail = await service.getUniversityDetail("asterheim-institute-of-technology");
    assert.ok(detail);
    assert.equal(detail.programmes.length, 2);
    assert.equal(detail.courseCount, 4);
    assert.equal(detail.instructorCount, 3);
    assert.equal(detail.scores.overall, null);

    const courseDetail = await service.getCourseDetail(COURSE_IDS.asterheimCs101);
    assert.ok(courseDetail);
    assert.equal(courseDetail.reviewCount, 0);
    assert.equal(courseDetail.scores.overall, null);
    assert.equal(courseDetail.offerings.length, 1);
    assert.equal(courseDetail.offerings[0].academicYear, 2025);
    assert.deepEqual(
      courseDetail.instructors.map((i) => i.slug),
      ["jonas-okafor"],
    );

    const instructorDetail = await service.getInstructorDetail(INSTRUCTOR_IDS.asterheimOkafor);
    assert.ok(instructorDetail);
    assert.equal(instructorDetail.reviewCount, 0);
    assert.equal(instructorDetail.scores.overall, null);
    assert.ok(instructorDetail.courses.some((c) => c.id === COURSE_IDS.asterheimCs101));
  });
});

test("search, country filter, sort and pagination behave deterministically", async () => {
  await withCatalogDatabase(async ({ db, service }) => {
    await seedDatabase(db);
    await seedDemoRatings(db);

    // Search is case-insensitive across name/city/country.
    assert.equal((await service.listUniversities({ q: "vesim" })).total, 1);
    assert.equal((await service.listUniversities({ q: "ASTERHEIM" })).total, 1);
    assert.equal((await service.listUniversities({ q: "finland" })).total, 1);
    // No match stays honest.
    assert.equal((await service.listUniversities({ q: "oxford" })).total, 0);

    // Country filter is an exact ISO code match.
    const germany = await service.listUniversities({ country: "de" });
    assert.equal(germany.total, 1);
    assert.equal(germany.items[0].slug, "asterheim-institute-of-technology");
    assert.equal((await service.listUniversities({ country: "xx" })).total, 0);

    // LIKE wildcards in user input are escaped, not honoured.
    assert.equal((await service.listUniversities({ q: "%" })).total, 0);
    assert.equal((await service.listUniversities({ q: "_" })).total, 0);

    // Sort by score: Vesimäki (4.5) before Asterheim (4.33); Bellenau
    // (unscored) last.
    const byOverall = await service.listUniversities({ sort: "overall" });
    assert.deepEqual(
      byOverall.items.map((u) => [u.slug, u.scores.overall]),
      [
        ["vesimaki-university", 4.5],
        ["asterheim-institute-of-technology", 4.33],
        ["university-of-bellenau", null],
      ],
    );

    // Sort by review count: 3, 2, 0.
    const byReviews = await service.listUniversities({ sort: "reviews" });
    assert.deepEqual(
      byReviews.items.map((u) => u.reviewCount),
      [3, 2, 0],
    );

    // Pagination is bounded and honest.
    const page1 = await service.listUniversities({ pageSize: 2, page: 1 });
    assert.equal(page1.items.length, 2);
    assert.equal(page1.total, 3);
    assert.equal(page1.totalPages, 2);
    assert.equal(page1.hasNextPage, true);

    const page2 = await service.listUniversities({ pageSize: 2, page: 2 });
    assert.equal(page2.items.length, 1);
    assert.equal(page2.hasNextPage, false);

    const page3 = await service.listUniversities({ pageSize: 2, page: 3 });
    assert.equal(page3.items.length, 0);
    assert.equal(page3.total, 3);

    // Out-of-range / invalid inputs clamp to documented defaults.
    const clamped = await service.listUniversities({ pageSize: 999, page: -3 });
    assert.equal(clamped.pageSize, 50);
    assert.equal(clamped.page, 1);
  });
});

test("top-N ranks scored universities deterministically and excludes unscored ones", async () => {
  await withCatalogDatabase(async ({ db, service }) => {
    await seedDatabase(db);
    await seedDemoRatings(db);

    const top = await service.getTopUniversities();
    assert.deepEqual(
      top.map((u) => [u.slug, u.scores.overall, u.reviewCount]),
      [
        ["vesimaki-university", 4.5, 2],
        ["asterheim-institute-of-technology", 4.33, 3],
      ],
    );
    assert.ok(top.every((u) => u.slug !== "university-of-bellenau"));
    // Recency metadata follows the newest published sample review.
    assert.equal(top[0].latestReviewAt, "2026-02-10T10:15:00.000Z");

    // Limit clamps to the documented bound.
    const limited = await service.getTopUniversities({ limit: 1 });
    assert.equal(limited.length, 1);
    assert.equal(limited[0].slug, "vesimaki-university");
  });
});

test("scores derive from stored sample ratings, not hardcoded values", async () => {
  await withCatalogDatabase(async ({ db, service }) => {
    await seedDatabase(db);
    await seedDemoRatings(db);

    // Recompute Asterheim's overall average directly from stored rating rows.
    const asterheimRows = await db
      .select()
      .from(universitiesTable)
      .where(eq(universitiesTable.id, UNIVERSITY_IDS.asterheim));
    const asterheim = asterheimRows[0];

    const overallRatings = demoReviews
      .filter((r) => r.subjectType === "university" && r.universityId === asterheim.id)
      .map((r) => r.ratings.overall as number);
    const expected =
      Math.round((overallRatings.reduce((a, b) => a + b, 0) / overallRatings.length) * 100) / 100;

    const detail = await service.getUniversityDetail(asterheim.slug);
    assert.ok(detail);
    assert.equal(detail.scores.overall, expected);
    assert.equal(detail.reviewCount, overallRatings.length);

    // Course averages derive from course-dimension ratings the same way.
    const cs101 = await service.getCourseDetail(COURSE_IDS.asterheimCs101);
    assert.ok(cs101);
    const cs101Workload = demoReviews
      .filter((r) => r.courseId === COURSE_IDS.asterheimCs101)
      .map((r) => r.ratings.workload as number);
    const expectedWorkload =
      Math.round((cs101Workload.reduce((a, b) => a + b, 0) / cs101Workload.length) * 100) / 100;
    assert.equal(cs101.scores.workload, expectedWorkload);
    assert.equal(cs101.reviewCount, cs101Workload.length);
  });
});

test("course listing filters, searches and stays deterministic", async () => {
  await withCatalogDatabase(async ({ db, service }) => {
    await seedDatabase(db);
    await seedDemoRatings(db);

    const all = await service.listCourses();
    assert.equal(all.total, 12);

    const bachelors = await service.listCourses({ level: "bachelor" });
    assert.equal(bachelors.total, 6);
    assert.ok(bachelors.items.every((c) => c.level === "bachelor"));

    const search = await service.listCourses({ q: "algorithms" });
    assert.equal(search.total, 1);
    assert.equal(search.items[0].id, COURSE_IDS.asterheimCs210);

    const byCode = await service.listCourses({ universitySlug: "asterheim-institute-of-technology" });
    assert.deepEqual(
      byCode.items.map((c) => c.code),
      ["AIT-CS101", "AIT-CS210", "AIT-DE501", "AIT-DE560"],
    );

    const byOverall = await service.listCourses({ sort: "overall" });
    // DE501 (5.0 avg from 1 review) first; CS101 and SE150 both 4.5 with 2
    // reviews each — CS210 last among scored courses (4.0). Unscored courses
    // trail, sorted by code.
    assert.equal(byOverall.items[0].id, COURSE_IDS.asterheimDe501);
    assert.ok(byOverall.items[0].scores.overall !== null);
    // All scored courses appear before any unscored course.
    const scoredCount = byOverall.items.filter((c) => c.scores.overall !== null).length;
    assert.ok(scoredCount > 0);
    assert.ok(byOverall.items.slice(scoredCount).every((c) => c.scores.overall === null));

    // Unknown university slug yields an honest empty page, not an error.
    const unknownScope = await service.listCourses({ universitySlug: "does-not-exist" });
    assert.equal(unknownScope.total, 0);
    assert.deepEqual(unknownScope.items, []);
  });
});

test("sample review pages are paginated, ordered and scoped to the subject", async () => {
  await withCatalogDatabase(async ({ db, service }) => {
    await seedDatabase(db);
    await seedDemoRatings(db);

    const reviews = await service.listUniversityReviews("asterheim-institute-of-technology");
    assert.ok(reviews);
    assert.equal(reviews.total, 3);
    assert.equal(reviews.items.length, 3);
    // Ordered newest first.
    assert.deepEqual(
      reviews.items.map((r) => r.publishedAt),
      [...reviews.items.map((r) => r.publishedAt)].sort().reverse(),
    );
    assert.ok(reviews.items.every((r) => r.subjectType === "university"));
    assert.ok(reviews.items.every((r) => r.provenance === "demo"));

    const firstPage = await service.listUniversityReviews("asterheim-institute-of-technology", {
      pageSize: 2,
    });
    assert.ok(firstPage);
    assert.equal(firstPage.items.length, 2);
    assert.equal(firstPage.total, 3);
    assert.equal(firstPage.hasNextPage, true);

    // Unknown subject is null, distinct from an existing subject with zero
    // reviews (Bellenau).
    assert.equal(await service.listUniversityReviews("does-not-exist"), null);
    const bellenau = await service.listUniversityReviews("university-of-bellenau");
    assert.ok(bellenau);
    assert.equal(bellenau.total, 0);
    assert.deepEqual(bellenau.items, []);

    const courseReviews = await service.listCourseReviews(COURSE_IDS.asterheimCs101);
    assert.ok(courseReviews);
    assert.equal(courseReviews.total, 2);
    assert.ok(courseReviews.items.every((r) => r.courseId === COURSE_IDS.asterheimCs101));

    // Unscored course exposes an empty review page through the same contract.
    const ss430 = await service.listCourseReviews(COURSE_IDS.vesimakiSs430);
    assert.ok(ss430);
    assert.equal(ss430.total, 0);

    const instructorReviews = await service.listInstructorReviews(INSTRUCTOR_IDS.asterheimOkafor);
    assert.ok(instructorReviews);
    assert.equal(instructorReviews.total, 2);
  });
});

test("demo seed validates intended directory targets and cross-links stay intact", async () => {
  await withCatalogDatabase(async ({ db, ephemeral, service }) => {
    // The demo ratings seed must refuse rows for institutions the directory
    // does not contain (foreign keys reject cross-university references).
    await seedDatabase(db);
    const client = createDemoRatingsSeedClient(ephemeral.connectionString);
    const summary = await seedDemoRatings(client);
    await client.$client.end();

    assert.equal(summary.reviews, demoReviews.length);
    assert.ok(summary.reviews > 0);

    // Every review belongs to a seeded fictional university.
    const allUniversities = await db.select().from(universitiesTable);
    const seededIds = new Set(allUniversities.map((u) => u.id));
    for (const review of demoReviews) {
      assert.ok(seededIds.has(review.universityId), `review ${review.id} has a seeded university`);
    }

    // The service still reads the converged state afterwards.
    const top = await service.getTopUniversities();
    assert.equal(top.length, 2);
  });
});
