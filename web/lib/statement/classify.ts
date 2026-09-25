// Classification, ported from index.html (~lines 11741-12106, 11858-11957, 12431-12469, 12938-13026,
// 13768-14125).

import type {
  ParsedTxn,
  SourceGroup,
  SourceGroups,
  DuplicateSenderPair,
  ApplySenderDuplicateDecisionsResult,
  TopConsistentSendersResult,
} from './types';
import {
  BANK_NARRATION_STOPWORDS,
  extractNameCandidatesDetailed,
  RECIPIENT_MARKERS,
  toTitleCase,
  isLikelyApplicantsOwnName,
  surnameOf,
  sharesSurname,
  namesLooselyMatch,
  classifySourceType,
  senderSideCandidates,
  senderSideCandidatesForSelfCheck,
  nameMatchWords,
  identifyIncomeSourceName,
} from './names';
import { identifyStableIncome } from './parse';

export function isReversalNarration(narrationOrTxn: string | ParsedTxn | null | undefined): boolean {
  const isTxn = !!narrationOrTxn && typeof narrationOrTxn === 'object';
  const narration = isTxn ? (narrationOrTxn as ParsedTxn).narration : (narrationOrTxn as string | null | undefined);
  if (/\brvsl\b|\brsvl\b|\breversal\b/i.test(narration || '')) return true;
  return !!(isTxn && (narrationOrTxn as ParsedTxn).__amountMatchedReversal);
}

// User-reported real case, off an actual Opay statement: automatic daily interest credits on Opay's
// "OWealth" savings wallet narrate as e.g. "07 Aug 2026 01:40:30 OWealth Interest Earned -- Mobile uJ
// 260808994uHYYGJHzJblKYq3Jmt1" — no sender name at all, just a timestamp, the product name, and a
// long opaque reference token. The name-extraction logic had never seen this shape before, so it swept
// "Earned"/"Mobile"/"Owealth" plus that reference token in as if they were a person's name, producing
// garbled "sender" groups. This is automatic interest on the applicant's own money, not income from a
// person or company, so it's detected and routed to its own clearly-labelled bucket before name
// extraction ever runs on it — same treatment as a reversal or a self-transfer. Matched on "interest
// earned" generally (not just "owealth") so the same fix covers any other bank/wallet's own-worded
// interest-credit narration.
export function isInterestEarnedNarration(narration: string | null | undefined): boolean {
  return /\binterest\s*earned\b/i.test(narration || '');
}

// Real-data finding (two genuine Opay wallet/savings statements for the same applicant): beyond the
// "OWealth Interest Earned" credits already handled above, Opay's auto-save/sub-balance feature
// generates several OTHER credit narrations that are just as clearly not income — the applicant's own
// money moving between their main wallet and its OWealth/Targets/SafeBox sub-balances — but none of
// them contain the word "interest" so isInterestEarnedNarration doesn't catch them: "Auto-save to
// OWealth Balance", "OWealth Withdrawal(Transaction Payment)", "OWealth Deposit(from Targets)",
// "OWealth Deposit(from Fixed)", "OWealth Deposit(Transaction Refund)", "Targets Deposit", "SafeBox
// Deposit"/"SafeBox Withdrawal". None of these name a sender at all, so before this fix they fell
// through to candidate-name extraction and landed in "Other / one-off inflows" — technically harmless,
// but still surfaced as an unexplained inflow needing a reason/category, when it's actually just
// internal wallet bookkeeping. Matched generically on the product-feature vocabulary rather than only
// Opay's exact wording, so the same fix covers another wallet's similarly-worded internal transfer.
export const INTERNAL_WALLET_MOVEMENT_RE =
  /\bowealth\s*(deposit|withdrawal)\b|\bauto-?save\b|\btargets?\s*(deposit|withdrawal)\b|\bsafebox\s*(deposit|withdrawal)\b/i;

export function isInternalWalletMovementNarration(narration: string | null | undefined): boolean {
  return INTERNAL_WALLET_MOVEMENT_RE.test(narration || '');
}

// User-reported real case: 13 small credits narrated "Mobile USSDAirtime N500.00 to ..." and "SMS
// NOTIFICATION CHARGE FOR ..." got swept into the auto-detected "Salary" bucket — every one of these
// is under ₦2,500, so identifyStableIncome's round-to-nearest-₦5,000 bucketing collapsed them all
// into the SAME rounded amount (₦0), which then looked like a recurring "stable income" figure purely
// by coincidence of rounding. Whatever these actually are, they are never personal/employer income and
// should never be counted as any kind of inflow needing an income-source explanation.
// NOTE: AIRTIME is deliberately NOT wrapped in \b...\b on its left side — real narrations run it
// straight into the channel code with no separator ("Mobile USSDAirtime N500.00..."), so a leading
// word-boundary check would never match inside "USSDAirtime" at all. "airtime" as a bare substring is
// distinctive enough on its own to not need one.
export const NON_INCOME_CHARGE_RE =
  /\bSMS\s*NOTIFICATION\b|AIRTIME|\bDATA\s*BUNDLE\b|\bRECHARGE\b|\bCARD\s*MAINTENANCE\b|\bACCOUNT\s*MAINTENANCE\b|\bSTAMP\s*DUTY\b|\bVAT\s*CHARGE\b|\bCOMMISSION\s*ON\s*TURNOVER\b/i;

export function isNonIncomeChargeNarration(narration: string | null | undefined): boolean {
  return NON_INCOME_CHARGE_RE.test(narration || '');
}

