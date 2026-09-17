import { defineConfig } from "vitest/config";
import path from "node:path";

// Standalone vitest config — kept separate from vite.config.ts so the
// Cloudflare/TanStack Start build pipeline isn't disturbed by the test
// runner's environment.
export default defineConfig({
  test: {
    environment: "happy-dom",
    // Lazy-loaded tool chunks can take a while when suites run in parallel.
    testTimeout: 20000,
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
