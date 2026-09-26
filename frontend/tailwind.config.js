/** @type {import('tailwindcss').Config} */
// Design tokens extracted from the Rehearsly design (see REDESIGN_PROGRESS.md §1).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Light product; `class` keeps stray dark: utilities inert (no .dark class is ever set).
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        paper: '#F4F5F1',
        ink: {
          DEFAULT: '#0E1116',
          2: '#171B21',
          3: '#23272E',
          line: '#242A32',
          soft: '#2A2F36',
        },
        muted: {
          DEFAULT: '#5B6470',
          2: '#6B727C',
          strong: '#4A515A',
        },
        faint: {
          DEFAULT: '#8A9099',
          2: '#9AA0A8',
          3: '#C3C7CC',
        },
        'on-dark': {
          DEFAULT: '#A9B0B8',
          soft: '#C9CED4',
          bright: '#DDE1E5',
        },
        line: {
          DEFAULT: '#DDE0DC',
          2: '#E6E9E4',
          3: '#EDEFF2',
        },
        stone: {
          DEFAULT: '#E9EBE7',
          2: '#F1F2F0',
          3: '#EEF0EC',
        },
        brand: {
          DEFAULT: '#1B82EC',
          50: '#EEF6FF',
          100: '#DCEBFF',
          150: '#DCEFFC',
          200: '#BFE1FB',
          300: '#9ACDF8',
          350: '#8CC8F7',
          400: '#56AEF5',
          500: '#1B82EC',
          600: '#0B6FD9',
          700: '#0A63CC',
          800: '#1F4C80',
          900: '#0B3A73',
        },
        lime: {
          DEFAULT: '#D7F94B',
          hover: '#E6FF7A',
          soft: '#F2FCC9',
          ink: '#3A4410',
          ok: '#4E7A00',
        },
        coral: {
          DEFAULT: '#B8431A',
          bg: '#FFE3D6',
          bar: '#F2A27E',
          soft: '#FFF3EC',
        },
      },
      borderRadius: {
        r9: '9px',
        r14: '14px',
        r18: '18px',
        r20: '20px',
        r24: '24px',
        r28: '28px',
      },
      boxShadow: {
        float: '0 30px 60px -30px rgba(8,40,90,0.5)',
        'float-sm': '0 20px 40px -20px rgba(8,40,90,0.45)',
        'float-lg': '0 34px 70px -26px rgba(8,40,90,0.6)',
        ring: '0 0 0 4px rgba(27,130,236,0.15)',
        'ring-coral': '0 0 0 4px rgba(184,67,26,0.12)',
        card: '0 1px 2px rgba(14,17,22,0.04)',
        pop: '0 24px 48px -20px rgba(14,17,22,0.28)',
      },
      letterSpacing: {
        display: '-0.045em',
        tight2: '-0.04em',
        tight3: '-0.03em',
        tight1: '-0.02em',
        mono: '0.08em',
        eyebrow: '0.1em',
      },
      maxWidth: {
        page: '1180px',
      },
      backgroundImage: {
        hero: 'linear-gradient(180deg,#0A63CC 0%,#1B82EC 38%,#56AEF5 68%,#BFE1FB 90%,#E8F4FD 100%)',
        auth: 'linear-gradient(180deg,#0A63CC 0%,#1B82EC 40%,#6BB8F6 75%,#DCEFFC 100%)',
        cta: 'linear-gradient(180deg,#0A63CC 0%,#1B82EC 45%,#8CC8F7 85%,#DCEFFC 100%)',
        sky: 'linear-gradient(180deg,#0A63CC,#56AEF5 70%,#DCEFFC)',
        report: 'linear-gradient(180deg,#1B82EC,#8CC8F7)',
        'blue-card': 'linear-gradient(160deg,#3F9CF3,#1B82EC)',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out both',
        'slide-up': 'slideUp 0.45s cubic-bezier(.2,.7,.2,1) both',
        'pop-in': 'popIn 0.2s ease-out both',
        wave: 'wave 1.1s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        popIn: { '0%': { opacity: '0', transform: 'scale(.97) translateY(4px)' }, '100%': { opacity: '1', transform: 'scale(1) translateY(0)' } },
        wave: { '0%,100%': { transform: 'scaleY(.35)' }, '50%': { transform: 'scaleY(1)' } },
      },
    },
  },
  plugins: [],
};
