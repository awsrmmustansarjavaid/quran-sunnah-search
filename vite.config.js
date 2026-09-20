// Import Vite's configuration helper.
// defineConfig provides better editor support and makes the
// configuration easier to understand.
import { defineConfig } from "vite";

// Import the React plugin used by Vite.
// This enables Vite to correctly process React JSX/TSX files.
import react from "@vitejs/plugin-react";

// ============================================================
// VITE CONFIGURATION
// ============================================================
//
// This project is deployed to GitHub Pages.
//
// GitHub Pages URL:
// https://awsrmmustansarjavaid.github.io/quran-sunnah-search/
//
// Because the application is hosted inside the repository
// subdirectory "/quran-sunnah-search/", Vite must know about
// this base path.
//
// Without the correct base path, JavaScript, CSS, images,
// fonts, and other generated assets may be requested from:
//
// https://awsrmmustansarjavaid.github.io/assets/
//
// instead of:
//
// https://awsrmmustansarjavaid.github.io/quran-sunnah-search/assets/
//
// That can result in a blank page after deployment.
// ============================================================

export default defineConfig({
  // ----------------------------------------------------------
  // React Plugin
  // ----------------------------------------------------------
  //
  // Enables React support for the Vite application.
  //
  // The plugin handles JSX transformation and React Fast
  // Refresh during local development.
  plugins: [react()],

  // ----------------------------------------------------------
  // Base Path
  // ----------------------------------------------------------
  //
  // GitHub Actions provides VITE_BASE_PATH during deployment:
  //
  // VITE_BASE_PATH: /quran-sunnah-search/
  //
  // We use that value when it exists.
  //
  // The fallback value makes the configuration safe when you
  // run a production build locally without setting the
  // VITE_BASE_PATH environment variable.
  //
  // IMPORTANT:
  // The trailing "/" is intentional.
  // ----------------------------------------------------------
  base: process.env.VITE_BASE_PATH || "/quran-sunnah-search/",
});

