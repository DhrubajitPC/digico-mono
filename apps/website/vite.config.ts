import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  envDir: "../../",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Dashboard proxy to Fastify backend API on 8787
    proxy: {
      "/api": "http://localhost:8787",
      "/trpc": "http://localhost:8787",
    },
  },
});
