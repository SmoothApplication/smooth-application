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
//   8  Identity & application       \
//   9  Financial evidence           |  the document checklist, split into one
//   10 Ties to Nigeria              |  session per CAT_ORDER_UK category
//   11 Accommodation & UK host      |
//   12 Travel details               /
//   13 Final review (declaration)
//   14 Reasons
//
// This port doesn't yet split sessions 3/4 (still one combined "qualifying questions" form) or
// 8-13 (still one combined document-checklist screen, with no separate "Final review/declaration"
// feature built at all) — that's real, disclosed follow-up work, not silently dropped. What ships
// now: the order below reflects the REAL relative order of everything that IS already a single
// standalone page (passport, travel history, income/statement, financial calculator, what-to-do-
// next, reasons), with the still-combined qualifying-questions-plus-document-checklist screen kept
// as one placeholder slot in its approximate real position (after "what to do next", before
// "reasons") rather than left first the way it was before this pass. Splitting that placeholder
// into its real 8 sessions (3, 4, and 8-13) is the next slice of task #381.
export type SessionKey =
  | 'passport'
  | 'travel-history'
  | 'statement'
  | 'financial'
  | 'next-steps'
  | 'checklist'
  | 'reasons';

export type SessionDescriptor = {
  key: SessionKey;
  label: string;
  href: (code: string) => string;
};

export const SESSION_ORDER: SessionDescriptor[] = [
  { key: 'passport', label: 'Validate your International Passport', href: (code) => `/checklist/${code.toLowerCase()}/passport` },
  { key: 'travel-history', label: 'Travel Experience', href: (code) => `/checklist/${code.toLowerCase()}/travel-history` },
  { key: 'statement', label: 'Income & bank statement analysis', href: (code) => `/checklist/${code.toLowerCase()}/statement` },
  { key: 'financial', label: 'Financial readiness calculator', href: (code) => `/checklist/${code.toLowerCase()}/financial` },
  { key: 'next-steps', label: 'What to do next', href: (code) => `/checklist/${code.toLowerCase()}/next-steps` },
  { key: 'checklist', label: 'Your responsibilities, trip details & document checklist', href: (code) => `/checklist/${code.toLowerCase()}` },
  { key: 'reasons', label: 'Reasons', href: (code) => `/checklist/${code.toLowerCase()}/reasons` },
];

export function sessionIndex(key: SessionKey): number {
  return SESSION_ORDER.findIndex((s) => s.key === key);
}

export function sessionHref(key: SessionKey, code: string): string {
  const found = SESSION_ORDER.find((s) => s.key === key);
  return found ? found.href(code) : `/checklist/${code.toLowerCase()}`;
}

export function prevSessionHref(key: SessionKey, code: string): string | null {
  const idx = sessionIndex(key);
  if (idx <= 0) return null;
  return SESSION_ORDER[idx - 1].href(code);
}

export function nextSessionHref(key: SessionKey, code: string): string | null {
  const idx = sessionIndex(key);
  if (idx < 0 || idx >= SESSION_ORDER.length - 1) return null;
  return SESSION_ORDER[idx + 1].href(code);
}
