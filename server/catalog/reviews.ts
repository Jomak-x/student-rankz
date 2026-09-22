import { and, asc, desc, eq, sql } from "drizzle-orm";

import { publicSampleReviews } from "@/db/demo-review-schema";
import type { CatalogPage, CatalogSampleReview } from "@/lib/catalog-types";

import type { CatalogDatabase, NormalizedPagination } from "./database";
import { toIsoOrNull } from "./database";

// Shared paginated reader for published sample reviews of one subject.
//
// Only rows from the public sample projection are returned: fictional demo
// aliases, no identity columns, no drafts. Ordering is deterministic
// (published_at DESC, id ASC) and pages are bounded by the caller.

export type SubjectScope =
  | { subjectType: "university"; universityId: string }
  | { subjectType: "course"; universityId: string; courseId: string }
  | { subjectType: "instructor"; universityId: string; instructorId: string };

function scopeCondition(scope: SubjectScope) {
  const conditions = [
    eq(publicSampleReviews.subjectType, scope.subjectType),
    eq(publicSampleReviews.universityId, scope.universityId),
  ];
  if (scope.subjectType === "course") {
    conditions.push(eq(publicSampleReviews.courseId, scope.courseId));
  }
  if (scope.subjectType === "instructor") {
    conditions.push(eq(publicSampleReviews.instructorId, scope.instructorId));
  }
  return and(...conditions);
}

type ReviewListRow = {
  id: string;
  universityId: string;
  courseId: string | null;
  instructorId: string | null;
  authorAlias: string;
  programmeLabel: string | null;
  experienceYear: number | null;
  title: string;
  body: string;
  pros: string | null;
  cons: string | null;
  publishedAt: Date;
};

// The projection schema constrains provenance to 'demo', so the DTO value is
// exact rather than mapped. `subjectType` comes from the query scope itself,
// which every returned row is guaranteed to match.
function toReviewDto(row: ReviewListRow, scope: SubjectScope): CatalogSampleReview {
  return {
    id: row.id,
    subjectType: scope.subjectType,
    universityId: row.universityId,
    courseId: row.courseId,
    instructorId: row.instructorId,
    authorAlias: row.authorAlias,
    programmeLabel: row.programmeLabel,
    experienceYear: row.experienceYear,
    title: row.title,
    body: row.body,
    pros: row.pros,
    cons: row.cons,
    publishedAt: toIsoOrNull(row.publishedAt) ?? "",
    provenance: "demo",
  };
}

export async function querySubjectReviews(
  db: CatalogDatabase,
  scope: SubjectScope,
  pagination: NormalizedPagination,
): Promise<CatalogPage<CatalogSampleReview>> {
  const condition = scopeCondition(scope);

  const rows = await db
    .select({
      id: publicSampleReviews.id,
      universityId: publicSampleReviews.universityId,
      courseId: publicSampleReviews.courseId,
      instructorId: publicSampleReviews.instructorId,
      authorAlias: publicSampleReviews.authorAlias,
      programmeLabel: publicSampleReviews.programmeLabel,
      experienceYear: publicSampleReviews.experienceYear,
      title: publicSampleReviews.title,
      body: publicSampleReviews.body,
      pros: publicSampleReviews.pros,
      cons: publicSampleReviews.cons,
      publishedAt: publicSampleReviews.publishedAt,
    })
    .from(publicSampleReviews)
    .where(condition)
    .orderBy(desc(publicSampleReviews.publishedAt), asc(publicSampleReviews.id))
    .limit(pagination.pageSize + 1)
    .offset(pagination.offset);

  const totalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(publicSampleReviews)
    .where(condition);
  const total = Number(totalRows[0]?.total ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.pageSize);
  const hasNextPage = rows.length > pagination.pageSize;

  return {
    items: rows.slice(0, pagination.pageSize).map((row) => toReviewDto(row, scope)),
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages,
    hasNextPage,
  };
}
