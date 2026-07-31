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
  // No manualChunks here, deliberately. Two attempts at hand-splitting the vendors both
  // went wrong, and the second one shipped a white screen:
  //
  //   1. The object form makes Vite synthesise a module that imports every listed package
  //      from the entry, which dragged maps/charts/PDF back into the initial download and
  //      undid the route splitting.
  //   2. The function form split react and @supabase/@tanstack into sibling chunks that
  //      ended up importing each other. Rollup cannot order a cycle, so vendor-data
  //      evaluated first and blew up on `undefined.createContext` before React existed.
  //
  // Rollup's automatic chunking already gives each lazy route its own chunk and hoists
  // genuinely shared code into shared chunks, without either failure mode. Any future
  // attempt to hand-split must be verified by loading the built output in a browser and
  // checking the console, not just by reading the chunk sizes.

});
