import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Only pin the vendors the entry genuinely needs, so they get their own
        // long-lived cacheable chunks. Everything heavy (maps, charts, xlsx, jspdf) is
        // reached solely through lazy routes — Rollup already hoists those into shared
        // chunks that load on demand, and pinning them here only risks creating an
        // import edge from the entry that would put them back in the initial download.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id))
            return "vendor-react";
          if (/node_modules\/(@supabase|@tanstack)\//.test(id)) return "vendor-data";
        },
      },
    },
  },
});
