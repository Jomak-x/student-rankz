import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  courseOfferings,
  courses,
  instructors,
  offeringInstructors,
  programmes,
  programmeCourses,
  universities,
} from "@/db/schema";
import { closeDb, createEphemeralDatabase, dropEphemeralDatabase } from "./helpers.js";

const migrationsFolder = path.resolve(import.meta.dirname, "../../drizzle");

const UNIVERSITIES = {
  westhaven: "00000000-0000-4000-9000-00000000a001",
  ostbruck: "00000000-0000-4000-9000-00000000a002",
};

const PROGRAMMES = {
  westhavenCs: "00000000-0000-4000-9000-00000000b001",
  ostbruckCs: "00000000-0000-4000-9000-00000000b002",
};

const COURSES = {
  westhavenAlgorithms: "00000000-0000-4000-9000-00000000c001",
  ostbruckAlgorithms: "00000000-0000-4000-9000-00000000c002",
};

const OFFERINGS = {
  westhaven2026: "00000000-0000-4000-9000-00000000d001",
};

const INSTRUCTORS = {
  westhavenDoe: "00000000-0000-4000-9000-00000000e001",
  ostbruckRoe: "00000000-0000-4000-9000-00000000e002",
};

type Db = NodePgDatabase<Record<string, never>>;

async function setupBaseline(db: Db): Promise<void> {
  await db.insert(universities).values([
    {
      id: UNIVERSITIES.westhaven,
      slug: "westhaven-university",
      name: "Westhaven University (baseline fixture)",
      city: "Westhaven",
      country: "Netherlands",
      countryCode: "NL",
      foundedYear: 1955,
      type: "public",
    },
    {
      id: UNIVERSITIES.ostbruck,
      slug: "ostbruck-institute",
      name: "Ostbrück Institute (baseline fixture)",
      city: "Ostbrück",
      country: "Germany",
      countryCode: "DE",
      foundedYear: 1980,
      type: "technical",
    },
  ]);

  await db.insert(programmes).values([
    {
      id: PROGRAMMES.westhavenCs,
      universityId: UNIVERSITIES.westhaven,
      slug: "bsc-computer-science",
      name: "BSc Computer Science",
      level: "bachelor",
    },
    {
      id: PROGRAMMES.ostbruckCs,
      universityId: UNIVERSITIES.ostbruck,
      slug: "bsc-computer-science",
      name: "BSc Computer Science",
      level: "bachelor",
    },
  ]);

  await db.insert(courses).values([
    {
      id: COURSES.westhavenAlgorithms,
      universityId: UNIVERSITIES.westhaven,
      code: "WH-CS200",
      name: "Algorithms",
      credits: "7.50",
      level: "bachelor",
    },
    {
      id: COURSES.ostbruckAlgorithms,
      universityId: UNIVERSITIES.ostbruck,
      code: "WH-CS200",
      name: "Algorithms",
      credits: "5.00",
      level: "bachelor",
    },
  ]);

  await db.insert(instructors).values([
    {
      id: INSTRUCTORS.westhavenDoe,
      universityId: UNIVERSITIES.westhaven,
      slug: "jane-doe",
      fullName: "Prof. Jane Doe",
    },
    {
      id: INSTRUCTORS.ostbruckRoe,
      universityId: UNIVERSITIES.ostbruck,
      slug: "john-roe",
      fullName: "Dr. John Roe",
    },
  ]);
}

