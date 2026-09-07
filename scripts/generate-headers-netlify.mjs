#!/usr/bin/env node
// scripts/generate-headers-netlify.mjs
//
// Writes dist/_headers for a Netlify deploy. Kept in the repo in case this
// project is ever pointed back at Netlify (see netlify.toml) — not run by
// the default `npm run build`, which now targets Vercel. Run explicitly via
// `npm run build:netlify` if needed.

import { promises as fs } from "node:fs";
import path from "node:path";
import { collectInlineScriptHashes, buildCspString } from "./lib/collect-inline-script-hashes.mjs";

const DIST_DIR = path.resolve(process.cwd(), "dist");

function buildHeadersFile(csp) {
  return `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: ${csp}

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/scripts/*
  Cache-Control: public, max-age=3600, must-revalidate
`;
}

async function main() {
  try {
    await fs.access(DIST_DIR);
  } catch {
    console.error(`[generate-headers-netlify] dist/ not found at ${DIST_DIR} — run "astro build" first.`);
    process.exitCode = 1;
    return;
  }

  const { hashes, scriptCount, fileCount } = await collectInlineScriptHashes(DIST_DIR);
  const csp = buildCspString(hashes);
  await fs.writeFile(path.join(DIST_DIR, "_headers"), buildHeadersFile(csp), "utf8");

  console.log(
    `[generate-headers-netlify] Scanned ${fileCount} HTML file(s), found ${scriptCount} ` +
      `inline script(s), ${hashes.length} unique hash(es). Wrote dist/_headers.`
  );
}

main();
