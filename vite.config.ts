import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Never ship source maps publicly; heavy PDF/export libs are lazy-loaded
    // so the warning threshold only needs to cover genuinely large chunks.
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
});
