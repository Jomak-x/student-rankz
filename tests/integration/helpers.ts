import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";

export async function screenshot(page: Page, info: TestInfo, state: string) {
  const directory = path.resolve("test-screenshots/integration", info.project.name);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${state}.png`), animations: "disabled" });
}

export async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
}

export function expectNoFixtures(page: Page) {
  return expect(page.locator('main a[href="/universities/tum"], main a[href="/universities/kth"], main a[href="/universities/unibo"]')).toHaveCount(0);
}
