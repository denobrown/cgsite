// scripts/lib/collect-inline-script-hashes.mjs
//
// Platform-agnostic core: walks the built dist/ output, finds every INLINE
// <script> element — any <script> tag with no `src` attribute, regardless
// of its `type` — and returns the exact set of SHA-256/base64 hashes CSP
// needs for script-src. Both scripts/generate-headers-netlify.mjs and
// scripts/generate-headers-vercel.mjs call this and only differ in what
// file format they write the result into.
//
// HISTORY — why this uses a real HTML parser (parse5) instead of a regex:
//
// Version 1 only matched `type="application/ld+json"`, which broke silently
// the moment other inline scripts (bootstrap loaders, @vercel/speed-insights'
// own injected script) were added elsewhere on the site — none of them had
// that exact type, so they went unhashed. Fixed by matching any src-less
// <script> regardless of type.
//
// Version 2 (the regex fix above) had a SECOND, more serious bug: regex has
// no concept of an HTML comment. Layout.astro contains a documentation
// comment that describes this exact pattern using the literal text
// `<script type="application/ld+json">` for human readers. The regex
// matched that literal text INSIDE the comment as if it were a real
// opening tag, then consumed everything up to the *next* real `</script>`
// as its "content" — silently swallowing the real Organization/WebSite
// JSON-LD script (present on every single page) into a corrupted match
// and computing the WRONG hash for it. That script would have been
// blocked by CSP in every visitor's browser. This was caught by manually
// tracing a suspicious-looking match, not by the generator's own
// self-check — which was circular (it re-used the same buggy regex to
// verify itself, so it always agreed with its own mistake).
//
// A parser doesn't have this failure mode: it tokenizes the document the
// same way a browser does, so text inside a comment is never mistaken for
// a real tag, regardless of what that text happens to contain.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseFragment } from "parse5";

async function walkHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkHtmlFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

function sha256Base64(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("base64");
}

/** Depth-first walk of a parse5 tree, collecting every <script> node. */
function findScriptNodes(node, out = []) {
  if (node.tagName === "script") out.push(node);
  if (node.childNodes) {
    for (const child of node.childNodes) findScriptNodes(child, out);
  }
  return out;
}

function hasSrcAttribute(scriptNode) {
  return (scriptNode.attrs || []).some((attr) => attr.name === "src");
}

/** parse5 stores a <script>'s text content as a single text child node. */
function getScriptTextContent(scriptNode) {
  const textChild = (scriptNode.childNodes || []).find((c) => c.nodeName === "#text");
  return textChild ? textChild.value : "";
}

export async function collectInlineScriptHashes(distDir) {
  const htmlFiles = await walkHtmlFiles(distDir);
  const hashes = new Set();
  let scriptCount = 0;

  for (const file of htmlFiles) {
    const html = await fs.readFile(file, "utf8");
    const tree = parseFragment(html, { sourceCodeLocationInfo: false });
    const scriptNodes = findScriptNodes(tree);

    for (const node of scriptNodes) {
      if (hasSrcAttribute(node)) continue; // external file — covered by 'self'
      const text = getScriptTextContent(node);
      if (text.trim().length === 0) continue;
      hashes.add(`sha256-${sha256Base64(text)}`);
      scriptCount += 1;
    }
  }

  return { hashes: Array.from(hashes), scriptCount, fileCount: htmlFiles.length };
}

export const BASE_DIRECTIVES = {
  "default-src": ["'self'"],
  "style-src": ["'self'"],
  "img-src": ["'self'", "data:", "https:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'", "https://api.open-meteo.com"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'none'"],
  "object-src": ["'none'"],
};

export function buildCspString(inlineScriptHashes) {
  const scriptSrc = ["'self'", ...inlineScriptHashes.map((h) => `'${h}'`)];
  const lines = [`script-src ${scriptSrc.join(" ")}`];
  for (const [directive, sources] of Object.entries(BASE_DIRECTIVES)) {
    lines.push(`${directive} ${sources.join(" ")}`);
  }
  lines.push("upgrade-insecure-requests");
  return lines.join("; ") + ";";
}
