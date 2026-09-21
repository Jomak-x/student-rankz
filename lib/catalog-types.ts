// Public catalog DTOs shared between the server catalog read service
// (server/catalog/**) and UI code. This file is intentionally dependency-free
// and server-agnostic: it contains no database, fixture or server-only
// imports, so both sides can import it safely.
//
// Honesty rules encoded in these types:
// - Scores are `number | null`. `null` means "no published sample reviews yet"
//   — the UI must render an explicit empty state, never a fabricated number.
// - `reviewCount` is the number of published sample reviews the aggregates
//   derive from; `latestReviewAt` (ISO 8601) is null when there are none.
// - Only published sample data appears here. No identities (author aliases are
//   fictional demo labels), no drafts, no tokens, no moderation state.

export type CatalogUniversityType = "public" | "private" | "technical";

export type CatalogStudyLevel = "bachelor" | "master" | "phd";

export type CatalogSubjectType = "university" | "course" | "instructor";

export type CatalogProvenance = "demo";

// Student-experience score dimensions, averaged from published sample review
// ratings. DB dimension names are snake_case (e.g. social_life); DTOs use the
// camelCase keys the UI already renders.
export type UniversityExperienceScores = {
  overall: number | null;
  teaching: number | null;
  support: number | null;
  facilities: number | null;
  administration: number | null;
  value: number | null;
  socialLife: number | null;
};

export type CourseExperienceScores = {
  overall: number | null;
  workload: number | null;
  organisation: number | null;
  clarity: number | null;
  assessmentFairness: number | null;
};

export type InstructorExperienceScores = {
  overall: number | null;
  clarity: number | null;
  support: number | null;
  expertise: number | null;
  engagement: number | null;
};

export type CatalogUniversitySort = "name" | "overall" | "reviews";

export type CatalogCourseSort = "code" | "name" | "overall";

export type CatalogPageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type CatalogPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type CatalogUniversity = {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  foundedYear: number | null;
  type: CatalogUniversityType;
  websiteUrl: string | null;
  description: string | null;
  studentCount: number | null;
  scores: UniversityExperienceScores;
  reviewCount: number;
  latestReviewAt: string | null;
};

export type CatalogProgrammeSummary = {
  id: string;
  slug: string;
  name: string;
  level: CatalogStudyLevel;
  description: string | null;
};

export type CatalogUniversityDetail = CatalogUniversity & {
  programmes: CatalogProgrammeSummary[];
  courseCount: number;
  instructorCount: number;
};

export type CatalogCountry = {
  countryCode: string;
  country: string;
  universityCount: number;
};

export type CatalogInstructorSummary = {
  id: string;
  slug: string;
  fullName: string;
  title: string | null;
};

export type CatalogCourse = {
  id: string;
  universityId: string;
  universitySlug: string;
  universityName: string;
  code: string;
  name: string;
  department: string | null;
  credits: number;
  level: CatalogStudyLevel;
  description: string | null;
  scores: CourseExperienceScores;
  reviewCount: number;
  latestReviewAt: string | null;
};

export type CatalogOffering = {
  id: string;
  academicYear: number;
  term: string;
  startsOn: string | null;
  endsOn: string | null;
};

export type CatalogCourseDetail = CatalogCourse & {
  offerings: CatalogOffering[];
  instructors: CatalogInstructorSummary[];
};

export type CatalogCourseSummary = {
  id: string;
  code: string;
  name: string;
  level: CatalogStudyLevel;
};

export type CatalogInstructor = {
  id: string;
  universityId: string;
  universitySlug: string;
  universityName: string;
  slug: string;
  fullName: string;
  title: string | null;
  department: string | null;
  bio: string | null;
  scores: InstructorExperienceScores;
  reviewCount: number;
  latestReviewAt: string | null;
  courses: CatalogCourseSummary[];
};

// A published sample review. `authorAlias` is a fictional, non-identifying
// label (demo rows are suffixed "(demo)"); no account, email or identity data
// exists in the projection.
export type CatalogSampleReview = {
  id: string;
  subjectType: CatalogSubjectType;
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
  publishedAt: string;
  provenance: CatalogProvenance;
};
