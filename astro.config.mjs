import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// CloudGrid Africa — cloudgridafrica.com
// Fully static build. No SSR adapter: every route below compiles to plain
// HTML/CSS at build time. The only runtime JavaScript on the site lives in
// public/scripts/*.js — small, single-purpose, externally-hosted modules
// (never inline <script> blocks) so that netlify.toml's CSP can pin
// `script-src 'self'` without hash recomputation on every content edit.
export default defineConfig({
  site: "https://cloudgridafrica.com",
  output: "static",
  build: {
    format: "directory",
    // Force all component CSS into external files rather than inlining any
    // of it into <style> tags. Paired with the CSP in netlify.toml, this
    // means style-src never needs 'unsafe-inline' or a hash list either.
    inlineStylesheets: "never",
  },
  integrations: [
    tailwind({
      applyBaseStyles: false, // we own the base layer in src/styles/global.css
    }),
    sitemap(),
  ],
  compressHTML: true,
});