// Real-data finding (a real Fidelity Bank statement): a failed POS/transfer attempt can be reversed
// WITHOUT any "RVSL"/"reversal" keyword in either line's narration — the credit simply repeats the
// same merchant/reference description as the debit it's undoing. Missing this meant a reversed payment
// could resurface as a brand-new "unexplained inflow" from a merchant-shaped non-name. Deliberately
// conservative: only flags a credit when its amount exactly matches an earlier debit within a few days
// AND the two narrations share enough distinctive words (stopwords/channel codes excluded) to
// plausibly describe the same underlying transaction — not just two unrelated payments that happen to
// share an amount.
export function narrationWordsForReversalMatch(narration: string | null | undefined): string[] {
  return (narration || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => {
      // A purely-numeric token is an account/reference/session number, not a "word" describing what
      // the transaction was for — real narrations reuse the SAME reference/sort-code numbers across
      // many unrelated transactions on the same channel, so letting a shared digit string count as
      // "distinctive overlap" here was flagging completely unrelated debit/credit pairs as reversals
      // purely because they went through the same channel. User-reported real case: 36 genuinely
      // unrelated payments on one statement, none of them a reversal, all wrongly tagged this way.
      return w.length >= 3 && !/^\d+$/.test(w) && BANK_NARRATION_STOPWORDS.indexOf(w) === -1;
    });
}

export function markAmountMatchedReversals(txns: ParsedTxn[]): void {
  const usedDebitIdx: Record<number, boolean> = {};
  txns.forEach((t, ci) => {
    if (!t.credit || isReversalNarration(t)) return;
    const creditWords = narrationWordsForReversalMatch(t.narration);
    for (let di = ci - 1; di >= 0; di--) {
      const d = txns[di];
      const daysApart = (t.date.getTime() - d.date.getTime()) / 86400000;
      if (daysApart > 3) break; // scanning backward in time - only gets older from here, stop looking
      if (!d.debit || usedDebitIdx[di]) continue;
      if (Math.abs(d.debit - t.credit) > 0.5) continue;
      const debitWords = narrationWordsForReversalMatch(d.narration);
      // Always require at least 2 real shared distinctive words — never degraded to 1 for a short
      // narration. A single shared word is too easy to hit by coincidence and was the source of real
      // false-positive reversals on a statement where nothing was actually reversed; if either side
      // doesn't even have 2 qualifying words to begin with, there's no safe basis for a match at all.
      if (creditWords.length < 2 || debitWords.length < 2) continue;
      const overlap = creditWords.filter((w) => debitWords.indexOf(w) !== -1).length;
      if (overlap >= 2) {
        t.__amountMatchedReversal = true;
        usedDebitIdx[di] = true;
        break;
      }
    }
  });
}

// Finds the individual CREDIT transactions whose own narration line names this employer/business —
// stronger evidence than just "the name appears somewhere in the document". Reversal credits are
// excluded, same as every other inflow analysis in this file — money bouncing back from a failed debit
// isn't new income.
//
// `resolveSenderNameCorrection` is the applicant's own manually-confirmed "Fix name" correction
// (persisted UI state in the original app, out of scope for this pure-logic port) — callers that have
// that data can pass a resolver; omitting it preserves the same matching behavior minus that one extra
// (applicant-confirmed) source of evidence.
export function findInflowsMatchingName(
  name: string,
  txns: ParsedTxn[],
  resolveSenderNameCorrection?: (narration: string) => string | null | undefined
): { words: string[]; matches: ParsedTxn[] } {
  const words = nameMatchWords(name);
  if (!words.length) return { words, matches: [] };
  // User feedback, off a real 928-transaction statement: an unrelated payment narrated "NIP/PBNL/HOMES
  // DEALS VENTURES/..." was wrongly counted as an inflow from "Bright Homes Cleaning Solutions Ltd"
  // purely because both share the single ordinary word "HOMES". A lone shared word isn't strong enough
  // evidence to attribute a whole transaction to a specific employer/business — two genuinely unrelated
  // payers can innocently share one word. Require at least 2 of the name's distinctive words to appear
  // in the narration (or all of them, when the name only has 1 distinctive word to begin with, e.g.
  // "GTB") before counting a transaction as a match.
  const minWordsNeeded = Math.min(2, words.length);
  const matches = txns.filter((t) => {
    if (!t.credit || isReversalNarration(t) || isNonIncomeChargeNarration(t.narration)) return false;
    const upperN = (t.narration || '').toUpperCase();
    const hitCount = words.filter((w) => upperN.indexOf(w) !== -1).length;
    if (hitCount >= minWordsNeeded) return true;
    // User-reported real case: a declared employer's FULL registered name never appears intact in this
    // bank's own narration, which only ever shortens it to a bare first word or two — nowhere near 2 of
    // the declared name's distinctive words, so this transaction would otherwise never count as a
    // match no matter how the employer name is typed. But the applicant has already confirmed that
    // exact link themselves, via "Fix name" — so this checks the declared name against that CONFIRMED
    // fuller name too, not just the raw narration text. Deliberately still gated by the same
    // minWordsNeeded threshold (just applied to the corrected name instead) — this isn't a loophole
    // around the "one shared generic word" false-positive guard above, it only ever fires for a
    // transaction the applicant has personally relabelled.
    const correctedName = resolveSenderNameCorrection ? resolveSenderNameCorrection(t.narration) : null;
    if (!correctedName) return false;
    const correctedHitCount = words.filter((w) => nameMatchWords(correctedName).indexOf(w) !== -1).length;
    return correctedHitCount >= minWordsNeeded;
  });
  return { words, matches };
}

