// Shared checklist domain types and pure scoring logic, used by every country's checklist (UK,
// Canada, the EU, South Africa, Ghana, Kenya, Ethiopia, Morocco) — not UK-specific despite having
// started life inside uk.ts.
//
// Extracted from lib/checklist/uk.ts (code-quality pass, no behaviour change): Answers/
// DEFAULT_ANSWERS/ChecklistItem and the itemApplies/computeOverallPercent/computeRequiredPercent/
// requiredStatus/missingRequiredItems functions were always generic — every other country file
// (ca.ts, eu.ts, za.ts, gh.ts, ke.ts, et.ts, ma.ts) already imported them FROM uk.ts, which read
// oddly to a reviewer: the shared domain model living inside one specific country's module. uk.ts
// re-exports everything below (`export * from './types'`) so no existing import path breaks.
export type Answers = {
  employed: boolean;
  selfEmployed: boolean;
  student: boolean;
  studentSponsor: boolean;
  married: boolean;
  /** Task #418 (direct request, screenshot comparison against the original's own live "Your
   * responsibilities" session): a real Single/Married/Divorced choice, not just a yes/no checkbox —
   * this was already built in the pre-Next.js-rebuild codebase (task #206, "replace 'I'm married'
   * checkbox with marital status dropdown") but never carried over. `married` above stays a derived
   * boolean (`maritalStatus === 'married'`), kept as its own field because it's what every existing
   * appliesIf condition and self-detection check already reads — see ResponsibilitiesSession.tsx's
   * onChange, which sets both together. Picking "Single" also clears numKids, matching the original
   * ("do not add the cost of school fees" for someone who isn't a parent). Deliberately NOT porting
   * the original's separate Gender/maiden-name fields here: gender is already captured off the
   * passport scan's MRZ (lib/passport/mrz.ts), and maiden name already has its own, already-wired
   * field on the bank-statement page (StatementDashboard.tsx's onMaidenNameChange, feeding
   * buildIncomeSourceBreakdown) — duplicating either here would just be two answers that could
   * disagree with each other, not two chances to get it right. */
  maritalStatus: '' | 'single' | 'married' | 'divorced';
  spouseSponsoring: boolean;
  /** Spouse/sponsor decision tool (task #319+, ported from index.html's rs_spouseWilling/
   * rs_spouseEmployed/rs_spouseUkHistory + rs_spouseName) — feeds getSponsorRecommendation() in
   * lib/checklist/sponsor.ts. spouseSponsoring above remains the one flag spouseSponsorFinance's
   * appliesIf actually reads; these three plus the name are advisory inputs only. */
  spouseName: string;
  spouseWilling: '' | 'yes' | 'no';
  spouseEmployed: '' | 'yes' | 'no';
  spouseUkHistory: '' | 'yes' | 'no';
  hasHost: boolean;
  hostFunding: boolean;
  hasChild: boolean;
  /** Task #418: "How many children do you have?" (0-10) — the applicant's own family situation,
   * kept separate from hasChild above (whether a child is specifically travelling on THIS trip).
   * Stored as a string, same empty-means-"not answered" convention index.html used, so an untouched
   * field doesn't silently count as 0 kids for the school-fee estimate below. Clearing this (picking
   * "Single" in maritalStatus, or clearing it directly) hides and zeroes out the school-fee line in
   * the yearly cost summary — see lib/checklist/livingCost.ts's computeYearlyCostSummary(). */
  numKids: string;
  /** Task #418: "Where do you live?" — State/LGA of the applicant's own Nigerian residence (not the
   * destination country), used only to pre-fill the rent estimate below via
   * lib/checklist/livingCost.ts's getEstimatedAnnualRent(). See lib/checklist/nigeriaLocations.ts
   * for the full State -> LGA data, transcribed from the original. */
  livingState: string;
  livingLga: string;
  /** Eti Osa (Lagos) spans genuinely incomparable neighbourhoods blended into one rent range —
   * only shown/consulted when livingState==='Lagos' && livingLga==='Eti Osa'. */
  etiOsaArea: string;
  /** A single premium enclave sitting inside an otherwise fairly uniform LGA (Ikeja GRA, Ogudu GRA)
   * — only shown/consulted for the Lagos LGAs listed in LAGOS_PREMIUM_POCKET. */
  premiumPocket: boolean;
  bedrooms: '' | 'room' | '1bed' | '2bed' | '3bed' | '4bedDuplex' | '5bedDuplex' | 'other';
  addressNumber: string;
  addressName: string;
  /** "Estimated yearly cost of living" — annualRent is auto-filled from getEstimatedAnnualRent() the
   * first time enough is known to estimate it, but the UI never overwrites a value the applicant has
   * typed themselves (tracked via a separate "what did we last auto-fill" ref, same idiom as
   * index.html's data-autofilled attribute). monthlyUpkeep/schoolFeePerTerm get a one-time generic
   * starting figure, same as the original. All three stay plain strings so an untouched field reads
   * as "not entered" rather than a silent 0. */
  annualRent: string;
  monthlyUpkeep: string;
  schoolFeePerTerm: string;
  /** Task #418: "I have aged parents I support" — father/mother names + an independent "passed
   * away / not applicable" checkbox per parent (which disables/clears that name field, same as the
   * original), how much the applicant sends them monthly, and an explicit opt-in to have that
   * remittance figure checked against their own bank statement (advisory only here — no automated
   * cross-check is wired up yet, same disclosed gap the original's own verifyConsent checkbox left
   * for a human reviewer rather than promising an automated match). */
  agedParents: boolean;
  fatherName: string;
  motherName: string;
  fatherDeceased: boolean;
  motherDeceased: boolean;
  remittanceAmount: string;
  remittanceVerifyConsent: boolean;
  hasRefusal: boolean;
  translation: boolean;
  readyToSubmit: boolean;
  purpose: '' | 'tourism' | 'business' | 'conference' | 'medical' | 'family' | 'wedding' | 'academic' | 'training';
  /** Task #386 (Final review/declaration session): port of index.html's decl_name/decl_date/
   * decl_confirm fields (~line 6470, function updateDeclaration()) — the applicant's own signed-off
   * statement that everything entered is accurate, shown on the last real session before Reasons. */
  declarationName: string;
  declarationDate: string;
  declarationConfirmed: boolean;
};

