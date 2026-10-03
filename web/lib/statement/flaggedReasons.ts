// Direct instruction, verbatim, off a live screenshot showing 4 separate cards all headed "MARY
// OLUWAFUNMILAYO AFENI": "to group all inflows from similar names together then you create a
// button that says is it for the same purpose then the purpose has a drop down or for different
// purposes if you click for the same purposes it fills it straight into the excel file that is
// created that they are all for the same purposes if it fills for different purposes it will take
// the input for each purpose that was filled from the drop down menu this was how it was before."
//
// groupFlaggedInflows (classify.ts) still splits a flagged inflow by (sender, month, amount) on
// purpose — a different amount from the same person in the same month may genuinely be for a
// different reason, per the earlier direct instruction that built that grouping. But showing every
// one of those sub-groups as its own separate card made one sender read as "not grouped" to the
// applicant. This file nests those same sub-groups one level up (one card per sender) and adds the
// same/different-purpose choice, backed by a dropdown of canonical reasons rather than free text —
// matching how the original pre-rebuild app handled recurring-sender explanations (see CHANGELOG,
// "Income-source boxes can now take a different reason per payment, not just one for the whole
// group"), which is the behavior the direct instruction above refers to as "how it was before."
//
// Deliberately does NOT change findUnexplainedLargeInflows or groupFlaggedInflows themselves — this
// is a pure re-shape of groupFlaggedInflows's own output, plus the reason-resolution logic, kept
// here as its own small testable module rather than growing classify.ts further.
import type { ParsedTxn } from './types';
import type { FlaggedInflowGroup } from './classify';

export interface SenderInflowGroup {
  /** = senderLabel; also the map key used for a "same purpose" answer covering this whole sender. */
  senderKey: string;
  senderLabel: string;
  /** The original (sender, month, amount) sub-groups, unchanged — each keeps its own `key` for a
   * "different purposes" answer. */
  subGroups: FlaggedInflowGroup[];
  count: number;
  total: number;
}

/** Pure re-shape of groupFlaggedInflows's flat output into one entry per sender. Sorted by total
 * flagged amount, largest first, same convention as the flat list's own size-first ordering. */
export function nestFlaggedGroupsBySender(flatGroups: FlaggedInflowGroup[]): SenderInflowGroup[] {
  const bySender: Record<string, SenderInflowGroup> = {};
  const order: string[] = [];
  flatGroups.forEach((g) => {
    if (!bySender[g.senderLabel]) {
      bySender[g.senderLabel] = { senderKey: g.senderLabel, senderLabel: g.senderLabel, subGroups: [], count: 0, total: 0 };
      order.push(g.senderLabel);
    }
    const entry = bySender[g.senderLabel];
    entry.subGroups.push(g);
    entry.count += g.count;
    entry.total += g.total;
  });
  return order.map((k) => bySender[k]).sort((a, b) => b.total - a.total);
}

/** Stable per-transaction signature used to match a flagged-inflow answer back to its exact row in
 * the exported spreadsheet — buildIncomeBreakdownAoa already renders each transaction with this
 * same date/amount/narration triple, so no separate id needs to be threaded through ParsedTxn. */
export function txnSignature(t: Pick<ParsedTxn, 'date' | 'credit' | 'narration'>): string {
  return `${t.date.toDateString()}__${Math.round(t.credit)}__${t.narration || ''}`;
}

export type FlaggedReasonMode = 'same' | 'different';

export interface FlaggedReasonOption {
  value: string;
  label: string;
}

// Canonical, dropdown-driven reasons for why an unclear inflow arrived — covers the realistic
// categories a Nigerian applicant's unexplained credit is actually for, rather than leaving every
// answer as unreviewed free text. "Other" still opens a one-line free-text field for anything that
// doesn't fit one of these.
export const UNEXPLAINED_REASON_OPTIONS: FlaggedReasonOption[] = [
  { value: 'salary', label: 'Salary from my employer' },
  { value: 'allowance', label: 'Allowance or bonus from my employer' },
  { value: 'family', label: 'Family support' },
  { value: 'gift', label: 'Gift' },
  { value: 'loan', label: 'Loan or loan repayment' },
  { value: 'business', label: 'Business or trade payment' },
  { value: 'savings_group', label: 'Savings group contribution (ajo/esusu/cooperative)' },
  { value: 'rent', label: 'Rent I collect from a tenant' },
  { value: 'refund', label: 'Refund' },
  { value: 'sale', label: 'Sale of a personal item or property' },
  { value: 'errand', label: 'Errand (money sent to run an errand or buy something for someone)' },
  { value: 'other', label: 'Other (describe below)' },
];

/** Turns a dropdown choice (+ free text, when the choice is "other") into the plain-language label
 * that should actually be shown/exported. Empty string when nothing's been answered yet. */
export function resolveFlaggedReasonLabel(
  choice: string | undefined,
  otherText: string | undefined,
  options: FlaggedReasonOption[] = UNEXPLAINED_REASON_OPTIONS
): string {
  if (!choice) return '';
  if (choice === 'other') return (otherText || '').trim();
  return options.find((o) => o.value === choice)?.label || '';
}

/** A sender with only one (month, amount) sub-group has nothing to choose between, so it's always
 * treated as "same" — one dropdown, no same/different toggle shown for it. */
export function effectiveReasonMode(
  sg: Pick<SenderInflowGroup, 'senderKey' | 'subGroups'>,
  mode: Record<string, FlaggedReasonMode>
): FlaggedReasonMode {
  if (sg.subGroups.length <= 1) return 'same';
  return mode[sg.senderKey] || 'same';
}

/** Direct instruction: "if you click for the same purposes it fills it straight into the excel
 * file... that they are all for the same purposes; if it fills for different purposes it will take
 * the input for each purpose." Builds the per-transaction map buildIncomeBreakdownAoa needs (keyed
 * by txnSignature) so every flagged transaction's resolved reason reaches its own row in the
 * exported spreadsheet — whether it came from one shared "same purpose" answer applied to the whole
 * sender, or its own "different purposes" sub-group answer. */
export function buildFlaggedTxnReasons(
  senderGroups: SenderInflowGroup[],
  mode: Record<string, FlaggedReasonMode>,
  choice: Record<string, string>,
  otherText: Record<string, string>,
  options: FlaggedReasonOption[] = UNEXPLAINED_REASON_OPTIONS
): Record<string, string> {
  const out: Record<string, string> = {};
  senderGroups.forEach((sg) => {
    if (effectiveReasonMode(sg, mode) === 'same') {
      const label = resolveFlaggedReasonLabel(choice[sg.senderKey], otherText[sg.senderKey], options);
      if (!label) return;
      sg.subGroups.forEach((g) => g.txns.forEach((t) => { out[txnSignature(t)] = label; }));
    } else {
      sg.subGroups.forEach((g) => {
        const label = resolveFlaggedReasonLabel(choice[g.key], otherText[g.key], options);
        if (!label) return;
        g.txns.forEach((t) => { out[txnSignature(t)] = label; });
      });
    }
  });
  return out;
}