// Bank narrations for a NIP/electronic transfer are commonly slash-delimited, roughly:
// CHANNEL/PRODUCT-CODE/SENDER NAME/REASON/REFERENCE. This pulls out the human-readable "reason"
// segment (e.g. "February Salary") so it can be shown alongside the inflow count — skipping the
// segment that's actually the matched employer/business name itself, known bank/channel codes, and
// long alphanumeric reference codes. Best-effort: narration formats vary a lot between banks, so this
// simply returns null (no reason shown) rather than guessing when nothing clearly reason-shaped is found.
export const NARRATION_REASON_HINTS = [
  'SALARY', 'WAGE', 'WAGES', 'STIPEND', 'ALLOWANCE', 'INCOME', 'REMUNERATION',
  'COMMISSION', 'BONUS', 'PAY', 'PAYMENT', 'FEE', 'FEES', 'INVOICE', 'CONSULTANCY', 'CONTRACT', 'HONORARIUM',
  'DIVIDEND', 'REFUND', 'RENT',
];
export const NARRATION_CHANNEL_WORDS = [
  'NIP', 'NEFT', 'RTGS', 'MOB', 'USSD', 'CIP', 'TRF', 'POS', 'ATM', 'FRM', 'FROM',
  'TO', 'CR', 'DR', 'STLB', 'ONEBANK', 'CASH', 'DEP',
  // Same real-world channel/aggregator codes added to BANK_NARRATION_STOPWORDS — without these here
  // too, a segment like "ROLEZ" (with nothing else surviving the name-overlap filter below) gets
  // wrongly picked as if it were the payment's REASON instead of being recognised as just a channel
  // code with no real reason text to report.
  'ETI', 'VFD', 'WBP', 'ROLEZ', 'ROLEX', 'STBC', 'ABN', 'FD', 'FDP', 'ISW', 'QTELLER', 'PBNL', 'ZIB', 'NXG', 'AFB',
  // Real-data finding, off the same real statement: a receiving-BANK's own name/code (e.g. "FBN" —
  // First Bank of Nigeria) can end up as the only candidate left once the sender's name is excluded,
  // wrongly surfacing as "Most commonly narrated as 'Fbn'" — a bank name is never itself the REASON
  // for a payment.
  'GTB', 'GTBANK', 'FBN', 'UBA', 'ZENITH', 'ACCESS', 'FIRST', 'STANBIC', 'FIDELITY', 'WEMA', 'POLARIS', 'UNION',
  'STERLING', 'KEYSTONE', 'PROVIDUS', 'MONIEPOINT', 'PALMPAY', 'KUDA',
];

