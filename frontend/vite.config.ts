import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // one .env.local at the repo root for backend and frontend; only VITE_*
  // variables ever reach the browser
  envDir: "..",
  server: {
    port: 5173,
    // the design tokens live in ../replica/design (one source of truth)
    fs: { allow: [".."] },
    // same origin as production (FastAPI serves both), so no CORS
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
