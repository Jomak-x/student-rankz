import type {
  CatalogCountry,
  CatalogCourse,
  CatalogCourseDetail,
  CatalogInstructor,
  CatalogPage,
  CatalogSampleReview,
  CatalogUniversity,
  CatalogUniversityDetail,
  CatalogCourseSort,
  CatalogUniversitySort,
} from "@/lib/catalog-types";

import type { CatalogDatabase, CatalogServiceDeps, NormalizedPagination } from "./database";
import { CatalogUnavailableError } from "./errors";
import { queryInstructorDetail } from "./instructors";
import {
  COURSE_SORTS,
  LIST_PAGE_DEFAULT,
  LIST_PAGE_MAX,
  REVIEWS_PAGE_DEFAULT,
  REVIEWS_PAGE_MAX,
  STUDY_LEVELS,
  TOP_DEFAULT,
  TOP_MAX,
  UNIVERSITY_SORTS,
  normalizeCountryCode,
  normalizeEnum,
  normalizePagination,
  normalizeSearchTerm,
  normalizeSlug,
  normalizeUuid,
} from "./params";
import { queryCourses, queryCourseDetail } from "./courses";
import { querySubjectReviews, type SubjectScope } from "./reviews";
import {
  queryCountries,
  queryTopUniversities,
  queryUniversities,
  queryUniversityDetail,
} from "./universities";

// Catalog read service.
//
// The single privacy-safe entry point over the read queries. Behaviour
// contract:
// - Input is normalised and clamped before it reaches SQL (bounded pages,
//   escaped search terms, enum fallbacks); invalid input never surfaces as a
//   database error.
// - Missing data is honest: `null` details, empty pages, null scores.
// - Unavailable infrastructure is loud and typed: every method throws
//   CatalogUnavailableError when the database is not configured or cannot be
//   reached — it never falls back to fixtures or mock rows, and never leaks
//   internal error details.
// - No module-level environment access or network calls: importing this
//   module is free; `getDb` is only invoked inside method calls.
export type CatalogService = {
  // Universities
  listUniversities(params?: ListUniversitiesParams): Promise<CatalogPage<CatalogUniversity>>;
  getUniversityDetail(slug: string): Promise<CatalogUniversityDetail | null>;
  getTopUniversities(params?: TopUniversitiesParams): Promise<CatalogUniversity[]>;
  listCountries(): Promise<CatalogCountry[]>;
  listUniversityReviews(
    slug: string,
    params?: ReviewsPageParams,
  ): Promise<CatalogPage<CatalogSampleReview> | null>;

  // Courses
  listCourses(params?: ListCoursesParams): Promise<CatalogPage<CatalogCourse>>;
  getCourseDetail(id: string): Promise<CatalogCourseDetail | null>;
  listCourseReviews(
    id: string,
    params?: ReviewsPageParams,
  ): Promise<CatalogPage<CatalogSampleReview> | null>;

  // Instructors
  getInstructorDetail(id: string): Promise<CatalogInstructor | null>;
  listInstructorReviews(
    id: string,
    params?: ReviewsPageParams,
  ): Promise<CatalogPage<CatalogSampleReview> | null>;
};

export type ListUniversitiesParams = {
  /** Free-text search across name, city and country. */
  q?: string | undefined;
  /** ISO 3166-1 alpha-2 country code filter (case-insensitive). */
  country?: string | undefined;
  /** "name" (default) | "overall" (score desc, unscored last) | "reviews". */
  sort?: string | undefined;
  page?: number | undefined;
  /** 1–50, default 12. */
  pageSize?: number | undefined;
};

export type TopUniversitiesParams = {
  /** 1–25, default 10. */
  limit?: number | undefined;
};

export type ListCoursesParams = {
  /** Free-text search across name, code and department. */
  q?: string | undefined;
  level?: string | undefined;
  /** Restrict to one university (UUID). */
  universityId?: string | undefined;
  /** Restrict to one university (slug); unknown slugs yield an empty page. */
  universitySlug?: string | undefined;
  /** "code" (default) | "name" | "overall". */
  sort?: string | undefined;
  page?: number | undefined;
  /** 1–50, default 12. */
  pageSize?: number | undefined;
};

export type ReviewsPageParams = {
  page?: number | undefined;
  /** 1–20, default 10. */
  pageSize?: number | undefined;
};