export function extractNarrationReason(narration: string | null | undefined, nameWords?: string[] | null): string | null {
  if (!narration) return null;
  const parts = narration.split('/').map((p) => p.trim()).filter(Boolean);
  const upperNameWords = nameWords || [];
  const candidates = parts.filter((p) => {
    // Reason segments read as ordinary words — letters, spaces and light punctuation — never a long
    // run of digits/mixed-case reference-code characters like "AT68TRF2MPTj92cg2030304544496898048".
    if (!/^[A-Za-z][A-Za-z .,'&\-]{1,50}$/.test(p)) return false;
    const upperP = p.toUpperCase();
    if (NARRATION_CHANNEL_WORDS.indexOf(upperP) !== -1) return false;
    // Skip the segment that's actually the matched employer/business name itself (or clearly overlaps
    // with it), so the name isn't echoed back as its own "reason".
    const pWords = upperP.split(/\s+/);
    const overlap = pWords.filter((w) => upperNameWords.indexOf(w) !== -1).length;
    if (upperNameWords.length && overlap >= Math.min(2, upperNameWords.length)) return false;
    return true;
  });
  if (!candidates.length) return null;
  let hinted: string | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const upperC = candidates[i].toUpperCase();
    if (NARRATION_REASON_HINTS.some((h) => upperC.indexOf(h) !== -1)) {
      hinted = candidates[i];
      break;
    }
  }
  return hinted || candidates[candidates.length - 1];
}

// User feedback: "Pick similar words and group them, example Happy Birthday means HBD." Different
// narrations for the SAME underlying reason would otherwise tally as separate one-off reasons instead
// of one recurring one — which understates how consistent a category of inflow actually is.
// Deliberately conservative: only known, common Nigerian bank-narration shorthand is folded together;
// anything not matched here is left exactly as extracted, never guessed at.
export const NARRATION_REASON_SYNONYMS: { canonical: string; pattern: RegExp }[] = [
  { canonical: 'Birthday', pattern: /\bhbd\b|\bhappy\s*b['’]?day\b|\bhappy\s*birthday\b|\bb['’]?day\s*token\b|\bb['’]?day\b/i },
  { canonical: 'Salary', pattern: /\bsalary\b/i },
  { canonical: 'Transport allowance', pattern: /\btransport\s*allowance\b/i },
  { canonical: 'Allowance', pattern: /\ballowance\b/i },
  { canonical: 'Gift', pattern: /\bgift\b/i },
  { canonical: 'Refund', pattern: /\brefund\b/i },
  { canonical: 'Rental income', pattern: /\brent(al)?\s*income\b|\brent\b/i },
];

export function canonicalizeNarrationReason(reason: string | null | undefined): string | null | undefined {
  if (!reason) return reason;
  for (let i = 0; i < NARRATION_REASON_SYNONYMS.length; i++) {
    if (NARRATION_REASON_SYNONYMS[i].pattern.test(reason)) return NARRATION_REASON_SYNONYMS[i].canonical;
  }
  return reason;
}

// Direct request: "Read HBD as Happy Birthday, automatically label as gift." Reuses the same
// "Birthday" pattern already defined above (kept as one source of truth) — used in
// buildIncomeSourceBreakdown to default a sender's category straight to "Gift" the moment every one
// of their payments carries an unmistakable birthday narration, rather than leaving an obvious case
// sitting on "Choose a reason…" for the applicant to fill in by hand.
export function isBirthdayGiftNarration(narration: string | null | undefined): boolean {
  const entry = NARRATION_REASON_SYNONYMS.filter((s) => s.canonical === 'Birthday')[0];
  return !!(entry && entry.pattern.test(narration || ''));
}

// User feedback, off a real Zenith/Bright Homes Cleaning statement: several of the recurring salary
// payments from the same employer spell out exactly which month they're for right in their own
// narration, and the statement kept going for months afterwards without a matching "<later month>
// Salary" ever showing up. That's exactly the kind of gap a reviewer notices — so once at least two
// distinct "<Month> Salary"-style narrations are found for one income source, this checks every month
// in between (and any later month the source is still active in) for a matching payment, and reports
// back whichever month(s) never got one.
export const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTH_NAME_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

export function detectMissingSalaryMonths(txns: ParsedTxn[], nameWords: string[] | null | undefined): string[] | null {
  const salaryKeys: number[] = [];
  const allKeys: number[] = [];
  const seen: Record<number, boolean> = {};
  txns.forEach((t) => {
    if (!t.date || !t.credit) return;
    const key = t.date.getFullYear() * 12 + t.date.getMonth();
    allKeys.push(key);
    const reason = extractNarrationReason(t.narration, nameWords);
    if (!reason || !/\bsalary\b/i.test(reason)) return;
    const mm = reason.match(MONTH_NAME_RE);
    if (!mm) return;
    // The narration NAMES the month this payment is for — trusted over the posting date itself, since
    // salary often posts a few days into the following month. Only the YEAR comes from the actual
    // posting date (best-effort: a named month right at a Dec/Jan boundary could mis-key, same caveat
    // as every other best-effort read in this tool).
    const monthIndex = FULL_MONTH_NAMES.findIndex((n) => n.toLowerCase() === mm[1].toLowerCase());
    const salaryKey = t.date.getFullYear() * 12 + monthIndex;
    if (!seen[salaryKey]) {
      seen[salaryKey] = true;
      salaryKeys.push(salaryKey);
    }
  });
  if (salaryKeys.length < 2) return null; // not enough of a pattern yet to assume monthly recurrence
  const minKey = Math.min.apply(null, salaryKeys);
  const maxKey = Math.max(Math.max.apply(null, salaryKeys), Math.max.apply(null, allKeys));
  // User report: the CURRENT calendar month was getting flagged "missing" purely because the statement
  // had other (non-salary) activity in it. Never flag the month still in progress right now, or
  // anything after it — those genuinely can't have a payment yet. Also give last month a short grace
  // window early in a new month, since payroll commonly posts a few days into the following month
  // rather than landing exactly on the 1st.
  const now = new Date();
  const todayKey = now.getFullYear() * 12 + now.getMonth();
  const withinPayrollGraceWindow = now.getDate() <= 7;
  const missing: string[] = [];
  for (let k = minKey; k <= maxKey; k++) {
    if (seen[k]) continue;
    if (k >= todayKey) continue; // the current month (still in progress) or any month after it
    if (withinPayrollGraceWindow && k === todayKey - 1) continue; // give last month's payroll a few days' grace
    const mIdx = ((k % 12) + 12) % 12;
    missing.push(FULL_MONTH_NAMES[mIdx]);
  }
  return missing.length ? missing : null;
}

// User feedback, off a real matched-employer inflow list: several payments already spell out exactly
// what they were for right in their own narration — the matched-inflow box should read and use that
// instead of defaulting every payment to the same generic "Business"/"Salary" pre-tag regardless of
// what the narration actually says. More specific than NARRATION_REASON_SYNONYMS above (which only
// folds down to a generic "Allowance" for tallying/display purposes) — this maps straight to a
// WORK_PAYMENT_REASON_CATEGORIES value, checking the more specific allowance types before the generic
// "Allowance" catch-all, so "housing allowance" pre-selects "Housing Allowance," not just "Allowance."
export const NARRATION_REASON_TO_WORK_CATEGORY: { value: string; pattern: RegExp }[] = [
  { value: 'transport_allowance', pattern: /\btransport\s*allowance\b/i },
  { value: 'housing_allowance', pattern: /\bhousing\s*allowance\b/i },
  { value: 'car_allowance', pattern: /\bcar\s*allowance\b/i },
  { value: 'fuel_allowance', pattern: /\bfuel\s*allowance\b/i },
  { value: 'wardrobe_allowance', pattern: /\bwardrobe\s*allowance\b/i },
  { value: 'subsidy_allowance', pattern: /\bsubsidy\s*allowance\b/i },
  { value: '13th_month_allowance', pattern: /\b13th\s*month\s*allowance\b|\bthirteenth\s*month\s*allowance\b/i },
  { value: 'medical_allowance', pattern: /\bmedical\s*allowance\b/i },
  { value: 'allowance', pattern: /\ballowance\b/i },
  { value: 'salary', pattern: /\bsalary\b/i },
];

export function detectWorkPaymentCategory(narrationReason: string | null | undefined): string | null {
  if (!narrationReason) return null;
  for (let i = 0; i < NARRATION_REASON_TO_WORK_CATEGORY.length; i++) {
    if (NARRATION_REASON_TO_WORK_CATEGORY[i].pattern.test(narrationReason)) return NARRATION_REASON_TO_WORK_CATEGORY[i].value;
  }
  return null;
}

// User instruction: "N50,000 is less than 30 pounds. The visa needs to see consistent quality inflows
// above N50,000." A flat, visa-officer-realistic floor is easier to explain and safer to under-flag on.
export const UNEXPLAINED_INFLOW_MIN_AMOUNT = 50000;
export const INFLOW_DESC_KEYWORDS = [
  'salary', 'transfer', 'payment', 'sale', 'loan', 'gift', 'rent', 'refund', 'contract',
  'invoice', 'fee', 'proceeds', 'remittance', 'dividend', 'interest', 'allowance', 'bonus', 'commission', 'pension',
  'drawing', 'remuneration', 'reversal', 'rvsl', 'withdrawal', 'deposit',
];

// A narration counts as "blank" if, once dates are stripped out, there's no readable letter content
// left — e.g. a bare amount/reference-number row with nothing a reviewer could actually read as an
// explanation.
export function isBlankNarration(narration: string | null | undefined): boolean {
  const stripped = (narration || '').replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g, '').trim();
  return !/[a-zA-Z]{2,}/.test(stripped);
}

export function findUnexplainedLargeInflows(txns: ParsedTxn[]): ParsedTxn[] {
  const credits = txns.filter((t) => t.credit > 0 && !isReversalNarration(t));
  if (!credits.length) return [];
  const flagged = credits.filter((t) => {
    if (isBlankNarration(t.narration)) return true; // flagged regardless of amount - no narration to judge by
    if (t.credit < UNEXPLAINED_INFLOW_MIN_AMOUNT) return false;
    const lower = (t.narration || '').toLowerCase();
    return !INFLOW_DESC_KEYWORDS.some((k) => lower.indexOf(k) !== -1);
  });
  flagged.forEach((t) => {
    t.__flagReason = isBlankNarration(t.narration) ? 'blank' : 'vague';
  });
  return flagged.sort((a, b) => b.credit - a.credit).slice(0, 10);
}

export function inflowKey(t: ParsedTxn): string {
  return t.date.getTime() + '_' + Math.round(t.credit) + '_' + (t.narration || '').slice(0, 40);
}

// Significant (>=3 letters, matching surnameOf's own convention) words shared between two already
// name-shaped strings — deliberately simpler than namesLooselyMatch (which is asymmetric, "does every
// word of A appear in B") since here neither name is the trusted reference; both are equally uncertain
// extractions and either could be the more complete one.
export function sharedSignificantWords(a: string, b: string): string[] {
  const wa = (a || '').toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const wb = (b || '').toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  return wa.filter((w) => wb.indexOf(w) !== -1);
}

export function senderPairKey(a: string, b: string): string {
  const la = (a || '').toLowerCase();
  const lb = (b || '').toLowerCase();
  return la < lb ? la + '||' + lb : lb + '||' + la;
}

// Requires 2+ shared significant words (not just 1) so two unrelated people who happen to share a
// single common first name are never flagged — same reasoning as isLikelyApplicantsOwnName requiring
// every word, just relaxed to "most" since here we WANT to catch partial/reordered matches, only
// pushed past coincidence by requiring 2+ shared words.
export const SENDER_DUP_MIN_SHARED_WORDS = 2;
// User request: "names that appear once... if you see a Funmi Afeni and a Funmi Agboola, group it and
// ask if they are the same person." A name seen only ONCE is exactly the case where a full name is
// most likely to have been extracted incompletely or differently from a recurring sender's other rows
// - so when at least one side of a pair is a singleton, a SINGLE shared significant word (just a first
// name, say) is relaxed to be enough to ask about, rather than requiring 2+ like the general case
// above. Still never auto-merged - it's still only a question.
export const SENDER_DUP_MIN_SHARED_WORDS_SINGLETON = 1;

// Walks every pair of names in a post-mergeNameVariants namedGroups object, splitting into groups
// still needing a merged view (any pair already answered "merge") from pairs still awaiting an answer.
// Pairwise (O(n^2)) is fine here — namedGroups is always a small, already-deduplicated set of senders
// from one bank statement, never raw transaction volume.
//
// `decisions` is the applicant's own prior merge/separate answers (persisted UI state, keyed by
// senderPairKey, in the original app) — pass the same map back in on a later call so an already-
// answered pair is never re-asked.
export function applySenderDuplicateDecisions(
  namedGroups: Record<string, ParsedTxn[]>,
  decisions: Record<string, 'merge' | 'separate'> = {}
): ApplySenderDuplicateDecisionsResult {
  const names = Object.keys(namedGroups);
  const merged: Record<string, ParsedTxn[]> = {};
  const absorbed: Record<string, boolean> = {};
  const pending: DuplicateSenderPair[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      const shared = sharedSignificantWords(a, b);
      const isSingletonPair = (namedGroups[a] || []).length === 1 || (namedGroups[b] || []).length === 1;
      const minShared = isSingletonPair ? SENDER_DUP_MIN_SHARED_WORDS_SINGLETON : SENDER_DUP_MIN_SHARED_WORDS;
      if (shared.length < minShared) continue;
      const key = senderPairKey(a, b);
      const decision = decisions[key];
      if (decision === 'merge') {
        // Merge into whichever extracted name is longer — usually the more complete one — without
        // re-asking if a later pair also touches whichever name absorbs the other.
        const canonical = a.length >= b.length ? a : b;
        const other = canonical === a ? b : a;
        if (!merged[canonical]) merged[canonical] = (namedGroups[canonical] || []).slice();
        if (!absorbed[other]) {
          merged[canonical] = merged[canonical].concat(namedGroups[other] || []);
          absorbed[other] = true;
        }
      } else if (decision !== 'separate') {
        pending.push({ nameA: a, nameB: b, key, shared });
      }
    }
  }
  names.forEach((n) => {
    if (absorbed[n]) return;
    if (!merged[n]) merged[n] = namedGroups[n];
  });
  return { merged, pending };
}

// Ported from index.html's getTopConsistentSenders (~lines 13680-13717). Ranks every named sender by
// how many DISTINCT MONTHS they've paid in first (a sender who pays a little every month for a year is
// stronger evidence of reliable income than one who paid a lot once), then by payment count, then by
// total amount, as a tiebreaker. Reuses the exact same sender-extraction/merge/dedupe pipeline as
// buildIncomeSourceBreakdown (senderSideCandidates -> toTitleCase -> mergeNameVariants ->
// applySenderDuplicateDecisions) so a name here is keyed identically to a group name there — a caller
// applying a "Fix name" display correction can use the same correction map for both.
//
// Deliberately does NOT apply any name correction itself (unlike the original, which called into its
// own UI-only displaySourceName) — that's persisted UI state out of scope for this pure-logic module;
// callers with a correction map apply it themselves using the returned (raw, extracted) `name`.
export function getTopConsistentSenders(
  txns: ParsedTxn[],
  n: number,
  applicantName?: string | null
): TopConsistentSendersResult {
  let namedGroups: Record<string, ParsedTxn[]> = {};
  txns.forEach((t) => {
    if (!t.credit || isReversalNarration(t) || isNonIncomeChargeNarration(t.narration)) return;
    const candidates = senderSideCandidates(t.narration, applicantName);
    if (!candidates.length) return;
    const name = toTitleCase(candidates.reduce((a, b) => (b.length > a.length ? b : a)));
    (namedGroups[name] = namedGroups[name] || []).push(t);
  });
  namedGroups = mergeNameVariants(namedGroups);
  const dup = applySenderDuplicateDecisions(namedGroups);
  namedGroups = dup.merged;
  const list = Object.keys(namedGroups).map((name) => {
    const grpTxns = namedGroups[name];
    const months: Record<string, boolean> = {};
    let total = 0;
    grpTxns.forEach((t) => {
      months[t.date.getFullYear() + '-' + t.date.getMonth()] = true;
      total += t.credit;
    });
    return { name, monthCount: Object.keys(months).length, count: grpTxns.length, total };
  });
  list.sort((a, b) => b.monthCount - a.monthCount || b.count - a.count || b.total - a.total);
  return { list: list.slice(0, n || 10), pendingDuplicates: dup.pending };
}

export function summarizeSourceGroup(name: string, txnsIn: ParsedTxn[], type: string): SourceGroup {
  const sorted = txnsIn.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
  const total = txnsIn.reduce((s, t) => s + t.credit, 0);
  return {
    name,
    type,
    count: txnsIn.length,
    total,
    firstDate: sorted[0].date,
    lastDate: sorted[sorted.length - 1].date,
    txns: sorted,
  };
}

// Bank narrations often name the same sender slightly differently between transactions — e.g. a
// fuller registered name on some rows and a shorter/truncated version on others. Left ungrouped, that
// splits one real income source into two boxes and forces a business owner to write the same
// explanation twice. Merge any name that's a substring of another (case-insensitive) into the longer,
// more complete version — guarded by a minimum length so we don't accidentally merge two genuinely
// different short/generic names into one.
export const NAME_MERGE_MIN_LEN = 6;

// User request: "if you see a Funmi Agboola or Agboola Funmi pick it as the same name" — two candidate
// names built from EXACTLY the same set of words, just printed in a different order, are the same real
// person with total certainty - no genuine two-different-people reading survives that - so these merge
// automatically here, unlike the fuzzier "shares SOME words" case (applySenderDuplicateDecisions),
// which still asks first since two different family members really can share just a surname. Requires
// 2+ words on each side - deliberately not gated by NAME_MERGE_MIN_LEN, since an exact word-for-word
// match is already a far stronger signal than the length-gated substring check below.
export function sameWordSet(a: string, b: string): boolean {
  const wa = (a || '').toLowerCase().split(/\s+/).filter(Boolean).sort();
  const wb = (b || '').toLowerCase().split(/\s+/).filter(Boolean).sort();
  if (wa.length < 2 || wa.length !== wb.length) return false;
  for (let i = 0; i < wa.length; i++) {
    if (wa[i] !== wb[i]) return false;
  }
  return true;
}

// Real-world finding: a narration sometimes carries the full recognisable name and other times just
// its first word alone — now capturable as its own one-word candidate, but too short to clear
// NAME_MERGE_MIN_LEN against the fuller name it belongs with. A single WHOLE word is a much safer
// signal than an arbitrary short substring would be — it can't accidentally match half of an unrelated
// longer word — so this bypasses the length gate specifically for that case: a one-word candidate
// merges into an existing 2+-word name if it appears there as a complete word.
export function isWholeWordIn(word: string, fullName: string): boolean {
  return new RegExp('\\b' + word + '\\b').test(fullName);
}

export function mergeNameVariants(namedGroups: Record<string, ParsedTxn[]>): Record<string, ParsedTxn[]> {
  const names = Object.keys(namedGroups).sort((a, b) => b.length - a.length);
  const merged: Record<string, ParsedTxn[]> = {}; // canonical (longest-seen) name -> combined txns[]
  const order: string[] = []; // preserves a stable "longest first" merge order
  names.forEach((name) => {
    let target: string | null = null;
    for (let i = 0; i < order.length; i++) {
      const existing = order[i];
      const a = existing.toLowerCase();
      const b = name.toLowerCase();
      if (sameWordSet(existing, name)) {
        target = existing;
        break;
      }
      if (b.indexOf(' ') === -1 && a.indexOf(' ') !== -1 && isWholeWordIn(b, a)) {
        target = existing;
        break;
      }
      if (a.indexOf(' ') === -1 && b.indexOf(' ') !== -1 && isWholeWordIn(a, b)) {
        target = existing;
        break;
      }
      if (Math.min(a.length, b.length) < NAME_MERGE_MIN_LEN) continue;
      if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) {
        target = existing;
        break;
      }
    }
    if (target) {
      merged[target] = merged[target].concat(namedGroups[name]);
    } else {
      merged[name] = namedGroups[name].slice();
      order.push(name);
    }
  });
  return merged;
}

