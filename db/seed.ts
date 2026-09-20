import { sql } from "drizzle-orm";
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
import {
  seedCourses,
  seedInstructors,
  seedOfferingInstructors,
  seedOfferings,
  seedProgrammeCourses,
  seedProgrammes,
  seedUniversities,
} from "@/db/seed-data";

// Repeatable synthetic directory seed.
//
// Every insert upserts on its natural unique key with the full seed payload,
// so running the seed any number of times converges to exactly the same
// state. All rows use fixed UUIDs and describe fictional institutions only.

export function createSeedClient(connectionString: string) {
  return drizzle(connectionString, { casing: "snake_case" });
}

export type SeedDatabase = ReturnType<typeof createSeedClient>;

export async function seedDatabase(db: SeedDatabase): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(universities)
      .values(seedUniversities)
      .onConflictDoUpdate({
        target: universities.slug,
        set: {
          name: sqlExcluded("name"),
          city: sqlExcluded("city"),
          country: sqlExcluded("country"),
          countryCode: sqlExcluded("country_code"),
          foundedYear: sqlExcluded("founded_year"),
          type: sqlExcluded("type"),
          websiteUrl: sqlExcluded("website_url"),
          description: sqlExcluded("description"),
          studentCount: sqlExcluded("student_count"),
          updatedAt: new Date(),
        },
      });

    await tx
      .insert(programmes)
      .values(seedProgrammes)
      .onConflictDoUpdate({
        target: [programmes.universityId, programmes.slug],
        set: {
          name: sqlExcluded("name"),
          level: sqlExcluded("level"),
          description: sqlExcluded("description"),
        },
      });

    await tx
      .insert(courses)
      .values(seedCourses)
      .onConflictDoUpdate({
        target: [courses.universityId, courses.code],
        set: {
          name: sqlExcluded("name"),
          department: sqlExcluded("department"),
          credits: sqlExcluded("credits"),
          level: sqlExcluded("level"),
          description: sqlExcluded("description"),
        },
      });

    await tx
      .insert(programmeCourses)
      .values(seedProgrammeCourses)
      .onConflictDoUpdate({
        target: [programmeCourses.programmeId, programmeCourses.courseId],
        set: {
          status: sqlExcluded("status"),
        },
      });

    await tx
      .insert(courseOfferings)
      .values(seedOfferings)
      .onConflictDoUpdate({
        target: [
          courseOfferings.courseId,
          courseOfferings.academicYear,
          courseOfferings.term,
        ],
        set: {
          startsOn: sqlExcluded("starts_on"),
          endsOn: sqlExcluded("ends_on"),
        },
      });

    await tx
      .insert(instructors)
      .values(seedInstructors)
      .onConflictDoUpdate({
        target: [instructors.universityId, instructors.slug],
        set: {
          fullName: sqlExcluded("full_name"),
          title: sqlExcluded("title"),
          department: sqlExcluded("department"),
          bio: sqlExcluded("bio"),
        },
      });

    await tx
      .insert(offeringInstructors)
      .values(seedOfferingInstructors)
      .onConflictDoUpdate({
        target: [offeringInstructors.offeringId, offeringInstructors.instructorId],
        set: {
          role: sqlExcluded("role"),
        },
      });
  });
}

// References the conflicting row's proposed insert value in ON CONFLICT
// DO UPDATE clauses.
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}
