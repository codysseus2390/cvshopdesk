import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests load no hosting plugins and cannot connect to the database.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { SUPABASE_DB_URL: "" },
  },
});
