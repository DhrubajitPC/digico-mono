import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    // Dashboard is read-only + unauthenticated for now; proxy avoids CORS entirely.
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
