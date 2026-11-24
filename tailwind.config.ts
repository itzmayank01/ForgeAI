import type { Config } from "tailwindcss";

const rgb = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: rgb("canvas"),
        ink: rgb("ink"),
        accent: rgb("accent"),
        muted: rgb("muted"),
        surface: rgb("surface"),
        ok: rgb("ok"),
        warn: rgb("warn"),
        bad: rgb("bad"),
        "accent-soft": rgb("accent-soft"),
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      maxWidth: { content: "1200px" },
      borderColor: { DEFAULT: "rgb(var(--line))" },
    },
  },
  plugins: [],
} satisfies Config;
