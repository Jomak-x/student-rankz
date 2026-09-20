// Public types of the drafts service.
//
// DraftDto is the ONLY shape the service returns. It deliberately omits the
// owner subject and the client request key: owner identity stays private and
// request keys are transport bookkeeping, not review data.

export type DraftTargetType = "university" | "course" | "instructor";

export const DRAFT_TARGET_TYPES: readonly DraftTargetType[] = [
  "university",
  "course",
  "instructor",
];

export type DraftDto = {
  id: string;
  targetType: DraftTargetType;
  universityId: string;
  courseId: string | null;
  instructorId: string | null;
  title: string | null;
  body: string;
  rating: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type DraftListOptions = {
  /** Page size, 1..50 (default 20). */
  limit?: number;
  /** Number of drafts to skip, >= 0 (default 0). */
  offset?: number;
};

export type DraftListResult = {
  items: DraftDto[];
  hasMore: boolean;
  /** Offset to pass as `offset` for the next page, or null when exhausted. */
  nextOffset: number | null;
};

/** Result of a successful delete. */
export type DraftDeleteResult = {
  id: string;
};
