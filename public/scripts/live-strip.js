/**
 * live-strip.js
 * Powers the two genuinely time-sensitive segments of the Live Systems Strip:
 * the Nairobi clock and Nairobi weather reading. The security-tip segment is
 * static HTML resolved at build time (see LiveSystemsStrip.astro) and is not
 * touched here.
 *
 * Loaded as an external module referenced by src=, never inlined, so this
 * file can change freely without recomputing a CSP script-src hash in
 * netlify.toml — only the file's own origin ('self') needs to stay allowed.
 */

const NAIROBI_COORDS = { latitude: -1.2921, longitude: 36.8219 };
const WEATHER_ENDPOINT =
  `https://api.open-meteo.com/v1/forecast?latitude=${NAIROBI_COORDS.latitude}` +
  `&longitude=${NAIROBI_COORDS.longitude}&current=temperature_2m,weather_code` +
  `&timezone=Africa%2FNairobi`;

// WMO weather interpretation codes, condensed to the phrases relevant to
// Nairobi's climate (we do not need blizzard/heavy-snow entries here).
const WEATHER_CODE_TEXT = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent showers",
  95: "Thunderstorm",
};

function describeWeatherCode(code) {
  return WEATHER_CODE_TEXT[code] ?? "Conditions unavailable";
}

function startClock() {
  const el = document.querySelector('[data-live="time"]');
  if (!el) return;

  const formatter = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const tick = () => {
    const parts = formatter.formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
    el.innerHTML = `${get("hour")}:${get("minute")}:${get("second")} <span class="text-ink-muted">EAT</span>`;
  };

  tick();
  setInterval(tick, 1000);
}

async function fetchWeather() {
  const el = document.querySelector('[data-live="weather"]');
  if (!el) return;

  try {
    const res = await fetch(WEATHER_ENDPOINT, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Weather API responded ${res.status}`);
    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;

    if (typeof temp !== "number") throw new Error("Malformed weather payload");

    el.textContent = `${Math.round(temp)}°C, ${describeWeatherCode(code)}`;
  } catch (err) {
    // Fail quietly and informatively — never leave the "reading sensor feed…"
    // ellipsis spinning forever if the network call is blocked or the API
    // is down.
    el.textContent = "Live feed unavailable";
    console.warn("[CloudGrid] Weather fetch failed:", err);
  }
}

function startWeatherPolling() {
  fetchWeather();
  // Open-Meteo's current-conditions block updates roughly every 15 minutes
  // upstream — polling more often than that just burns the visitor's data.
  setInterval(fetchWeather, 15 * 60 * 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    startClock();
    startWeatherPolling();
  });
} else {
  startClock();
  startWeatherPolling();
}
