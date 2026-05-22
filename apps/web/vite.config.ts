import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BRIDGE_URL = process.env.VITE_BRIDGE_URL ?? "http://localhost:8080";

// Injected at build time so the running SPA can announce its build
// identity. Available as `__SPA_BUILD__` in source, logged to the
// console on boot. Used to verify the browser actually loaded the
// freshly-built bundle vs. a cached older one — F12 → Console will
// show the build marker, and if it doesn't match what was just built,
// you're looking at a cached page.
const SPA_BUILD = new Date().toISOString();

// During dev, Vite proxies /api and /openapi.json to the bridge so the
// browser sees the same origin and JWT bearer headers work end-to-end.
export default defineConfig({
  plugins: [react()],
  define: {
    __SPA_BUILD__: JSON.stringify(SPA_BUILD),
  },
  // Relative base: generated `<script src="./assets/…">` + `<base href="./">`
  // resolve against the URL the SPA was actually served from. This is what
  // makes the same bundle work behind HA ingress (`/api/hassio_ingress/TOKEN/`)
  // AND when served directly on port 8080, without conditional builds.
  base: "./",
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BRIDGE_URL, changeOrigin: true },
      "/openapi.json": { target: BRIDGE_URL, changeOrigin: true },
    },
  },
  build: { outDir: "dist", sourcemap: true },
});
