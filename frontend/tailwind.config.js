/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-hover": "rgb(var(--surface-hover) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted) / <alpha-value>)",
        accent: {
          DEFAULT: "#5B8DEF",
          soft: "#1B2A4A",
        },
        success: "#34D399",
        warning: "#FBBF24",
        danger: "#F87171",
        info: "#38BDF8",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(91,141,239,0.15), 0 8px 24px -8px rgba(91,141,239,0.25)",
        card: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.5)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 currentColor" },
          "70%": { boxShadow: "0 0 0 6px transparent" },
          "100%": { boxShadow: "0 0 0 0 transparent" },
        },
        heartbeat: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.85)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite",
        heartbeat: "heartbeat 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};