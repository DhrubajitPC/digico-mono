import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Dashboard proxy to Fastify backend API on 8787
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
