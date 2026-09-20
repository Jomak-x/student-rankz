import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function captureScreenshot(page: Page, name: string, projectName: string) {
  const dir = path.join(__dirname, `../test-screenshots/${projectName}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Wait for any animations to finish
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

// ─── Navigation ──────────────────────────────────────────────────────────────

test("home page loads with demo banner and search", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByText("Demo · sample data")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Find your university/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Search universities/i })).toBeVisible();
  await captureScreenshot(page, "01-home-light", info.project.name);
});

test("home page dark mode", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Toggle theme/i }).click();
  await page.getByText("Dark").click();
  await page.waitForTimeout(200);
  const htmlClass = await page.locator("html").getAttribute("class");
  expect(htmlClass).toContain("dark");
  await captureScreenshot(page, "02-home-dark", info.project.name);
  // Reset for other tests
  await page.getByRole("button", { name: /Toggle theme/i }).click();
  await page.getByText("System").click();
});

test("header navigation works", async ({ page }) => {
  await page.goto("/");
  const isMobile = page.viewportSize()!.width < 640;
  if (isMobile) {
    await page.getByRole("button", { name: /Open navigation menu/i }).click();
  }
  await page.getByRole("link", { name: "Universities" }).first().click();
  await expect(page).toHaveURL("/universities");
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: /Open navigation menu/i }).click();
  }
  await page.getByRole("link", { name: "Courses" }).first().click();
  await expect(page).toHaveURL("/courses");
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: /Open navigation menu/i }).click();
  }
  await page.getByRole("link", { name: "Compare" }).first().click();
  await expect(page).toHaveURL("/compare");
});

// ─── Search & filter ──────────────────────────────────────────────────────────

test("university search filters results", async ({ page }) => {
  await page.goto("/universities");
  const searchInput = page.getByRole("textbox", { name: /Search universities/i });
  await searchInput.fill("Munich");
  await expect(page.getByText("Technical University of Munich")).toBeVisible();
  await expect(page.getByText("University of Bologna")).not.toBeVisible();
});

test("university search empty state shows reset button", async ({ page }) => {
  await page.goto("/universities");
  const searchInput = page.getByRole("textbox", { name: /Search universities/i });
  await searchInput.fill("xxxxxxxxxx-no-match");
  await expect(page.getByRole("button", { name: /Reset filters/i })).toBeVisible();
  await page.getByRole("button", { name: /Reset filters/i }).click();
  await expect(page.getByText("Technical University of Munich")).toBeVisible();
});

test("home search navigates to universities with query", async ({ page }) => {
  await page.goto("/");
  const searchInput = page.getByRole("textbox", { name: /Search universities/i });
  await searchInput.fill("KTH");
  await page.getByRole("button", { name: /Search/i }).click();
  await expect(page).toHaveURL(/\/universities\?q=KTH/);
});

// ─── Detail navigation ────────────────────────────────────────────────────────

test("university detail page loads scores and tabs", async ({ page }, info) => {
  await page.goto("/universities/tum");
  await expect(page.getByRole("heading", { name: /Technical University of Munich/i })).toBeVisible();
  await expect(page.getByText(/Category scores/)).toBeVisible();
  await captureScreenshot(page, "03-university-detail", info.project.name);
});

test("university tabs navigate between overview and reviews", async ({ page }) => {
  await page.goto("/universities/tum");
  const reviewsTab = page.getByRole("tab", { name: /Reviews/i });
  await reviewsTab.click();
  // Verify the Reviews tabpanel is active and shows its content
  await expect(page.getByRole("tabpanel", { name: /Reviews/i })).toBeVisible();
  await expect(
    page.getByRole("tabpanel", { name: /Reviews/i }).getByText(/Excellent research infrastructure/)
  ).toBeVisible();
});

test("course detail page loads", async ({ page }) => {
  await page.goto("/courses/tum-ml401");
  await expect(page.getByRole("heading", { name: /Machine Learning/i })).toBeVisible();
  await expect(page.getByText(/Workload balance/)).toBeVisible();
});

test("instructor detail page loads", async ({ page }) => {
  await page.goto("/instructors/prof-mueller");
  await expect(page.getByRole("heading", { name: /Prof. Dr. Anna Müller/i })).toBeVisible();
  await expect(page.getByText(/Explanation clarity/)).toBeVisible();
});

// ─── Compare ─────────────────────────────────────────────────────────────────

test("compare page empty state shows browse link", async ({ page }, info) => {
  await page.goto("/compare");
  await page.evaluate(() => localStorage.removeItem("student-rankz-compare"));
  await page.reload();
  await expect(page.getByRole("link", { name: /Browse universities/i })).toBeVisible();
  await captureScreenshot(page, "04-compare-empty", info.project.name);
});

test("compare selection persists across reload", async ({ page }, info) => {
  await page.goto("/compare");
  await page.evaluate(() => localStorage.removeItem("student-rankz-compare"));
  await page.reload();

  await page.goto("/universities/tum");
  await page.getByRole("button", { name: /Add to comparison/i }).click();
  await page.goto("/universities/kth");
  await page.getByRole("button", { name: /Add to comparison/i }).click();

  await page.goto("/compare");
  await expect(page.getByRole("link", { name: "Technical University of Munich" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "KTH Royal Institute of Technology" }).first()).toBeVisible();
  await captureScreenshot(page, "05-compare-two", info.project.name);
  await page.reload();
  await expect(page.getByRole("link", { name: "Technical University of Munich" }).first()).toBeVisible();
});

// ─── Review composer ─────────────────────────────────────────────────────────

test("review form validates empty submission", async ({ page }, info) => {
  await page.goto("/universities/tum");
  await page.getByRole("button", { name: /Write a review/i }).first().click();
  // Wait for dialog to be fully open
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /Save draft/i }).click();
  await expect(page.getByText(/Please select a rating/i)).toBeVisible();
  await expect(page.getByText(/Title is required/i)).toBeVisible();
  await captureScreenshot(page, "06-review-dialog", info.project.name);
});

test("review form saves to localStorage only", async ({ page }) => {
  await page.goto("/universities/unibo");
  await page.getByRole("button", { name: /Write a review/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /4 stars/i }).click();
  await page.getByLabel("Title").fill("Great experience");
  await page.locator("#review-body").fill("This was a truly wonderful university experience that I thoroughly enjoyed during my time there.");
  await page.getByRole("button", { name: /Save draft/i }).click();
  await expect(page.getByText(/Saved on this device · demo, not published/i)).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("student-rankz-pending-reviews"));
  expect(stored).toBeTruthy();
  const reviews = JSON.parse(stored!);
  expect(reviews[reviews.length - 1].title).toBe("Great experience");
});

test("saved review does not change public count", async ({ page }) => {
  await page.goto("/universities/unibo");
  const countText = await page.getByText(/\d+ demo reviews/).first().textContent();
  await page.getByRole("button", { name: /Write a review/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /4 stars/i }).click();
  await page.getByLabel("Title").fill("My review");
  await page.locator("#review-body").fill("This is a test review body that is long enough to pass validation checks.");
  await page.getByRole("button", { name: /Save draft/i }).click();
  await page.getByRole("button", { name: /Close/i }).first().click();
  const countAfter = await page.getByText(/\d+ demo reviews/).first().textContent();
  expect(countAfter).toBe(countText);
});

// ─── Theme ───────────────────────────────────────────────────────────────────

test("theme toggle switches to dark mode persistently", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Toggle theme/i }).click();
  await page.getByText("Dark").click();
  await page.waitForTimeout(200);
  const htmlClass = await page.locator("html").getAttribute("class");
  expect(htmlClass).toContain("dark");
  await page.reload();
  const htmlClassAfterReload = await page.locator("html").getAttribute("class");
  expect(htmlClassAfterReload).toContain("dark");
});

// ─── Mobile overflow ─────────────────────────────────────────────────────────

test("no horizontal overflow on home", async ({ page }, info) => {
  await page.goto("/");
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  if (page.viewportSize()!.width < 640) {
    await captureScreenshot(page, "07-home-mobile", info.project.name);
  }
});

test("no horizontal overflow on universities page", async ({ page }) => {
  await page.goto("/universities");
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
});

// ─── Console errors ──────────────────────────────────────────────────────────

test("no console errors on home page", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/");
  await page.waitForTimeout(500);
  // Filter out known non-critical errors
  const realErrors = errors.filter(
    (e) => !e.includes("favicon") && !e.includes("net::ERR_ABORTED")
  );
  expect(realErrors).toHaveLength(0);
});
