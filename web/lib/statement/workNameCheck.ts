// Port of index.html's "namesToCheck" mechanism (~line 14844-14953) — cross-checking the applicant's
// declared employer/business name against their PERSONAL bank statement's own transaction narrations.
// A reviewer expects the name someone says pays them to actually show up in their account activity;
// this is stronger, more specific evidence than a name merely appearing somewhere in the document (the
// account-holder-name check in personalNameTally.ts is a separate, narrower thing — whose statement is
// this, not who's paying into it).
//
// findInflowsMatchingName/extractNarrationReason/canonicalizeNarrationReason (classify.ts) were already
// ported as part of the original bank-statement-engine port (task #244) — this file is the piece that
// was never assembled/wired: the higher-level "found vs not found, how consistent, how many months"
// synthesis index.html builds directly in its results.push() calls, pulled out here as pure, testable
// functions.
//
// One difference from the earlier name-tally checks (businessDrawings.ts / personalNameTally.ts): those
// needed the statement's full RAW TEXT to search for an account-holder-name header, which this app has
// never persisted (a deliberate privacy choice, disclosed in both those files). This check has no such
// problem — it only ever needs the already-parsed transaction list (dates/amounts/narrations), which
// StatementCheck.tsx already persists for the dashboard's own analysis tab regardless of this feature.
// So the "found only in passing narration text, not as a direct inflow sender" fallback IS reproduced
// here faithfully — just searching narrations rather than the whole document, which is if anything more
// targeted than the original.
import type { ParsedTxn } from './types';
import { nameAppearsInStatementText, toTitleCase } from './names';
import { findInflowsMatchingName, extractNarrationReason, canonicalizeNarrationReason } from './classify';
import { fmtN } from '../checklist/financial';

export type WorkNameLabel = 'employer' | 'business';

export interface WorkNameCheckInput {
  label: WorkNameLabel;
  name: string;
  altName?: string;
}

export interface WorkNameCheckResult {
  label: WorkNameLabel;
  name: string;
  found: boolean;
  inflowMatches: ParsedTxn[];
  inflowTotal: number;
  topReason: string | null;
  reasonIsMajority: boolean;
  salaryLabeledCount: number;
  distinctMonthsCount: number;
  narrationConsistencyPct: number;
}

/** Ported from the nameChecks.map(...) body (index.html ~14859-14914). `matchName` folds the
 * optional "also known as" alt name into the same word-matching pass as the full name (a bank
 * narration commonly shortens a name to initials/an acronym that never spells out the full name),
 * but the applicant's own typed `name` is still what every message shows. */
export function computeWorkNameCheck(input: WorkNameCheckInput, txns: ParsedTxn[]): WorkNameCheckResult {
  const matchName = input.altName ? `${input.name} ${input.altName}` : input.name;
  const { words, matches: inflowMatches } = findInflowsMatchingName(matchName, txns);
  const inflowTotal = inflowMatches.reduce((s, t) => s + t.credit, 0);

  const reasonCounts: Record<string, { display: string; count: number }> = {};
  inflowMatches.forEach((t) => {
    const r = extractNarrationReason(t.narration, words);
    if (!r) return;
    const canon = canonicalizeNarrationReason(r) || r;
    const key = canon.toUpperCase();
    if (!reasonCounts[key]) reasonCounts[key] = { display: canon, count: 0 };
    reasonCounts[key].count++;
  });
  let topReason: string | null = null;
  let topReasonCount = 0;
  Object.keys(reasonCounts).forEach((k) => {
    if (reasonCounts[k].count > topReasonCount) {
      topReasonCount = reasonCounts[k].count;
      topReason = reasonCounts[k].display;
    }
  });
  // Only claim a reason is the "most common" one when it genuinely recurs more than once — with one
  // inflow per distinct month label every reason ties at a count of 1, which would overclaim.
  const reasonIsMajority = topReasonCount > 1;

  const allNarrations = txns.map((t) => t.narration || '').join(' ');
  const found = inflowMatches.length > 0 || nameAppearsInStatementText(matchName, allNarrations);

  const salaryLabeledCount = inflowMatches.filter((t) => {
    const r = extractNarrationReason(t.narration, words);
    return !!(r && /salary/i.test(canonicalizeNarrationReason(r) || r));
  }).length;

  const distinctMonthsSet: Record<string, boolean> = {};
  inflowMatches.forEach((t) => {
    distinctMonthsSet[`${t.date.getFullYear()}-${t.date.getMonth()}`] = true;
  });
  const distinctMonthsCount = Object.keys(distinctMonthsSet).length;
  const narrationConsistencyPct = inflowMatches.length
    ? Math.round((salaryLabeledCount / inflowMatches.length) * 100)
    : 0;

  return {
    label: input.label,
    name: input.name,
    found,
    inflowMatches,
    inflowTotal,
    topReason,
    reasonIsMajority,
    salaryLabeledCount,
    distinctMonthsCount,
    narrationConsistencyPct,
  };
}

