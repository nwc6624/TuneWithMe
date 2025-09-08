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
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        spotify: {
          green: '#1DB954',
          black: '#191414',
          white: '#FFFFFF',
          gray: '#535353',
        },
        // Light mode colors
        background: {
          primary: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
        },
        surface: {
          primary: '#ffffff',
          secondary: '#f1f5f9',
          tertiary: '#e2e8f0',
        },
        text: {
          primary: '#0f172a',
          secondary: '#334155',
          tertiary: '#475569',
        },
        border: {
          primary: '#e2e8f0',
          secondary: '#cbd5e1',
        },
        // Dark mode colors (will be overridden by CSS variables)
        'dark-background': {
          primary: '#0f172a',
          secondary: '#1e293b',
          tertiary: '#334155',
        },
        'dark-surface': {
          primary: '#1e293b',
          secondary: '#1e293b',
          tertiary: '#475569',
        },
        'dark-text': {
          primary: '#f8fafc',
          secondary: '#e2e8f0',
          tertiary: '#cbd5e1',
        },
        'dark-border': {
          primary: '#475569',
          secondary: '#64748b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
