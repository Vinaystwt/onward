import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0B0B0F",
          soft: "#1A1A22",
          muted: "#5B5B6B"
        },
        paper: {
          DEFAULT: "#F6F2EA",
          warm: "#EEE7DA",
          card: "#FFFFFF"
        },
        brand: {
          DEFAULT: "#1F4BFF",
          deep: "#0E2EAA",
          glow: "#7C9CFF",
          tint: "#E4EBFF"
        },
        signal: {
          mint: "#1FC79E",
          amber: "#F2A93B",
          rose: "#E8537C"
        }
      },
      fontFamily: {
        display: ["\"Schibsted Grotesk\"", "\"Hanken Grotesk\"", "ui-sans-serif"],
        sans: ["\"Hanken Grotesk\"", "ui-sans-serif"],
        mono: ["\"JetBrains Mono\"", "ui-monospace", "monospace"]
      },
      letterSpacing: {
        tightest: "-0.04em"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem"
      },
      boxShadow: {
        card: "0 1px 0 rgba(11,11,15,0.04), 0 12px 32px -16px rgba(11,11,15,0.18)",
        ring: "0 0 0 4px rgba(31,75,255,0.18)"
      },
      transitionTimingFunction: {
        ease: "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    }
  },
  plugins: []
} satisfies Config;