// Drizzle wraps driver errors in DrizzleQueryError; the original Postgres
// error (with its SQLSTATE code) is the cause.
function expectErrorCode(error: unknown, code: string): void {
  const candidates = [error];
  if (error && typeof error === "object" && "cause" in error) {
    candidates.push((error as { cause?: unknown }).cause);
  }
  const matched = candidates.some(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      "code" in candidate &&
      (candidate as { code?: unknown }).code === code,
  );
  assert.ok(
    matched,
    `expected Postgres error ${code}, got: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
  );
}

async function insertAndExpectError(
  db: Db,
  code: string,
  insert: () => Promise<unknown>,
): Promise<void> {
  await assert.rejects(insert(), (error: unknown) => {
    expectErrorCode(error, code);
    return true;
  });
}

test("directory constraints reject invalid and cross-university data", async () => {
  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  const db = drizzle(ephemeral.connectionString, {
    casing: "snake_case",
  });
  try {
    await setupBaseline(db);

    // Uniqueness: university slug is globally unique.
    await insertAndExpectError(db, "23505", () =>
      db
        .insert(universities)
        .values({ ...baselineUniversity(), slug: "westhaven-university" }),
    );

    // Enum: unknown university type is rejected.
    await insertAndExpectError(db, "22P02", () =>
      db
        .insert(universities)
        .values({
          ...baselineUniversity(),
          slug: "another-university",
          // Cast through unknown on purpose: the database must also reject it.
          type: "academy" as unknown as "public",
        }),
    );

    // Check: founded year out of range.
    await insertAndExpectError(db, "23514", () =>
      db
        .insert(universities)
        .values({ ...baselineUniversity(), slug: "ancient-college", foundedYear: 700 }),
    );

    // Uniqueness: course code unique per university — same code at the same
    // university collides even though slugs elsewhere differ.
    await insertAndExpectError(db, "23505", () =>
      db.insert(courses).values({
        universityId: UNIVERSITIES.westhaven,
        code: "WH-CS200",
        name: "Duplicate Algorithms",
        credits: "5.00",
        level: "bachelor",
      }),
    );

    // Check: credits must be positive.
    await insertAndExpectError(db, "23514", () =>
      db.insert(courses).values({
        universityId: UNIVERSITIES.westhaven,
        code: "WH-CS999",
        name: "Zero Credit Course",
        credits: "0.00",
        level: "bachelor",
      }),
    );

    // Foreign key: course referencing a missing university.
    await insertAndExpectError(db, "23503", () =>
      db.insert(courses).values({
        universityId: "00000000-0000-4000-9000-00000000ffff",
        code: "XX-100",
        name: "Orphan Course",
        credits: "5.00",
        level: "bachelor",
      }),
    );

    // Cross-university consistency: a programme may only contain courses of
    // its own university. Ostbrück's course inside Westhaven's programme is
    // rejected by the composite foreign keys even though both course rows
    // exist and share the same code.
    await insertAndExpectError(db, "23503", () =>
      db.insert(programmeCourses).values({
        programmeId: PROGRAMMES.westhavenCs,
        courseId: COURSES.ostbruckAlgorithms,
        universityId: UNIVERSITIES.westhaven,
        status: "required",
      }),
    );

    // Even lying about university_id does not help: every accepted pair must
    // agree with both referenced rows.
    await insertAndExpectError(db, "23503", () =>
      db.insert(programmeCourses).values({
        programmeId: PROGRAMMES.westhavenCs,
        courseId: COURSES.ostbruckAlgorithms,
        universityId: UNIVERSITIES.ostbruck,
        status: "required",
      }),
    );

    // Same-university link succeeds, including elective status.
    await db.insert(programmeCourses).values({
      programmeId: PROGRAMMES.westhavenCs,
      courseId: COURSES.westhavenAlgorithms,
      universityId: UNIVERSITIES.westhaven,
      status: "elective",
    });

    // Programme-course status enum is enforced.
    await insertAndExpectError(db, "22P02", () =>
      db.insert(programmeCourses).values({
        programmeId: PROGRAMMES.westhavenCs,
        courseId: COURSES.westhavenAlgorithms,
        universityId: UNIVERSITIES.westhaven,
        status: "optional" as unknown as "required",
      }),
    );

    // Offering dates: ends_on before starts_on is rejected.
    await insertAndExpectError(db, "23514", () =>
      db.insert(courseOfferings).values({
        courseId: COURSES.westhavenAlgorithms,
        universityId: UNIVERSITIES.westhaven,
        academicYear: 2026,
        term: "winter",
        startsOn: "2026-02-01",
        endsOn: "2026-01-31",
      }),
    );

    // Offerings are dated and unique per course/year/term.
    await db.insert(courseOfferings).values(OFFERING_INSERT);
    await insertAndExpectError(db, "23505", () =>
      db.insert(courseOfferings).values(OFFERING_INSERT),
    );

    // Offerings cannot be attached to a course of another university.
    await insertAndExpectError(db, "23503", () =>
      db.insert(courseOfferings).values({
        courseId: COURSES.ostbruckAlgorithms,
        universityId: UNIVERSITIES.westhaven,
        academicYear: 2027,
        term: "winter",
      }),
    );

    // Cross-university consistency: an offering may only list instructors of
    // the same university.
    await insertAndExpectError(db, "23503", () =>
      db.insert(offeringInstructors).values({
        offeringId: OFFERINGS.westhaven2026,
        instructorId: INSTRUCTORS.ostbruckRoe,
        universityId: UNIVERSITIES.westhaven,
        role: "lecturer",
      }),
    );

    // Same-university association succeeds and default role applies.
    await db.insert(offeringInstructors).values({
      offeringId: OFFERINGS.westhaven2026,
      instructorId: INSTRUCTORS.westhavenDoe,
      universityId: UNIVERSITIES.westhaven,
    });
    const links = await db.select().from(offeringInstructors);
    assert.equal(links.length, 1);
    assert.equal(links[0].role, "lecturer");
  } finally {
    await closeDb(db);
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});

test("deleting a university cascades through the whole directory", async () => {
  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  const db = drizzle(ephemeral.connectionString, { casing: "snake_case" });
  try {
    await setupBaseline(db);

    await db.insert(programmeCourses).values({
      programmeId: PROGRAMMES.westhavenCs,
      courseId: COURSES.westhavenAlgorithms,
      universityId: UNIVERSITIES.westhaven,
      status: "required",
    });
    await db.insert(courseOfferings).values(OFFERING_INSERT);
    await db.insert(offeringInstructors).values({
      offeringId: OFFERINGS.westhaven2026,
      instructorId: INSTRUCTORS.westhavenDoe,
      universityId: UNIVERSITIES.westhaven,
    });

    await db.delete(universities).where(eq(universities.id, UNIVERSITIES.westhaven));

    assert.equal((await db.select().from(universities)).length, 1);
    assert.equal((await db.select().from(programmes)).length, 1);
    assert.equal((await db.select().from(courses)).length, 1);
    assert.equal((await db.select().from(instructors)).length, 1);
    assert.equal((await db.select().from(programmeCourses)).length, 0);
    assert.equal((await db.select().from(courseOfferings)).length, 0);
    assert.equal((await db.select().from(offeringInstructors)).length, 0);
  } finally {
    await closeDb(db);
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});

const OFFERING_INSERT = {
  id: OFFERINGS.westhaven2026,
  courseId: COURSES.westhavenAlgorithms,
  universityId: UNIVERSITIES.westhaven,
  academicYear: 2026,
  term: "winter",
  startsOn: "2025-10-01",
  endsOn: "2026-01-31",
};

function baselineUniversity() {
  return {
    slug: "placeholder-university",
    name: "Placeholder University",
    city: "Placeholder City",
    country: "Germany",
    countryCode: "DE",
    type: "public" as const,
  };
}
