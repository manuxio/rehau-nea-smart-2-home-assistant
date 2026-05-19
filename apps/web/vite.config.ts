import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BRIDGE_URL = process.env.VITE_BRIDGE_URL ?? "http://localhost:8080";

// During dev, Vite proxies /api and /openapi.json to the bridge so the
// browser sees the same origin and JWT bearer headers work end-to-end.
export default defineConfig({
  plugins: [react()],
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
