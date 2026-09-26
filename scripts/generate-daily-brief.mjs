#!/usr/bin/env node
// scripts/generate-daily-brief.mjs
//
// Writes today's brief to src/content/blog/daily-brief-YYYY-MM-DD.md.
// Run by .github/workflows/daily-brief.yml, which commits the file; Vercel
// then rebuilds the site from the push like any other commit. Nothing here
// needs Vercel environment variables or a personal access token.
//
// Local test: node scripts/generate-daily-brief.mjs   (then git status)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanText, summarize, renderBrief } from "./lib/daily-brief.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLOG = path.join(ROOT, "src/content/blog");

const LANES = [
  { lane: "Africa and Kenya tech", sources: [
    { name: "TechCabal", url: "https://techcabal.com/feed/" },
    { name: "Techpoint Africa", url: "https://techpoint.africa/feed" },
    { name: "Disrupt Africa", url: "https://disrupt-africa.com/feed/" },
  ]},
  { lane: "Security", sources: [
    { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/" },
    { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
    { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml" },
  ]},
  { lane: "Cloud and global tech", sources: [
    { name: "AWS News Blog", url: "https://aws.amazon.com/blogs/aws/feed/" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
    { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  ]},
];

function parseFeed(xml, source) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || [];
  return blocks.slice(0, 10).map((b) => {
    const get = (tag) => (b.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")) || [])[1] || "";
    let link = cleanText(get("link"));
    if (!link) link = (b.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1] || "";
    return {
      title: cleanText(get("title")),
      link: link.trim(),
      summary: summarize(get("description") || get("summary")),
      date: new Date(cleanText(get("pubDate") || get("published") || get("updated")) || 0),
      source: source.name,
    };
  }).filter((i) => i.title && /^https?:\/\//.test(i.link));
}

async function fetchSource(source) {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "CloudGridAfrica-DailyBrief/2.0 (+https://cloudgridafrica.com/blog/)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(await res.text(), source);
  } catch (e) {
    console.warn(`[daily-brief] ${source.name} failed: ${e.message}`);
    return [];
  }
}

async function recentLinks(days = 10) {
  const files = (await fs.readdir(BLOG)).filter((f) => f.startsWith("daily-brief-")).sort().slice(-days);
  const text = (await Promise.all(files.map((f) => fs.readFile(path.join(BLOG, f), "utf8")))).join("\n");
  return new Set([...text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]));
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(BLOG, `daily-brief-${date}.md`);
  try { await fs.access(file); console.log(`[daily-brief] ${date} already exists`); return; } catch {}

  const seen = await recentLinks();
  const cutoff = Date.now() - 3 * 24 * 3600 * 1000; // ignore stale items
  const stories = [];
  for (const { lane, sources } of LANES) {
    const items = (await Promise.all(sources.map(fetchSource))).flat()
      .filter((i) => !seen.has(i.link) && (isNaN(i.date) || i.date.getTime() === 0 || i.date.getTime() > cutoff))
      .sort((a, b) => (b.summary ? 1 : 0) - (a.summary ? 1 : 0) || b.date - a.date);
    if (items[0]) stories.push({ ...items[0], lane });
  }

  if (stories.length < 2) {
    console.log(`[daily-brief] only ${stories.length} usable stories; skipping today`);
    return;
  }
  await fs.writeFile(file, renderBrief({ date, stories }));
  console.log(`[daily-brief] wrote ${path.relative(ROOT, file)} with ${stories.length} stories`);
}

main().catch((e) => { console.error(e); process.exit(1); });
