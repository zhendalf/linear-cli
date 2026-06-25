import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node20",
  banner: {
    js: "#!/usr/bin/env node",
  },
  bundle: true,
  clean: true,
  outDir: "dist",
  sourcemap: true,
  // Ensure package.json is available for version import
  noExternal: ["package.json"],
});
