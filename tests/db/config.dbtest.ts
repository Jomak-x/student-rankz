import assert from "node:assert/strict";
import test from "node:test";

import { resolveMigrationUrl } from "@/db/config";

test("migration URL prefers a non-empty direct URL and treats blank values as unset", () => {
  assert.equal(
    resolveMigrationUrl({
      DATABASE_DIRECT_URL: "postgres://direct",
      DATABASE_URL: "postgres://pooled",
    }),
    "postgres://direct",
  );
  assert.equal(
    resolveMigrationUrl({
      DATABASE_DIRECT_URL: "   ",
      DATABASE_URL: "postgres://pooled",
    }),
    "postgres://pooled",
  );
  assert.equal(
    resolveMigrationUrl({
      DATABASE_DIRECT_URL: "",
      DATABASE_URL: "postgres://pooled",
    }),
    "postgres://pooled",
  );
  assert.equal(
    resolveMigrationUrl({ DATABASE_DIRECT_URL: "postgres://direct" }),
    "postgres://direct",
  );
});

test("migration URL falls back to DATABASE_URL and is empty when both are absent", () => {
  assert.equal(
    resolveMigrationUrl({ DATABASE_URL: "postgres://pooled" }),
    "postgres://pooled",
  );
  assert.equal(resolveMigrationUrl({}), "");
  assert.equal(
    resolveMigrationUrl({
      DATABASE_URL: undefined,
      DATABASE_DIRECT_URL: undefined,
    }),
    "",
  );
  assert.equal(resolveMigrationUrl({ DATABASE_URL: "  " }), "");
});
