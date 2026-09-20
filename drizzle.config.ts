import { defineConfig } from "drizzle-kit";

// drizzle-kit configuration. DATABASE_URL is only required for commands that
// connect to a database (push, migrate, studio, pull); `generate` works
// without one. Local .env is loaded when present (Node >= 20.12).
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
    url: process.env.DATABASE_URL ?? "",
  },
});
