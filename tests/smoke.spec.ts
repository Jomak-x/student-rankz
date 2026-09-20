import { test, expect, type Page } from "@playwright/test";
import path from "path";

const SCREENSHOTS = path.join(__dirname, "../test-screenshots");

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function captureScreenshot(page: Page, name: string) {
  const dir = SCREENSHOTS;
  const fs = await import("fs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

// ─── Navigation ──────────────────────────────────────────────────────────────

test("home page loads with demo banner and hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo · sample data")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Choose where to study/i })).toBeVisible();
  await captureScreenshot(page, "01-home-light");
});

test("header navigation works", async ({ page }) => {
  await page.goto("/");
  // On mobile the nav links may be inside a hamburger menu
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
  // Bologna should not be visible
  await expect(page.getByText("University of Bologna")).not.toBeVisible();
});

test("university search empty state shows reset button", async ({ page }) => {
  await page.goto("/universities");
  const searchInput = page.getByRole("textbox", { name: /Search universities/i });
  await searchInput.fill("xxxxxxxxxx-no-match");
  await expect(page.getByRole("button", { name: /Reset filters/i })).toBeVisible();
  await page.getByRole("button", { name: /Reset filters/i }).click();
  // After reset, all universities should show
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

test("university detail page loads scores and tabs", async ({ page }) => {
  await page.goto("/universities/tum");
  await expect(page.getByRole("heading", { name: /Technical University of Munich/i })).toBeVisible();
  await expect(page.getByText(/Category scores/)).toBeVisible();
  await expect(page.getByText(/Teaching quality/)).toBeVisible();
  await captureScreenshot(page, "02-university-detail");
});

test("university tabs navigate between overview and reviews", async ({ page }) => {
  await page.goto("/universities/tum");
  await page.getByRole("tab", { name: /Reviews/i }).click();
  await expect(page.getByText(/Excellent research infrastructure/)).toBeVisible();
});

test("course detail page loads", async ({ page }) => {
  await page.goto("/courses/tum-ml401");
  await expect(page.getByRole("heading", { name: /Machine Learning/i })).toBeVisible();
  await expect(page.getByText(/Workload balance/)).toBeVisible();
  await captureScreenshot(page, "03-course-detail");
});

test("instructor detail page loads", async ({ page }) => {
  await page.goto("/instructors/prof-mueller");
  await expect(page.getByRole("heading", { name: /Prof. Dr. Anna Müller/i })).toBeVisible();
  await expect(page.getByText(/Explanation clarity/)).toBeVisible();
  await captureScreenshot(page, "04-instructor-detail");
});

// ─── Compare ─────────────────────────────────────────────────────────────────

test("compare page empty state shows browse link", async ({ page }) => {
  // Clear localStorage before test
  await page.goto("/compare");
  await page.evaluate(() => localStorage.removeItem("student-rankz-compare"));
  await page.reload();
  await expect(page.getByRole("link", { name: /Browse universities/i })).toBeVisible();
  await captureScreenshot(page, "05-compare-empty");
});

test("compare selection persists across reload", async ({ page }) => {
  await page.goto("/universities/tum");
  // Add TUM to compare
  await page.getByRole("button", { name: /Add to comparison/i }).click();
  await page.goto("/universities/kth");
  await page.getByRole("button", { name: /Add to comparison/i }).click();
  // Navigate to compare
  await page.goto("/compare");
  await expect(page.getByRole("link", { name: "Technical University of Munich" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "KTH Royal Institute of Technology" }).first()).toBeVisible();
  await captureScreenshot(page, "06-compare-two");
  // Reload — selection should persist
  await page.reload();
  await expect(page.getByRole("link", { name: "Technical University of Munich" }).first()).toBeVisible();
});

// ─── Review composer ─────────────────────────────────────────────────────────

test("review form validates empty submission", async ({ page }) => {
  await page.goto("/universities/tum");
  await page.getByRole("button", { name: /Write a review/i }).first().click();
  // Submit without filling in anything
  await page.getByRole("button", { name: /Save draft/i }).click();
  await expect(page.getByText(/Please select a rating/i)).toBeVisible();
  await expect(page.getByText(/Title is required/i)).toBeVisible();
});

test("review form saves successfully to localStorage", async ({ page }) => {
  await page.goto("/universities/unibo");
  await page.getByRole("button", { name: /Write a review/i }).first().click();
  // Select 4 stars
  await page.getByRole("button", { name: /4 stars/i }).click();
  // Fill title
  await page.getByLabel("Title").fill("Great experience");
  // Fill body (use the textarea specifically)
  await page.locator("#review-body").fill("This was a truly wonderful university experience that I thoroughly enjoyed during my time there.");
  await page.getByRole("button", { name: /Save draft/i }).click();
  await expect(page.getByText(/Saved on this device · demo, not published/i)).toBeVisible();
  // Verify localStorage
  const stored = await page.evaluate(() => localStorage.getItem("student-rankz-pending-reviews"));
  expect(stored).toBeTruthy();
  const reviews = JSON.parse(stored!);
  expect(reviews.length).toBeGreaterThan(0);
  expect(reviews[0].title).toBe("Great experience");
});

test("saved review does not appear in public review count", async ({ page }) => {
  await page.goto("/universities/unibo");
  // Get initial review count displayed
  const countText = await page.getByText(/\d+ demo reviews/).first().textContent();
  // Write a review
  await page.getByRole("button", { name: /Write a review/i }).first().click();
  await page.getByRole("button", { name: /4 stars/i }).click();
  await page.getByLabel("Title").fill("My review");
  await page.locator("#review-body").fill("This is a test review body that is long enough to pass validation checks.");
  await page.getByRole("button", { name: /Save draft/i }).click();
  await page.getByRole("button", { name: /Close/i }).first().click();
  // Count should not have changed
  const countAfter = await page.getByText(/\d+ demo reviews/).first().textContent();
  expect(countAfter).toBe(countText);
});

// ─── Theme ───────────────────────────────────────────────────────────────────

test("theme toggle switches to dark mode", async ({ page }) => {
  await page.goto("/");
  // Click theme toggle
  await page.getByRole("button", { name: /Toggle theme/i }).click();
  await page.getByText("Dark").click();
  // Check dark class applied to html
  const htmlClass = await page.locator("html").getAttribute("class");
  expect(htmlClass).toContain("dark");
  await captureScreenshot(page, "07-home-dark");
});

// ─── Mobile overflow ─────────────────────────────────────────────────────────

test("mobile: no horizontal overflow on home", async ({ page, browserName }) => {
  // Only run in viewport-aware tests
  if (page.viewportSize()!.width > 600) return;
  await page.goto("/");
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2); // allow 2px tolerance
  await captureScreenshot(page, "08-home-mobile");
});

test("mobile: no horizontal overflow on universities page", async ({ page }) => {
  if (page.viewportSize()!.width > 600) return;
  await page.goto("/universities");
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  await captureScreenshot(page, "09-universities-mobile");
});
