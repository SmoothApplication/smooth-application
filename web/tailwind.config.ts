import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Wired to the CSS variable next/font/google sets on <html> in app/layout.tsx — makes
        // Tailwind's own `font-sans` (the default on <body>, and Tailwind's implicit default
        // everywhere else) resolve to Inter instead of the browser's system font stack.
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Admin-dashboard accent — kept separate from `accent` (the actual applicant-facing
        // brand color, --accent below) since the admin panel was scaffolded independently.
        brand: {
          DEFAULT: '#0b7a6e',
          dark: '#0e8f82',
        },
        // Retinted to match the new homepage mockup's "premium authority" look: a deep forest
        // green as the one shared brand/CTA color across every session, replacing the old blue
        // (#12699a). `dark` is the hover/pressed shade; `wash` is the pale tint used for
        // badge/pill backgrounds. Kept clearly distinct (darker, less teal) from `good` below so
        // a brand button and a "status: good" badge never read as the same color.
        accent: {
          DEFAULT: '#145c44',
          dark: '#0c3d2d',
          wash: '#e3efe8',
        },
        // The mockup's gold/amber accent, for stat numerals, highlight badges, and secondary
        // CTAs — used sparingly alongside the green, never replacing it as the primary action color.
        gold: { DEFAULT: '#c08a28', dark: '#96690f', wash: '#fbf0d9' },
        good: { DEFAULT: '#0f8266', wash: '#dcf3ea' },
        warn: { DEFAULT: '#d99a34', wash: '#fbf0dc', text: '#7a5518' },
        // Warm cream, matching manifest.json's existing PWA background_color — the new sitewide
        // body background, replacing plain bg-gray-50. `soft` is a slightly lighter shade for
        // cards/bars that sit on top of the cream body.
        cream: { DEFAULT: '#f7f5f0', soft: '#faf8f3' },
      },
    },
  },
  plugins: [],
};

export default config;