export const DEFAULT_ANSWERS: Answers = {
  employed: false,
  selfEmployed: false,
  student: false,
  studentSponsor: false,
  married: false,
  maritalStatus: '',
  spouseSponsoring: false,
  spouseName: '',
  spouseWilling: '',
  spouseEmployed: '',
  spouseUkHistory: '',
  hasHost: false,
  hostFunding: false,
  hasChild: false,
  numKids: '',
  livingState: '',
  livingLga: '',
  etiOsaArea: '',
  premiumPocket: false,
  bedrooms: '',
  addressNumber: '',
  addressName: '',
  annualRent: '',
  monthlyUpkeep: '',
  schoolFeePerTerm: '',
  agedParents: false,
  fatherName: '',
  motherName: '',
  fatherDeceased: false,
  motherDeceased: false,
  remittanceAmount: '',
  remittanceVerifyConsent: false,
  hasRefusal: false,
  translation: false,
  readyToSubmit: false,
  purpose: '',
  declarationName: '',
  declarationDate: '',
  declarationConfirmed: false,
};

export type ChecklistItem = {
  id: string;
  cat: string;
  subcat?: string;
  label: string;
  weight: 'required' | 'recommended';
  tip?: string;
  appliesIf?: (a: Answers) => boolean;
};

export function itemApplies(item: ChecklistItem, a: Answers): boolean {
  return item.appliesIf ? item.appliesIf(a) : true;
}

// Takes the checklist explicitly (rather than always using CHECKLIST_UK) so it works correctly
// for every ported country, not just the UK — see regression tests in __tests__/percent.test.ts
// for the bug this used to have when every country's percent was silently computed against the
// UK's (much longer) item list.
export function computeOverallPercent(checklist: ChecklistItem[], a: Answers, checked: Record<string, boolean>): number {
  const applicable = checklist.filter((it) => itemApplies(it, a));
  if (!applicable.length) return 0;
  const done = applicable.filter((it) => checked[it.id]).length;
  return Math.round((done / applicable.length) * 100);
}

// Verbatim port of index.html's updateScore() "Documents" readiness score (~line 6328): required
// items ONLY, not required+recommended like computeOverallPercent above. Session/sidebar rebuild
// (task #380, matching the original's "Readiness scores" card) — the original's single Documents
// score has always been required-only, so recommended-but-unchecked items don't quietly drag it
// down the way computeOverallPercent's broader denominator does.
export function computeRequiredPercent(checklist: ChecklistItem[], a: Answers, checked: Record<string, boolean>): number {
  const required = checklist.filter((it) => it.weight === 'required' && itemApplies(it, a));
  if (!required.length) return 0;
  const done = required.filter((it) => checked[it.id]).length;
  return Math.round((done / required.length) * 100);
}

export type RequiredStatus = { label: string; tone: 'neutral' | 'critical' | 'serious' | 'warning' | 'good' };

// Verbatim port of updateScore()'s statusPill thresholds/copy.
export function requiredStatus(pct: number): RequiredStatus {
  if (pct === 0) return { label: 'Getting started', tone: 'neutral' };
  if (pct < 50) return { label: 'Just getting going', tone: 'critical' };
  if (pct < 80) return { label: 'Making progress', tone: 'serious' };
  if (pct < 100) return { label: 'Almost there', tone: 'warning' };
  return { label: 'All required documents ready', tone: 'good' };
}

// Verbatim port of the "Still missing" list source: every applicable required item not yet
// checked, in checklist order (same order updateScore() builds missList from).
export function missingRequiredItems(checklist: ChecklistItem[], a: Answers, checked: Record<string, boolean>): ChecklistItem[] {
  return checklist.filter((it) => it.weight === 'required' && itemApplies(it, a) && !checked[it.id]);
}
