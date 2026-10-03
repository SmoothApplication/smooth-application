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
import { checkLetterSufficiency, buildLetterPayload, renderLetterText, renderLetterHtml, LetterInput } from '@/lib/letter';
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

type LetterDetails = { applicantName: string; employerName: string; businessName: string; phone: string; email: string };
const EMPTY_DETAILS: LetterDetails = { applicantName: '', employerName: '', businessName: '', phone: '', email: '' };
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
  const [showLetter, setShowLetter] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = readJson<Partial<LetterDetails>>(detailsKey);
    if (d) setDetails({ ...EMPTY_DETAILS, ...d });
    const f = readJson<Partial<FinancialInputs>>(financialKey);
    if (f) setDates({ travelDate: f.travelDate || '', returnDate: f.returnDate || '' });
    setDetailsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowerCode]);

  function saveDetails(next: LetterDetails) {
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
      });
      groups = groups.concat(g) as SourceGroups;
    });

    const combined = combineStatementSummaries(summaries);

    setLetterInput({
      countryName,
      visaName,
      applicantName,
      answers,
      employed: answers.employed,
      selfEmployed: answers.selfEmployed,
      employerName: s1?.employerName || s2?.employerName || details.employerName || '',
      businessName: s1?.businessName || s2?.businessName || details.businessName || '',
      phone: details.phone,
      email: details.email,
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
      <label className="text-xs text-[#4c6270]">{answers.selfEmployed ? 'Business name' : 'Employer name'}
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
      <label className="flex items-center gap-2 text-xs text-[#4c6270] sm:col-span-2">
        <input type="checkbox" checked={answers.agedParents} onChange={(e) => setAnswers({ ...answers, agedParents: e.target.checked })} />
        I support aged parents in Nigeria (adds a line to “Ties to Nigeria”)
      </label>
    </div>
  ) : null;

  return (
    <section className="rounded-lg border-l-4 border-l-[#4a5d8a] border border-black/10 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-[#12232e]">📝 Your personal supporting letter</h2>
      <p className="mb-3 text-xs text-[#4c6270]">
        A draft letter of introduction and supporting statement, built from the information and documents
        you&apos;ve already entered — not a template you fill in again. Processed entirely in your browser.
      </p>

      {form}

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
    </section>
  );
}
