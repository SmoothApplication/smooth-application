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
// Sessions 3/4 (task #382, "split qualifying-questions form into Sessions 3 and 4"): the old
// combined "qualifying questions" form (CountryChecklistApp's view==='profile') is now split into
// ResponsibilitiesSession.tsx (session 3, "Your responsibilities" — employment/marital/spouse-
// sponsor/host/child fields) and TripDetailsSession.tsx (session 4, "Your trip details" — purpose,
// refusal history, translation need, application-started status), each with its own real numbered
// route/session slot below. CountryChecklistApp's own flat profile view is unchanged and still
// reachable by a direct visit to the bare /checklist/<code> route (same "fallback, not linked from
// the numbered flow" treatment already given to its combined checklist view in task #383) — both
// read/write the exact same sa_<code>_answers key, so answers filled in one place show up in the
// other.
//
// Session 13, "Final review" (task #386): built directly off the original's own markup/JS (the
// "review" session key) rather than guessed — it bundles three cards: an "Are you ready?" required-
// documents summary (verbatim reuse of missingRequiredItems/computeRequiredPercent from
// lib/checklist/uk.ts), a static "Documents best avoided as sole evidence" note, and the Declaration
// form itself (full name / date / confirm-checkbox, ported as Answers.declarationName/
// declarationDate/declarationConfirmed). See components/checklist/FinalReviewSession.tsx.
export type SessionKey =
  | 'passport'
  | 'travel-history'
  | 'responsibilities'
  | 'trip-details'
  | 'statement'
  | 'financial'
  | 'next-steps'
  | `checklist:${number}`
  | 'final-review'
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
    { key: 'responsibilities', label: 'Your responsibilities', href: (c) => `/checklist/${c.toLowerCase()}/responsibilities` },
    { key: 'trip-details', label: 'Your trip details', href: (c) => `/checklist/${c.toLowerCase()}/trip-details` },
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

  order.push({ key: 'final-review', label: 'Final review', href: (c) => `/checklist/${c.toLowerCase()}/final-review` });
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