// ---- "Self" inflow detection ----
// User instruction, off a real statement: several inflows show the account holder's OWN name in the
// "SENDER" field — a known quirk of some transfer/collection channels, where the narration's sender
// label gets populated with the receiving account's own registered name rather than a genuine third
// party. Left unhandled, these got mis-swept into "Salary" or into their own "Personal" sender box.
// Resolves the statement's own account-holder name from whichever full name recurs most often on the
// RECIPIENT (TO/IFO) side of THIS statement's own credit narrations — more reliable than the typed
// passport-name field alone, which real statements have shown can differ from however the bank account
// is actually registered (a maiden name, a shortened form, extra/missing middle names) — falling back
// to the typed applicant name if no recipient-side name recurs at all.
//
// Real-data finding, off a real Sterling statement: the SAME account holder shows up on the RECIPIENT
// side of different transactions narrated with DIFFERENT subsets/orderings of a longer real name — all
// genuinely referring to one person, none of them the applicant's typed passport name verbatim, and no
// single one of them necessarily recurs the MOST often. Picking only the single best-recurring variant
// (still exposed below as detectStatementHolderName for whichever caller wants just one) silently
// discarded every other variant, so a genuine self-transfer narrated with a less-common variant fell
// through to "no clear sender name" / a personal box instead of Self. detectStatementHolderNames
// returns EVERY variant that recurs at least twice, so a self-check can match a candidate against any
// of them, not just whichever one happened to recur most.
export function detectStatementHolderNames(txns: ParsedTxn[], applicantName?: string | null): string[] {
  const buckets: Record<string, number> = {}; // lowercased name -> count
  txns.forEach((t) => {
    if (!t.credit) return;
    extractNameCandidatesDetailed(t.narration).forEach((c) => {
      if (RECIPIENT_MARKERS.indexOf(c.precededBy as string) === -1) return;
      const key = c.name.toLowerCase();
      buckets[key] = (buckets[key] || 0) + 1;
    });
  });
  const keys = Object.keys(buckets).filter((k) => buckets[k] >= 2);
  keys.sort((a, b) => buckets[b] - buckets[a]); // most-recurring first
  const variants = keys.map(toTitleCase);
  return variants.length ? variants : applicantName ? [applicantName] : [];
}

