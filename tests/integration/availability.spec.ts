import { expect, test } from "@playwright/test";
import { COURSE_IDS, INSTRUCTOR_IDS, seedUniversities } from "../../db/seed-data";
import { expectNoFixtures, noOverflow, screenshot } from "./helpers";

for (const route of ["/", "/universities", "/courses", "/rankings"]) {
  test(`${route} distinguishes an empty catalog from a database outage`, async ({ page }, info) => {
    const outage = info.project.name.startsWith("outage-");
    await page.goto(route);
    const heading = outage ? "The directory is temporarily unavailable" : route === "/" ? "No featured universities yet" : "Nothing to show yet";
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The directory is not available yet", exact: true })).toHaveCount(0);
    await expect(page.locator('main a[href^="/universities/"], main a[href^="/courses/"], main a[href^="/instructors/"]')).toHaveCount(0);
    await expect(page.getByText("Demo · sample data", { exact: true })).toHaveCount(0);
    await expectNoFixtures(page);
    await noOverflow(page);
    if (route === "/universities") await screenshot(page, info, "directory-availability");
  });
}

test("detail absence is distinct from unavailable database reads", async ({ page }, info) => {
  for (const route of [
    `/universities/${seedUniversities[0].slug}`,
    `/courses/${COURSE_IDS.asterheimCs101}`,
    `/instructors/${INSTRUCTOR_IDS.asterheimOkafor}`,
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", {
      name: info.project.name.startsWith("outage-") ? "The directory is temporarily unavailable" : "404",
      exact: true,
    })).toBeVisible();
    await expect(page.getByRole("button", { name: "Write a review" })).toHaveCount(0);
  }
});

test("persisted comparison distinguishes unavailable data from removed records", async ({ page }, info) => {
  await page.addInitScript(slug => {
    localStorage.setItem("student-rankz-catalog-compare", JSON.stringify([slug]));
  }, seedUniversities[0].slug);
  await page.goto("/compare");
  if (info.project.name.startsWith("outage-")) {
    await expect(page.getByRole("heading", { name: "The directory is temporarily unavailable" })).toBeVisible();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("heading", { name: "The directory is temporarily unavailable" })).toBeVisible();
  } else {
    await expect(page.getByText("Some selected universities are no longer available. Remove them to choose another.", { exact: true })).toBeVisible();
  }
  await expect(page.locator('table a[href^="/universities/"]')).toHaveCount(0);
  await screenshot(page, info, "comparison-availability");
});
