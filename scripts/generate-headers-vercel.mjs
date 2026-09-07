#!/usr/bin/env node
// scripts/generate-headers-vercel.mjs
//
// Vercel has no dist/_headers equivalent, and its dynamic-config option
// (vercel.ts) has execution-order semantics that aren't clearly documented
// to run AFTER the framework build completes — which is exactly when this
// needs to run, since it has to read the actual built HTML to hash the
// JSON-LD blocks in it. Rather than guess at an uncertain mechanism for a
// production security header, this uses the certain, well-documented path:
// a plain `vercel.json` at the repo root, regenerated from a real local (or
// CI) build and committed before each deploy.
//
// WORKFLOW:
//   1. `npm run build` (astro build && this script) — regenerates
//      vercel.json's `headers` array from the fresh dist/ output.
//   2. Commit the updated vercel.json alongside your content changes.
//   3. Push — Vercel's git integration deploys using the vercel.json in
//      that commit.
//
// This script only ever touches the `headers` key. Everything else already
// in vercel.json (crons, functions, anything you hand-add later) is read
// back in unchanged — see the object spread below.

import { promises as fs } from "node:fs";
import path from "node:path";
import { collectInlineScriptHashes, buildCspString } from "./lib/collect-inline-script-hashes.mjs";

const DIST_DIR = path.resolve(process.cwd(), "dist");
const VERCEL_JSON_PATH = path.resolve(process.cwd(), "vercel.json");

function buildHeadersArray(csp) {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        { key: "Content-Security-Policy", value: csp },
      ],
    },
    {
      source: "/_astro/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      source: "/scripts/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }],
    },
  ];
}

async function main() {
  try {
    await fs.access(DIST_DIR);
  } catch {
    console.error(`[generate-headers-vercel] dist/ not found at ${DIST_DIR} — run "astro build" first.`);
    process.exitCode = 1;
    return;
  }

  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(VERCEL_JSON_PATH, "utf8"));
  } catch {
    console.warn("[generate-headers-vercel] No existing vercel.json found — creating a new one.");
  }

  const { hashes, scriptCount, fileCount } = await collectInlineScriptHashes(DIST_DIR);
  const csp = buildCspString(hashes);

  const updated = {
    ...existing,
    headers: buildHeadersArray(csp),
  };

  await fs.writeFile(VERCEL_JSON_PATH, JSON.stringify(updated, null, 2) + "\n", "utf8");

  console.log(
    `[generate-headers-vercel] Scanned ${fileCount} HTML file(s), found ${scriptCount} ` +
      `inline script(s), ${hashes.length} unique hash(es). Wrote vercel.json.`
  );
  console.log(
    "[generate-headers-vercel] Remember: commit this updated vercel.json before pushing — " +
      "Vercel reads it as static, version-controlled config, not something it regenerates itself."
  );
}

main();
