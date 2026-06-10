import { defineConfig } from "vitest/config";
import fs from "fs";
import path from "path";

// Config dedicada para tests de integración contra Supabase real.
// Se ejecuta con: npm run test:integration
// Requiere en .env/.env.local:
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function loadDotEnvFiles(): void {
  for (const file of [".env", ".env.local"]) {
    const fullPath = path.resolve(__dirname, file);
    if (!fs.existsSync(fullPath)) continue;
    for (const rawLine of fs.readFileSync(fullPath, "utf8").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      if (!REQUIRED_KEYS.includes(key) || process.env[key]) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

loadDotEnvFiles();

export default defineConfig({
  test: {
    globals: true,
    include: ["__tests__/integration/**/*.test.ts"],
    // Una sola conexión lógica contra la BD remota: los archivos corren en
    // serie para que los sweeps/cleanups no compitan entre sí.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globalSetup: ["__tests__/integration/helpers/globalSetup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});