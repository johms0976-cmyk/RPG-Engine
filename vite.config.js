import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "/<repo-name>/" when deploying to GitHub Pages from a project repo.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || "/",
});
