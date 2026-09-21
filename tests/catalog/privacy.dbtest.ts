import assert from "node:assert/strict";
import test from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";

import { createCatalogService } from "@/server/catalog/service";
import { CatalogUnavailableError } from "@/server/catalog/errors";
import { seedDatabase } from "@/db/seed";
import { seedDemoRatings } from "@/db/demo-ratings-seed";
import { withCatalogDatabase } from "./helpers.js";

// Privacy contract of the catalog read service: no identity data in the
// projection or the DTOs, no internal error details in failures, and clear
// separation between "not configured", "unreachable", "empty" and "missing".

const REVIEW_DTO_KEYS = [
  "id",
  "subjectType",
  "universityId",
  "courseId",
  "instructorId",
  "authorAlias",
  "programmeLabel",
  "experienceYear",
  "title",
  "body",
  "pros",
  "cons",
  "publishedAt",
  "provenance",
].sort();

const UNIVERSITY_DTO_KEYS = [
  "id",
  "slug",
  "name",
  "city",
  "country",
  "countryCode",
  "foundedYear",
  "type",
  "websiteUrl",
  "description",
  "studentCount",
  "scores",
  "reviewCount",
  "latestReviewAt",
].sort();

const IDENTITY_PATTERN = /email|mail|token|secret|password|account|user|author_id|session|ip_address/i;

test("the sample projection contains no identity-shaped columns", async () => {
  await withCatalogDatabase(async ({ db }) => {
    const columns = await db.execute(
      "select table_name, column_name from information_schema.columns where table_name in ('public_sample_reviews','public_sample_review_ratings')",
    );
    const names = (columns.rows as { table_name: string; column_name: string }[]).map(
      (c) => `${c.table_name}.${c.column_name}`,
    );
    assert.ok(names.length > 0, "projection tables must exist");
    for (const name of names) {
      assert.doesNotMatch(name, IDENTITY_PATTERN, `column ${name} must not be identity-shaped`);
    }
  });
});

test("DTOs expose no identity fields — only fictional demo aliases", async () => {
  await withCatalogDatabase(async ({ db, service }) => {
    await seedDatabase(db);
    await seedDemoRatings(db);

    const page = await service.listUniversities();
    assert.ok(page.items.length > 0);
    for (const university of page.items) {
      assert.deepEqual(Object.keys(university).sort(), UNIVERSITY_DTO_KEYS);
    }

    const reviews = await service.listUniversityReviews("asterheim-institute-of-technology");
    assert.ok(reviews && reviews.items.length > 0);
    for (const review of reviews.items) {
      assert.deepEqual(Object.keys(review).sort(), REVIEW_DTO_KEYS);
      // The alias is a role label, never an address or identifier.
      assert.ok(!review.authorAlias.includes("@"));
    }

    // Serialized DTO text contains no identity-shaped words at all.
    const serialized = JSON.stringify({ universities: page.items, reviews: reviews.items });
    assert.doesNotMatch(serialized, /"@|email|token|secret|password|account/i);
  });
});

test("not-configured databases surface a typed, generic error", async () => {
  const service = createCatalogService({
    getDb: () => {
      throw new Error(
        "DATABASE_URL is not set. Internal detail that must never leak: host db-xyz-internal",
      );
    },
  });

  await assert.rejects(
    () => service.listUniversities(),
    (error: unknown) => {
      assert.ok(error instanceof CatalogUnavailableError);
      assert.equal(error.reason, "database-not-configured");
      assert.doesNotMatch(error.message, /internal|host|xyz/i);
      return true;
    },
  );

  await assert.rejects(() => service.getTopUniversities(), CatalogUnavailableError);
  await assert.rejects(() => service.listCountries(), CatalogUnavailableError);
});

test("unreachable databases surface a typed, generic error without connection details", async () => {
  // Port 1 on localhost: connection refused, nothing is listening.
  const dead = drizzle("postgres://postgres:postgres@127.0.0.1:1/does_not_exist", {
    casing: "snake_case",
  });
  const service = createCatalogService({ getDb: () => dead as never });
  try {
    await assert.rejects(
      () => service.listUniversities(),
      (error: unknown) => {
        assert.ok(error instanceof CatalogUnavailableError);
        assert.equal(error.reason, "database-unreachable");
        assert.doesNotMatch(error.message, /ECONNREFUSED|127\.0\.0\.1|postgres|does_not_exist/);
        // Server-side diagnostics remain available on cause for logging.
        assert.ok(error.cause !== undefined);
        return true;
      },
    );
  } finally {
    await dead.$client.end();
  }
});

test("invalid identifiers return null instead of database errors", async () => {
  await withCatalogDatabase(async ({ service }) => {
    assert.equal(await service.getCourseDetail("not-a-uuid"), null);
    assert.equal(await service.getInstructorDetail("'; drop table universities; --"), null);
    assert.equal(await service.getUniversityDetail("Not A Slug!"), null);
  });
});
