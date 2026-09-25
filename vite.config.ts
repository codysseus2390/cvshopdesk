import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  define: {
    // Vercel sets VERCEL_ENV ("production" | "preview" | "development") at build
    // time but doesn't expose it to client code on its own — bake it in here so
    // routes can tell a real Production deploy apart from a PR Preview build.
    "import.meta.env.VITE_DEPLOY_ENV": JSON.stringify(process.env["VERCEL_ENV"] ?? "development"),
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Keep TanStack Start's server entry on src/server.ts (SSR error wrapper).
      server: { entry: "server" },
    }),
    // Required for Vercel / TanStack Start server builds after dropping
    // @lovable.dev/vite-tanstack-config (that package previously wired Nitro).
    nitro(),
    react(),
  ],
});
