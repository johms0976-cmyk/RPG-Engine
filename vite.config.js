import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A relative base means the built site works wherever it is served from —
// user page, project page (/RPG-Engine/), a /docs folder, or file://.
// BASE_PATH can still override it if you ever need an absolute base.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || "./",
});