export type WorkNameMessageStatus = 'ok' | 'warn' | 'err';

export interface WorkNameMessage {
  status: WorkNameMessageStatus;
  message: string;
}

/** Ported from the foundChecks.forEach(...) / notFoundChecks branches (index.html ~14916-14953).
 * Returns the ordered list of messages for ONE declared name — a not-found check produces exactly
 * one (err) message; a found check produces up to four (the main match, narration-consistency,
 * distinct-months, and — only when inflowCount is 0 — the "referenced but not a direct sender"
 * neutral note). */
export function buildWorkNameCheckMessages(result: WorkNameCheckResult): WorkNameMessage[] {
  if (!result.found) {
    return [
      {
        status: 'err',
        message: `"${result.name}" - the name you entered as your ${result.label} - could not be found anywhere in this bank statement. Reviewers expect your stated ${result.label} to actually show up in your account's transaction narrations; if it genuinely doesn't appear here, this application faces a high risk of denial. Double-check you've uploaded the statement your income is actually paid into, or that the name matches exactly.`,
      },
    ];
  }

  if (result.inflowMatches.length === 0) {
    // Found only in passing narration text, not as the direct sender on any credit.
    return [
      {
        status: 'ok',
        message: `Found "${result.name}" referenced in this bank statement - matches what you entered as your ${result.label}, a good consistency signal. It doesn't look like the direct sender on any individual inflow though - worth double-checking by eye that this statement actually shows your ${result.label} income landing here, not just a mention elsewhere (e.g. a fee or a reference to it in passing).`,
      },
    ];
  }

  const messages: WorkNameMessage[] = [];
  const count = result.inflowMatches.length;
  let reasonBit = '';
  if (result.topReason) {
    reasonBit = result.reasonIsMajority
      ? ` Most commonly narrated as "${toTitleCase(result.topReason)}".`
      : ` E.g. narrated as "${toTitleCase(result.topReason)}".`;
  }
  messages.push({
    status: 'ok',
    message: `Found "${result.name}" as the sender on ${count} inflow${count === 1 ? '' : 's'} in this bank statement, totaling ${fmtN(result.inflowTotal)} - matches what you entered as your ${result.label}.${reasonBit} This is exactly the kind of consistency signal a reviewer looks for: regular money actually arriving from the ${result.label} you say pays you, not just its name appearing somewhere on the page.`,
  });

  if (result.salaryLabeledCount === 0) {
    messages.push({
      status: 'warn',
      message: `Inconsistent salary narration: none of the ${count} inflow${count === 1 ? '' : 's'} from "${result.name}" are explicitly narrated as "Salary" (or a close variant). If this genuinely is your salary, ask your ${result.label} to include the word "Salary" in the payment narration going forward - reviewers specifically look for it, and its total absence here can itself read as inconsistent.`,
    });
  } else {
    messages.push({
      status: 'ok',
      message: `Narration consistency: ${result.narrationConsistencyPct}% of these inflows (${result.salaryLabeledCount} of ${count}) are explicitly narrated "Salary" - a reviewer can trace the pattern directly from the narration text itself, not just the amount.`,
    });
  }

  if (result.distinctMonthsCount >= 6) {
    messages.push({
      status: 'ok',
      message: `Found ${result.label} inflow in ${result.distinctMonthsCount} distinct month(s) - 6 or more months of consistent income is exactly what reviewers look for, so these are treated as already accounted for rather than needing further explanation.`,
    });
  } else {
    messages.push({
      status: 'warn',
      message: `Only found ${result.label} inflow in ${result.distinctMonthsCount} distinct month(s) so far - reviewers typically expect at least 6 months of consistent salary/income history. If you genuinely have 6 months, make sure every page covering that period is uploaded; if you don't yet, this is a common reason for refusal and worth addressing directly in a covering letter.`,
    });
  }

  return messages;
}
