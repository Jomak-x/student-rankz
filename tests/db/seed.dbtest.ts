import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import {
  courseOfferings,
  courses,
  instructors,
  offeringInstructors,
  programmes,
  programmeCourses,
  universities,
} from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import {
  seedCourses,
  seedInstructors,
  seedOfferingInstructors,
  seedOfferings,
  seedProgrammeCourses,
  seedProgrammes,
  seedUniversities,
} from "@/db/seed-data";
import { closeDb, createEphemeralDatabase, dropEphemeralDatabase } from "./helpers.js";

const migrationsFolder = path.resolve(import.meta.dirname, "../../drizzle");

async function snapshot(db: Awaited<ReturnType<typeof drizzle>>) {
  const order = <T>(rows: T[]): T[] =>
    [...rows].sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
    );

  // Timestamps legitimately differ between seed runs; exclude them from the
  // content snapshot.
  return JSON.stringify(
    {
      universities: order(await db.select().from(universities)),
      programmes: order(await db.select().from(programmes)),
      courses: order(await db.select().from(courses)),
      programmeCourses: order(await db.select().from(programmeCourses)),
      courseOfferings: order(await db.select().from(courseOfferings)),
      instructors: order(await db.select().from(instructors)),
      offeringInstructors: order(await db.select().from(offeringInstructors)),
    },
    (key, value) => (key === "createdAt" || key === "updatedAt" ? undefined : value),
  );
}

test("seed is repeatable: two runs produce identical state", async () => {
  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  const db = drizzle(ephemeral.connectionString, { casing: "snake_case" });
  try {

    await seedDatabase(db);
    const first = await snapshot(db);

    // Second run must be a no-op convergence, not duplicate rows.
    await seedDatabase(db);
    const second = await snapshot(db);

    assert.equal(first, second);

    assert.equal(
      (await db.select().from(universities)).length,
      seedUniversities.length,
    );
    assert.equal(
      (await db.select().from(programmes)).length,
      seedProgrammes.length,
    );
    assert.equal((await db.select().from(courses)).length, seedCourses.length);
    assert.equal(
      (await db.select().from(programmeCourses)).length,
      seedProgrammeCourses.length,
    );
    assert.equal(
      (await db.select().from(courseOfferings)).length,
      seedOfferings.length,
    );
    assert.equal(
      (await db.select().from(instructors)).length,
      seedInstructors.length,
    );
    assert.equal(
      (await db.select().from(offeringInstructors)).length,
      seedOfferingInstructors.length,
    );
  } finally {
    await closeDb(db);
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});

test("seed data is synthetic: fictional institutions, no ratings", async () => {
  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  const db = drizzle(ephemeral.connectionString, { casing: "snake_case" });
  try {
    await seedDatabase(db);

    for (const university of await db.select().from(universities)) {
      assert.match(
        university.name,
        /fictional/i,
        `university ${university.slug} must be marked fictional`,
      );
      assert.match(university.websiteUrl ?? "", /^https:\/\/example\.com\//);
    }

    // The directory schema deliberately has no rating/review columns; assert
    // the seeded offerings are dated instances and programme links are
    // required/elective only.
    const offerings = await db.select().from(courseOfferings);
    for (const offering of offerings) {
      assert.ok(offering.academicYear >= 2025);
      assert.ok(
        offering.startsOn === null ||
          offering.endsOn === null ||
          offering.endsOn >= offering.startsOn,
      );
    }
    const statuses = new Set(
      (await db.select().from(programmeCourses)).map((pc) => pc.status),
    );
    assert.deepEqual([...statuses].sort(), ["elective", "required"]);
  } finally {
    await closeDb(db);
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});

test("seed converges even after local edits", async () => {
  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  const db = drizzle(ephemeral.connectionString, { casing: "snake_case" });
  try {
    await seedDatabase(db);

    // Simulate local drift, then re-seed: the seed must win.
    await db
      .update(universities)
      .set({ name: "Drifted University" })
      .where(eqUniversitySlug("vesimaki-university"));
    await db.delete(instructors).where(eqInstructorSlug("mara-lindqvist"));

    await seedDatabase(db);

    const drifted = await db
      .select()
      .from(universities)
      .where(eqUniversitySlug("vesimaki-university"));
    assert.match(drifted[0].name, /Vesimäki/);

    const instructorsAfter = await db
      .select()
      .from(instructors)
      .where(eqInstructorSlug("mara-lindqvist"));
    assert.equal(instructorsAfter.length, 1);
  } finally {
    await closeDb(db);
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});

function eqUniversitySlug(slug: string) {
  return eq(universities.slug, slug);
}

function eqInstructorSlug(slug: string) {
  return eq(instructors.slug, slug);
}
