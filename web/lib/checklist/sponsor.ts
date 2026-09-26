// Port of index.html's renderSponsorRecommendation() (lines 7431-7473, as of the September 2026
// index.html) — task #319+. Field-work insight carried over verbatim: "who actually applies, and
// whose money pays for it" is a real, open decision for a married applicant, not something this
// checklist should silently assume is always "you, self-funded". This module is the pure
// recommendation logic ONLY — deliberately scoped to just the 3-question spouse/sponsor decision,
// NOT the much larger "What to do next" hard-gated report session (renderNextStepsReport()) the
// original embeds this tool inside (passport-validity + travel-history-strength + finance-readiness
// synthesis). That's a separate, much bigger feature that hasn't been requested for this port.
//
// Deliberately advisory only: nothing here changes the required-documents list on its own — that
// only happens once the applicant actively ticks the confirm checkbox the UI shows when
// showConfirm is true (see the checklist item this gates, spouseSponsorFinance, keyed off
// Answers.spouseSponsoring in uk.ts/ca.ts/eu.ts/za.ts etc.).
export type YesNo = '' | 'yes' | 'no';

export interface SponsorAnswers {
  spouseWilling: YesNo;
  spouseEmployed: YesNo;
  spouseUkHistory: YesNo;
}

export type SponsorRecommendationKind = 'spouse_history' | 'sponsor_eligible' | 'sponsor_weak' | 'no_sponsor';

export interface SponsorRecommendation {
  kind: SponsorRecommendationKind;
  /** Mirrors the original's showConfirm/confirmRow.style.display logic: only the "eligible sponsor"
   * branch surfaces the "tick this if you want this route" confirm checkbox. */
  showConfirm: boolean;
}

// Same if/else-if precedence as the original: spouseUkHistory==='yes' is checked FIRST and wins
// regardless of the other two answers (a spouse with proven travel history is a distinct framing
// choice, not something that competes with the sponsor-eligibility question). Returns null when
// none of the four branches match (original: box.innerHTML stays '') — e.g. nothing answered yet,
// or spouseWilling==='' with spouseUkHistory!=='yes'.
export function getSponsorRecommendation(answers: SponsorAnswers): SponsorRecommendation | null {
  if (answers.spouseUkHistory === 'yes') {
    return { kind: 'spouse_history', showConfirm: false };
  }
  if (answers.spouseWilling === 'yes' && answers.spouseEmployed === 'yes') {
    return { kind: 'sponsor_eligible', showConfirm: true };
  }
  if (answers.spouseWilling === 'yes' && answers.spouseEmployed === 'no') {
    return { kind: 'sponsor_weak', showConfirm: false };
  }
  if (answers.spouseWilling === 'no') {
    return { kind: 'no_sponsor', showConfirm: false };
  }
  return null;
}

/** spouseName.trim() || 'your spouse' — same fallback as the original's `spouseRef`. */
export function resolveSpouseRef(spouseName: string): string {
  const trimmed = spouseName.trim();
  return trimmed || 'your spouse';
}
