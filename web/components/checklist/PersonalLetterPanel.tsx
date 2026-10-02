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
import { checkLetterSufficiency, buildLetterPayload, renderLetterText, LetterInput } from '@/lib/letter';
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
};

function readJson<T>(key: string): T | null {
  try {
    const raw = secureStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function PersonalLetterPanel({ code }: PersonalLetterPanelProps) {
  const lowerCode = code.toLowerCase();
  const { answers, loaded: answersLoaded } = useEditableChecklistState(code);
  const countryInfo = COUNTRIES.find((c) => c.code === code.toUpperCase());
  const countryName = countryInfo?.name || code;
  const visaName = countryInfo?.visaName || 'visa';

  const [letterInput, setLetterInput] = useState<LetterInput | null>(null);
  const [showLetter, setShowLetter] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!answersLoaded) return;
    const s1 = readJson<PersistedStatement>(`sa_${lowerCode}_statement`);
    const s2 = readJson<PersistedStatement>(`sa_${lowerCode}_statement_2`);
    const financialInputs = readJson<Partial<FinancialInputs>>(`sa_${lowerCode}_financial`);

    const statements = [s1, s2].filter((s): s is PersistedStatement => !!s);
    const applicantName = (s1?.applicantName || s2?.applicantName || '').trim();

    let groups: SourceGroups = [] as SourceGroups;
    let totalInflow = 0;
    let totalOutflow = 0;
    const summaries: StatementSummary[] = [];

    statements.forEach((s, i) => {
      const txns = deserializeTxns(s.txns || []);
      totalInflow += txns.reduce((sum, t) => sum + (t.credit || 0), 0);
      totalOutflow += txns.reduce((sum, t) => sum + (t.debit || 0), 0);
      summaries.push(summarizeStatement(s.label || `Statement ${i + 1}`, txns));
      const g = buildIncomeSourceBreakdown(txns, applicantName, s.maidenName, undefined);
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
      employerName: s1?.employerName || s2?.employerName || '',
      businessName: s1?.businessName || s2?.businessName || '',
      groups,
      statementSummaries: summaries,
      totalInflow,
      totalOutflow,
      openingBalance: combined.totalClosingBalance - (totalInflow - totalOutflow),
      closingBalance: combined.totalClosingBalance,
      financialInputs: financialInputs ? { ...DEFAULT_FINANCIAL_INPUTS, ...financialInputs } : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answersLoaded, answers, lowerCode, countryName, visaName]);

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

  return (
    <section className="rounded-lg border-l-4 border-l-[#4a5d8a] border border-black/10 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-[#12232e]">📝 Your personal supporting letter</h2>
      <p className="mb-3 text-xs text-[#4c6270]">
        A draft letter of introduction and supporting statement, built from the information and documents
        you&apos;ve already entered — not a template you fill in again. Processed entirely in your browser.
      </p>

      {!sufficiency.sufficient ? (
        <div>
          <p className="text-sm font-medium text-warn-text">
            ⚠️ Not enough information yet to generate your letter — {sufficiency.missing.length} item
            {sufficiency.missing.length === 1 ? '' : 's'} still needed:
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-[#12232e]">
            {sufficiency.missing.map((m) => (
              <li key={m}>• {m}</li>
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
