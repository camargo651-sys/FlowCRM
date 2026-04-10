/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#0891B2',
          600: '#0e7490',
          700: '#155e75',
          800: '#164e63',
          900: '#083344',
          950: '#042f2e',
        },
        surface: {
          0:   '#ffffff',
          50:  '#f8f9fc',
          100: '#f0f2f8',
          200: '#e4e7f0',
          300: '#d0d5e8',
          400: '#9ba3c0',
          500: '#6b75a0',
          600: '#4e5880',
          700: '#374068',
          800: '#232b50',
          900: '#151b3a',
          950: '#0c1025',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(8, 145, 178, 0.15)',
        'glow-lg': '0 0 40px rgba(8, 145, 178, 0.2)',
        'card': '0 0 0 1px rgba(21, 27, 58, 0.03), 0 1px 2px rgba(21, 27, 58, 0.06), 0 2px 8px rgba(21, 27, 58, 0.04)',
        'card-hover': '0 0 0 1px rgba(21, 27, 58, 0.04), 0 4px 8px rgba(21, 27, 58, 0.08), 0 12px 32px rgba(21, 27, 58, 0.08)',
        'sidebar': 'inset -1px 0 0 rgba(21, 27, 58, 0.06)',
        'input-focus': '0 0 0 3px rgba(8, 145, 178, 0.15)',
        'modal': '0 24px 48px -12px rgba(21, 27, 58, 0.18), 0 0 0 1px rgba(21, 27, 58, 0.05)',
        'float': '0 8px 24px -4px rgba(21, 27, 58, 0.12), 0 0 0 1px rgba(21, 27, 58, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
      transitionTimingFunction: {
        'ease-spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
