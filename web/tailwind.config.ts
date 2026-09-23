import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Admin-dashboard accent — kept separate from `accent` (the actual index.html checklist
        // brand color, --accent below) since the admin panel was scaffolded independently.
        brand: {
          DEFAULT: '#0b7a6e',
          dark: '#0e8f82',
        },
        // Matches index.html's :root custom properties exactly, so the ported applicant-facing
        // pages look like a continuation of the live checklist rather than a re-skin.
        accent: {
          DEFAULT: '#12699a',
          wash: '#d8eaf3',
        },
        good: { DEFAULT: '#0f8266', wash: '#dcf3ea' },
        warn: { DEFAULT: '#d99a34', wash: '#fbf0dc', text: '#7a5518' },
      },
    },
  },
  plugins: [],
};

export default config;
