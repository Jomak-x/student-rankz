import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Production server has blank auth config. No synthetic credentials or bypass routes.
test("auth sign-in is unavailable and unsafe return paths stay local", async ({ page }, info) => {
  await page.goto("/sign-in?next=https://external.example/path");
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  await expect(page.getByText("Account access is temporarily unavailable")).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up?next=%2Faccount");
  await mkdir(`test-screenshots/${info.project.name}`, { recursive: true });
  await page.screenshot({ path: `test-screenshots/${info.project.name}/auth-sign-in-light.png`, fullPage: true });
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=%2Faccount/);
});

test("auth sign-up is unavailable in dark mode with reciprocal navigation", async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/sign-up?next=/courses");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
  await expect(page.getByLabel("Name", { exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/sign-in?next=%2Fcourses");
  await mkdir(`test-screenshots/${info.project.name}`, { recursive: true });
  await page.screenshot({ path: `test-screenshots/${info.project.name}/auth-sign-up-dark.png`, fullPage: true });
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fcourses/);
});

test("account fails closed and provider endpoints are uncached 503 without config", async ({ page, request }) => {
  await page.goto("/account");
  await expect(page.getByText("Account access is temporarily unavailable")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your account" })).toHaveCount(0);
  for (const response of [await request.get("/api/auth/get-session"), await request.post("/api/auth/sign-out", { data: {} })]) {
    expect(response.status()).toBe(503);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({ error: { message: "Authentication is temporarily unavailable." } });
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
});

test("main navigation connects rankings to the unavailable account", async ({ page }, info) => {
  await page.goto("/rankings");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
  }
  const navigation = page.getByRole("navigation", {
    name: info.project.name === "mobile" ? "Mobile navigation" : "Main navigation",
  });
  await expect(navigation.getByRole("link", { name: "Rankings", exact: true })).toBeVisible();
  await mkdir(`test-screenshots/${info.project.name}`, { recursive: true });
  await page.screenshot({ path: `test-screenshots/${info.project.name}/integration-navigation-light.png`, fullPage: true });
  await navigation.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("status")).toContainText("Account access is temporarily unavailable");
  await expect(page.getByRole("status")).toContainText("You can still browse universities and rankings.");
  if (info.project.name === "mobile") {
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
  }
  await page.screenshot({ path: `test-screenshots/${info.project.name}/integration-account-light.png`, fullPage: true });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await page.screenshot({ path: `test-screenshots/${info.project.name}/integration-account-dark.png`, fullPage: true });
  await page.goto("/rankings");
  await page.screenshot({ path: `test-screenshots/${info.project.name}/integration-rankings-dark.png`, fullPage: true });
});

test("account navigation fits intermediate screen widths", async ({ page }) => {
  for (const width of [640, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/rankings");
    if (width < 768) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    }
    await expect(page.getByRole("link", { name: "Account", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
