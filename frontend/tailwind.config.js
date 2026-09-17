/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0faf7',
          100: '#dbf2ea',
          200: '#b9e4d7',
          300: '#8dcfbd',
          400: '#5fb39f',
          500: '#419683',
          600: '#337a6b',
          700: '#2b6258',
          800: '#254f48',
          900: '#21423d',
          950: '#102521',
        },
        surface: {
          DEFAULT: '#0d1311',
          card: '#121b18',
          border: '#22302c',
          hover: '#18231f',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #337a6b 0%, #5fb39f 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0d1311 0%, #0a0f0e 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(65,150,131,0.08) 0%, rgba(65,150,131,0.02) 100%)',
      },
      boxShadow: {
        'brand': '0 0 40px rgba(65, 150, 131, 0.22)',
        'card': '0 4px 24px rgba(4, 12, 10, 0.45)',
        'glow': '0 0 24px rgba(65, 150, 131, 0.38)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
