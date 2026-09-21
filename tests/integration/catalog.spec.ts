import { expect, test } from "@playwright/test";
import {
  COURSE_IDS, INSTRUCTOR_IDS, UNIVERSITY_IDS,
  seedCourses, seedInstructors, seedUniversities,
} from "../../db/seed-data";
import { expectNoFixtures, noOverflow, screenshot } from "./helpers";
import { paginationCourses } from "./pagination-data";

// These are the actual database seed identities, never lib/demo-data fixtures.
const asterheim = seedUniversities.find(item => item.id === UNIVERSITY_IDS.asterheim)!;
const bellenau = seedUniversities.find(item => item.id === UNIVERSITY_IDS.bellenau)!;
const vesimaki = seedUniversities.find(item => item.id === UNIVERSITY_IDS.vesimaki)!;
const course = seedCourses.find(item => item.id === COURSE_IDS.asterheimCs101)!;
const instructor = seedInstructors.find(item => item.id === INSTRUCTOR_IDS.asterheimOkafor)!;
const universityPath = `/universities/${asterheim.slug}`;
const coursePath = `/courses/${course.id}`;
const instructorPath = `/instructors/${instructor.id}`;
const compareKey = "student-rankz-catalog-compare";

test("seeded directory searches, filters, sorts, and shows real row counts", async ({ page }, info) => {
  await page.goto("/universities");
  await expect(page.getByText("3 universities", { exact: true })).toBeVisible();
  for (const university of seedUniversities) {
    await expect(page.getByRole("link", { name: `View ${university.name}`, exact: true })).toHaveAttribute("href", `/universities/${university.slug}`);
  }
  await expect(page.getByText("Demo · sample data", { exact: true })).toBeVisible();
  await expectNoFixtures(page);
  await noOverflow(page);
  await screenshot(page, info, "directory-light");

  await page.getByLabel("Search universities", { exact: true }).fill("Asterheim");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/q=Asterheim/);
  await expect(page.getByText("1 university", { exact: true })).toBeVisible();
  await expect(page.locator('main a[href^="/universities/"]')).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("Search universities", { exact: true })).toHaveValue("Asterheim");

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByLabel("Search universities", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Filter by country", { exact: true })).toHaveValue("");
  await page.getByLabel("Filter by country", { exact: true }).selectOption("FR");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("link", { name: `View ${bellenau.name}`, exact: true })).toBeVisible();
  await expect(page.locator('main a[href^="/universities/"]')).toHaveCount(1);
  await expect(page.getByText("No score", { exact: true })).toBeVisible();
  await expect(page.getByText("(0 sample reviews)", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL("/universities");
  await expect(page.getByLabel("Search universities", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Filter by country", { exact: true })).toHaveValue("");
  await page.getByLabel("Sort universities", { exact: true }).selectOption("name");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator('main a[href^="/universities/"]').first()).toHaveAttribute("href", universityPath);
  await page.getByLabel("Search universities", { exact: true }).fill("no-such-university-98317");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No universities match your filters" })).toBeVisible();
  await expect(page.locator('main a[href^="/universities/"]')).toHaveCount(0);
});

test("home and rankings use stored scores/counts and exclude the unrated university", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("list", { name: "University rankings" }).getByRole("link")).toHaveCount(2);
  await page.getByRole("link", { name: "All rankings" }).click();
  const rows = page.getByRole("list", { name: "University rankings" }).getByRole("link");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute("href", `/universities/${vesimaki.slug}`);
  await expect(rows.nth(0)).toContainText("4.5");
  await expect(rows.nth(0)).toContainText("2 sample reviews");
  await expect(rows.nth(1)).toHaveAttribute("href", universityPath);
  await expect(rows.nth(1)).toContainText("4.3");
  await expect(rows.nth(1)).toContainText("3 sample reviews");
  await expect(page.getByText(/Showing 2 universities/)).toBeVisible();
  await expect(page.locator(`main a[href="/universities/${bellenau.slug}"]`)).toHaveCount(0);
  await noOverflow(page);
  await screenshot(page, info, "rankings-light");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await screenshot(page, info, "rankings-dark");
});

