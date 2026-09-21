import { defineConfig, devices } from "@playwright/test";

const states = [
  { name: "demo", port: 3128, database: "INTEGRATION_DEMO_DATABASE_URL" },
  { name: "empty", port: 3129, database: "INTEGRATION_EMPTY_DATABASE_URL" },
  { name: "outage", port: 3130, database: "INTEGRATION_OUTAGE_DATABASE_URL" },
] as const;

if (!process.argv.includes("--list")) {
  for (const state of states) {
    if (!process.env[state.database]) {
      throw new Error("Run npm run test:integration to provision isolated databases before starting Playwright.");
    }
  }
}

// Database URLs are private child-process environment, never command arguments.
export default defineConfig({
  testDir: "./tests/integration",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "test-results/integration",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: states.flatMap(state => [
    {
      name: `${state.name}-desktop`,
      testMatch: state.name === "demo" ? "catalog.spec.ts" : "availability.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${state.port}` },
    },
    {
      name: `${state.name}-mobile`,
      testMatch: state.name === "demo" ? "catalog.spec.ts" : "availability.spec.ts",
      use: { ...devices["Pixel 5"], browserName: "chromium" as const, baseURL: `http://localhost:${state.port}` },
    },
  ]),
  webServer: states.map(state => ({
    command: `node node_modules/next/dist/bin/next start --port ${state.port}`,
    url: `http://localhost:${state.port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM" as const, timeout: 5_000 },
    env: {
      APP_ORIGIN: `http://localhost:${state.port}`,
      DATABASE_URL: process.env[state.database] ?? "",
      DATABASE_DIRECT_URL: "",
      DATABASE_TRANSPORT: "postgres",
      CATALOG_MODE: state.name === "demo" ? "demo" : "",
      NEON_AUTH_BASE_URL: "",
      NEON_AUTH_COOKIE_SECRET: "",
    },
  })),
});
