import type { Config } from "tailwindcss";

// Theme tokens chosen to align with the Claude Design hand-off:
// Bricolage Grotesque (display), IBM Plex Sans (body), IBM Plex Mono (mono),
// dark surface palette with #C8A8FF accent.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["'Bricolage Grotesque'", "ui-serif", "Georgia", "serif"],
        sans: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "Menlo", "monospace"],
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface2)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        dim: "var(--dim)",
        accent: "var(--accent)",
        on: "var(--on)",
        heat: "var(--heat)",
        cool: "var(--cool)",
        alert: "var(--alert)",
      },
    },
  },
  plugins: [],
};

export default config;
