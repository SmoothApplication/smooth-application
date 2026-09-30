import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Analytics from '@/components/Analytics';
import { AppLockProvider } from '@/lib/security/AppLockContext';
import AppLockGate from '@/components/security/AppLockGate';

// Design pass (user feedback: "this site needs a UI/UX designer" — live screenshot of the
// homepage): the app had never set a real typeface anywhere, so every page fell back to the
// browser's default system sans-serif — a big, easy-to-miss reason a functional site reads as
// unpolished. Inter is a free, self-hosted (via next/font/google, no external request at runtime)
// typeface built for UI text at small sizes, applied once here so every page inherits it.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Direct request: "create SEO for this website." Until now, smoothapplication.com's ONLY metadata
// was a generic placeholder ("Applicant accounts and admin dashboards...") that didn't even
// describe the real product — worse, that placeholder is what every search engine, and every
// WhatsApp/X link preview, had been showing since this Next.js app became the live site. This was
// never a from-scratch job, though: the RETIRED GitHub Pages app already had real, keyword-tested
// on-page SEO (see the now-retired tests/seo-meta-tags.test.js and docs/seo-blog-posts.md) — a
// title leading with the primary search phrase, an accurate description, Open Graph + Twitter
// Card tags, and SoftwareApplication JSON-LD with no fabricated review/rating data (Google's
// structured-data policy treats a fake aggregateRating as a violation). That proven copy is ported
// here, onto the actual live product, with the URL/canonical switched from the retired GitHub
// Pages domain to smoothapplication.com and the description updated for what's actually live now
// (this app supports more countries and more analysis depth than the old site ever did - see
// CHANGELOG's "Auto-fill the 6-month cash-flow table..." entry). `metadataBase` lets every route's
// own relative `alternates.canonical`/OG image resolve to an absolute smoothapplication.com URL
// without repeating the full domain on every page.
const SITE_URL = 'https://www.smoothapplication.com';
const OG_IMAGE = '/icons/icon-512.png';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Free UK Visa Checklist for Nigerians | Smooth Application',
    template: '%s | Smooth Application',
  },
  description:
    'Free visa & travel-document checklist for Nigerian applicants — UK, Canada, Schengen, South Africa, Ghana, Kenya, Morocco & Ethiopia. Auto-checks your bank statement for issues reviewers flag. 100% private, runs entirely in your browser.',
  alternates: { canonical: '/' },
  applicationName: 'Smooth Application',
  keywords: [
    'UK visa checklist Nigeria',
    'UK visitor visa Nigeria',
    'bank statement checker visa',
    'Canada visitor visa Nigeria',
    'Schengen visa checklist Nigeria',
    'visa document checklist',
  ],
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Smooth Application',
    url: SITE_URL,
    title: 'Free UK Visa Checklist for Nigerians | Smooth Application',
    description:
      'Auto-checks your bank statement for issues UK reviewers flag, tracks your documents, and also covers Canada, Schengen, South Africa, Ghana, Kenya, Morocco & Ethiopia. 100% private - runs in your browser, nothing is uploaded.',
    images: [{ url: OG_IMAGE, width: 512, height: 512 }],
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free UK Visa Checklist for Nigerians | Smooth Application',
    description:
      'Auto-checks your bank statement for issues UK reviewers flag. 100% private - runs entirely in your browser, nothing is uploaded.',
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

// Kept as a plain object (not a component) so it's trivially JSON.stringify-able below — same
// SoftwareApplication shape the retired site's own JSON-LD used, deliberately WITHOUT an
// aggregateRating/review field (see this block's own top comment: no genuine review data exists).
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Smooth Application',
  url: SITE_URL,
  description:
    'Free, private visa and travel document-readiness checklist for Nigerian applicants, covering the UK, Canada, Schengen, South Africa, Ghana, Kenya, Morocco and Ethiopia. Automatically checks bank statements for issues reviewers commonly flag - everything runs in your browser, nothing is uploaded.',
  applicationCategory: 'TravelApplication',
  operatingSystem: 'Any (web browser)',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'NGN' },
  audience: { '@type': 'Audience', geographicArea: { '@type': 'Country', name: 'Nigeria' } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Homepage-mockup restyle: matches the new deep-green accent (was #1b6fa8, the old blue). */}
        <meta name="theme-color" content="#145c44" />
        {/* eslint-disable-next-line react/no-danger */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      {/* Homepage-mockup restyle: warm cream sitewide background (was bg-gray-50), matching
          manifest.json's existing PWA background_color for brand continuity. */}
      <body className="min-h-screen bg-cream font-sans text-gray-900 antialiased">
        <Analytics />
        {/* Task #499: wraps the ENTIRE app (landing page, login/admin, quiz, checklist, everything)
            but only ever changes behavior once an applicant has opted into a PIN on this device —
            see AppLockContext.tsx's and secureStorage.ts's own header comments for why this is safe
            to mount here unconditionally rather than scoping it to just the checklist routes. */}
        <AppLockProvider>
          <AppLockGate>{children}</AppLockGate>
        </AppLockProvider>
      </body>
    </html>
  );
}
