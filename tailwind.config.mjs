import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Canvas — premium tech midnight charcoal, per brief
        midnight: {
          DEFAULT: "#0B0F17", // page canvas
          surface: "#10151C", // card / panel fill
          raised: "#151B26", // hovered / elevated panel fill
          border: "#1E2635", // hairline borders
          "border-strong": "#2A3345",
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
          // TEXT against both the page canvas and card surfaces — the
          // true brand blue only hits 3.02:1 as small text on midnight,
          // which fails AA. This is used for links, icons, and accent
          // text; `blue-dim` above is used for solid-fill contexts.
          blue: "#3181E8",
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
          // backgrounds actually used (#0B0F17 page canvas AND #10151C
          // card surface) — checked with a real contrast-ratio script, not
          // eyeballed. See README.md's accessibility section for the
          // verification method.
          muted: "#7E8CA0", // 5.61:1 on midnight, 5.36:1 on surface
          faint: "#748094", // 4.80:1 on midnight, 4.59:1 on surface
        },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans Variable"',
          '"Plus Jakarta Sans"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
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
        "fade-up": "fade-up 0.6s ease-out both",
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
