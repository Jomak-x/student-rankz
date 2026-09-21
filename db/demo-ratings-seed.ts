// Synthetic DEMO ratings dataset: fictional published sample reviews for the
// fictional seeded directory institutions (see db/seed-data.ts).
//
// Every person quoted here is invented; every reviewed institution, course and
// instructor is a fictional example seeded by the database foundation. No real
// student content about real people exists in this file. Author aliases are
// role labels suffixed "(demo)" — they identify no one.
//
// Each row carries provenance "demo" in the projection schema itself, so
// demo data is distinguishable from any future moderated content at the row
// level. Scores displayed by the catalog service are always aggregated from
// these stored rating rows — nothing here hardcodes a displayed score.
//
// Deliberate gaps for honest empty states: University of Bellenau, the
// Bellenau courses, the course VU-SS430 and instructors Claire Fontaine,
// Malik Benali and Timo Aaltonen have NO reviews and therefore null scores
// everywhere.

import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import { publicSampleReviewRatings, publicSampleReviews } from "@/db/demo-review-schema";
import { COURSE_IDS, INSTRUCTOR_IDS, UNIVERSITY_IDS } from "@/db/seed-data";

export const DEMO_PROVENANCE = "demo" as const;

type Dimension = (typeof RATING_DIMENSIONS)[number];

// Union of all dimension names the projection schema allows.
export const RATING_DIMENSIONS = [
  "overall",
  "teaching",
  "support",
  "facilities",
  "administration",
  "value",
  "social_life",
  "workload",
  "organisation",
  "clarity",
  "assessment_fairness",
  "expertise",
  "engagement",
] as const;

const UNIVERSITY_DIMENSIONS: ReadonlySet<string> = new Set([
  "overall",
  "teaching",
  "support",
  "facilities",
  "administration",
  "value",
  "social_life",
]);
const COURSE_DIMENSIONS: ReadonlySet<string> = new Set([
  "overall",
  "workload",
  "organisation",
  "clarity",
  "assessment_fairness",
]);
const INSTRUCTOR_DIMENSIONS: ReadonlySet<string> = new Set([
  "overall",
  "clarity",
  "support",
  "expertise",
  "engagement",
]);

export type DemoReviewSpec = {
  id: string;
  subjectType: "university" | "course" | "instructor";
  universityId: string;
  courseId?: string;
  instructorId?: string;
  authorAlias: string;
  programmeLabel?: string;
  experienceYear: number;
  title: string;
  body: string;
  pros?: string;
  cons?: string;
  /** Fixed ISO instant — the dataset stays identical across runs. */
  publishedAt: string;
  /** Present keys only; absent dimensions stay unrated. */
  ratings: Partial<Record<Dimension, number>>;
};

export const DEMO_REVIEW_IDS = {
  asterheimUni1: "00000000-0000-4000-8000-000000000501",
  asterheimUni2: "00000000-0000-4000-8000-000000000502",
  asterheimUni3: "00000000-0000-4000-8000-000000000503",
  vesimakiUni1: "00000000-0000-4000-8000-000000000504",
  vesimakiUni2: "00000000-0000-4000-8000-000000000505",
  asterheimCs101a: "00000000-0000-4000-8000-000000000511",
  asterheimCs101b: "00000000-0000-4000-8000-000000000512",
  asterheimCs210a: "00000000-0000-4000-8000-000000000513",
  asterheimDe501a: "00000000-0000-4000-8000-000000000514",
  vesimakiSe150a: "00000000-0000-4000-8000-000000000515",
  vesimakiSe150b: "00000000-0000-4000-8000-000000000516",
  asterheimOkafora: "00000000-0000-4000-8000-000000000521",
  asterheimOkaforb: "00000000-0000-4000-8000-000000000522",
  vesimakiKorhonena: "00000000-0000-4000-8000-000000000523",
} as const;

