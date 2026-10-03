// Direct request (consultant workflow): clients are busy, so instead of an empty "What was this for?"
// dropdown, each major sender gets a SUGGESTED reason the client only has to confirm ("Yes, that's
// right") or change. This is the in-app version of what the consultant does by hand today: read the
// narration, make an informed guess, send it back for "true or false".
//
// Deliberately conservative and fully on-device: it reads only the narrations already on screen and
// the group's type; it never looks anything up online (that would send names off the device, which
// the privacy promise rules out). When there isn't a real signal it returns null and the dropdown
// stays blank rather than guessing.
import type { SourceGroup } from './types';
import { extractRemitaPurpose, remitaCategory } from './remitaReason';
import { extractNarrationReason } from './classify';

export interface ReasonSuggestion {
  /** One of UNEXPLAINED_REASON_OPTIONS' values. */
  value: string;
  /** The exact UNEXPLAINED_REASON_OPTIONS label (so accepting it round-trips as a canonical pick). */
  label: string;
  /** Plain-language "why we think so", shown next to the suggestion. */
  why: string;
}

// Same labels as UNEXPLAINED_REASON_OPTIONS in flaggedReasons.ts. Duplicated as a lookup (not
// imported) only to keep this module dependency-free; a test asserts they stay in sync.
const LABELS: Record<string, string> = {
  salary: 'Salary from my employer',
  allowance: 'Allowance or bonus from my employer',
  family: 'Family support',
  gift: 'Gift',
  loan: 'Loan or loan repayment',
  business: 'Business or trade payment',
  savings_group: 'Savings group contribution (ajo/esusu/cooperative)',
  rent: 'Rent I collect from a tenant',
  refund: 'Refund',
  sale: 'Sale of a personal item or property',
  errand: 'Errand (money sent to run an errand or buy something for someone)',
};

// Checked in order; first hit wins. Whole-word-ish patterns so "rental" is not caught by "rent"
// accidentally inside another word.
const KEYWORD_RULES: { value: string; re: RegExp; word: string }[] = [
  { value: 'rent', re: /\brent(al)?\b/i, word: 'rent' },
  { value: 'loan', re: /\b(loan|repay(ment)?|borrow(ed)?)\b/i, word: 'loan' },
  { value: 'savings_group', re: /\b(ajo|esusu|thrift|coop(erative)?|contribution)\b/i, word: 'savings group' },
  { value: 'refund', re: /\brefund\b/i, word: 'refund' },
  { value: 'sale', re: /\b(sale|sold|proceeds)\b/i, word: 'sale' },
  { value: 'errand', re: /\b(errand|errands)\b/i, word: 'errand' },
  { value: 'gift', re: /\b(birthday|b'?day|hbd|gift|christmas|wedding|anniversary)\b/i, word: 'gift' },
  { value: 'business', re: /\b(invoice|contract|consult(ing|ancy)?|supply|supplies|service(s)?|commission|business)\b/i, word: 'business' },
];

// Types that never need a reason (the applicant's own money or an automatic movement) or that are
// too generic to guess.
const NO_SUGGESTION_TYPES = new Set(['self', 'reversal', 'interest', 'internal', 'other']);

export function suggestReasonForGroup(group: Pick<SourceGroup, 'type' | 'txns'>): ReasonSuggestion | null {
  if (group.type === 'salary') return { value: 'salary', label: LABELS.salary, why: 'these are your regular employer payments' };
  if (NO_SUGGESTION_TYPES.has(group.type)) return null;
  const text = (group.txns || []).map((t) => t.narration || '').join(' | ');
  for (const rule of KEYWORD_RULES) {
    const m = rule.re.exec(text);
    if (m) {
      return { value: rule.value, label: LABELS[rule.value], why: `the bank narration mentions "${m[0].toLowerCase()}"` };
    }
  }
  if (group.type === 'family') {
    return { value: 'family', label: LABELS.family, why: 'this sender shares your surname' };
  }
  if (group.type === 'company') {
    if (/\bREMITA\b/i.test(text)) {
      return { value: 'business', label: LABELS.business, why: 'paid through Remita, which is how employers and government bodies pay staff - likely your employer, so say which allowance or bonus it was' };
    }
    return { value: 'business', label: LABELS.business, why: 'this sender looks like a company' };
  }
  return null;
}

export type ReviewStatus = 'confirmed' | 'edited' | 'needs_review';

/** For the spreadsheet: was the final answer the suggestion (confirmed), something else (edited),
 * or still blank? A group with no suggestion and an answer counts as "edited" (the client supplied
 * it); no answer at all is "needs review". */
export function reviewStatusFor(suggestion: ReasonSuggestion | null, finalReasonLabel: string): ReviewStatus {
  const answer = (finalReasonLabel || '').trim();
  if (!answer) return 'needs_review';
  if (suggestion && answer === suggestion.label) return 'confirmed';
  return 'edited';
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  confirmed: 'Confirmed',
  edited: 'Edited by you',
  needs_review: 'Needs your review',
};

// Sheet column "Suggested reason" - kept deliberately simple: whatever the statement itself says.
// Order: Salary first, then Allowances, then everything else in the order found.
const CATEGORY_ORDER = ['Salary', 'Allowances'];
const TEXT_CATEGORIES: { re: RegExp; label: (m: RegExpExecArray) => string }[] = [
  { re: /\bsalar(y|ies)\b/i, label: () => 'Salary' },
  { re: /\ballowances?\b/i, label: () => 'Allowances' },
  { re: /\bbonus\b/i, label: () => 'Bonus' },
  { re: /\b(birthday|b'?day|hbd)\b/i, label: (m) => 'Gift (' + (m[0].toLowerCase() === 'hbd' ? 'birthday' : m[0].toLowerCase()) + ')' },
];

export function describeGroupForSheet(group: Pick<SourceGroup, 'type' | 'txns'> & { name?: string }): string {
  const cats: string[] = [];
  const add = (c: string) => { if (cats.indexOf(c) === -1) cats.push(c); };
  (group.txns || []).forEach((t) => {
    const purpose = extractRemitaPurpose(t.narration);
    if (purpose) add(remitaCategory(purpose));
    TEXT_CATEGORIES.forEach((tc) => {
      const m = tc.re.exec(t.narration || '');
      if (m) add(tc.label(m));
    });
  });
  if (cats.length) {
    const rank = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? CATEGORY_ORDER.length : i; };
    return cats.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map((x) => x.c).join(', ');
  }
  const sug = suggestReasonForGroup(group);
  if (sug) return sug.label;
  // Anything left that is wording but not a name: surface it for the reviewer instead of dropping it.
  const nameWords = group.name ? group.name.toUpperCase().split(/\s+/) : [];
  for (const t of group.txns || []) {
    const leftover = extractNarrationReason(t.narration, nameWords);
    if (leftover && !/^(to|from)\b/i.test(leftover)) return 'Check: ' + leftover;
  }
  return '';
}
