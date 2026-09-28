import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Toy-store palette: playful but not primary-school.
        brick: {
          50: '#fff1f0',
          400: '#f2655a',
          500: '#e0392b',
          600: '#c22b1e',
          900: '#5c120c',
        },
        sky: {
          50: '#eff8ff',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          900: '#0c4a6e',
        },
        sunbeam: {
          300: '#ffd966',
          400: '#ffc72c',
          500: '#f5a623',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        block: '0 8px 0 0 rgba(0,0,0,0.15), 0 12px 24px -8px rgba(0,0,0,0.35)',
      },
      keyframes: {
        'spin-slow': {
          from: { transform: 'rotateY(0deg)' },
          to: { transform: 'rotateY(360deg)' },
        },
      },
      animation: {
        'spin-slow': 'spin-slow 12s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