// Fictional sample reviews, written about the fictional institutions only.
export const demoReviews: DemoReviewSpec[] = [
  {
    id: DEMO_REVIEW_IDS.asterheimUni1,
    subjectType: "university",
    universityId: UNIVERSITY_IDS.asterheim,
    authorAlias: "M.Sc. Data Engineering student, 2nd year (demo)",
    programmeLabel: "MSc Data Engineering (fictional example)",
    experienceYear: 2025,
    title: "Strong technical curriculum with real project work",
    body: "This fictional example review describes the invented Asterheim Institute of Technology. Sample strengths: well-equipped labs and a curriculum that builds from programming foundations to distributed systems. Sample weakness: administration paperwork takes a few iterations.",
    pros: "Sample strengths: labs, project-based courses",
    cons: "Sample weakness: administrative paperwork",
    publishedAt: "2025-11-20T12:00:00.000Z",
    ratings: { overall: 5, teaching: 5, support: 4, facilities: 5, administration: 3, value: 4, social_life: 4 },
  },
  {
    id: DEMO_REVIEW_IDS.asterheimUni2,
    subjectType: "university",
    universityId: UNIVERSITY_IDS.asterheim,
    authorAlias: "Exchange student, winter term (demo)",
    experienceYear: 2024,
    title: "Well-organised exchange, busy course load",
    body: "Invented exchange-semester impression of the fictional Asterheim Institute of Technology. The course load is demanding and the exercise sessions are well run. Finding the right administrative office took a while in this sample scenario.",
    pros: "Sample strengths: structured exercises",
    cons: "Sample weakness: campus navigation",
    publishedAt: "2024-12-05T09:30:00.000Z",
    ratings: { overall: 4, teaching: 4, support: 4, facilities: 4, administration: 3, value: 4, social_life: 3 },
  },
  {
    id: DEMO_REVIEW_IDS.asterheimUni3,
    subjectType: "university",
    universityId: UNIVERSITY_IDS.asterheim,
    authorAlias: "B.Sc. Informatics graduate (demo)",
    programmeLabel: "BSc Informatics (fictional example)",
    experienceYear: 2025,
    title: "Solid foundations for a software career",
    body: "Fictional graduate perspective on the invented Asterheim curriculum: algorithms and systems courses build on each other, and the careers office helped with interview practice in this sample scenario.",
    pros: "Sample strengths: curriculum coherence, careers office",
    cons: "Sample weakness: elective variety",
    publishedAt: "2025-03-18T15:45:00.000Z",
    ratings: { overall: 4, teaching: 4, support: 3, facilities: 4, administration: 4, value: 5, social_life: 4 },
  },
  {
    id: DEMO_REVIEW_IDS.vesimakiUni1,
    subjectType: "university",
    universityId: UNIVERSITY_IDS.vesimaki,
    authorAlias: "M.Sc. Sustainable Systems student (demo)",
    programmeLabel: "MSc Sustainable Systems (fictional example)",
    experienceYear: 2026,
    title: "Sustainability woven into every course",
    body: "Fictional impression of the invented Vesimäki University: energy-systems courses connect modelling to policy questions in this sample scenario, and student services respond quickly.",
    pros: "Sample strengths: curriculum integration, student services",
    cons: "Sample weakness: limited lab space",
    publishedAt: "2026-02-10T10:15:00.000Z",
    ratings: { overall: 5, teaching: 5, support: 5, facilities: 4, administration: 4, value: 5, social_life: 4 },
  },
  {
    id: DEMO_REVIEW_IDS.vesimakiUni2,
    subjectType: "university",
    universityId: UNIVERSITY_IDS.vesimaki,
    authorAlias: "B.Sc. Software Engineering student (demo)",
    programmeLabel: "BSc Software Engineering (fictional example)",
    experienceYear: 2025,
    title: "Team-based learning done properly",
    body: "Invented impression of the fictional Vesimäki software engineering programme: group projects use realistic workflows, and the administration handled enrolment smoothly in this sample scenario.",
    pros: "Sample strengths: realistic group projects",
    cons: "Sample weakness: quiet social scene",
    publishedAt: "2025-10-02T14:00:00.000Z",
    ratings: { overall: 4, teaching: 4, support: 4, facilities: 4, administration: 5, value: 4, social_life: 3 },
  },
  {
    id: DEMO_REVIEW_IDS.asterheimCs101a,
    subjectType: "course",
    universityId: UNIVERSITY_IDS.asterheim,
    courseId: COURSE_IDS.asterheimCs101,
    authorAlias: "B.Sc. Informatics student, 1st year (demo)",
    experienceYear: 2025,
    title: "Gentle but thorough introduction",
    body: "Fictional sample review of the invented course AIT-CS101: concepts build step by step and the weekly exercises prepare you well for the assessment in this sample scenario.",
    pros: "Sample strengths: incremental exercises",
    cons: "Sample weakness: pace picks up quickly mid-term",
    publishedAt: "2026-01-15T08:20:00.000Z",
    ratings: { overall: 5, workload: 4, organisation: 5, clarity: 5, assessment_fairness: 4 },
  },
  {
    id: DEMO_REVIEW_IDS.asterheimCs101b,
    subjectType: "course",
    universityId: UNIVERSITY_IDS.asterheim,
    courseId: COURSE_IDS.asterheimCs101,
    authorAlias: "Exchange student (demo)",
    experienceYear: 2025,
    title: "Good first course, brush up beforehand",
    body: "Invented sample review of the fictional AIT-CS101: coming in with some programming background helps, and the tutorials are well staffed in this sample scenario.",
    pros: "Sample strengths: well-staffed tutorials",
    cons: "Sample weakness: assumes some prior practice",
    publishedAt: "2025-12-01T16:10:00.000Z",
    ratings: { overall: 4, workload: 3, organisation: 4, clarity: 4, assessment_fairness: 4 },
  },
  {
    id: DEMO_REVIEW_IDS.asterheimCs210a,
    subjectType: "course",
    universityId: UNIVERSITY_IDS.asterheim,
    courseId: COURSE_IDS.asterheimCs210,
    authorAlias: "B.Sc. Informatics student, 2nd year (demo)",
    experienceYear: 2025,
    title: "Demanding algorithms course, fair exam",
    body: "Fictional sample review of the invented AIT-CS210: problem sets are time-consuming but the assessment matched the exercise style closely in this sample scenario.",
    pros: "Sample strengths: exam matches exercises",
    cons: "Sample weakness: heavy problem sets",
    publishedAt: "2026-02-02T11:50:00.000Z",
    ratings: { overall: 4, workload: 2, organisation: 4, clarity: 4, assessment_fairness: 5 },
  },
  {
    id: DEMO_REVIEW_IDS.asterheimDe501a,
    subjectType: "course",
    universityId: UNIVERSITY_IDS.asterheim,
    courseId: COURSE_IDS.asterheimDe501,
    authorAlias: "M.Sc. Data Engineering student (demo)",
    experienceYear: 2026,
    title: "Systems course with real design trade-offs",
    body: "Invented sample review of the fictional AIT-DE501: replication and partitioning topics are taught through design discussions, and the project mirrors the lecture material in this sample scenario.",
    pros: "Sample strengths: design-focused projects",
    cons: "Sample weakness: reading load",
    publishedAt: "2026-03-05T13:05:00.000Z",
    ratings: { overall: 5, workload: 3, organisation: 5, clarity: 5, assessment_fairness: 5 },
  },
  {
    id: DEMO_REVIEW_IDS.vesimakiSe150a,
    subjectType: "course",
    universityId: UNIVERSITY_IDS.vesimaki,
    courseId: COURSE_IDS.vesimakiSe150,
    authorAlias: "B.Sc. Software Engineering student, 1st year (demo)",
    experienceYear: 2025,
    title: "Practical start to version control and testing",
    body: "Fictional sample review of the invented VU-SE150: labs introduce version control and testing gradually, and feedback on submissions arrives quickly in this sample scenario.",
    pros: "Sample strengths: fast feedback",
    cons: "Sample weakness: tooling setup takes time",
    publishedAt: "2025-12-20T09:00:00.000Z",
    ratings: { overall: 4, workload: 4, organisation: 4, clarity: 4, assessment_fairness: 4 },
  },
  {
    id: DEMO_REVIEW_IDS.vesimakiSe150b,
    subjectType: "course",
    universityId: UNIVERSITY_IDS.vesimaki,
    courseId: COURSE_IDS.vesimakiSe150,
    authorAlias: "Exchange student, autumn term (demo)",
    experienceYear: 2025,
    title: "Collaborative and welcoming course",
    body: "Invented sample review of the fictional VU-SE150: pair exercises make the material stick, and the course stays well organised around deadlines in this sample scenario.",
    pros: "Sample strengths: pair exercises",
    cons: "Sample weakness: deadline cluster at the end",
    publishedAt: "2025-11-28T17:25:00.000Z",
    ratings: { overall: 5, workload: 3, organisation: 5, clarity: 4, assessment_fairness: 4 },
  },
  {
    id: DEMO_REVIEW_IDS.asterheimOkafora,
    subjectType: "instructor",
    universityId: UNIVERSITY_IDS.asterheim,
    instructorId: INSTRUCTOR_IDS.asterheimOkafor,
    authorAlias: "B.Sc. Informatics student (demo)",
    experienceYear: 2025,
    title: "Explains algorithms step by step",
    body: "Fictional sample review of the invented instructor Dr. Jonas Okafor: structured exercise sessions and patient explanations in this sample scenario.",
    pros: "Sample strengths: structured exercises",
    cons: "Sample weakness: sessions fill up quickly",
    publishedAt: "2026-01-08T10:40:00.000Z",
    ratings: { overall: 5, clarity: 5, support: 4, expertise: 4, engagement: 5 },
  },
  {
    id: DEMO_REVIEW_IDS.asterheimOkaforb,
    subjectType: "instructor",
    universityId: UNIVERSITY_IDS.asterheim,
    instructorId: INSTRUCTOR_IDS.asterheimOkafor,
    authorAlias: "B.Sc. Informatics student, 2nd year (demo)",
    experienceYear: 2024,
    title: "Approachable and well prepared",
    body: "Invented sample review of the fictional instructor Dr. Jonas Okafor: lecture notes are complete and questions get answered in this sample scenario.",
    pros: "Sample strengths: complete lecture notes",
    cons: "Sample weakness: fast lecture pace",
    publishedAt: "2025-06-30T12:30:00.000Z",
    ratings: { overall: 4, clarity: 4, support: 4, expertise: 5, engagement: 4 },
  },
  {
    id: DEMO_REVIEW_IDS.vesimakiKorhonena,
    subjectType: "instructor",
    universityId: UNIVERSITY_IDS.vesimaki,
    instructorId: INSTRUCTOR_IDS.vesimakiKorhonen,
    authorAlias: "B.Sc. Software Engineering student (demo)",
    experienceYear: 2025,
    title: "Great at coaching team projects",
    body: "Fictional sample review of the invented instructor Dr. Aino Korhonen: helps teams untangle process problems without taking over in this sample scenario.",
    pros: "Sample strengths: team coaching",
    cons: "Sample weakness: candid feedback style",
    publishedAt: "2026-01-22T15:10:00.000Z",
    ratings: { overall: 4, clarity: 4, support: 5, expertise: 4, engagement: 5 },
  },
];

