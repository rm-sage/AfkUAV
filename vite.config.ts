import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";

// Alt1 1.6.0 embeds CEF 108.4.13 (Chromium 108.0.5359.125). Building above that
// silently ships syntax the host cannot parse, so the target is pinned here and
// must not be raised without re-checking the host's CEF version.
export default defineConfig({
  plugins: [preact()],
  base: "./",
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "chrome108",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