// Single-name convenience wrapper — same "most-recurring" pick as this function always made before
// detectStatementHolderNames (plural) existed, kept for any caller that only needs one name.
export function detectStatementHolderName(txns: ParsedTxn[], applicantName?: string | null): string | null {
  const variants = detectStatementHolderNames(txns, applicantName);
  return variants.length ? variants[0] : null;
}

// A candidate counts as "self" if it fully matches ANY resolved holder-name variant
// (isLikelyApplicantsOwnName, via namesLooselyMatch) OR — ONLY when the candidate is a single bare
// word ("SENDER: MARY") — shares at least one significant (3+ letter) word with any of them. That
// single-word restriction is deliberate and was tightened after a real regression: an EARLIER version
// of this check fired on any shared significant word regardless of candidate length, which wrongly
// caught a full "Mary Smith" sender as "self" purely because she shares the applicant's surname
// ("Smith") — exactly the shared-surname pattern the existing Family grouping (sharesSurname) is there
// to catch instead. A multi-word candidate carries other identifying words beyond the shared one; if
// those don't ALSO match a holder-name variant, it names a genuinely different person (most often
// family), not the applicant. A single bare word has no such "other" identity to weigh against, so any
// significant overlap there is still a strong enough signal — narrowed, not removed.
export function looksLikeSelfInflow(candidateName: string, applicantName: string | null | undefined, holderNames?: string[] | null): boolean {
  if (isLikelyApplicantsOwnName(candidateName, applicantName)) return true;
  const variants = holderNames || [];
  for (let i = 0; i < variants.length; i++) {
    if (isLikelyApplicantsOwnName(candidateName, variants[i])) return true;
  }
  if (!variants.length) return false;
  const candWords = (candidateName || '').trim().split(/\s+/).filter(Boolean);
  if (candWords.length !== 1) return false;
  for (let j = 0; j < variants.length; j++) {
    if (sharedSignificantWords(candidateName, variants[j]).length >= 1) return true;
  }
  return false;
}

