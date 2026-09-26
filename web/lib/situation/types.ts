// The "Where are you in the process?" gate — ported from index.html's #situationGate. Shown after
// the country/consent pick, before the checklist itself, so an applicant who isn't in the
// fresh-application case gets pointed somewhere more useful than the standard checklist flow.

export type SituationKind = 'fresh' | 'refused' | 'paid';

export type RefusalRoutingTarget = 'finance2' | 'restart';

export interface RefusalRouting {
  target: RefusalRoutingTarget;
  /** Months between the refusal date and now, or null if no date was available (shouldn't
   * normally happen — both the OCR path and the manual-entry path require a date first — but the
   * routing logic fails safe toward 'finance2' rather than throwing if it ever is). */
  months: number | null;
}
