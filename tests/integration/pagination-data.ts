import { UNIVERSITY_IDS } from "../../db/seed-data";

// Inserted only into this harness's ephemeral demo DB. No ratings or offerings:
// existing seed identities, university totals and ranked scores stay unchanged.
export const paginationCourses = Array.from({ length: 13 }, (_, index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  universityId: UNIVERSITY_IDS.bellenau,
  code: `ZZ-PAGE-${String(index + 1).padStart(2, "0")}`,
  name: `Pagination probe course ${String(index + 1).padStart(2, "0")}`,
  department: "Integration pagination",
  credits: "5.00",
  level: "bachelor" as const,
  description: "Synthetic browser pagination record, created only in an ephemeral integration database.",
}));
