'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageview } from '@/lib/analytics';

// Task #419 (direct request: "I want it to count as it counts before so I can trace the number of
// people who hit the website"): mounted once in the root layout (app/layout.tsx) so it runs on
// every route in the app — unlike trackEvent()'s funnel events, which only fire when a specific
// button gets clicked, this fires on every real page load AND every client-side route change (the
// App Router doesn't do full page reloads between pages, so a plain useEffect keyed on the pathname
// is what stands in for "a new page was requested").
//
// Deliberately skips /admin/* — that's internal staff traffic (the Super Admin / sub-admin
// dashboards from tasks #241-243), not applicant traffic, and mixing the two would make "how many
// people hit the website" answer the wrong question.
export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    trackPageview(pathname);
  }, [pathname]);

  return null;
}