export type DemoRatingsSeedSummary = {
  reviews: number;
  ratings: number;
  bySubject: { university: number; course: number; instructor: number };
};

// Drizzle node-postgres instance, mirroring the base seed's client style.
export type DemoRatingsDatabase = ReturnType<typeof createDemoRatingsSeedClient>;

export function createDemoRatingsSeedClient(connectionString: string) {
  // Plain TCP driver, like db/seed.ts: the CLI and tests run on ordinary
  // Postgres, never on the HTTP runtime path.
  return drizzle(connectionString, { casing: "snake_case" });
}

// Dataset integrity guard: dimension sets must match the subject type,
// `overall` must always be rated and every rating must be an integer 1..5.
// The projection schema enforces the same rules in SQL; this pre-check gives
// the seed a precise failure message before any write happens.
export function assertDemoDatasetShape(dataset: DemoReviewSpec[] = demoReviews): void {
  const seen = new Set<string>();
  for (const review of dataset) {
    if (seen.has(review.id)) {
      throw new Error(`Duplicate demo review id ${review.id}`);
    }
    seen.add(review.id);

    const allowed =
      review.subjectType === "university"
        ? UNIVERSITY_DIMENSIONS
        : review.subjectType === "course"
          ? COURSE_DIMENSIONS
          : INSTRUCTOR_DIMENSIONS;

    const rated = new Set<string>();
    for (const [dimension, value] of Object.entries(review.ratings)) {
      if (value === undefined) {
        continue;
      }
      if (!RATING_DIMENSIONS.includes(dimension as Dimension)) {
        throw new Error(`Unknown rating dimension "${dimension}" on ${review.id}`);
      }
      if (!allowed.has(dimension)) {
        throw new Error(
          `Dimension "${dimension}" is not valid for subject type "${review.subjectType}" (${review.id})`,
        );
      }
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new Error(`Rating "${dimension}" = ${value} on ${review.id} must be an integer 1..5`);
      }
      rated.add(dimension);
    }

    if (!rated.has("overall")) {
      throw new Error(`Demo review ${review.id} must rate the "overall" dimension`);
    }

    const subjectColumnsMatch =
      review.subjectType === "course"
        ? Boolean(review.courseId) && !review.instructorId
        : review.subjectType === "instructor"
          ? Boolean(review.instructorId) && !review.courseId
          : !review.courseId && !review.instructorId;
    if (!subjectColumnsMatch) {
      throw new Error(`Demo review ${review.id} subject columns do not match its subject type`);
    }
  }
}

