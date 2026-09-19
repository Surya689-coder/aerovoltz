/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0e14',
        'bg-secondary': '#0f1520',
        'bg-tertiary': '#151c2c',
        'bg-card': '#111827',
        'accent-amber': '#f59e0b',
        'accent-teal': '#14b8a6',
        'accent-red': '#ef4444',
        'accent-blue': '#38bdf8',
        'accent-green': '#22c55e',
      },
    },
  },
  plugins: [],
};
