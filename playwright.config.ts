import { defineConfig, devices } from "@playwright/test";

// Port 3001 by default. Set PLAYWRIGHT_PORT to run the suite in a separate
// worktree without clashing with another local server, e.g.:
//   PLAYWRIGHT_PORT=3127 npx playwright test
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3001);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  testIgnore: "**/integration/**",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "test-results/smoke",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      APP_ORIGIN: "",
      CATALOG_MODE: "production",
      DATABASE_URL: "",
      DATABASE_DIRECT_URL: "",
      NEON_AUTH_BASE_URL: "",
      NEON_AUTH_COOKIE_SECRET: "",
    },
  },
});
