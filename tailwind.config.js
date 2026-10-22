/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stage: {
          bg: '#0b1220',
          border: '#334155',
          grid: '#64748b',
          accent: '#22d3ee'
        }
      }
    },
  },
  plugins: [],
}
