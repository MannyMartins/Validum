/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        validum: {
          navy: '#0f2537',
          'navy-dark': '#0a1824',
          'navy-light': '#16324a',
          lime: '#c4d600',
          'lime-hover': '#d2e300',
          'lime-dark': '#a8b800',
          cream: '#f7f5ed',
        },
        amber: {
          300: '#c4d600',
          400: '#c4d600',
          500: '#c4d600',
          600: '#a8b800',
          700: '#0f2537',
        },
        yellow: {
          400: '#c4d600',
          500: '#c4d600',
        },
        gold: {
          400: '#c4d600',
          500: '#c4d600',
          600: '#a8b800',
        },
        cream: {
          50: '#fdfbf7',
          100: '#f7f5ed',
          200: '#efeee4',
          300: '#e5e2d3',
          800: '#3a3830',
          900: '#1c1b17',
        },
        navy: {
          800: '#16324a',
          900: '#0f2537',
          950: '#0a1824',
        }
      },
      fontFamily: {
        serif: ['Outfit', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'cream-card': '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 2px rgba(196, 214, 0, 0.3)',
        'glow-lime': '0 0 30px -5px rgba(196, 214, 0, 0.4)',
      }
    },
  },
  plugins: [],
}
