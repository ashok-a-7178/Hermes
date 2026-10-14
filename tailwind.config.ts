import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
      },
      colors: {
        ink: "#17211f",
        canvas: "#f6f7f4",
        accent: "#5b6e5d",
      },
      boxShadow: {
        panel: "0 12px 40px -24px rgba(24, 40, 32, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
