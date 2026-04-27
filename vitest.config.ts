import { defineConfig } from "vitest/config";
import path from "node:path";

// Standalone vitest config — kept separate from vite.config.ts so the
// Cloudflare/TanStack Start build pipeline isn't disturbed by the test
// runner's environment.
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
