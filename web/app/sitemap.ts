import type { MetadataRoute } from 'next';
import { COUNTRIES } from '@/lib/checklist/countries';
import { GUIDES } from '@/lib/guides/guides';

// Direct request: "create SEO for this website." No sitemap existed before this - search engines
// had to discover every route by crawling links alone, and a checklist as deep as this one (18
// sessions per country, see lib/checklist/sessions.ts) is exactly the kind of site where a crawler
// can miss real entry points. Deliberately lists only the pages worth a stranger landing on
// directly from search - the homepage, the confidence quiz, the country-picker, each LIVE
// country's own checklist entry point (only `ready` countries from COUNTRIES - AU/CN/US are
// listed as "coming soon" in the app itself and would be a dead end from search), the
// opportunities directory, and the two legal pages. Deep per-session pages (passport/statement/
// financial/etc. for each country), the personal tracker, and every account/admin route are left
// out on purpose: they're either not meaningful without the country context first, personal to a
// signed-in applicant, or staff-only (see robots.ts for the matching disallow list).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.smoothapplication.com';
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/quiz`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/checklist/start`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/opportunities`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/verify-privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${base}/guides`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    ...GUIDES.map((g) => ({
      url: `${base}/guides/${g.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const countryRoutes: MetadataRoute.Sitemap = COUNTRIES.filter((c) => c.ready).map((c) => ({
    url: `${base}/checklist/${c.code.toLowerCase()}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.9,
  }));

  return [...staticRoutes, ...countryRoutes];
}
