/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#10120e",
          900: "#161914",
          800: "#1e221b",
          700: "#2a3026",
          600: "#3a4134",
          400: "#8b8476",
          200: "#d8d2c4",
          100: "#ece7db",
        },
        brass: "#d4a84b",
        copper: "#c45c26",
        paper: "#f3eee3",
      },
      fontFamily: {
        sans: ['"DM Sans"', '"Noto Sans SC"', '"Noto Sans"'],
        display: ['"Fraunces"', '"Noto Serif SC"', '"Noto Serif"'],
      },
      boxShadow: {
        paper: "0 24px 80px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.3)",
      },
    },
  },
  plugins: [],
};
