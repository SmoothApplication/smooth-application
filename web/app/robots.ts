import type { MetadataRoute } from 'next';

// Direct request: "create SEO for this website." No robots.txt existed at all before this — search
// engines were crawling smoothapplication.com with no guidance, and could just as easily index the
// staff-only /admin/* dashboards (Super Admin/sub-admin, tasks #241-243) as the real applicant-
// facing pages. Disallowing /admin, /api, and the account-management flow (login/create-password/
// forgot-password/reset-password) keeps the sitemap and crawl budget pointed at what an applicant
// actually searches for, and keeps staff-only URLs out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/login', '/create-password', '/forgot-password', '/reset-password', '/account'],
    },
    sitemap: 'https://www.smoothapplication.com/sitemap.xml',
  };
}
