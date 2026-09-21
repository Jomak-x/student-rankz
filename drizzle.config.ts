import { defineConfig } from "drizzle-kit";

import { resolveMigrationUrl } from "./db/config";

// drizzle-kit configuration. A database connection is only required for
// commands that connect (push, migrate, studio, pull); `generate` works
// without one. Connection resolution: DATABASE_DIRECT_URL preferred, falling
// back to DATABASE_URL (see db/config.ts). Local .env is loaded when present
// (Node >= 20.12); exported environment variables take precedence over .env.
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the environment instead.
}

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: resolveMigrationUrl(),
  },
});
