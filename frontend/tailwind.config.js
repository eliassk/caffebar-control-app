/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        glass: {
          DEFAULT: "rgba(255,255,255,0.12)",
          light: "rgba(255,255,255,0.6)",
          strong: "rgba(255,255,255,0.85)",
        },
        "glass-dark": {
          DEFAULT: "rgba(28,25,23,0.6)",
          light: "rgba(28,25,23,0.4)",
          strong: "rgba(28,25,23,0.85)",
        },
        mushroom: {
          card: "#134e5e",
          cardOff: "#1e3a42",
          iconOn: "#fbbf24",
          iconOff: "#64748b",
          sliderFill: "#ea580c",
        },
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
        glass: "0 8px 32px rgba(0,0,0,0.08)",
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        card: "1rem",
        pill: "2rem",
      },
    },
  },
  plugins: [],
};
