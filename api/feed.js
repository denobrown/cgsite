// api/feed.js
//
// Vercel Edge Function — GET /api/feed?source=<key>
//
// Direct port of netlify/functions/feed.js. The fetch/parsing/allowlist
// logic is unchanged; only the export shape and runtime declaration differ
// between platforms, since this file was already written against the
// Web-standard Request/Response API rather than Netlify's older
// (event, context) handler signature — that choice is what makes this port
// nearly line-for-line instead of a rewrite.
//
// SECURITY NOTE — read before changing SOURCES:
// This function only accepts an exact `source` KEY from the fixed allowlist
// below. There is no code path that ever fetches a URL not present in
// SOURCES. If you need a new feed, add it here — do not reintroduce a
// pass-through `url` parameter. See netlify/functions/feed.js's original
// comment for the full SSRF rationale; it applies identically here.

export const config = {
  runtime: "edge",
};

const SOURCES = {
  security: [
    "https://feeds.feedburner.com/TheHackersNews",
    "https://www.bleepingcomputer.com/feed/",
  ],
  cloud: [
    "https://aws.amazon.com/blogs/aws/feed/",
    "https://azure.microsoft.com/en-us/blog/feed/",
  ],
  tech: [
    "https://techcrunch.com/feed/",
    "https://www.theverge.com/rss/index.xml",
  ],
  africa: [
    "https://techcabal.com/feed/",
    "https://disrupt-africa.com/feed/",
  ],
};

const FETCH_TIMEOUT_MS = 4500;
const ITEMS_PER_FEED = 4;
const MAX_TOTAL_ITEMS = 6;

function extractItems(xml, sourceLabel) {
  const items = [];
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks.slice(0, ITEMS_PER_FEED)) {
    const title = pluckTag(block, "title");
    const link = pluckTag(block, "link");
    if (!title) continue;
    items.push({
      title: decodeEntities(stripCDATA(title)).trim(),
      link: link ? decodeEntities(stripCDATA(link)).trim() : null,
      source: sourceLabel,
    });
  }

  return items;
}

function pluckTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1] : null;
}

function stripCDATA(str) {
  return str.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i, "$1");
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"');
}

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "CloudGridAfrica-TechIntelHub/1.0 (+https://cloudgridafrica.com)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");

  if (!source || !Object.prototype.hasOwnProperty.call(SOURCES, source)) {
    return new Response(
      JSON.stringify({
        error: "Unknown source. Must be one of: " + Object.keys(SOURCES).join(", "),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const feedUrls = SOURCES[source];
  const results = await Promise.all(feedUrls.map((url) => fetchWithTimeout(url)));

  let items = [];
  results.forEach((xml, i) => {
    if (!xml) return;
    items = items.concat(extractItems(xml, hostLabel(feedUrls[i])));
  });

  items = items.slice(0, MAX_TOTAL_ITEMS);

  return new Response(JSON.stringify({ source, items, fetchedAt: new Date().toISOString() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
    },
  });
}
