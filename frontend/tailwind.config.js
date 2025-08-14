/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'space-dark': '#0f0f23',
        'space-blue': '#1e3a8a',
        'satellite-orange': '#f97316',
        'chat-gray': '#374151'
      }
    },
  },
  plugins: [],
}