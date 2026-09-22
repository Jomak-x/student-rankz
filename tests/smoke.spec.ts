import { expect, test } from "@playwright/test";

const unavailable = "The directory is not available yet";

for (const route of ["/", "/universities", "/courses"]) {
  test(`unconfigured ${route} shows no invented catalog or browser errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: unavailable }).first()).toBeVisible();
    await expect(page.locator('main a[href^="/universities/"], main a[href^="/courses/"], main a[href^="/instructors/"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Write a review" })).toHaveCount(0);
    await expect(page.getByText("Demo · sample data", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("header navigation works at desktop and mobile widths", async ({ page }, info) => {
  await page.goto("/");
  const mobile = info.project.name === "mobile";
  for (const [label, route] of [["Universities", "/universities"], ["Courses", "/courses"], ["Compare", "/compare"]]) {
    if (mobile) await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("navigation", { name: mobile ? "Mobile navigation" : "Main navigation", exact: true }).getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(route);
    if (mobile) await expect(page.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");
  }
  await expect(page.getByRole("heading", { name: "No universities selected" })).toBeVisible();
  await page.getByRole("link", { name: "Student Rankz home" }).click();
  await expect(page).toHaveURL("/");
});

test("theme selection survives navigation and reload", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["Dark", "Light"]) {
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.getByRole("menuitem", { name: theme, exact: true }).click();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme.toLowerCase()));
    await page.goto("/universities");
    await page.reload();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme.toLowerCase()));
  }
});
