import { ALL_CHECKLISTS } from '@/lib/checklist/all';

// Phase 2 of the session/sidebar rebuild (task #381): index.html's numbered-session architecture
// ("Session X of N" nav with progress pills and Back/Next) applied across this port's session
// pages.
//
// Task #417 (direct request): "rearrange smoothapplication.com to follow the arrangement in
// sessions" on the live original. The EARLIER version of this comment claimed passport was session
// 1, "confirmed directly off the live original's own session pills" — that was wrong, and it's worth
// recording exactly how, since the same mistake is easy to repeat: a plain DOM/text read of the live
// page (or of index.html's own markup order) genuinely does list passport first — the sections are
// all present in one static document and merely paginated by CSS. The actual user-facing order comes
// from a SEPARATE reordering step applied on top of that base array. Ground truth this time is the
// original's own source (raw.githubusercontent.com/SmoothApplication/smooth-application/main/
// index.html), specifically two functions:
//
//   function getVisibleSessionKeys(){
//     var keys = ['passport', 'travelExperience', 'responsibilities', 'trip', 'finance2', 'finance', 'nextSteps'];
//     ...catOrder categories pushed here (as 'cat:'+cat)...
//     if (a.selfEmployed) keys.push('bizLedger');
//     keys.push('review');
//     keys.push('reasons');
//     return keys;
//   }
//   // Founder decision: Income & bank statement analysis (finance2) is the first session applicants
//   // land on ... Rather than reordering keys[] itself — which would silently break every existing
//   // hardcoded goToSessionByPill(page, N) call — the underlying array order stays EXACTLY as
//   // declared above ... Only the user-FACING flow ... follows this flow order instead of the raw
//   // array index.
//   function sessionFlowOrder(keys){
//     if (keys.length < 5) return keys.map(function(_, i){ return i; });
//     var order = [4, 0, 1, 2, 3];
//     for (var i = 5; i < keys.length; i++) order.push(i);
//     return order;
//   }
//
// So the real 14-session order (for an applicant not self-employed — bizLedger only appears for
// self-employed applicants, see below) is:
//   1  Income & bank statement analysis
//   2  Validate your International Passport
//   3  Travel Experience
//   4  Your responsibilities
//   5  Your trip details
//   6  Financial readiness calculator
//   7  What to do next
//   8-12(+) the document checklist, one session per CAT_ORDER_<CODE> category (5-6 categories
//        depending on country — see lib/checklist/all.ts) — unaffected by the reorder above (only
//        indices 0-4 of the base array get moved; everything from index 5 on stays in place)
//   (+1) Business Income Record — self-employed applicants only; not yet ported as a numbered
//        session in this app (BusinessIncomeLedger.tsx exists but isn't wired into buildSessionOrder
//        below — a disclosed gap, out of scope for the reordering fix this task asked for)
//   Final review (declaration)
//   Reasons
//
// This port has no per-key indirection to preserve (no hardcoded pill-index test suite to protect,
// unlike the original's reason for keeping its own base array's index order untouched) — so
// buildSessionOrder below builds `base` in the original's own declared order for clarity/parity with
// that source, then applies the exact same [4, 0, 1, 2, 3, ...rest] permutation before appending the
// per-category/final-review/reasons sessions, rather than just writing the reordered list directly.
//
// This split (task #383, "start with the document-checklist split") is what turns the document-
// checklist run into one session per category rather than one combined screen: SESSION_ORDER is no
// longer a fixed array, because each country's own CAT_ORDER_<CODE> has a different length and
// different category names (UK has 6 categories incl. "Purpose-specific"; GH/KE/MA have a different
// 4-5, see lib/checklist/all.ts) — buildSessionOrder(code) below builds the real, country-specific
// list on demand from ALL_CHECKLISTS[code].catOrder, rather than assuming every country matches UK's
// shape.
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

  // Declared in the original's own base-array order (see the header comment's getVisibleSessionKeys
  // quote) purely for parity/traceability with that source — the actual applicant-facing order comes
  // from the flowOrder permutation applied right below, matching the original's sessionFlowOrder().
  const base: SessionDescriptor[] = [
    { key: 'passport', label: 'Validate your International Passport', href: (c) => `/checklist/${c.toLowerCase()}/passport` },
    { key: 'travel-history', label: 'Travel Experience', href: (c) => `/checklist/${c.toLowerCase()}/travel-history` },
    { key: 'responsibilities', label: 'Your responsibilities', href: (c) => `/checklist/${c.toLowerCase()}/responsibilities` },
    { key: 'trip-details', label: 'Your trip details', href: (c) => `/checklist/${c.toLowerCase()}/trip-details` },
    { key: 'statement', label: 'Income & bank statement analysis', href: (c) => `/checklist/${c.toLowerCase()}/statement` },
    { key: 'financial', label: 'Financial readiness calculator', href: (c) => `/checklist/${c.toLowerCase()}/financial` },
    { key: 'next-steps', label: 'What to do next', href: (c) => `/checklist/${c.toLowerCase()}/next-steps` },
  ];

  // [4, 0, 1, 2, 3, 5, 6] — statement first, then passport/travel/responsibilities/trip in their
  // original relative order, then financial/next-steps unchanged. Exactly index.html's
  // sessionFlowOrder([4, 0, 1, 2, 3, ...rest]).
  const order: SessionDescriptor[] = [4, 0, 1, 2, 3, 5, 6].map((i) => base[i]);

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
