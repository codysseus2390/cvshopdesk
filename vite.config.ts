import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
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
