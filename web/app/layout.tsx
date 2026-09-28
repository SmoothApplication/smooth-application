import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Analytics from '@/components/Analytics';

// Design pass (user feedback: "this site needs a UI/UX designer" — live screenshot of the
// homepage): the app had never set a real typeface anywhere, so every page fell back to the
// browser's default system sans-serif — a big, easy-to-miss reason a functional site reads as
// unpolished. Inter is a free, self-hosted (via next/font/google, no external request at runtime)
// typeface built for UI text at small sizes, applied once here so every page inherits it.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Smooth Application',
  description: 'Applicant accounts and admin dashboards for Smooth Application.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
        <Analytics />
        {children}
      </body>
    </html>
  );
}
