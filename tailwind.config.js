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
        slate: {
          950: '#14121a', 900: '#1d1a25', 800: '#2c2836', 700: '#423c4e',
          600: '#5f576c', 500: '#9a91aa', 400: '#b4abc2', 300: '#cec6da',
          200: '#e3dcec', 100: '#f0ebf6',
        },
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
