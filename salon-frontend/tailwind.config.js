/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf8f0',
          100: '#faefd8',
          200: '#f5d9a8',
          300: '#efbe6e',
          400: '#e89c3a',
          500: '#d4821e',
          600: '#b86715',
          700: '#954d13',
          800: '#773e15',
          900: '#613514',
        },
        dark: {
          900: '#0a0a0b',
          800: '#111113',
          700: '#18181c',
          600: '#222228',
          500: '#2e2e38',
          400: '#3d3d4a',
          300: '#52525e',
          200: '#6b6b78',
          100: '#9a9aab',
        },
        surface: {
          primary:   'var(--background)',
          secondary: 'var(--surface)',
          tertiary:  'var(--surface-secondary)',
          elevated:  '#2e2e38',
        },
        accent: {
          gold:    'var(--primary)',
          amber:   'var(--warning)',
          copper:  '#b87333',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error:   '#ef4444',
        info:    '#3b82f6',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'token':  ['4rem', { lineHeight: '1', fontWeight: '700' }],
        'token-sm': ['2.5rem', { lineHeight: '1', fontWeight: '700' }],
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(212, 130, 30, 0.3)',
        'glow-sm':   '0 0 10px rgba(212, 130, 30, 0.15)',
        'card':      '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover':'0 8px 40px rgba(0, 0, 0, 0.6)',
        'inset-border': 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'gradient-radial':   'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand':    'linear-gradient(135deg, #d4821e 0%, #b86715 100%)',
        'gradient-dark':     'linear-gradient(180deg, #18181c 0%, #111113 100%)',
        'gradient-card':     'linear-gradient(145deg, #222228 0%, #18181c 100%)',
        'grid-pattern':      'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
      },
      backgroundSize: {
        'grid': '32px 32px',
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.08)',
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':      'fadeIn 0.3s ease-out',
        'slide-up':     'slideUp 0.4s ease-out',
        'slide-in':     'slideIn 0.3s ease-out',
        'token-appear': 'tokenAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        tokenAppear: {
          '0%':   { opacity: '0', transform: 'scale(0.7)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
