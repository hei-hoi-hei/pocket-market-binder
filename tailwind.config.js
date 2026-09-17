/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm parchment / binder paper
        parchment: {
          50: '#fdfbf6',
          100: '#f7f2e6',
          200: '#ece3cc',
          300: '#ddcfa5',
          400: '#c8b376',
        },
        // Rich binder leather (deep teal-green)
        leather: {
          800: '#1c3a3a',
          700: '#234747',
          600: '#2e5959',
          500: '#3b6f6f',
          400: '#5a8f8f',
        },
        // TCG gold accent
        gold: {
          400: '#e0b54a',
          500: '#c99a2e',
          600: '#a87d22',
        },
        // Energy type tints (subtle)
        fire: { 400: '#f87171', 500: '#ef4444' },
        water: { 400: '#60a5fa', 500: '#3b82f6' },
        grass: { 400: '#4ade80', 500: '#22c55e' },
        electric: { 400: '#facc15', 500: '#eab308' },
        psychic: { 400: '#f472b6', 500: '#ec4899' },
        dark: { 400: '#6b7280', 500: '#4b5563' },
        steel: { 400: '#9ca3af', 500: '#6b7280' },
        dragon: { 400: '#a78bfa', 500: '#8b5cf6' },
      },
      fontFamily: {
        sans: ['"Nunito"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Luckiest Guy"', '"Nunito"', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 6px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.12)',
        'card-hover': '0 4px 10px rgba(0,0,0,0.22), 0 14px 32px rgba(0,0,0,0.18)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'scale-in': 'scale-in 0.25s ease-out both',
        'pop': 'pop 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
