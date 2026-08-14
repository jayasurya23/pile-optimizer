import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset URLs relative so the built bundle works from any
// sub-path (e.g. /civil/pile-optimizer/) without a rebuild.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    // Dev API: uvicorn server.main:app on 8001 with LOCAL_DEV_MODE=1
    proxy: {
      "/api": "http://127.0.0.1:8001",
    },
  },
});
