// See types.ts for why this shape exists. Pure and synchronous — every input is already-parsed
// plain data (Answers/FinancialInputs/StatementSummary[]), so this has no localStorage or fetch
// calls of its own and is fully unit-testable (see __tests__/buildReportPayload.test.ts).
import { Answers, ChecklistItem, computeRequiredPercent, requiredStatus, missingRequiredItems } from '@/lib/checklist/uk';
import { FinancialInputs, computeFinancials, computeFinanceReadiness } from '@/lib/checklist/financial';
import { StatementSummary, combineStatementSummaries } from '@/lib/statement/combined';
import {
  ReportAnswerLine,
  ReportDocsSummary,
  ReportFinancialSummary,
  ReportPayload,
  ReportStatementSummary,
} from './types';

function yn(b: boolean): string {
  return b ? 'Yes' : 'No';
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Verbatim-in-spirit port of "meaningful values only" — an applicant's Answers has ~40 fields, and
// on any given real applicant most are false/empty. Dumping all of them would bury the handful that
// actually matter under a wall of "No"s. This picks the same fields a human reviewer would actually
// want to see, in the same order ResponsibilitiesSession.tsx asks them, and skips a field entirely
// when it has nothing meaningful to say (e.g. spouse name when there's no spouse sponsoring).
export function buildResponsibilitiesSummary(a: Answers): ReportAnswerLine[] {
  const lines: ReportAnswerLine[] = [];

  if (a.employed) lines.push({ label: 'Employed', value: 'Yes' });
  if (a.selfEmployed) lines.push({ label: 'Self-employed', value: 'Yes' });
  if (a.student) lines.push({ label: 'Student', value: a.studentSponsor ? 'Yes (sponsored)' : 'Yes' });

  if (a.maritalStatus) lines.push({ label: 'Marital status', value: cap(a.maritalStatus) });
  if (a.maritalStatus === 'married') {
    lines.push({ label: 'Spouse sponsoring the trip', value: yn(a.spouseSponsoring) });
    if (a.spouseSponsoring && a.spouseName) lines.push({ label: 'Spouse name', value: a.spouseName });
  }

  if (a.hasChild) lines.push({ label: 'Child travelling on this trip', value: 'Yes' });
  if (a.numKids) lines.push({ label: 'Number of children', value: a.numKids });

  if (a.hasHost) {
    lines.push({ label: 'Has a host at destination', value: 'Yes' });
    lines.push({ label: 'Host funding the trip', value: yn(a.hostFunding) });
  }

  if (a.livingState) {
    lines.push({ label: 'Where you live', value: [a.livingLga, a.livingState].filter(Boolean).join(', ') });
  }
  if (a.annualRent) lines.push({ label: 'Estimated annual rent', value: a.annualRent });

  if (a.agedParents) {
    lines.push({ label: 'Supports aged parents', value: 'Yes' });
    if (a.fatherName && !a.fatherDeceased) lines.push({ label: "Father's name", value: a.fatherName });
    if (a.motherName && !a.motherDeceased) lines.push({ label: "Mother's name", value: a.motherName });
    if (a.remittanceAmount) lines.push({ label: 'Monthly remittance to parents', value: a.remittanceAmount });
  }

  if (a.purpose) lines.push({ label: 'Purpose of visit', value: cap(a.purpose) });

  // These two are worth stating either way (a clean "No" is itself reassuring evidence for a
  // reviewer), unlike the conditional fields above which only make sense when their gate is true.
  lines.push({ label: 'Previous visa refusal', value: yn(a.hasRefusal) });
  if (a.translation) lines.push({ label: 'Documents need translation', value: 'Yes' });

  if (a.declarationConfirmed) {
    const signed = [a.declarationName, a.declarationDate].filter(Boolean).join(' — ');
    lines.push({ label: 'Declaration signed', value: signed || 'Yes' });
  }

  return lines;
}

export function buildDocsSummary(
  checklist: ChecklistItem[],
  answers: Answers,
  checked: Record<string, boolean>
): ReportDocsSummary {
  const percent = computeRequiredPercent(checklist, answers, checked);
  const status = requiredStatus(percent);
  const missing = missingRequiredItems(checklist, answers, checked);
  const required = checklist.filter((it) => it.weight === 'required' && (!it.appliesIf || it.appliesIf(answers)));
  const totalChecked = required.filter((it) => checked[it.id]).length;
  return {
    percent,
    statusLabel: status.label,
    totalRequired: required.length,
    totalChecked,
    missing: missing.map((it) => ({ id: it.id, label: it.label })),
  };
}

// null when nothing's been entered yet (totalCost === 0) — an all-zero block would read as "you
// have no money for this trip" rather than "you haven't told us yet", which is a materially
// different (and false) thing to put in a report an embassy might see.
export function buildFinancialSummary(inputs: FinancialInputs | null): ReportFinancialSummary | null {
  if (!inputs) return null;
  const result = computeFinancials(inputs);
  if (result.totalCost <= 0) return null;
  const readiness = computeFinanceReadiness(result);
  return {
    totalCost: result.totalCost,
    recommendedFunds: result.recommendedFunds,
    totalFunds: result.totalFunds,
    shortfall: result.shortfall,
    fundsReady: result.fundsReady,
    readinessPercent: readiness.percent,
    readinessCapped: readiness.capped,
    timingRealityCheck: result.timingRealityCheck,
  };
}

// Accepts both slots' summaries (task #420's dual-statement feature) — 0, 1, or 2 entries. Reuses
// combineStatementSummaries rather than re-deriving the combined total here, so this can never
// silently drift from what the StatementCheck page itself shows the applicant on screen.
export function buildStatementSummary(summaries: StatementSummary[]): ReportStatementSummary | null {
  const withData = summaries.filter((s) => s.txnCount > 0);
  if (!withData.length) return null;
  const combined = combineStatementSummaries(withData);
  return {
    statements: withData.map((s) => ({
      label: s.label,
      closingBalance: s.closingBalance,
      firstDateISO: s.firstDate && !Number.isNaN(s.firstDate.getTime()) ? s.firstDate.toISOString() : null,
      lastDateISO: s.lastDate && !Number.isNaN(s.lastDate.getTime()) ? s.lastDate.toISOString() : null,
      txnCount: s.txnCount,
    })),
    combinedClosingBalance: combined.totalClosingBalance,
    earliestDateISO: combined.earliestDate ? combined.earliestDate.toISOString() : null,
    latestDateISO: combined.latestDate ? combined.latestDate.toISOString() : null,
  };
}

export function buildReportPayload(opts: {
  countryCode: string;
  countryName: string;
  visaName: string;
  checklist: ChecklistItem[];
  answers: Answers;
  checked: Record<string, boolean>;
  financialInputs: FinancialInputs | null;
  statementSummaries: StatementSummary[];
}): ReportPayload {
  return {
    generatedAtISO: new Date().toISOString(),
    countryCode: opts.countryCode,
    countryName: opts.countryName,
    visaName: opts.visaName,
    docs: buildDocsSummary(opts.checklist, opts.answers, opts.checked),
    responsibilities: buildResponsibilitiesSummary(opts.answers),
    financial: buildFinancialSummary(opts.financialInputs),
    statement: buildStatementSummary(opts.statementSummaries),
  };
}
