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
        "accent-hover": rgb("accent-hover"),
        "accent-line": rgb("accent-line"),
        "accent-text": rgb("accent-text"),
        "on-accent": rgb("on-accent"),
        "ok-soft": rgb("ok-soft"),
        "ok-text": rgb("ok-text"),
        "warn-soft": rgb("warn-soft"),
        "warn-text": rgb("warn-text"),
        "bad-soft": rgb("bad-soft"),
        "bad-text": rgb("bad-text"),
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