test("course pagination follows Next and Previous through distinct stored rows while preserving filters", async ({ page }, info) => {
  await page.goto("/courses?sort=code");
  await expect(page.getByText(`${seedCourses.length + paginationCourses.length} courses`, { exact: true })).toBeVisible();
  await page.getByLabel("Search courses", { exact: true }).fill("Pagination probe");
  await page.getByLabel("Filter by level", { exact: true }).selectOption("bachelor");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("13 courses", { exact: true })).toBeVisible();
  const links = page.locator('main a[href^="/courses/"]');
  await expect(links).toHaveCount(12);
  const firstPage = await links.evaluateAll(elements => elements.map(element => element.getAttribute("href")));
  expect(firstPage).toEqual(paginationCourses.slice(0, 12).map(item => `/courses/${item.id}`));
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  const query = new URL(page.url()).searchParams;
  expect(query.get("q")).toBe("Pagination probe");
  expect(query.get("level")).toBe("bachelor");
  expect(query.get("sort")).toBe("code");
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute("href", `/courses/${paginationCourses[12].id}`);
  expect(firstPage).not.toContain(await links.first().getAttribute("href"));
  await expect(page.getByRole("link", { name: "Next", exact: true })).toHaveCount(0);
  await expect(page.getByText("No score", { exact: true })).toBeVisible();
  await screenshot(page, info, "courses-pagination-last-page");
  await page.reload();
  await expect(links).toHaveCount(1);
  await page.getByRole("link", { name: "Previous", exact: true }).click();
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await expect(links).toHaveCount(12);
  expect(await links.evaluateAll(elements => elements.map(element => element.getAttribute("href")))).toEqual(firstPage);

  await page.goto("/courses?sort=code&page=4");
  await expect(page.getByRole("heading", { name: "Nothing to show yet" })).toBeVisible();
  await expect(links).toHaveCount(0);
  await page.getByRole("link", { name: "Previous", exact: true }).click();
  await expect(page).toHaveURL(/page=3/);
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute("href", `/courses/${paginationCourses[12].id}`);
  await page.getByLabel("Search courses", { exact: true }).fill(course.code);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute("href", coursePath);
  await expect(page.getByText("1 course", { exact: true })).toBeVisible();
  await page.getByLabel("Search courses", { exact: true }).fill("no-such-course-98317");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No courses match your filters" })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByLabel("Search courses", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Filter by level", { exact: true })).toHaveValue("");
  await expect(page.getByText(`${seedCourses.length + paginationCourses.length} courses`, { exact: true })).toBeVisible();
});

test("university, course, instructor and review crosslinks resolve real identities without browser errors", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(universityPath);
  await expect(page.getByRole("heading", { level: 1, name: asterheim.name, exact: true })).toBeVisible();
  await expect(page.getByText("3 sample reviews", { exact: true })).toBeVisible();
  await expect(page.locator("#reviews")).toContainText("Strong technical curriculum with real project work");
  await page.locator(`main a[href="${coursePath}"]`).click();
  await expect(page.getByRole("heading", { level: 1, name: course.name, exact: true })).toBeVisible();
  await expect(page.getByText("2 sample reviews", { exact: true })).toBeVisible();
  await expect(page.locator("#reviews")).toContainText("Gentle but thorough introduction");
  await page.locator(`main a[href="${instructorPath}"]`).click();
  await expect(page.getByRole("heading", { level: 1, name: instructor.fullName, exact: true })).toBeVisible();
  await expect(page.locator("#reviews")).toContainText("Explains algorithms step by step");
  await expect(page.locator(`main a[href="${coursePath}"]`)).toBeVisible();
  await noOverflow(page);
  await screenshot(page, info, "instructor-detail");
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: asterheim.name, exact: true }).click();
  await expect(page).toHaveURL(universityPath);
  expect(errors).toEqual([]);
});

