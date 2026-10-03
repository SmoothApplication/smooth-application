// "Use the analysis to fill the form": the UK online visa form asks money questions in pounds (monthly
// income after tax, savings, planned spend, monthly spend). Those numbers already exist in the statement
// analysis, so we hand them over ready to copy, converted at a rate the applicant types in.
import type { ParsedTxn, SourceGroups } from '@/lib/statement/types';
import { isSalaryNarrationText } from '@/lib/statement/classify';

export interface FormAnswer {
  question: string;
  answer: string;
  /** Where the number came from, shown in small print so the person trusts it. */
  note?: string;
}

export interface FormAnswersInput {
  groups: SourceGroups;
  txns: ParsedTxn[];
  closingBalance: number;
  otherSavingsTotal: number;
  employed: boolean;
  selfEmployed: boolean;
  employerName: string;
  jobTitle: string;
  startedWhen: string;
  jobDescription: string;
  /** Naira per one pound. Blank/0 means "show naira only". */
  ratePerGbp: number;
  /** Planned spend on the trip in naira (optional). */
  plannedSpendNgn: number;
  travelDate: string;
  returnDate: string;
  /** Extra pay details typed by the applicant (grade, bonus schedule...). */
  salaryNote?: string;
  /** Answers already given elsewhere in the checklist, reused so the form box agrees with them. */
  maritalStatus?: '' | 'single' | 'married' | 'divorced';
  numKids?: string;
  agedParents?: boolean;
  hasRefusal?: boolean;
  hasHost?: boolean;
}

const ngn = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');

function both(n: number, rate: number): string {
  return rate > 0 ? `${(n / rate).toFixed(2)} GBP (${ngn(n)})` : ngn(n);
}

export function monthlyNetSalary(groups: SourceGroups): number {
  const sal = groups.find((g) => g.type === 'salary');
  if (!sal) return 0;
  const base = sal.txns.filter((t) => t.credit > 0 && isSalaryNarrationText(t.narration));
  const use = base.length ? base : sal.txns.filter((t) => t.credit > 0);
  if (!use.length) return 0;
  // The average of the salary credits on the statement - the same figure the personal letter quotes, so the
  // form and the letter never disagree.
  return use.reduce((a, t) => a + t.credit, 0) / use.length;
}

/** Average monthly allowances/bonuses from the employer (salary-group credits that are not salary). */
export function monthlyAllowances(groups: SourceGroups): number {
  const sal = groups.find((g) => g.type === 'salary');
  if (!sal) return 0;
  const extras = sal.txns.filter((t) => t.credit > 0 && !isSalaryNarrationText(t.narration));
  // Only meaningful when real salary credits exist alongside them.
  if (!extras.length || !sal.txns.some((t) => t.credit > 0 && isSalaryNarrationText(t.narration))) return 0;
  const byMonth = new Map<string, number>();
  extras.forEach((t) => {
    const k = `${t.date.getFullYear()}-${t.date.getMonth()}`;
    byMonth.set(k, (byMonth.get(k) || 0) + t.credit);
  });
  return extras.reduce((a, t) => a + t.credit, 0) / byMonth.size;
}

export function averageMonthlySpend(txns: ParsedTxn[]): number {
  const debits = txns.filter((t) => t.debit > 0);
  if (!debits.length) return 0;
  const months = new Set(txns.map((t) => `${t.date.getFullYear()}-${t.date.getMonth()}`)).size || 1;
  return debits.reduce((a, t) => a + t.debit, 0) / months;
}

export function buildFormAnswers(i: FormAnswersInput): FormAnswer[] {
  const out: FormAnswer[] = [];
  const net = monthlyNetSalary(i.groups);
  out.push({ question: 'What is your employment status?', answer: i.selfEmployed && !i.employed ? 'Self-employed' : i.employed ? 'Employed' : '' });
  if (i.employed) {
    out.push({ question: "Employer's name", answer: i.employerName });
    out.push({ question: 'Your job title', answer: i.jobTitle });
    out.push({ question: 'Date you started working for this employer', answer: i.startedWhen });
    out.push({ question: 'Describe your job', answer: i.jobDescription });
  }
  const allow = monthlyAllowances(i.groups);
  out.push({
    question: allow ? 'Monthly salary - after tax' : 'How much do you earn each month - after tax?',
    answer: net ? both(net, i.ratePerGbp) : '',
    note: net ? 'The average salary credit on your statement - the same figure as in your letter.' : 'No salary found on the statement yet.',
  });
  if (allow) {
    out.push({
      question: 'Monthly allowances and bonuses from your employer',
      answer: both(allow, i.ratePerGbp),
      note: 'Average per month of the allowance and bonus credits on your statement.',
    });
    out.push({
      question: 'How much do you earn each month - after tax? (salary + allowances)',
      answer: both(net + allow, i.ratePerGbp),
      note: 'Salary plus allowances added together - use this total on the form.',
    });
  }
  if (i.salaryNote && i.salaryNote.trim()) {
    out.push({ question: 'Anything else about your pay', answer: i.salaryNote.trim(), note: 'Your own note - also added to your letter.' });
  }
  const savings = i.closingBalance + i.otherSavingsTotal;
  out.push({
    question: 'How much money do you have in savings?',
    answer: savings > 0 ? both(savings, i.ratePerGbp) : '',
    note: 'Closing balance of your statement plus any other accounts you added.',
  });
  out.push({
    question: 'How much money are you personally planning to spend on your visit?',
    answer: i.plannedSpendNgn > 0 ? both(i.plannedSpendNgn, i.ratePerGbp) : '',
    note: i.plannedSpendNgn > 0 ? undefined : 'Type your planned trip budget above.',
  });
  const spend = averageMonthlySpend(i.txns);
  out.push({
    question: 'What is the total amount of money you spend each month?',
    answer: spend ? both(spend, i.ratePerGbp) : '',
    note: spend ? 'Average money going out per month across your statement.' : undefined,
  });
  out.push({ question: 'Date you plan to arrive in the UK', answer: i.travelDate });
  out.push({ question: 'Date you plan to leave the UK', answer: i.returnDate });
  out.push({ question: 'Will anyone be paying towards the cost of your visit?', answer: 'No', note: 'Matches the letter: you fund the trip yourself.' });
  // Answers the applicant already gave in the checklist - reused here so the form box never disagrees with them.
  const ms = i.maritalStatus;
  if (ms) out.push({ question: 'What is your marital status?', answer: ms[0].toUpperCase() + ms.slice(1), note: 'From your checklist answers.' });
  const kids = Number(i.numKids);
  const supports = [i.agedParents ? 'your parents' : '', kids > 0 ? `${kids} child${kids === 1 ? '' : 'ren'}` : ''].filter(Boolean);
  if (i.agedParents !== undefined || i.numKids !== undefined) {
    out.push({
      question: 'Do you financially support anyone at home?',
      answer: supports.length ? `Yes - ${supports.join(' and ')}` : 'No',
      note: 'From your checklist answers (parents and children).',
    });
  }
  if (i.hasHost !== undefined) {
    out.push({ question: 'Where will you stay?', answer: i.hasHost ? 'With a host in the UK (their invitation and address proof go with your application)' : 'Paid accommodation (hotel or rental) - keep the booking', note: 'From your checklist answers.' });
  }
  if (i.hasRefusal !== undefined) {
    out.push({ question: 'Have you ever been refused a visa?', answer: i.hasRefusal ? 'Yes - answer truthfully and attach the refusal explanation' : 'No', note: 'From your checklist answers. Always answer this truthfully.' });
  }
  return out;
}
