// Follow-up to task #456/#457 ("create SEO for this website"): the root layout's metadata (title,
// description, OG/Twitter tags) is UK-led and generic across every route, so a Nigerian applicant
// searching specifically for "Ghana travel checklist" or "Schengen visa checklist Nigeria" saw the
// same UK-branded snippet in search results as someone looking for the UK page — a real gap for a
// site that already supports 8 countries. Each entry mirrors the visa/travel-document type actually
// used on that country's own checklist (see visaNameByCode in app/checklist/[country]/page.tsx and
// app/checklist/uk/page.tsx) so the copy stays accurate rather than inventing visa names.
export interface CountrySeoCopy {
  title: string;
  description: string;
}

export const COUNTRY_SEO: Record<string, CountrySeoCopy> = {
  UK: {
    title: 'UK Visitor Visa Checklist for Nigerians',
    description:
      'Free UK Standard Visitor visa document checklist for Nigerian applicants. Auto-checks your bank statement for issues reviewers flag — 100% private, runs entirely in your browser.',
  },
  CA: {
    title: 'Canada Visitor Visa Checklist for Nigerians',
    description:
      'Free Canada visitor visa (TRV) document checklist for Nigerian applicants. Auto-checks your bank statement for issues reviewers flag — 100% private, runs entirely in your browser.',
  },
  EU: {
    title: 'Schengen Visa Checklist for Nigerians',
    description:
      'Free Schengen short-stay visa document checklist for Nigerian applicants. Auto-checks your bank statement for issues reviewers flag — 100% private, runs entirely in your browser.',
  },
  ZA: {
    title: 'South Africa Visitor Visa Checklist for Nigerians',
    description:
      "Free South Africa visitor's visa document checklist for Nigerian applicants. Auto-checks your bank statement for issues reviewers flag — 100% private, runs entirely in your browser.",
  },
  GH: {
    title: 'Ghana Travel Checklist for Nigerians',
    description:
      'Free Ghana travel-readiness document checklist for Nigerian applicants. Auto-checks your bank statement for issues reviewers flag — 100% private, runs entirely in your browser.',
  },
  KE: {
    title: 'Kenya Travel Checklist for Nigerians (eTA)',
    description:
      'Free Kenya eTA travel-readiness document checklist for Nigerian applicants. Auto-checks your bank statement for issues reviewers flag — 100% private, runs entirely in your browser.',
  },
  ET: {
    title: 'Ethiopia Tourist e-Visa Checklist for Nigerians',
    description:
      'Free Ethiopia tourist e-visa document checklist for Nigerian applicants. Auto-checks your bank statement for issues reviewers flag — 100% private, runs entirely in your browser.',
  },
  MA: {
    title: 'Morocco Travel Checklist for Nigerians',
    description:
      'Free Morocco travel-readiness document checklist for Nigerian applicants. Auto-checks your bank statement for issues reviewers flag — 100% private, runs entirely in your browser.',
  },
};
