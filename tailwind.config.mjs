import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Canvas — re-anchored to the real CloudGrid Africa brand navy.
        // #0D1A38 is not a guess: it's the exact theme-color declared in
        // cloudgridafrica.com's own <meta name="theme-color"> tag (fetched
        // and confirmed live). surface/raised/border are derived from it
        // using the SAME relative lightening steps as the previous
        // near-black scheme, so the design system's elevation hierarchy is
        // unchanged — only its base anchor moved to match the real brand.
        midnight: {
          DEFAULT: "#0D1A38", // page canvas — CONFIRMED real (site theme-color)
          surface: "#12203D", // card / panel fill
          raised: "#172647", // hovered / elevated panel fill
          border: "#203156", // hairline borders
          "border-strong": "#2C3E66",
        },
        // Signal palette — every accent on the site maps to a live-systems
        // meaning, not decoration. Blue = engineering/primary, emerald =
        // operational/secure, amber = advisory (used only inside the
        // Security Tip rotator for elevated-priority tips).
        signal: {
          // Real CloudGrid Africa brand blue, sampled directly from the
          // actual logo file's pixels (#155DBA — not an approximation).
          // Used for solid fills (buttons, the logo itself) where it
          // already passes AA with white text (6.35:1) at its true value.
          "blue-dim": "#155DBA",
          // The same brand hue, lightened just enough to clear 4.5:1 as
          // TEXT against the new navy canvas AND its surface tone (4.98:1
          // and 4.68:1 respectively — re-verified after the navy re-anchor,
          // not just carried over from the old background's numbers).
          blue: "#3A8AF1",
          emerald: "#10B981",
          "emerald-dim": "#065F46",
          amber: "#F59E0B",
        },
        ink: {
          primary: "#E2E8F0", // slate-200
          secondary: "#94A3B8", // slate-400
          // Original values (#64748B, #3D4759) failed WCAG AA (4.03:1 and
          // 2.05:1 against the page background) despite being used
          // extensively at 10-13px throughout the site — well below the
          // size threshold that would exempt them under the "large text"
          // 3:1 rule. Replaced with values verified >=4.5:1 against BOTH
          // backgrounds actually used (#0D1A38 page canvas AND #12203D
          // card surface) — checked with a real contrast-ratio script, not
          // eyeballed. Re-verified after the navy re-anchor: unchanged,
          // both values still clear 4.5:1 on the new backgrounds with
          // margin to spare (5.03:1 / 4.99:1 on midnight and midnight
          // respectively — see README.md's accessibility section).
          // NOTE: these two are NOT verified against midnight-raised
          // (only midnight + surface, the two backgrounds text sits on in
          // the general design system) — the two specific components that
          // place small text on midnight-raised use ink-secondary instead,
          // which clears it with room to spare (5.83:1). See AboutTeam.astro
          // and ChatWidget.astro.
          muted: "#7E8CA0", // 5.03:1 on midnight, 4.73:1 on surface
          faint: "#748094", // 4.99:1 on midnight, 4.69:1 on surface
        },
      },
      fontFamily: {
        // Geist (Vercel) for both roles: one family, two cuts. Mono is kept
        // for code and real figures only, not decorative labels.
        sans: ['"Geist Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Geist Mono Variable"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(2.75rem, 5vw + 1rem, 5.25rem)", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "display-lg": ["clamp(2.25rem, 3.5vw + 1rem, 3.5rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
      },
      boxShadow: {
        "glow-blue": "0 0 80px -20px rgba(59, 130, 246, 0.45)",
        "glow-emerald": "0 0 40px -12px rgba(16, 185, 129, 0.35)",
        "card-hover": "0 0 0 1px rgba(59, 130, 246, 0.25), 0 20px 40px -20px rgba(0, 0, 0, 0.6)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
      animation: {
        "pulse-dot": "pulse-dot 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [typography],
};
