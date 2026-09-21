import { expect, test } from "@playwright/test";

test("unconfigured rankings explain availability without fabricated ranks or scores", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const response = await page.goto("/rankings");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "The directory is not available yet" })).toBeVisible();
  await expect(page.locator('main a[href^="/universities/"]')).toHaveCount(0);
  await expect(page.getByText("The directory is temporarily unavailable", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Demo · sample data", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  expect(errors).toEqual([]);
});

test("rankings remain reachable from the unconfigured home", async ({ page }, info) => {
  await page.goto("/");
  const mobile = info.project.name === "mobile";
  if (mobile) await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.getByRole("navigation", { name: mobile ? "Mobile navigation" : "Main navigation", exact: true }).getByRole("link", { name: "Rankings", exact: true }).click();
  await expect(page).toHaveURL("/rankings");
  await expect(page.getByRole("heading", { name: "The directory is not available yet" })).toBeVisible();
});
