// netlify/functions/feed.js
//
// Serves GET /.netlify/functions/feed?source=<key>
//
// SECURITY NOTE — read before changing SOURCES:
// The previous implementation of this function accepted an arbitrary
// `?url=` query parameter and fetched whatever the visitor supplied. That is
// a textbook Server-Side Request Forgery primitive: a serverless function
// with outbound network access, fetching attacker-controlled URLs, running
// on infrastructure that (depending on provider) can sometimes reach
// internal metadata endpoints. For a firm whose own product is penetration
// testing, shipping that pattern on the marketing site is the kind of
// finding we'd flag on a client audit.
//
// This version only accepts an exact `source` KEY from the fixed allowlist
// below. There is no code path that ever fetches a URL not present in
// SOURCES. If you need a new feed, add it to SOURCES — do not reintroduce a
// pass-through `url` parameter.

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

/**
 * Minimal, dependency-free RSS 2.0 item extractor. Deliberately not a full
 * XML parser — this function only ever reads from the fixed SOURCES list
 * above (never visitor input), so we only need to be correct for the known
 * shape of those feeds, not defensive against adversarial XML.
 */
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

export default async (request) => {
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

  // If every upstream feed failed, return an explicit empty result rather
  // than an error — the client script treats this as "keep static
  // fallback" rather than throwing.
  return new Response(JSON.stringify({ source, items, fetchedAt: new Date().toISOString() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Edge-cacheable for 10 minutes, serve-stale for an hour while
      // revalidating in the background — keeps the hub feeling "live"
      // without hammering upstream feeds on every visitor.
      "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
    },
  });
};

export const config = {
  path: "/.netlify/functions/feed",
};