export function createCatalogService(deps: CatalogServiceDeps): CatalogService {
  // Lazily resolve the database inside each call so importing (and building)
  // the app never touches the environment. Configuration failures surface as
  // database-not-configured; execution failures as database-unreachable.
  const withDb = async <T>(op: (db: CatalogDatabase) => Promise<T>): Promise<T> => {
    let db: CatalogDatabase;
    try {
      db = deps.getDb();
    } catch (error) {
      throw new CatalogUnavailableError("database-not-configured", error);
    }
    try {
      return await op(db);
    } catch (error) {
      if (error instanceof CatalogUnavailableError) {
        throw error;
      }
      throw new CatalogUnavailableError("database-unreachable", error);
    }
  };

  const listPagination = (params: { page?: number; pageSize?: number } | undefined) =>
    normalizePagination(params, LIST_PAGE_DEFAULT, LIST_PAGE_MAX);
  const reviewsPagination = (params: { page?: number; pageSize?: number } | undefined) =>
    normalizePagination(params, REVIEWS_PAGE_DEFAULT, REVIEWS_PAGE_MAX);

  return {
    async listUniversities(params = {}) {
      const sort = normalizeEnum(UNIVERSITY_SORTS, params.sort) ?? "name";
      const countryCode = normalizeCountryCode(params.country);
      return withDb((db) =>
        queryUniversities(db, {
          term: normalizeSearchTerm(params.q),
          countryCode,
          sort: sort as CatalogUniversitySort,
          pagination: listPagination(params),
        }),
      );
    },

    async getUniversityDetail(slug) {
      const normalized = normalizeSlug(slug);
      if (!normalized) {
        return null;
      }
      return withDb((db) => queryUniversityDetail(db, normalized));
    },

    async getTopUniversities(params = {}) {
      const { pageSize: limit } = normalizePagination(
        { page: 1, pageSize: params.limit },
        TOP_DEFAULT,
        TOP_MAX,
      );
      return withDb((db) => queryTopUniversities(db, { limit }));
    },

    async listCountries() {
      return withDb((db) => queryCountries(db));
    },

    async listUniversityReviews(slug, params = {}) {
      const normalized = normalizeSlug(slug);
      if (!normalized) {
        return null;
      }
      return withDb(async (db) => {
        const detail = await queryUniversityDetail(db, normalized);
        if (!detail) {
          return null;
        }
        return querySubjectReviews(
          db,
          { subjectType: "university", universityId: detail.id },
          reviewsPagination(params),
        );
      });
    },

    async listCourses(params = {}) {
      const sort = normalizeEnum(COURSE_SORTS, params.sort) ?? "code";
      const level = normalizeEnum(STUDY_LEVELS, params.level);
      const universityId = normalizeUuid(params.universityId);
      const universitySlug = normalizeSlug(params.universitySlug);
      return withDb(async (db) => {
        let scopedUniversityId = universityId;
        if (!scopedUniversityId && universitySlug) {
          const scoped = await queryUniversityDetail(db, universitySlug);
          // Unknown university slug: honest empty page, not an error.
          if (!scoped) {
            return emptyPage(listPagination(params));
          }
          scopedUniversityId = scoped.id;
        }
        return queryCourses(db, {
          term: normalizeSearchTerm(params.q),
          level,
          universityId: scopedUniversityId,
          sort: sort as CatalogCourseSort,
          pagination: listPagination(params),
        });
      });
    },

    async getCourseDetail(id) {
      const courseId = normalizeUuid(id);
      if (!courseId) {
        return null;
      }
      return withDb((db) => queryCourseDetail(db, courseId));
    },

    async getInstructorDetail(id) {
      const instructorId = normalizeUuid(id);
      if (!instructorId) {
        return null;
      }
      return withDb((db) => queryInstructorDetail(db, instructorId));
    },

    async listCourseReviews(id, params = {}) {
      const courseId = normalizeUuid(id);
      if (!courseId) {
        return null;
      }
      return withDb(async (db) => {
        const detail = await queryCourseDetail(db, courseId);
        if (!detail) {
          return null;
        }
        return querySubjectReviews(
          db,
          {
            subjectType: "course",
            universityId: detail.universityId,
            courseId: detail.id,
          } satisfies SubjectScope,
          reviewsPagination(params),
        );
      });
    },

    async listInstructorReviews(id, params = {}) {
      const instructorId = normalizeUuid(id);
      if (!instructorId) {
        return null;
      }
      return withDb(async (db) => {
        const detail = await queryInstructorDetail(db, instructorId);
        if (!detail) {
          return null;
        }
        return querySubjectReviews(
          db,
          {
            subjectType: "instructor",
            universityId: detail.universityId,
            instructorId: detail.id,
          } satisfies SubjectScope,
          reviewsPagination(params),
        );
      });
    },
  };
}

function emptyPage(pagination: NormalizedPagination): CatalogPage<never> {
  return {
    items: [],
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
  };
}
