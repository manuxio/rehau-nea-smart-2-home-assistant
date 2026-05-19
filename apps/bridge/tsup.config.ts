import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
  // Keep these external — heavier deps that don't need bundling.
  external: ["bcrypt", "pino-pretty"],
  // Workspace packages (`@rehau/*`) are not present in the HA addon's
  // node_modules at runtime, so they MUST be inlined into the bundle.
  // tsup defaults to treating every package.json dependency as external —
  // this regex overrides that for our internal monorepo packages.
  noExternal: [/^@rehau\//],
});
