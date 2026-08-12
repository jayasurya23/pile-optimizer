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
  },
});
