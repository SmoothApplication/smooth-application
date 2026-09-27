// Phase 2 of the session/sidebar rebuild (task #381): a first real slice of index.html's
// numbered-session architecture — "Session X of N" nav with progress pills and Back/Next — applied
// to the three biggest, already-built pieces of the checklist flow: the bank statement check, the
// financial calculator, and the document checklist itself.
//
// Scope, disclosed rather than silently partial: the original interleaves 14 sessions (including
// per-category document sessions, passport, business ledger, travel history, next steps, reasons,
// and a final review) via sessionFlowOrder()/sessionLabel() (index.html ~line 5220-5256), all inside
// ONE single-page app with client-side session switching. This port is still several separate
// Next.js routes, so replicating all 14 exactly would mean merging Passport/BusinessIncomeLedger/
// TravelHistory/NextStepsReport/Reasons into this same shell too — a bigger follow-up left for
// later. What ships now is the part of this feedback that was most direct and highest-impact: "the
// site is not the way i arranged it... income analysis comes 1st" — so the flow that IS paginated
// puts the bank statement / income session first, exactly like the original's Session 1, with a real
// Back/Next between it, the financial calculator, and the document checklist. Passport scan,
// business ledger, travel history, next steps, and reasons remain reachable as links from the
// document-checklist session, same as before this change — not yet part of the numbered flow.
export type SessionKey = 'statement' | 'financial' | 'checklist';

export type SessionDescriptor = {
  key: SessionKey;
  label: string;
  href: (code: string) => string;
};

export const SESSION_ORDER: SessionDescriptor[] = [
  { key: 'statement', label: 'Income & bank statement analysis', href: (code) => `/checklist/${code.toLowerCase()}/statement` },
  { key: 'financial', label: 'Financial readiness calculator', href: (code) => `/checklist/${code.toLowerCase()}/financial` },
  { key: 'checklist', label: 'Document checklist', href: (code) => `/checklist/${code.toLowerCase()}` },
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
