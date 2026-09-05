import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", assetsDir: "assets" },
  server: { host: true },  // host:true lets you open the dev server on your phone
});
