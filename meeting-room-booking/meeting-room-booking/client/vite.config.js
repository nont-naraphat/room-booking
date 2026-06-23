import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ระหว่าง dev: proxy /api และ /auth ไปที่ backend (พอร์ต 4000)
// เพื่อให้ cookie session ทำงานบน origin เดียวกัน
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/auth": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
