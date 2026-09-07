/**
 * tech-intel-hub.js
 * Progressively enhances the static, always-readable Tech Intelligence Hub
 * markup into a tabbed interface backed by live data. Requests go only to
 * /api/feed?source=<allowlisted-key> — never a raw ?url=
 * parameter — matching the allowlist enforced server-side in api/feed.js
 * (ported from netlify/functions/feed.js — same SSRF-safe allowlist, just
 * an Edge Function export instead of Netlify's handler shape). If a
 * category's live fetch fails for any reason, its original static <li>
 * markup is left exactly as rendered by Astro at build time.
 */

const FEED_ENDPOINT = "/api/feed";
const CATEGORY_IDS = ["security", "cloud", "tech", "africa"];
const fetchedCache = new Map();

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function activateTab(hub, id) {
  qsa("[data-intel-tab]", hub).forEach((btn) => {
    btn.setAttribute("aria-selected", btn.dataset.intelTab === id ? "true" : "false");
  });
  qsa("[data-intel-panel]", hub).forEach((panel) => {
    panel.hidden = panel.dataset.intelPanel !== id;
  });
  loadCategory(id);
}

function renderItems(listEl, items) {
  if (!Array.isArray(items) || items.length === 0) return; // keep static fallback
  const html = items
    .slice(0, 6)
    .map((item) => {
      const title = escapeHTML(item.title ?? "Untitled");
      const source = escapeHTML(item.source ?? "");
      const href = typeof item.link === "string" && /^https?:\/\//.test(item.link) ? item.link : null;

      const titleMarkup = href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer" class="hover:text-white">${title}</a>`
        : title;

      return `<li class="flex items-start justify-between gap-4 px-4 py-3.5">
        <span class="text-[13.5px] leading-snug text-ink-secondary">${titleMarkup}</span>
        <span class="shrink-0 font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">${source}</span>
      </li>`;
    })
    .join("");

  listEl.innerHTML = html;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

async function loadCategory(id) {
  if (fetchedCache.has(id)) return; // already fetched (success or a handled failure) this session
  fetchedCache.set(id, true);

  const listEl = document.querySelector(`[data-feed-list="${id}"]`);
  if (!listEl) return;

  try {
    const res = await fetch(`${FEED_ENDPOINT}?source=${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`feed proxy responded ${res.status}`);
    const payload = await res.json();
    renderItems(listEl, payload.items);
  } catch (err) {
    // Static fallback markup already rendered by Astro remains in place —
    // this is a deliberate no-op, not a missing error path.
    console.warn(`[CloudGrid] Tech Intel Hub: live fetch failed for "${id}", static fallback retained.`, err);
  }
}

function init() {
  const hub = qs("[data-intel-hub]");
  if (!hub) return;

  const tabbar = qs("[data-intel-tabbar]", hub);
  if (tabbar) tabbar.classList.remove("hidden");

  // Collapse to single-panel view now that JS can drive tab switching.
  qsa("[data-intel-panel]", hub).forEach((panel, i) => {
    panel.hidden = i !== 0;
  });

  qsa("[data-intel-tab]", hub).forEach((btn) => {
    btn.addEventListener("click", () => activateTab(hub, btn.dataset.intelTab));
  });

  // Warm the active tab immediately; the rest load lazily on click.
  loadCategory(CATEGORY_IDS[0]);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