export function buildIncomeSourceBreakdown(
  txns: ParsedTxn[],
  applicantName: string | null | undefined,
  maidenName?: string | null,
  sourceExplanations: Record<string, { category: string; detail: string }> = {}
): SourceGroups {
  let accountHolderNames = detectStatementHolderNames(txns, applicantName);
  // User request: a married woman's bank statement can carry her maiden name on some transactions (an
  // account opened before marriage, a recipient-side name that was never updated, a relative still
  // using the old name) and her married name on others — both are genuinely the SAME person's own
  // money, so the maiden name typed in "Your responsibilities" is folded in here as one more
  // holder-name variant, exactly like the auto-detected ones above, rather than needing its own
  // separate check.
  if (maidenName && maidenName.trim()) accountHolderNames = accountHolderNames.concat([maidenName.trim()]);
  // User-reported bug, off a real statement: a single, isolated ₦18,730 payment with a blank/coded
  // narration got swept into "Salary", even though it has nothing to do with the declared employer.
  // Root cause: the applicant's OWN roughly-₦20,000 self-transfers (many of them, across many months)
  // rounded to the exact same ₦5,000 bucket and, since identifyStableIncome/identifyIncomeSourceName
  // ran on ALL credits with no awareness of Self at all, established ₦20,000 as "the" stable recurring
  // amount purely off money moving between the applicant's own accounts — a bucket that then had room
  // for one more blank-narration payment to ride along for free. Self-transfers aren't anyone's income
  // and should never be able to manufacture a false "stable income" pattern in the first place, so
  // they're filtered out here, before the stable-amount detection even runs — the same treatment
  // reversals and bank-fee narrations already get.
  //
  // Uses senderSideCandidatesForSelfCheck (NOT senderSideCandidates) here deliberately: a self-transfer
  // narrated with the applicant's EXACT full typed name has its only candidate stripped by
  // senderSideCandidates' own isLikelyApplicantsOwnName filter, leaving candidates=[] —
  // indistinguishable from a genuinely blank narration, so it could never be recognized as Self and
  // would ride along in whatever stable-amount bucket matched instead.
  const nonSelfTxns = txns.filter((t) => {
    if (!t.credit) return true;
    const selfCheckCandidates = senderSideCandidatesForSelfCheck(t.narration);
    return !selfCheckCandidates.some((c) => looksLikeSelfInflow(c, applicantName, accountHolderNames));
  });
  const stable = identifyStableIncome(nonSelfTxns);
  // A recurring rounded amount only means "stable income from one source" if the transactions making
  // it up actually share a consistent, identifiable sender — otherwise it's just several DIFFERENT
  // people or companies whose one-off payments happen to land on the same round number (real user
  // report: a genuine business payment was swept into a false "Salary" bucket alongside several
  // unrelated senders' unrelated gifts/payments purely because the amounts coincided).
  // identifyIncomeSourceName looks for a sender name that itself recurs across 2+ distinct months
  // among just the stable-amount transactions. If one exists, only transactions whose own narration
  // names THAT sender — or that name no sender at all, which most genuine salary narrations don't — are
  // trusted as "Salary"; a transaction with a name candidate that doesn't match the dominant sender is
  // routed to its own named group instead, exactly like any other identified sender.
  const stableSourceName = stable ? identifyIncomeSourceName(nonSelfTxns, stable.amount, applicantName) : null;
  const salaryTxns: ParsedTxn[] = [];
  const otherTxns: ParsedTxn[] = [];
  const reversalTxns: ParsedTxn[] = [];
  const selfTxns: ParsedTxn[] = [];
  const interestTxns: ParsedTxn[] = [];
  const internalTxns: ParsedTxn[] = [];
  let namedGroups: Record<string, ParsedTxn[]> = {}; // titleCasedName -> txns[]
  const applicantSurname = surnameOf(applicantName || '');

  txns.forEach((t) => {
    if (!t.credit) return;
    // Bank fee / self-service purchase (SMS alert charge, airtime top-up, etc.) — never income, and
    // unlike a reversal it's not "money that bounced back" either, so it isn't shown in any group at
    // all, not even as an unexplained inflow needing a reason.
    if (isNonIncomeChargeNarration(t.narration)) return;
    if (isReversalNarration(t)) {
      reversalTxns.push(t);
      return;
    }
    // Automatic interest credit (e.g. Opay's "OWealth Interest Earned") — checked before name
    // extraction runs, same reasoning as the reversal check just above: this narration has no sender
    // at all, just a product name and a reference token, so letting it fall through to candidate-name
    // extraction produces a garbled fake "sender" instead of what it actually is.
    if (isInterestEarnedNarration(t.narration)) {
      interestTxns.push(t);
      return;
    }
    // Opay-style internal sub-balance movement (OWealth/Targets/SafeBox deposit or withdrawal,
    // auto-save) — checked right alongside interest, for the same reason: no sender at all, so it must
    // never reach name extraction or "Other".
    if (isInternalWalletMovementNarration(t.narration)) {
      internalTxns.push(t);
      return;
    }
    // The applicant's own name showing up on the "TO"/"IFO" side of a transfer narration isn't a
    // sender — excluded structurally (whichever side of the narration it's on) so it can never become
    // a bogus "dominant sender" match nor a nonsensical named group titled after the applicant
    // themselves.
    const candidates = senderSideCandidates(t.narration, applicantName);
    // Checked BEFORE the stable-amount Salary match below and before falling through to a named group
    // — a self-transfer is neither "salary" nor "someone I need to explain my relationship to,"
    // regardless of whether its amount happens to also recur. Uses the RAW (unfiltered) candidate list
    // for this check specifically — see senderSideCandidatesForSelfCheck's own comment — so a
    // self-transfer narrated with the applicant's EXACT full name is still recognized as Self instead
    // of falling through with candidates=[] to the "no candidate name" / stable-bucket branches below.
    const selfCheckCandidates = senderSideCandidatesForSelfCheck(t.narration);
    if (selfCheckCandidates.some((c) => looksLikeSelfInflow(c, applicantName, accountHolderNames))) {
      selfTxns.push(t);
      return;
    }
    if (stable && Math.round(t.credit / 5000) * 5000 === stable.amount) {
      const matchesDominantSender =
        !candidates.length ||
        !!(
          stableSourceName &&
          candidates.some((cand) => {
            const a = cand.toLowerCase();
            const b = stableSourceName.name.toLowerCase();
            return Math.min(a.length, b.length) >= NAME_MERGE_MIN_LEN && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1);
          })
        );
      if (matchesDominantSender) {
        salaryTxns.push(t);
        return;
      }
      // Else: this transaction names its own identifiable sender and that sender doesn't match the
      // amount's dominant recurring sender (or no consistent sender exists for this amount at all) —
      // fall through and group it by its own name below, same as any other unrelated one-off payment.
    }
    if (!candidates.length) {
      otherTxns.push(t);
      return;
    }
    const name = toTitleCase(candidates.reduce((a, b) => (b.length > a.length ? b : a)));
    (namedGroups[name] = namedGroups[name] || []).push(t);
  });

  namedGroups = mergeNameVariants(namedGroups);

  const groups: SourceGroups = [] as SourceGroups;
  if (salaryTxns.length) groups.push(summarizeSourceGroup('Salary', salaryTxns, 'salary'));
  Object.keys(namedGroups).forEach((name) => {
    const grpTxns = namedGroups[name];
    // A sender sharing the applicant's own surname (and not just the applicant's own name showing up
    // as a self-transfer) is very likely a family member — grouped and labelled distinctly so the
    // applicant gets a narrower, more relevant set of reasons to pick from.
    const isApplicantSelf = !!applicantName && namesLooselyMatch(applicantName, name) === 'ok';
    const type = !isApplicantSelf && sharesSurname(name, applicantSurname) ? 'family' : classifySourceType(grpTxns[0].narration);
    groups.push(summarizeSourceGroup(name, grpTxns, type));
    // Auto-default to "Gift" when every payment from this sender is an unmistakable birthday
    // narration and nothing's been chosen yet — still an ordinary, editable dropdown pick afterwards,
    // not a silently-locked answer.
    if (!sourceExplanations[name] && grpTxns.every((t) => isBirthdayGiftNarration(t.narration))) {
      sourceExplanations[name] = { category: 'gift', detail: '' };
    }
  });
  if (otherTxns.length) groups.push(summarizeSourceGroup('Other / one-off inflows (no clear sender name)', otherTxns, 'other'));
  if (reversalTxns.length) groups.push(summarizeSourceGroup('Reversals (money returned to you)', reversalTxns, 'reversal'));
  if (selfTxns.length) groups.push(summarizeSourceGroup('Self (transfers from your own name/account)', selfTxns, 'self'));
  if (interestTxns.length) groups.push(summarizeSourceGroup('Interest earned (savings/wallet, e.g. OWealth)', interestTxns, 'interest'));
  if (internalTxns.length)
    groups.push(
      summarizeSourceGroup(
        'Internal transfers within your own wallet/savings (not income, e.g. OWealth/Targets/SafeBox)',
        internalTxns,
        'internal'
      )
    );

  groups.sort((a, b) => b.total - a.total);
  // Checked across ALL inflows here, not per rendered group — a "<Month> Salary"-style payment can
  // land in either the auto-detected recurring-amount "Salary" bucket above OR a same-employer named
  // group (whichever one its exact amount happens to match), so checking group-by-group would miss a
  // recurring pattern split across both, or flag a false gap for a month that landed in the OTHER
  // bucket. Empty nameWords here is deliberate: at this point there's no single "sender name" in scope
  // to exclude, and a hint-matched candidate like "February Salary" is already prioritized over a
  // plain company-name candidate regardless.
  groups.missingSalaryMonths = detectMissingSalaryMonths(
    txns.filter((t) => t.credit && !isReversalNarration(t) && !isNonIncomeChargeNarration(t.narration)),
    []
  );
  return groups;
}
