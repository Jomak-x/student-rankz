import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { universities, type University } from "../lib/demo-data";
import { rankUniversities, RANKINGS_LIMIT } from "../lib/rankings";
import { RankingsList } from "../components/rankings-list";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function captureScreenshot(page: Page, name: string, projectName: string) {
  const dir = path.join(__dirname, `../test-screenshots/${projectName}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

function uni(overrides: Partial<University> & Pick<University, "id" | "name">): University {
  return {
    city: "X",
    country: "Y",
    countryCode: "XY",
    founded: 2000,
    type: "public",
    website: "",
    description: "",
    studentCount: 1000,
    scores: {
      overall: 1,
      teaching: 1,
      support: 1,
      facilities: 1,
      administration: 1,
      value: 1,
      socialLife: 1,
    },
    reviewCount: 0,
    tags: [],
    ...overrides,
  };
}

// ─── Ranking logic (pure, deterministic) ─────────────────────────────────────

test.describe("rankUniversities", () => {
  test("orders fixture universities by score desc, reviews desc, name asc", () => {
    const ranked = rankUniversities(universities);
    expect(ranked.map((r) => r.university.id)).toEqual([
      "kth", // 4.4
      "tum", // 4.3, 312 reviews (beats uhelsinki on count)
      "uhelsinki", // 4.3, 142 reviews
      "umaastricht", // 4.2
      "sorbonne", // 4.1, 241 reviews (beats lmu on count)
      "lmu", // 4.1, 228 reviews
      "unibo", // 4.0
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("breaks full ties alphabetically", () => {
    const a = uni({ id: "a", name: "Beta University", scores: { ...uni({ id: "a", name: "" }).scores, overall: 4.0 }, reviewCount: 10 });
    const b = uni({ id: "b", name: "Alpha University", scores: { ...uni({ id: "b", name: "" }).scores, overall: 4.0 }, reviewCount: 10 });
    const ranked = rankUniversities([a, b]);
    expect(ranked.map((r) => r.university.name)).toEqual([
      "Alpha University",
      "Beta University",
    ]);
  });

  test("caps the list at the limit and assigns consecutive ranks", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      uni({
        id: `u${i}`,
        name: `University ${String.fromCharCode(65 + i)}`,
        scores: { ...uni({ id: "x", name: "" }).scores, overall: 5 - i * 0.1 },
        reviewCount: 100,
      })
    );
    const ranked = rankUniversities(many, RANKINGS_LIMIT);
    expect(ranked).toHaveLength(10);
    expect(ranked[0].university.id).toBe("u0");
    expect(ranked[9].university.id).toBe("u9");
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("empty input yields an empty ranking (no invented entries)", () => {
    expect(rankUniversities([])).toEqual([]);
  });

  test("does not mutate the input array", () => {
    const input = [...universities];
    rankUniversities(input);
    expect(input).toEqual(universities);
  });
});

// ─── Empty state (static render, no data invented) ──────────────────────────

test.describe("rankings empty state", () => {
  test("renders an honest empty state with no university rows", () => {
    const html = renderToStaticMarkup(React.createElement(RankingsList, { items: [] }));
    expect(html).toContain("No universities to rank yet");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("/universities/");
  });
});

// ─── Rankings page ───────────────────────────────────────────────────────────

const EXPECTED_ORDER = [
  "KTH Royal Institute of Technology",
  "Technical University of Munich",
  "University of Helsinki",
  "Maastricht University",
  "Sorbonne University",
  "Ludwig Maximilian University",
  "University of Bologna",
];

test("rankings page lists all sample universities in ranked order with disclosure", async ({ page }, info) => {
  await page.goto("/rankings");
  await expect(page.getByRole("heading", { name: /Top 10 universities/i })).toBeVisible();
  await expect(page.getByText(/not academic prestige/i)).toBeVisible();
  await expect(page.getByText(/Showing 7 of 7/i)).toBeVisible();
  await expect(page.getByText(/demo data/i).first()).toBeVisible();

  const rows = page.locator("ol[aria-label='University rankings'] a");
  await expect(rows).toHaveCount(7);
  const texts = await rows.allTextContents();
  EXPECTED_ORDER.forEach((name, i) => {
    expect(texts[i]).toContain(name);
  });
  // Prominent consecutive rank numerals
  await expect(page.locator("ol[aria-label='University rankings'] li").first()).toContainText("1");
  await expect(page.locator("ol[aria-label='University rankings'] li").last()).toContainText("7");
  // Sample-vs-real labelling on scores/counts
  await expect(page.getByText(/sample reviews/i).first()).toBeVisible();

  if (info.project.name === "desktop") {
    await captureScreenshot(page, "01-rankings-light", info.project.name);
  }
});

test("rankings page dark mode", async ({ page }, info) => {
  await page.goto("/rankings");
  await page.getByRole("button", { name: /Toggle theme/i }).click();
  await page.getByText("Dark").click();
  await page.waitForTimeout(200);
  const htmlClass = await page.locator("html").getAttribute("class");
  expect(htmlClass).toContain("dark");
  if (info.project.name === "desktop") {
    await captureScreenshot(page, "02-rankings-dark", info.project.name);
  }
  await page.getByRole("button", { name: /Toggle theme/i }).click();
  await page.getByText("System").click();
});

test("header rankings navigation works on desktop and mobile", async ({ page }) => {
  await page.goto("/");
  const isMobile = page.viewportSize()!.width < 640;
  if (isMobile) {
    await page.getByRole("button", { name: /Open navigation menu/i }).click();
  }
  await page.getByRole("link", { name: "Rankings", exact: true }).click();
  await expect(page).toHaveURL("/rankings");
  await expect(page.getByRole("heading", { name: /Top 10 universities/i })).toBeVisible();
});

test("home rankings preview shows top three and links to full rankings", async ({ page }, info) => {
  await page.goto("/");
  const previewRows = page.locator("ol[aria-label='University rankings'] a");
  await expect(previewRows).toHaveCount(3);
  const texts = await previewRows.allTextContents();
  expect(texts[0]).toContain(EXPECTED_ORDER[0]);
  expect(texts[1]).toContain(EXPECTED_ORDER[1]);
  expect(texts[2]).toContain(EXPECTED_ORDER[2]);

  await page.getByRole("link", { name: /All rankings/i }).click();
  await expect(page).toHaveURL("/rankings");

  if (info.project.name === "desktop") {
    await page.goto("/");
    await captureScreenshot(page, "04-home-preview", info.project.name);
  }
});

test("no horizontal overflow on rankings page", async ({ page }, info) => {
  await page.goto("/rankings");
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  if (page.viewportSize()!.width < 640) {
    await captureScreenshot(page, "03-rankings-mobile", info.project.name);
  }
});

// ─── Composer saveError regression ───────────────────────────────────────────

test("failed save clears its error banner after a successful save or new draft", async ({ page }) => {
  // Make writes to the pending-reviews key fail until the test flips the flag.
  await page.addInitScript(() => {
    const w = window as unknown as { __failPendingWrites?: boolean };
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (w.__failPendingWrites === true && key === "student-rankz-pending-reviews") {
        throw new DOMException("QuotaExceededError");
      }
      return original.call(this, key, value);
    };
    w.__failPendingWrites = true;
  });

  await page.goto("/universities/unibo");
  await page.getByRole("button", { name: /Write a review/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /4 stars/i }).click();
  await page.getByLabel("Title").fill("Persistence regression");
  await page.locator("#review-body").fill("This body is long enough to pass the composer validation checks.");

  // 1) Failing storage → visible error banner
  await page.getByRole("button", { name: /Save draft/i }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/Could not save/i);

  // 2) Storage works again → save succeeds, banner gone, success view shown
  await page.evaluate(() => {
    (window as unknown as { __failPendingWrites?: boolean }).__failPendingWrites = false;
  });
  await page.getByRole("button", { name: /Save draft/i }).click();
  await expect(page.getByText(/Saved on this device/i)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  // 3) "Write another" → fresh form with no stale failure banner
  await page.getByRole("button", { name: /Write another/i }).click();
  await expect(page.getByRole("dialog").getByText(/Could not save/i)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible();
});
