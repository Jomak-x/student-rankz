import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/auth/**/*.test.{ts,tsx}"],
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ["./tests/auth/setup.ts"],
    // Transform the SDK so its Next request APIs can be mocked in transport tests.
    server: { deps: { inline: ["@neondatabase/auth"] } },
  },
});
