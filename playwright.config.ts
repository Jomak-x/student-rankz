import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
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
    command: "npm run start -- --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