test("detail pagination recovers from empty pages and preserves independent page parameters", async ({ page }) => {
  await page.goto(`${universityPath}?reviewPage=2&coursePage=2`);
  await expect(page.getByRole("heading", { name: "No sample reviews on this page" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No courses on this page" })).toBeVisible();
  await page.getByRole("link", { name: "Previous reviews" }).click();
  expect(new URL(page.url()).searchParams.get("coursePage")).toBe("2");
  await expect(page.locator("#reviews")).toContainText("Strong technical curriculum with real project work");
  await expect(page.getByRole("heading", { name: "No courses on this page" })).toBeVisible();
  await page.getByRole("link", { name: "Previous courses" }).click();
  expect(new URL(page.url()).searchParams.get("reviewPage")).toBe("1");
  await expect(page.locator('#courses a[href^="/courses/"]')).toHaveCount(4);
});

test("unrated details show null scores and zero reviews", async ({ page }) => {
  for (const route of [
    `/universities/${bellenau.slug}`,
    `/courses/${COURSE_IDS.bellenauEa120}`,
    `/instructors/${INSTRUCTOR_IDS.bellenauFontaine}`,
  ]) {
    await page.goto(route);
    await expect(page.getByText("0 sample reviews", { exact: true })).toBeVisible();
    await expect(page.getByText("Unrated", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "No sample reviews on this page" })).toBeVisible();
    await expect(page.getByText(/0\.0 out of 5 stars/)).toHaveCount(0);
  }
});

test("comparison persists actual database slugs and renders missing scores honestly", async ({ page }, info) => {
  // Obsolete prototype state must not silently become catalog selections.
  await page.addInitScript(() => localStorage.setItem("student-rankz-compare", JSON.stringify(["tum", "kth"])));
  for (const university of [asterheim, bellenau]) {
    await page.goto(`/universities/${university.slug}`);
    await page.getByRole("button", { name: "Add to comparison", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove from comparison", exact: true })).toBeVisible();
  }
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "[]"), compareKey)).toEqual([asterheim.slug, bellenau.slug]);
  await page.goto("/compare");
  const table = page.getByRole("table");
  await expect(table.getByRole("link", { name: asterheim.name, exact: true })).toHaveAttribute("href", universityPath);
  await expect(table.getByRole("link", { name: bellenau.name, exact: true })).toBeVisible();
  const overall = table.getByRole("row").filter({ has: page.getByText("Overall", { exact: true }) });
  await expect(overall).toContainText("4.3");
  await expect(overall).toContainText("Not rated");
  await page.reload();
  await expect(table.getByRole("link")).toHaveCount(2);
  await noOverflow(page);
  await screenshot(page, info, "comparison-persisted");
  await page.getByRole("button", { name: `Remove ${asterheim.slug}`, exact: true }).click();
  await expect(table.getByRole("link")).toHaveCount(1);
  await page.reload();
  await expect(table.getByRole("link", { name: bellenau.name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Remove ${bellenau.slug}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "No universities selected" })).toBeVisible();
});

for (const target of [
  { type: "university", path: universityPath, id: asterheim.id, reviewCount: 3 },
  { type: "course", path: coursePath, id: course.id, reviewCount: 2 },
  { type: "instructor", path: instructorPath, id: instructor.id, reviewCount: 2 },
]) {
  test(`real ${target.type} draft request uses the correct target and preserves input after auth failure`, async ({ page }, info) => {
    await page.goto(target.path);
    await page.getByRole("button", { name: "Write a review", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "4 stars", exact: true }).click();
    const title = "Private draft remains unsaved";
    const body = "This review input must survive the unavailable authentication response without becoming a public review.";
    await dialog.getByLabel("Title", { exact: true }).fill(title);
    await dialog.getByLabel("Review", { exact: true }).fill(body);
    const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/drafts") && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
    const response = await responsePromise;
    // No provider configured: the real auth boundary fails closed with 503.
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "UNAVAILABLE" } });
    const payload = response.request().postDataJSON();
    expect(payload).toMatchObject({ universityId: asterheim.id, targetType: target.type, title, body, rating: 4 });
    expect(payload).not.toHaveProperty("courseId");
    expect(payload).not.toHaveProperty("instructorId");
    if (target.type === "university") {
      expect(payload.targetId ?? asterheim.id).toBe(asterheim.id);
    } else {
      expect(payload.targetId).toBe(target.id);
    }
    await expect(dialog.getByRole("alert")).toContainText("couldn't confirm whether your draft was saved");
    await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue(title);
    await expect(dialog.getByLabel("Review", { exact: true })).toHaveValue(body);
    await expect(dialog.getByText("Private draft saved", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("student-rankz-pending-reviews"))).toBeNull();
    await screenshot(page, info, `composer-${target.type}-auth-unavailable`);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByText(`${target.reviewCount} sample reviews`, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(`${target.reviewCount} sample reviews`, { exact: true })).toBeVisible();
  });
}

test("unknown database identities and old fixture URLs show not found", async ({ page }) => {
  for (const route of ["/universities/tum", "/courses/not-a-uuid", "/instructors/00000000-0000-4000-8000-999999999999"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Write a review" })).toHaveCount(0);
  }
});
