/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#faf8f5",
          alt: "#f2ede6",
          card: "#ffffff",
        },
        accent: {
          DEFAULT: "#e85d2e",
          hover: "#d94a22",
          light: "#fef3ef",
        },
      },
      fontFamily: {
        display: ["DM Sans", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 12px rgba(0,0,0,0.06)",
        "soft-lg": "0 4px 24px rgba(0,0,0,0.08)",
        card: "0 2px 16px rgba(0,0,0,0.06)",
      },
      borderRadius: {
        card: "1rem",
        pill: "2rem",
      },
    },
  },
  plugins: [],
};
