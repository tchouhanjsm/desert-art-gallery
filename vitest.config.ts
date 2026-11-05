import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Keep Vitest module resolution aligned with the Next.js tsconfig alias.
// Integration suites import server modules directly, so their transitive
// "@/..." imports must resolve in the test runner as well.
export default defineConfig({
  // Match Next.js's automatic React JSX runtime so component tests exercise
  // the same JSX compilation contract as the application build.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});
