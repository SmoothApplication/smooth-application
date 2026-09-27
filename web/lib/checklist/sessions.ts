import { ALL_CHECKLISTS } from '@/lib/checklist/all';

// Phase 2 of the session/sidebar rebuild (task #381): index.html's numbered-session architecture
// ("Session X of N" nav with progress pills and Back/Next) applied across this port's session
// pages.
//
// Ground truth for the real order (pulled directly off the live original's own session pills,
// smoothapplication.github.io/smooth-application, since earlier task history in this repo — "move
// finance2 to session 1" — turned out to be stale relative to what's live today):
//   1  Validate your International Passport
//   2  Travel Experience
//   3  Your responsibilities
//   4  Your trip details
//   5  Income & bank statement analysis
//   6  Financial readiness calculator
//   7  What to do next
//   8-13 the document checklist, one session per CAT_ORDER_<CODE> category (5-6 categories
//        depending on country — see lib/checklist/all.ts), followed by Final review (declaration)
//   14 Reasons
//
// This split (task #383, "start with the document-checklist split") is what turns sessions 8-13
// from one combined screen into the real per-category sessions above: SESSION_ORDER is no longer a
// fixed array, because each country's own CAT_ORDER_<CODE> has a different length and different
// category names (UK has 6 categories incl. "Purpose-specific"; GH/KE/MA have a different 4-5, see
// lib/checklist/all.ts) — buildSessionOrder(code) below builds the real, country-specific list on
// demand from ALL_CHECKLISTS[code].catOrder, rather than assuming every country matches UK's shape.
//
// Not yet split: sessions 3/4 (still one combined "qualifying questions" form, reached via the
// bare /checklist/<code> route — CountryChecklistApp's own view='profile') and a dedicated "Final
// review / declaration" session (13) — no such feature exists in this port yet at all (no
// name/date/confirm-checkbox screen). Both are real, disclosed follow-up work, not silently
// dropped — see task #382.
export type SessionKey =
  | 'passport'
  | 'travel-history'
  | 'statement'
  | 'financial'
  | 'next-steps'
  | `checklist:${number}`
  | 'reasons';

export type SessionDescriptor = {
  key: SessionKey;
  label: string;
  href: (code: string) => string;
};

export function buildSessionOrder(code: string): SessionDescriptor[] {
  const catOrder = ALL_CHECKLISTS[code.toUpperCase()]?.catOrder ?? [];

  const order: SessionDescriptor[] = [
    { key: 'passport', label: 'Validate your International Passport', href: (c) => `/checklist/${c.toLowerCase()}/passport` },
    { key: 'travel-history', label: 'Travel Experience', href: (c) => `/checklist/${c.toLowerCase()}/travel-history` },
    { key: 'statement', label: 'Income & bank statement analysis', href: (c) => `/checklist/${c.toLowerCase()}/statement` },
    { key: 'financial', label: 'Financial readiness calculator', href: (c) => `/checklist/${c.toLowerCase()}/financial` },
    { key: 'next-steps', label: 'What to do next', href: (c) => `/checklist/${c.toLowerCase()}/next-steps` },
  ];

  catOrder.forEach((cat, i) => {
    order.push({
      key: `checklist:${i}`,
      label: cat,
      href: (c) => `/checklist/${c.toLowerCase()}/checklist/${i}`,
    });
  });

  order.push({ key: 'reasons', label: 'Reasons', href: (c) => `/checklist/${c.toLowerCase()}/reasons` });

  return order;
}

export function sessionIndex(code: string, key: SessionKey): number {
  return buildSessionOrder(code).findIndex((s) => s.key === key);
}

export function sessionHref(code: string, key: SessionKey): string {
  const order = buildSessionOrder(code);
  const found = order.find((s) => s.key === key);
  return found ? found.href(code) : `/checklist/${code.toLowerCase()}`;
}

export function prevSessionHref(code: string, key: SessionKey): string | null {
  const order = buildSessionOrder(code);
  const idx = order.findIndex((s) => s.key === key);
  if (idx <= 0) return null;
  return order[idx - 1].href(code);
}

export function nextSessionHref(code: string, key: SessionKey): string | null {
  const order = buildSessionOrder(code);
  const idx = order.findIndex((s) => s.key === key);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1].href(code);
}
