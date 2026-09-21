// Input normalisation for catalog queries.
//
// Every parameter a caller can influence is clamped/validated here before it
// reaches SQL: pages stay bounded, search terms are length-capped and
// LIKE-escaped, enum-ish values fall back to documented defaults. Invalid
// input never produces a database error; it degrades to the documented
// default or to "no match".

export const LIST_PAGE_DEFAULT = 12;
export const LIST_PAGE_MAX = 50;
export const REVIEWS_PAGE_DEFAULT = 10;
export const REVIEWS_PAGE_MAX = 20;
export const TOP_DEFAULT = 10;
export const TOP_MAX = 25;
export const SEARCH_MAX_LENGTH = 100;
export const SLUG_MAX_LENGTH = 120;

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const UNIVERSITY_SORTS = ["name", "overall", "reviews"] as const;
export const COURSE_SORTS = ["code", "name", "overall"] as const;
export const STUDY_LEVELS = ["bachelor", "master", "phd"] as const;

export type PaginationInput = {
  page?: number | undefined;
  pageSize?: number | undefined;
};

export type NormalizedPagination = {
  page: number;
  pageSize: number;
  offset: number;
};

export function normalizePagination(
  input: PaginationInput | undefined,
  defaultPageSize: number,
  maxPageSize: number,
): NormalizedPagination {
  const page =
    typeof input?.page === "number" && Number.isInteger(input.page) && input.page > 0
      ? Math.min(input.page, 10_000)
      : 1;
  const pageSize =
    typeof input?.pageSize === "number" &&
    Number.isInteger(input.pageSize) &&
    input.pageSize > 0
      ? Math.min(input.pageSize, maxPageSize)
      : defaultPageSize;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

// Trims and caps a free-text search term; empty/oversized-only input becomes
// undefined (no filter).
export function normalizeSearchTerm(raw: string | undefined | null): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim().slice(0, SEARCH_MAX_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

// Escapes LIKE wildcards so user input cannot broaden the match. Postgres
// ILIKE treats backslash as the default escape character.
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function normalizeCountryCode(raw: string | undefined | null): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}

// Returns a well-formed UUID string or undefined — never an invalid UUID
// literal that would make Postgres reject the query.
export function normalizeUuid(raw: string | undefined | null): string | undefined {
  return typeof raw === "string" && UUID_PATTERN.test(raw) ? raw.toLowerCase() : undefined;
}

export function normalizeSlug(raw: string | undefined | null): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const slug = raw.trim().toLowerCase();
  return slug.length > 0 && slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug)
    ? slug
    : undefined;
}

export function normalizeEnum<T extends readonly string[]>(
  allowed: T,
  raw: string | undefined | null,
): T[number] | undefined {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw)
    ? (raw as T[number])
    : undefined;
}
