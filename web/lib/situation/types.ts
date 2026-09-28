// The "Where are you in the process?" gate — ported from index.html's #situationGate. Shown after
// the country/consent pick, before the checklist itself, so an applicant who isn't in the
// fresh-application case gets pointed somewhere more useful than the standard checklist flow.

// Task #408 (direct request, screenshot): added 'reapplying' as a 4th option alongside the
// original 3 — someone who has successfully held this visa (or a similar one) before and is now
// renewing or applying again, distinct from 'fresh' (never applied, or it's been a while) and
// 'refused' (previously turned down). It has no dedicated follow-up panel below the grid (same as
// 'fresh') since there's no different routing advice to give — it exists so that applicant sees
// themselves reflected in the options rather than picking the closest-sounding one.
export type SituationKind = 'fresh' | 'refused' | 'paid' | 'reapplying';

export type RefusalRoutingTarget = 'finance2' | 'restart';

export interface RefusalRouting {
  target: RefusalRoutingTarget;
  /** Months between the refusal date and now, or null if no date was available (shouldn't
   * normally happen — both the OCR path and the manual-entry path require a date first — but the
   * routing logic fails safe toward 'finance2' rather than throwing if it ever is). */
  months: number | null;
}
