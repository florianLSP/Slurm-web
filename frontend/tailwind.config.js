/** @type {import('tailwindcss').Config} */

const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slurmweb: {
          light: '#ccdbe6',
          DEFAULT: '#759ab8',
          dark: '#486a86',
          'font-disabled': '#dbe9f4',
        },
      },
      animation: {
        'horizontal-shake': 'horizontal-shaking 0.35s infinite',
      },
      keyframes: {
        'horizontal-shaking': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%, 75%': { transform: 'translateX(5px)' },
          '50%': { transform: 'translateX(-5px)' },
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
