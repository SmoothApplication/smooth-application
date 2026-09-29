'use client';

import { useEffect, useState } from 'react';
import { getLinesFromFileWithMeta } from '@/lib/statement/extractFile';
import {
  parseStatementLinesWithFallback,
  ParsedTxn,
  serializeTxns,
  deserializeTxns,
  PersistedStatement,
  extractAccountHolderName,
  SpouseSponsorDeclaration,
  WorkCategoryMap,
  summarizeStatement,
  StatementSummary,
} from '@/lib/statement';
import StatementDashboard from '@/components/checklist/StatementDashboard';
import ResumeReminderLinks from '@/components/checklist/ResumeReminderLinks';
import { trackEvent } from '@/lib/analytics';

// Task #420 (direct request): one statement's whole upload → parse → dashboard lifecycle, pulled
// out of what used to be the entire body of StatementCheck.tsx so it can be mounted TWICE — once
// for a salary-only account, once for a second account carrying whatever a corporate employer
// won't let land in the first (side business, rental income, help from parents). Nothing about a
// single statement's own analysis changes here; this is a pure extraction, parameterized by
// `storageKey` so two instances never collide in localStorage, plus an editable `label` (defaults
// to "Statement 1"/"Statement 2") and an `onSummaryChange` callback so the parent (StatementCheck)
// can build the combined balance/date-range summary without reaching into this component's state.
//
// Deliberately still analyzes each statement completely independently — see lib/statement/
// combined.ts's file-level comment for why the two are never merged into one transaction list.
export type StatementSlotProps = {
  storageKey: string;
  answersStorageKey: string;
  defaultLabel: string;
  financialHref: string;
  visaName: string;
  onSummaryChange: (summary: StatementSummary | null) => void;
  /** Slot 2 only: lets the applicant drop the second statement entirely (distinct from "Upload a
   * different statement", which replaces THIS slot's file but keeps the slot itself). */
  onRemove?: () => void;
};

