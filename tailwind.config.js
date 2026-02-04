
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#002B5B', // Deep Corporate Blue
          'blue-light': '#0047AB', // Brighter blue for gradients
          orange: '#FF5F00', // Bright Orange
          'orange-light': '#FF7A33', // Lighter orange for gradients
        }
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'float': '0 20px 40px -5px rgba(0, 0, 0, 0.1), 0 10px 20px -5px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'slide-up': 'slide-up 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards',
        'slide-down': 'slide-down 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards',
        'slide-right': 'slide-right 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'zoom-pan': 'zoom-pan 8s ease-out forwards',
        'drive-bg': 'drive-bg 3s linear infinite',
        'drive-in': 'drive-in 2.2s cubic-bezier(0.2, 0, 0.2, 1) forwards',
        'suspension': 'suspension 0.8s ease-in-out infinite',
        'speed-line': 'speed-line 1.2s linear infinite',
        'spin-fast': 'spin 0.4s linear infinite',
      },
      keyframes: {
        'slide-up': {
          'from': { transform: 'translateY(100%)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          'from': { transform: 'translateY(-100%)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-right': {
          'from': { transform: 'translateX(-100%)' },
          'to': { transform: 'translateX(0)' },
        },
        'fade-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'zoom-pan': {
          '0%': { transform: 'scale(1) translateY(0)' },
          '100%': { transform: 'scale(1.2) translateY(-5%)' },
        },
        'drive-bg': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'drive-in': {
          '0%': { left: '-40%', transform: 'translateX(-100%) scale(0.7)' },
          '70%': { left: '55%', transform: 'translateX(-50%) scale(1.02)' },
          '100%': { left: '50%', transform: 'translateX(-50%) scale(1)' },
        },
        'suspension': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(3px)' },
        },
        'speed-line': {
          '0%': { transform: 'translateX(200%)', opacity: '0' },
          '30%': { opacity: '0.8' },
          '100%': { transform: 'translateX(-200%)', opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}
