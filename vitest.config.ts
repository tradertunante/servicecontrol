import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    // Los tests de integración (Supabase real) corren aparte:
    // npm run test:integration → vitest.integration.config.ts
    exclude: ["**/node_modules/**", "__tests__/integration/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