function formatDate(d: Date): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function loadSaved(storageKey: string): PersistedStatement | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedStatement;
    if (!parsed || !Array.isArray(parsed.txns) || parsed.txns.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function StatementSlot({
  storageKey,
  answersStorageKey,
  defaultLabel,
  financialHref,
  visaName,
  onSummaryChange,
  onRemove,
}: StatementSlotProps) {
  const [loaded, setLoaded] = useState(false);
  const [recalled, setRecalled] = useState(false);

  const [label, setLabel] = useState(defaultLabel);
  const [editingLabel, setEditingLabel] = useState(false);
  const [txns, setTxns] = useState<ParsedTxn[] | null>(null);
  const [applicantName, setApplicantName] = useState('');
  const [maidenName, setMaidenName] = useState('');
  const [nameCorrections, setNameCorrections] = useState<Record<string, string>>({});
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [senderDuplicateDecisions, setSenderDuplicateDecisions] = useState<Record<string, 'merge' | 'separate'>>(
    {}
  );
  const [detectedHolderName, setDetectedHolderName] = useState<string | null>(null);
  const [ocrUsed, setOcrUsed] = useState(false);
  const [spouse, setSpouse] = useState<SpouseSponsorDeclaration>({
    married: false,
    spouseSponsoring: false,
    spouseName: '',
  });
  const [employed, setEmployed] = useState(false);
  const [selfEmployed, setSelfEmployed] = useState(false);
  const [employerName, setEmployerName] = useState('');
  const [employerAltName, setEmployerAltName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAltName, setBusinessAltName] = useState('');
  const [employerCategoryChoices, setEmployerCategoryChoices] = useState<WorkCategoryMap>({});
  const [businessCategoryChoices, setBusinessCategoryChoices] = useState<WorkCategoryMap>({});

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore a previously-saved statement on mount — unchanged behavior from before this was split
  // out of StatementCheck.tsx, just keyed by whichever storageKey this instance was given.
  useEffect(() => {
    const saved = loadSaved(storageKey);
    if (saved) {
      setTxns(deserializeTxns(saved.txns));
      setLabel(saved.label || defaultLabel);
      setApplicantName(saved.applicantName || '');
      setMaidenName(saved.maidenName || '');
      setNameCorrections(saved.nameCorrections || {});
      setExplanations(saved.explanations || {});
      setSenderDuplicateDecisions(saved.senderDuplicateDecisions || {});
      setDetectedHolderName(saved.detectedHolderName ?? null);
      setOcrUsed(!!saved.ocrUsed);
      setEmployerName(saved.employerName || '');
      setEmployerAltName(saved.employerAltName || '');
      setBusinessName(saved.businessName || '');
      setBusinessAltName(saved.businessAltName || '');
      setEmployerCategoryChoices(saved.employerCategoryChoices || {});
      setBusinessCategoryChoices(saved.businessCategoryChoices || {});
      setRecalled(true);
    }

    try {
      const raw = localStorage.getItem(answersStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSpouse({
          married: !!parsed?.married,
          spouseSponsoring: !!parsed?.spouseSponsoring,
          spouseName: parsed?.spouseName || '',
        });
        setEmployed(!!parsed?.employed);
        setSelfEmployed(!!parsed?.selfEmployed);
      }
    } catch {
      /* nothing saved yet */
    }

    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, answersStorageKey]);

  // Save on every change, once loaded.
  useEffect(() => {
    if (!loaded || !txns || txns.length === 0) return;
    try {
      const payload: PersistedStatement = {
        txns: serializeTxns(txns),
        label,
        applicantName,
        maidenName,
        nameCorrections,
        explanations,
        senderDuplicateDecisions,
        detectedHolderName,
        ocrUsed,
        employerName,
        employerAltName,
        businessName,
        businessAltName,
        employerCategoryChoices,
        businessCategoryChoices,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [
    loaded,
    txns,
    label,
    applicantName,
    maidenName,
    nameCorrections,
    explanations,
    senderDuplicateDecisions,
    detectedHolderName,
    ocrUsed,
    employerName,
    employerAltName,
    businessName,
    businessAltName,
    employerCategoryChoices,
    businessCategoryChoices,
    storageKey,
  ]);

  // Report this slot's summary up to the parent (for the combined balance card) any time the
  // things that feed it change. Reports `null` while there's nothing parsed yet, same as
  // combineStatementSummaries treats a zero-txnCount summary as "not present".
  useEffect(() => {
    if (!loaded) return;
    onSummaryChange(txns && txns.length ? summarizeStatement(label, txns) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, txns, label]);

  function clearSaved() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setTxns(null);
    setLabel(defaultLabel);
    setApplicantName('');
    setMaidenName('');
    setNameCorrections({});
    setExplanations({});
    setSenderDuplicateDecisions({});
    setDetectedHolderName(null);
    setOcrUsed(false);
    setEmployerName('');
    setEmployerAltName('');
    setBusinessName('');
    setBusinessAltName('');
    setEmployerCategoryChoices({});
    setBusinessCategoryChoices({});
    setRecalled(false);
    setFile(null);
    setError(null);
  }

  async function handleAnalyze() {
    if (!file) return;
    trackEvent('statement_analysis:attempted');
    setUploading(true);
    setError(null);
    try {
      const { lines, ocrUsed: usedOcr } = await getLinesFromFileWithMeta(file);
      if (!lines.length) {
        setError(
          "We tried reading that file — including on-device OCR for a scanned or photographed statement — but couldn't make out any readable text in it. Try a clearer photo/scan (good lighting, holding it flat and steady), or a regular PDF/spreadsheet export from your bank."
        );
        return;
      }
      const result = parseStatementLinesWithFallback(lines);
      if (!result.length) {
        setError(
          "We read the file but couldn't make out any transactions in it. Double-check it's a bank statement export, or try a different file."
        );
        return;
      }
      setTxns(result);
      const fullStatementText = lines.map((l) => l.text || '').join(' ');
      const holderName = extractAccountHolderName(fullStatementText);
      setDetectedHolderName(holderName);
      setOcrUsed(usedOcr);
      // User request: auto-fill the applicant's name from the statement itself where possible,
      // rather than always waiting on manual entry. Never overwrites a name the applicant has
      // already typed (here or on a prior visit) — this only fills the field the first time it's
      // genuinely empty, and if extraction fails (returns null, e.g. an unrecognized statement
      // layout), the field is simply left for the applicant to fill in manually, same as before.
      setApplicantName((prev) => (prev.trim() ? prev : holderName || prev));
      setRecalled(false);
      trackEvent('statement_analysis:completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        `Something went wrong while reading that file (${message}). Try a different PDF or spreadsheet export from your bank.`
      );
    } finally {
      setUploading(false);
    }
  }

  if (!loaded) return null;

  const labelHeader = editingLabel ? (
    <input
      autoFocus
      value={label}
      onChange={(e) => setLabel(e.target.value)}
      onBlur={() => setEditingLabel(false)}
      onKeyDown={(e) => e.key === 'Enter' && setEditingLabel(false)}
      className="rounded border border-black/20 px-2 py-0.5 text-sm font-semibold text-[#12232e]"
    />
  ) : (
    <button
      type="button"
      onClick={() => setEditingLabel(true)}
      className="text-left text-sm font-semibold text-[#12232e] underline decoration-dotted underline-offset-4"
      title="Click to rename (e.g. Salary account, Side business account)"
    >
      {label} ✏️
    </button>
  );

  if (!txns) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {labelHeader}
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-xs text-[#566a76] underline">
              Remove this statement
            </button>
          )}
        </div>
        <p className="text-sm text-[#4c6270]">
          Upload a bank statement (PDF, Excel export, or a clear photo/scan) to see who&apos;s
          paying you, and whether a reviewer would find any gaps.
        </p>

        <ResumeReminderLinks
          visaName={visaName}
          whatToBring="my last 3–6 months of bank statements"
          prompt="Haven't downloaded your bank statements yet? Send yourself a reminder with the link back to this page:"
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-[#12232e]" htmlFor={`${storageKey}-file`}>
            Statement file
          </label>
          <input
            id={`${storageKey}-file`}
            type="file"
            accept=".pdf,.xlsx,.xls,image/*"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
            className="mb-4 block w-full text-sm text-[#12232e] file:mr-3 file:rounded-lg file:border-0 file:bg-accent-wash file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/10"
          />
          <button
            type="button"
            disabled={!file || uploading}
            onClick={handleAnalyze}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? 'Analyzing…' : 'Analyze'}
          </button>
          {uploading && (
            <p className="mt-2 text-xs text-[#566a76]">
              This can take a few minutes for a scanned or photographed statement — it&apos;s read
              entirely on this device (on-device OCR), so a longer statement or a lower-quality photo
              takes longer.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {labelHeader}
          <p className="mt-1 text-sm text-[#4c6270]">
            Found {txns.length} transaction{txns.length === 1 ? '' : 's'} · {formatDate(txns[0]?.date)} –{' '}
            {formatDate(txns[txns.length - 1]?.date)} · Closing balance:{' '}
            {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
              txns[txns.length - 1]?.balance || 0
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={clearSaved} className="text-xs text-accent underline">
            Upload a different statement
          </button>
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-xs text-[#566a76] underline">
              Remove this statement
            </button>
          )}
        </div>
      </div>

      {recalled && (
        <div className="rounded-lg bg-accent-wash p-3 text-sm text-accent" role="status">
          📄 Statement recalled from your last visit — no need to re-upload.
        </div>
      )}

      <StatementDashboard
        txns={txns}
        applicantName={applicantName}
        maidenName={maidenName}
        nameCorrections={nameCorrections}
        onApplicantNameChange={setApplicantName}
        onMaidenNameChange={setMaidenName}
        onNameCorrectionsChange={setNameCorrections}
        explanations={explanations}
        onExplanationsChange={setExplanations}
        senderDuplicateDecisions={senderDuplicateDecisions}
        onSenderDuplicateDecisionsChange={setSenderDuplicateDecisions}
        detectedHolderName={detectedHolderName}
        ocrUsed={ocrUsed}
        spouse={spouse}
        employed={employed}
        selfEmployed={selfEmployed}
        employerName={employerName}
        employerAltName={employerAltName}
        businessName={businessName}
        businessAltName={businessAltName}
        onEmployerNameChange={setEmployerName}
        onEmployerAltNameChange={setEmployerAltName}
        onBusinessNameChange={setBusinessName}
        onBusinessAltNameChange={setBusinessAltName}
        employerCategoryChoices={employerCategoryChoices}
        businessCategoryChoices={businessCategoryChoices}
        onEmployerCategoryChoicesChange={setEmployerCategoryChoices}
        onBusinessCategoryChoicesChange={setBusinessCategoryChoices}
        financialHref={financialHref}
      />
    </div>
  );
}
