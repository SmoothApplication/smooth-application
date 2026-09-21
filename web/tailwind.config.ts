import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0b7a6e',
          dark: '#0e8f82',
        },
      },
    },
  },
  plugins: [],
};

export default config;
