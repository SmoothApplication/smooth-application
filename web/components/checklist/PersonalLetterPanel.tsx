'use client';

import { useEffect, useState } from 'react';
import {
  deserializeTxns,
  PersistedStatement,
  buildIncomeSourceBreakdown,
  summarizeStatement,
  combineStatementSummaries,
  StatementSummary,
  SourceGroups,
} from '@/lib/statement';
import SavedIndicator from '@/components/checklist/SavedIndicator';
import { buildFormAnswers, OtherSavingsRow, suggestEmployerNames, hasSalaryLikeIncome, EmployerSuggestion, checkLetterSufficiency, buildLetterPayload, renderLetterText, renderLetterHtml, LetterInput, needsHelpWithBalance, shortfall, helpWhatsAppHref, feesPaymentHref, hasFeesPaymentLink } from '@/lib/letter';
import { computeWorkNameCheck } from '@/lib/statement/workNameCheck';
import type { ParsedTxn } from '@/lib/statement/types';
import { NIGERIA_STATES, NIGERIA_STATES_LGA } from '@/lib/checklist/nigeriaLocations';
import { useEditableChecklistState } from '@/lib/checklist/useEditableChecklistState';
import { DEFAULT_FINANCIAL_INPUTS, FinancialInputs } from '@/lib/checklist/financial';
import { COUNTRIES } from '@/lib/checklist/countries';
import * as secureStorage from '@/lib/security/secureStorage';

// Direct request: "I want you to create a personal letter once the person gives every document
// that is needed... I'll attach the personal letter I wrote and the documents the person
// provided... before you create it, let it tell you that it is insufficient." A self-contained
// panel (same uncontrolled "just give me a country code and I'll read my own localStorage" pattern
// as SaveProgressPanel.tsx) so it can be mounted at the true end of the application — the Final
// review session — without threading new props through StatementCheck/StatementDashboard/ReportTab.
//
// Re-derives the exact same income-source breakdown StatementDashboard shows on the Report tab
// (buildIncomeSourceBreakdown — see lib/statement/classify.ts) from the same persisted, encrypted
// statement payload(s) that component already writes, rather than inventing a second computation
// that could silently drift from what the applicant already sees there. Nothing here leaves the
// browser — same "processed entirely in your browser" privacy guarantee as the rest of this engine.
export type PersonalLetterPanelProps = {
  code: string;
  /** Statement-only mode: show a short fill-in form (employer, purpose, dates, address, contact) so a
   * client who never opened the full checklist can still produce the letter. */
  inline?: boolean;
};

type LetterDetails = {
  applicantName: string; employerName: string; businessName: string; phone: string; email: string;
  jobTitle: string; startedWhen: string; jobDescription: string; previousEmployment: string; plans: string;
  otherSavings: OtherSavingsRow[]; ratePerGbp: string; plannedSpend: string;
};
const EMPTY_DETAILS: LetterDetails = {
  applicantName: '', employerName: '', businessName: '', phone: '', email: '',
  jobTitle: '', startedWhen: '', jobDescription: '', previousEmployment: '', plans: '',
  otherSavings: [], ratePerGbp: '', plannedSpend: '',
};
const PURPOSES: { value: string; label: string }[] = [
  { value: 'tourism', label: 'Tourism / holiday' },
  { value: 'family', label: 'Visiting family or friends' },
  { value: 'business', label: 'Business' },
  { value: 'conference', label: 'Conference' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'medical', label: 'Medical' },
  { value: 'academic', label: 'Academic' },
  { value: 'training', label: 'Training' },
];

