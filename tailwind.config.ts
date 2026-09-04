import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#16232B",
        navy: "#14324A",
        surface: "#F7F8FA",
        line: "#E4E7EB",
        sun: "#E8A33D",
        meter: "#2F8F5B",
      },
    },
  },
  plugins: [],
};

export default config;
