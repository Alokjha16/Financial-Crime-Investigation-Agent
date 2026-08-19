/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light fintech palette with vibrant accents
        bg: {
          primary:   '#F5F6FA',
          secondary: '#EAEFF8',
          card:      '#FFFFFF',
        },
        accent: {
          purple: '#7C3AED',
          pink:   '#EC4899',
          green:  '#10B981',
          orange: '#F97316',
          blue:   '#3B82F6',
          indigo: '#6366F1',
        },
        risk: {
          high:   '#EF4444',
          medium: '#F97316',
          low:    '#10B981',
        },
        surface: {
          border: 'rgba(15,23,42,0.07)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'card':        '0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.02)',
        'card-hover':  '0 8px 32px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.04)',
        'sidebar':     '2px 0 16px rgba(0,0,0,0.04)',
        'header':      '0 1px 0 rgba(15,23,42,0.06)',
      },
      borderRadius: {
        'card': '16px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 0.35s ease-out',
        'slide-up':   'slideUp 0.35s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