function readJson<T>(key: string): T | null {
  try {
    const raw = secureStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function PersonalLetterPanel({ code, inline = false }: PersonalLetterPanelProps) {
  const lowerCode = code.toLowerCase();
  const { answers, setAnswers, loaded: answersLoaded } = useEditableChecklistState(code);
  const detailsKey = `sa_${lowerCode}_letter`;
  const financialKey = `sa_${lowerCode}_financial`;
  const [details, setDetails] = useState<LetterDetails>(EMPTY_DETAILS);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [dates, setDates] = useState({ travelDate: '', returnDate: '' });
  const countryInfo = COUNTRIES.find((c) => c.code === code.toUpperCase());
  const countryName = countryInfo?.name || code;
  const visaName = countryInfo?.visaName || 'visa';

  const [letterInput, setLetterInput] = useState<LetterInput | null>(null);
  const [allTxns, setAllTxns] = useState<ParsedTxn[]>([]);
  const [suggestions, setSuggestions] = useState<EmployerSuggestion[]>([]);
  const [showLetter, setShowLetter] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = readJson<Partial<LetterDetails>>(detailsKey);
    if (d) setDetails({ ...EMPTY_DETAILS, ...d });
    // Hand a saved employer name to the statement cards above (they only learn it from this box).
    if (d?.employerName && typeof window !== 'undefined') {
      const send = () =>
        window.dispatchEvent(new CustomEvent('sa:employer-name', { detail: { code: lowerCode, name: d.employerName } }));
      send();
      setTimeout(send, 400);
    }
    const f = readJson<Partial<FinancialInputs>>(financialKey);
    if (f) setDates({ travelDate: f.travelDate || '', returnDate: f.returnDate || '' });
    setDetailsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowerCode]);

  function saveDetails(next: LetterDetails) {
    // The statement dashboard groups employer pay under Salary using its own employer field; tell it when
    // the name typed here changes so the cards above regroup straight away.
    if (next.employerName !== details.employerName && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sa:employer-name', { detail: { code: lowerCode, name: next.employerName } }));
    }
    setDetails(next);
    try { secureStorage.setItem(detailsKey, JSON.stringify(next)); } catch { /* ignore */ }
  }
  function saveDates(next: { travelDate: string; returnDate: string }) {
    setDates(next);
    try {
      const cur = readJson<Partial<FinancialInputs>>(financialKey) || {};
      secureStorage.setItem(financialKey, JSON.stringify({ ...cur, ...next }));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!answersLoaded || !detailsLoaded) return;
    const s1 = readJson<PersistedStatement>(`sa_${lowerCode}_statement`);
    const s2 = readJson<PersistedStatement>(`sa_${lowerCode}_statement_2`);
    const financialInputs = readJson<Partial<FinancialInputs>>(`sa_${lowerCode}_financial`);

    const statements = [s1, s2].filter((s): s is PersistedStatement => !!s);
    const applicantName = (s1?.applicantName || s2?.applicantName || details.applicantName || '').trim();

    let groups: SourceGroups = [] as SourceGroups;
    let totalInflow = 0;
    let totalOutflow = 0;
    const summaries: StatementSummary[] = [];

    statements.forEach((s, i) => {
      const txns = deserializeTxns(s.txns || []);
      totalInflow += txns.reduce((sum, t) => sum + (t.credit || 0), 0);
      totalOutflow += txns.reduce((sum, t) => sum + (t.debit || 0), 0);
      summaries.push(summarizeStatement(s.label || `Statement ${i + 1}`, txns));
      const g = buildIncomeSourceBreakdown(txns, applicantName, s.maidenName, undefined, {
        minInflow: 50000,
        dropReversals: true,
        employerName: s1?.employerName || s2?.employerName || details.employerName || '',
      });
      groups = groups.concat(g) as SourceGroups;
    });

    const combined = combineStatementSummaries(summaries);
    setAllTxns(statements.flatMap((st) => deserializeTxns(st.txns || [])));
    const likeSalary = hasSalaryLikeIncome(groups);
    setSuggestions(suggestEmployerNames(groups));

    setLetterInput({
      countryName,
      visaName,
      applicantName,
      answers,
      // Salary-like income means we treat the applicant as employed (so the employer name is required) unless they said self-employed.
      employed: answers.employed || (likeSalary && !answers.selfEmployed),
      selfEmployed: answers.selfEmployed,
      employerName: s1?.employerName || s2?.employerName || details.employerName || '',
      businessName: s1?.businessName || s2?.businessName || details.businessName || '',
      phone: details.phone,
      email: details.email,
      jobTitle: details.jobTitle,
      startedWhen: details.startedWhen,
      jobDescription: details.jobDescription,
      previousEmployment: details.previousEmployment,
      plans: details.plans,
      otherSavings: details.otherSavings,
      groups,
      statementSummaries: summaries,
      totalInflow,
      totalOutflow,
      openingBalance: combined.totalClosingBalance - (totalInflow - totalOutflow),
      closingBalance: combined.totalClosingBalance,
      financialInputs: financialInputs ? { ...DEFAULT_FINANCIAL_INPUTS, ...financialInputs } : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answersLoaded, detailsLoaded, answers, details, dates, lowerCode, countryName, visaName]);

  if (!letterInput) return null;

  const sufficiency = checkLetterSufficiency(letterInput);
  const letterText = sufficiency.sufficient ? renderLetterText(buildLetterPayload(letterInput)) : '';

  function handleCopy() {
    navigator.clipboard?.writeText(letterText).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}
    );
  }

  function handleDownload() {
    const blob = new Blob([letterText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lowerCode}-personal-letter.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleWord() {
    const html = renderLetterHtml(buildLetterPayload(letterInput as LetterInput));
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lowerCode}-personal-letter.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputCls = 'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[#12232e]';
  const lgas = answers.livingState ? NIGERIA_STATES_LGA[answers.livingState] || [] : [];

  const employerValue = letterInput.employerName;
  const showEmployerBox = inline && letterInput.employed;
  const match = showEmployerBox && employerValue.trim() ? computeWorkNameCheck({ label: 'employer', name: employerValue }, allTxns) : null;
  const employerBox = showEmployerBox ? (
    <div className={`mb-4 rounded-lg border p-3 ${employerValue.trim() ? 'border-green-300 bg-green-50' : 'border-amber-400 bg-amber-50'}`}>
      <p className="text-sm font-semibold text-[#12232e]">Who pays your salary? (required)</p>
      <p className="mt-1 text-xs text-[#4c6270]">
        Type the employer exactly as it appears on a payment in your statement. A visa officer gives great weight to steady,
        sustainable monthly income, and when the name matches your payments we can write your letter around that story,
        with the months and amounts filled in for you.
      </p>
      {suggestions.length > 0 && !employerValue.trim() && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#4c6270]">Tap if this is your employer:</span>
          {suggestions.map((sg) => (
            <button key={sg.name} type="button" onClick={() => saveDetails({ ...details, employerName: sg.name })}
              className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-medium text-[#12232e]">
              {sg.name}
            </button>
          ))}
        </div>
      )}
      <input className={inputCls + ' mt-2'} placeholder="e.g. as on your payslip" value={details.employerName}
        onChange={(e) => saveDetails({ ...details, employerName: e.target.value })} />
      <SavedIndicator value={details.employerName} className="mt-1 block" />
      {employerValue.trim() && match && (
        <p className="mt-2 text-xs text-[#12232e]">
          {match.found
            ? `✓ Matches ${match.inflowMatches.length} payment${match.inflowMatches.length === 1 ? '' : 's'} on your statement (₦${Math.round(match.inflowTotal).toLocaleString('en-NG')}) across ${match.distinctMonthsCount} month${match.distinctMonthsCount === 1 ? '' : 's'}. Your letter will use this.`
            : 'We could not find this name on your payments. Check the spelling against a payment, or tap a suggestion.'}
        </p>
      )}
    </div>
  ) : null;

  const otherTotal = details.otherSavings.reduce((a, r) => a + (r.balance || 0), 0);
  const fmtLong = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const formAnswers = inline
    ? buildFormAnswers({
        groups: letterInput.groups, txns: allTxns, closingBalance: letterInput.closingBalance, otherSavingsTotal: otherTotal,
        employed: letterInput.employed, selfEmployed: letterInput.selfEmployed, employerName: letterInput.employerName,
        jobTitle: details.jobTitle, startedWhen: details.startedWhen, jobDescription: details.jobDescription,
        ratePerGbp: Number(details.ratePerGbp) || 0, plannedSpendNgn: Number(details.plannedSpend) || 0,
        travelDate: fmtLong(dates.travelDate), returnDate: fmtLong(dates.returnDate),
      }).filter((a) => a.answer)
    : [];
  const totalBalance = (letterInput.closingBalance || 0) + otherTotal;
  const helpCard = needsHelpWithBalance(totalBalance) ? (
    <div className="mb-4 rounded-lg border border-warn-text/30 bg-[#fff8e8] p-3 text-sm text-[#12232e]">
      <p className="font-semibold">Your balance is ₦{Math.round(totalBalance).toLocaleString('en-NG')}, which is under the ₦3,000,000 a reviewer typically expects.</p>
      <p className="mt-1 text-xs text-[#4c6270]">
        You are ₦{Math.round(shortfall(totalBalance)).toLocaleString('en-NG')} short. Don&apos;t borrow a lump sum to cover it - that can look worse. Ask us for help: we will go through your statement with you and tell you the safest way to strengthen your application.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={helpWhatsAppHref(totalBalance, visaName)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#12232e]">
          💬 Ask for help
        </a>
        <a href={feesPaymentHref(totalBalance, visaName)} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
          {hasFeesPaymentLink() ? '💳 Pay our fees' : '💳 Get help with our fees'}
        </a>
      </div>
    </div>
  ) : null;
  const formBox = inline && formAnswers.length ? (
    <div className="mt-4 rounded-lg border border-black/10 bg-white p-3">
      <h3 className="text-sm font-semibold text-[#12232e]">📋 Answers for the visa application form</h3>
      <p className="mb-2 text-xs text-[#4c6270]">Worked out from your statement and the details above. Tap Copy and paste into the form. Check each one before you submit.</p>
      <ul className="flex flex-col gap-2">
        {formAnswers.map((a) => (
          <li key={a.question} className="rounded-lg bg-[#faf9f6] p-2 text-xs">
            <p className="text-[#566a76]">{a.question}</p>
            <div className="mt-0.5 flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap font-medium text-[#12232e]">{a.answer}</p>
              <button type="button" className="shrink-0 text-accent hover:underline" onClick={() => navigator.clipboard?.writeText(a.answer)}>Copy</button>
            </div>
            {a.note && <p className="mt-0.5 text-[10px] text-[#566a76]">{a.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  const form = inline ? (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg bg-[#faf9f6] p-3 sm:grid-cols-2">
      <p className="text-xs font-semibold text-[#12232e] sm:col-span-2">Fill in what we could not read from your statement</p>
      {!letterInput.applicantName && (
        <label className="text-xs text-[#4c6270] sm:col-span-2">Full name
          <input className={inputCls} value={details.applicantName} onChange={(e) => saveDetails({ ...details, applicantName: e.target.value })} />
        </label>
      )}
      <label className="text-xs text-[#4c6270]">I am
        <select className={inputCls} value={answers.selfEmployed ? 'self' : answers.employed ? 'employed' : ''}
          onChange={(e) => setAnswers({ ...answers, employed: e.target.value === 'employed', selfEmployed: e.target.value === 'self' })}>
          <option value="">Choose…</option>
          <option value="employed">Employed</option>
          <option value="self">Self-employed / business owner</option>
        </select>
      </label>
      <label className={`text-xs text-[#4c6270] ${showEmployerBox ? 'hidden' : ''}`}>{answers.selfEmployed ? 'Business name' : 'Employer name'}
        <input className={inputCls} value={answers.selfEmployed ? details.businessName : details.employerName}
          onChange={(e) => saveDetails(answers.selfEmployed ? { ...details, businessName: e.target.value } : { ...details, employerName: e.target.value })} />
      </label>
      <label className="text-xs text-[#4c6270]">Purpose of visit
        <select className={inputCls} value={answers.purpose} onChange={(e) => setAnswers({ ...answers, purpose: e.target.value as typeof answers.purpose })}>
          <option value="">Choose…</option>
          {PURPOSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-[#4c6270]">Travel date
          <input type="date" className={inputCls} value={dates.travelDate} onChange={(e) => saveDates({ ...dates, travelDate: e.target.value })} />
        </label>
        <label className="text-xs text-[#4c6270]">Return date
          <input type="date" className={inputCls} value={dates.returnDate} onChange={(e) => saveDates({ ...dates, returnDate: e.target.value })} />
        </label>
      </div>
      <label className="text-xs text-[#4c6270]">Home address (number, street)
        <input className={inputCls} value={answers.addressName} onChange={(e) => setAnswers({ ...answers, addressName: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-[#4c6270]">State
          <select className={inputCls} value={answers.livingState} onChange={(e) => setAnswers({ ...answers, livingState: e.target.value, livingLga: '' })}>
            <option value="">Choose…</option>
            {NIGERIA_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </label>
        <label className="text-xs text-[#4c6270]">Area (LGA)
          <select className={inputCls} value={answers.livingLga} onChange={(e) => setAnswers({ ...answers, livingLga: e.target.value })}>
            <option value="">Choose…</option>
            {lgas.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>
      <label className="text-xs text-[#4c6270]">Email (optional, for the letterhead)
        <input type="email" className={inputCls} value={details.email} onChange={(e) => saveDetails({ ...details, email: e.target.value })} />
      </label>
      <label className="text-xs text-[#4c6270]">Phone (optional)
        <input type="tel" className={inputCls} value={details.phone} onChange={(e) => saveDetails({ ...details, phone: e.target.value })} />
      </label>
      <p className="text-xs font-semibold text-[#12232e] sm:col-span-2 mt-2">About you (fills your letter and the visa form)</p>
      {letterInput.employed && (
        <>
          <label className="text-xs text-[#4c6270]">Job title
            <input className={inputCls} value={details.jobTitle} onChange={(e) => saveDetails({ ...details, jobTitle: e.target.value })} />
          </label>
          <label className="text-xs text-[#4c6270]">When did you start with this employer?
            <input className={inputCls} placeholder="e.g. August 2025" value={details.startedWhen} onChange={(e) => saveDetails({ ...details, startedWhen: e.target.value })} />
          </label>
          <label className="text-xs text-[#4c6270] sm:col-span-2">What do you do in your job?
            <textarea rows={2} className={inputCls} value={details.jobDescription} onChange={(e) => saveDetails({ ...details, jobDescription: e.target.value })} />
          </label>
          <label className="text-xs text-[#4c6270] sm:col-span-2">Previous job (optional)
            <textarea rows={2} className={inputCls} placeholder="e.g. I worked at a bank for 10 years before moving here" value={details.previousEmployment} onChange={(e) => saveDetails({ ...details, previousEmployment: e.target.value })} />
          </label>
        </>
      )}
      <label className="text-xs text-[#4c6270] sm:col-span-2">What do you plan to do on the trip?
        <textarea rows={2} className={inputCls} placeholder="e.g. See the London Eye and Trafalgar Square, take a bus tour" value={details.plans} onChange={(e) => saveDetails({ ...details, plans: e.target.value })} />
      </label>
      <div className="sm:col-span-2">
        <p className="text-xs text-[#4c6270]">Other savings and investments (accounts not on this statement)</p>
        {details.otherSavings.map((r, idx) => (
          <div key={idx} className="mt-1 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <input className={inputCls} placeholder="Bank / platform" value={r.bank} onChange={(e) => saveDetails({ ...details, otherSavings: details.otherSavings.map((x, k) => (k === idx ? { ...x, bank: e.target.value } : x)) })} />
            <input className={inputCls} placeholder="Type (Savings, Investment…)" value={r.type} onChange={(e) => saveDetails({ ...details, otherSavings: details.otherSavings.map((x, k) => (k === idx ? { ...x, type: e.target.value } : x)) })} />
            <input type="number" className={inputCls} placeholder="Balance (₦)" value={r.balance || ''} onChange={(e) => saveDetails({ ...details, otherSavings: details.otherSavings.map((x, k) => (k === idx ? { ...x, balance: Number(e.target.value) || 0 } : x)) })} />
            <button type="button" aria-label="Remove" className="px-2 text-sm text-[#566a76]" onClick={() => saveDetails({ ...details, otherSavings: details.otherSavings.filter((_, k) => k !== idx) })}>✕</button>
          </div>
        ))}
        {details.otherSavings.length < 8 && (
          <button type="button" className="mt-1 text-xs font-medium text-accent hover:underline" onClick={() => saveDetails({ ...details, otherSavings: [...details.otherSavings, { bank: '', type: '', balance: 0 }] })}>
            + Add an account
          </button>
        )}
      </div>
      <label className="text-xs text-[#4c6270]">Naira per £1 (for the visa form amounts)
        <input type="number" className={inputCls} placeholder="e.g. 1980" value={details.ratePerGbp} onChange={(e) => saveDetails({ ...details, ratePerGbp: e.target.value })} />
      </label>
      <label className="text-xs text-[#4c6270]">Trip budget you plan to spend (₦)
        <input type="number" className={inputCls} value={details.plannedSpend} onChange={(e) => saveDetails({ ...details, plannedSpend: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 text-xs text-[#4c6270] sm:col-span-2">
        <input type="checkbox" checked={answers.agedParents} onChange={(e) => setAnswers({ ...answers, agedParents: e.target.checked })} />
        I support aged parents in Nigeria (adds a line to “Ties to Nigeria”)
      </label>
      <p className="text-xs sm:col-span-2"><SavedIndicator value={JSON.stringify([details, dates, answers.purpose, answers.addressName, answers.livingState, answers.livingLga, answers.employed, answers.selfEmployed, answers.agedParents])} /></p>
    </div>
  ) : null;

  return (
    <section className="rounded-lg border-l-4 border-l-[#4a5d8a] border border-black/10 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-[#12232e]">📝 Your personal supporting letter</h2>
      <p className="mb-3 text-xs text-[#4c6270]">
        A draft letter of introduction and supporting statement, built from the information and documents
        you&apos;ve already entered — not a template you fill in again. Processed entirely in your browser.
      </p>

      {employerBox}
      {form}

      {helpCard}

      {!sufficiency.sufficient ? (
        <div>
          <p className="text-sm font-medium text-warn-text">
            ⚠️ Not enough information yet to generate your letter — {sufficiency.missing.length} item
            {sufficiency.missing.length === 1 ? '' : 's'} still needed:
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-[#12232e]">
            {sufficiency.missing.map((m) => (
              <li key={m}>• {inline ? m.split(' — ')[0] + ' (fill it in above)' : m}</li>
            ))}
          </ul>
        </div>
      ) : !showLetter ? (
        <button type="button" onClick={() => setShowLetter(true)} className="btn-primary text-sm">
          ✅ Generate my personal letter
        </button>
      ) : (
        <div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-semibold text-[#12232e]"
            >
              {copied ? '✅ Copied' : '📋 Copy to clipboard'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-semibold text-[#12232e]"
            >
              ⬇️ Download (.txt)
            </button>
            <button
              type="button"
              onClick={handleWord}
              className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-semibold text-[#12232e]"
            >
              📄 Download for Word
            </button>
          </div>
          <pre className="mt-3 max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-black/10 bg-[#faf9f6] p-4 text-xs leading-relaxed text-[#12232e]">
            {letterText}
          </pre>
          <p className="mt-2 text-xs text-[#4c6270]">
            Review every figure and claim against your actual documents before you send this anywhere — this is a
            draft built from what you&apos;ve entered, not a substitute for your own final check.
          </p>
        </div>
      )}
      {formBox}
    </section>
  );
}
