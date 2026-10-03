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
  family: 'Family support',
  gift: 'Gift',
  loan: 'Loan or loan repayment',
  business: 'Business or trade payment',
  savings_group: 'Savings group contribution (ajo/esusu/cooperative)',
  rent: 'Rent I collect from a tenant',
  refund: 'Refund',
  sale: 'Sale of a personal item or property',
};

// Checked in order; first hit wins. Whole-word-ish patterns so "rental" is not caught by "rent"
// accidentally inside another word.
const KEYWORD_RULES: { value: string; re: RegExp; word: string }[] = [
  { value: 'rent', re: /\brent(al)?\b/i, word: 'rent' },
  { value: 'loan', re: /\b(loan|repay(ment)?|borrow(ed)?)\b/i, word: 'loan' },
  { value: 'savings_group', re: /\b(ajo|esusu|thrift|coop(erative)?|contribution)\b/i, word: 'savings group' },
  { value: 'refund', re: /\brefund\b/i, word: 'refund' },
  { value: 'sale', re: /\b(sale|sold|proceeds)\b/i, word: 'sale' },
  { value: 'gift', re: /\b(birthday|b'?day|hbd|gift|christmas|wedding|anniversary)\b/i, word: 'gift' },
  { value: 'business', re: /\b(invoice|contract|consult(ing|ancy)?|supply|supplies|service(s)?|commission|business)\b/i, word: 'business' },
];

// Types that never need a reason (the applicant's own money or an automatic movement) or that are
// too generic to guess.
const NO_SUGGESTION_TYPES = new Set(['salary', 'self', 'reversal', 'interest', 'internal', 'other']);

export function suggestReasonForGroup(group: Pick<SourceGroup, 'type' | 'txns'>): ReasonSuggestion | null {
  if (NO_SUGGESTION_TYPES.has(group.type)) return null;
  const text = (group.txns || []).map((t) => t.narration || '').join(' | ');
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(text)) {
      return { value: rule.value, label: LABELS[rule.value], why: `the bank narration mentions "${rule.word}"` };
    }
  }
  if (group.type === 'family') {
    return { value: 'family', label: LABELS.family, why: 'this sender shares your surname' };
  }
  if (group.type === 'company') {
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
