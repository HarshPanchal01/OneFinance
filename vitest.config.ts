import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate from vite.config.ts so the Electron build plugin is not loaded during
// unit tests. The crypto utilities are pure Node code, so a node environment is enough.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["electron/**/*.test.ts"],
  },
});
