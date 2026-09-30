// Two live-reported bugs share the same root cause: a readiness score in ChecklistSidebar.tsx is
// computed from a localStorage key that's only ever read once on mount by the component that owns
// it (useChecklistState.ts for `checked`, ChecklistSidebar's own effect for `sa_<code>_financial`).
// When a DIFFERENT component on the same page writes to that key — PassportCheck.tsx auto-ticking
// the 'passport' checklist item, or the statement dashboard seeding financial data from an analyzed
// statement — nothing tells the sidebar to re-read it, so the applicant sees a stale 0%/"Getting
// started" score right next to work they just finished, without a page reload.
//
// A plain `window` CustomEvent is enough here: everything involved already lives in the same tab,
// there's no cross-tab requirement, and it avoids adding a context/store just to fan out "go re-read
// localStorage" to a couple of listeners.
export const CHECKLIST_UPDATED_EVENT = 'sa:checklist-updated';
export const FINANCIAL_UPDATED_EVENT = 'sa:financial-updated';

export function dispatchChecklistUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHECKLIST_UPDATED_EVENT));
}

export function dispatchFinancialUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FINANCIAL_UPDATED_EVENT));
}