// Repeatable demo ratings seed.
//
// Convergence contract (mirrors the base directory seed): within one
// transaction the seed deletes exactly the dataset's rows and re-inserts them
// with fixed ids and fixed published_at/created_at values, so repeated runs
// converge to identical state and local drift is repaired. Rows outside the
// dataset (e.g. future moderated content) are never touched.
export async function seedDemoRatings(db: DemoRatingsDatabase): Promise<DemoRatingsSeedSummary> {
  assertDemoDatasetShape();

  return db.transaction(async (tx) => {
    const reviewIds = demoReviews.map((review) => review.id);

    await tx
      .delete(publicSampleReviewRatings)
      .where(inArray(publicSampleReviewRatings.reviewId, reviewIds));
    await tx.delete(publicSampleReviews).where(inArray(publicSampleReviews.id, reviewIds));

    await tx.insert(publicSampleReviews).values(
      demoReviews.map((review) => ({
        id: review.id,
        universityId: review.universityId,
        subjectType: review.subjectType,
        courseId: review.courseId ?? null,
        instructorId: review.instructorId ?? null,
        authorAlias: review.authorAlias,
        programmeLabel: review.programmeLabel ?? null,
        experienceYear: review.experienceYear,
        title: review.title,
        body: review.body,
        pros: review.pros ?? null,
        cons: review.cons ?? null,
        publishedAt: new Date(review.publishedAt),
        provenance: DEMO_PROVENANCE,
        // Fixed value keeps re-runs identical (created_at defaults to now()).
        createdAt: new Date(review.publishedAt),
      })),
    );

    const ratingRows = demoReviews.flatMap((review) =>
      Object.entries(review.ratings)
        .filter((entry): entry is [Dimension, number] => entry[1] !== undefined)
        .map(([dimension, value]) => ({
          reviewId: review.id,
          dimension,
          value,
        })),
    );
    await tx.insert(publicSampleReviewRatings).values(ratingRows);

    return {
      reviews: demoReviews.length,
      ratings: ratingRows.length,
      bySubject: {
        university: demoReviews.filter((r) => r.subjectType === "university").length,
        course: demoReviews.filter((r) => r.subjectType === "course").length,
        instructor: demoReviews.filter((r) => r.subjectType === "instructor").length,
      },
    };
  });
}
