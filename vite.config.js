import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project sites are served from /repository-name/.
// Set VITE_BASE_PATH to your repository name during deployment if needed.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "./",
});