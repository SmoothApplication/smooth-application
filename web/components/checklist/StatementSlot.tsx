'use client';

import { useEffect, useState } from 'react';
import { getLinesFromFileWithMeta, StatementPasswordRequiredError } from '@/lib/statement/extractFile';
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
  StatementFailureReason,
  buildStatementHelpWhatsAppHref,
} from '@/lib/statement';
import StatementDashboard from '@/components/checklist/StatementDashboard';
import ResumeReminderLinks from '@/components/checklist/ResumeReminderLinks';
import { trackEvent } from '@/lib/analytics';
import { syncFinancialInputsFromStatement } from '@/lib/checklist/financeStatementSync';
import { dispatchChecklistUpdated } from '@/lib/checklist/liveUpdateEvents';
import * as secureStorage from '@/lib/security/secureStorage';

// Direct user report (live, mid-session, screenshot of /checklist/uk/statement): a statement
// analyzed to 649 transactions, yet the sidebar's "Documents" readiness score still read 0%/
// "Getting started". Root cause, parallel to task #503's passport fix (PassportCheck.tsx — see
// that file's own comment): nothing on this page ever wrote to sa_<code>_checked, so the
// document-checklist's bank-statement item stayed unticked until the applicant separately
// remembered to go tick a checkbox on a different page. The item's id differs by country —
// 'bankStatements' (uk/eu/ca/za/et) vs 'proofOfFunds' (gh/ke/ma) — so both are set; whichever one
// isn't part of a given country's checklist is simply inert (computeRequiredPercent only counts
// ids that actually appear in that checklist). Only ever sets these to true, same as #503, so a
// manual tick elsewhere is never undone by this.
function autoTickBankStatementIfAnalyzed(checkedStorageKey: string) {
  try {
    const raw = secureStorage.getItem(checkedStorageKey);
    const current = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    if (current.bankStatements && current.proofOfFunds) return; // already ticked — nothing changed
    secureStorage.setItem(
      checkedStorageKey,
      JSON.stringify({ ...current, bankStatements: true, proofOfFunds: true })
    );
    dispatchChecklistUpdated();
  } catch {
    /* ignore — worst case the applicant ticks it by hand on the checklist */
  }
}

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
  /** Direct instruction: "read the balance on the dollar account and read the balance on the other
   * account... I did it to see before it even under financial readiness" — the OTHER slot's own
   * summary (closing balance, label, date range), surfaced inside THIS slot's Financial readiness
   * section rather than only in the page-level combined-summary card at the bottom. Null/undefined
   * when the other slot has nothing uploaded yet. */
  otherStatementSummary?: StatementSummary | null;
};

function formatDate(d: Date): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function loadSaved(storageKey: string): PersistedStatement | null {
  try {
    const raw = secureStorage.getItem(storageKey);
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
  otherStatementSummary,
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
  const [flaggedReasonMode, setFlaggedReasonMode] = useState<Record<string, 'same' | 'different'>>({});
  const [flaggedReasonChoice, setFlaggedReasonChoice] = useState<Record<string, string>>({});
  const [flaggedReasonOther, setFlaggedReasonOther] = useState<Record<string, string>>({});
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
  // Declared-vs-actual income mismatch check (incomeMatch.ts) — 0 means "not entered yet".
  const [employerDeclaredMonthlyIncome, setEmployerDeclaredMonthlyIncome] = useState(0);
  const [businessDeclaredMonthlyIncome, setBusinessDeclaredMonthlyIncome] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Direct request: "how do we get an alert when an applicant is having difficulty reading his or
  // her bank statement?" This is which of the three failure branches in handleAnalyze() below just
  // hit, so the error UI can offer a one-tap "message us now" link built specifically for it (see
  // lib/statement/supportContact.ts) — null whenever there's no error to show one for.
  const [failureReason, setFailureReason] = useState<StatementFailureReason | null>(null);
  // Direct request: "how can an applicant open his/her passworded bank statement... we need to make
  // it easier" — real Nigerian bank PDF exports are very often password-protected by default, and a
  // busy applicant shouldn't have to go find a separate PDF-unlock tool before they can even start.
  // getLinesFromFileWithMeta throws StatementPasswordRequiredError instead of the generic exception
  // it used to (see extractFile.ts) when the file needs a password; this is that: true once we know
  // this specific file needs one, so the upload card can swap its usual error banner for an inline
  // password field + a friendly hint, and retry with whatever the applicant types.
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordIncorrect, setPasswordIncorrect] = useState(false);
  const [password, setPassword] = useState('');

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
      setFlaggedReasonMode(saved.flaggedReasonMode || {});
      setFlaggedReasonChoice(saved.flaggedReasonChoice || {});
      setFlaggedReasonOther(saved.flaggedReasonOther || {});
      setDetectedHolderName(saved.detectedHolderName ?? null);
      setOcrUsed(!!saved.ocrUsed);
      setEmployerName(saved.employerName || '');
      setEmployerAltName(saved.employerAltName || '');
      setBusinessName(saved.businessName || '');
      setBusinessAltName(saved.businessAltName || '');
      setEmployerCategoryChoices(saved.employerCategoryChoices || {});
      setBusinessCategoryChoices(saved.businessCategoryChoices || {});
      setEmployerDeclaredMonthlyIncome(saved.employerDeclaredMonthlyIncome || 0);
      setBusinessDeclaredMonthlyIncome(saved.businessDeclaredMonthlyIncome || 0);
      setRecalled(true);
    }

    try {
      const raw = secureStorage.getItem(answersStorageKey);
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

  // Save on every change, once loaded. Declared BEFORE the finance-sync effect below — React runs a
  // component's useEffect hooks in declaration order within the same commit, and the sync effect
  // reads this slot's statement back OUT of storage (see its own comment), so it must run after this
  // one has actually written the just-parsed statement, not before. Getting this backwards was a
  // real, reported bug: a brand-new upload sets txns, which puts BOTH effects on deps and fires them
  // in the same commit — if the sync effect ran first (as it originally did, further down in the
  // file), it read storage before this effect had saved anything, silently found nothing, and never
  // seeded sa_<code>_financial at all. The Finances sidebar score then stayed stuck at 0% ("Enter
  // your figures") for a same-session upload, only ever working after a reload/recall (when this
  // effect's PRIOR write was already sitting in storage by the time the sync effect ran).
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
        flaggedReasonMode,
        flaggedReasonChoice,
        flaggedReasonOther,
        detectedHolderName,
        ocrUsed,
        employerName,
        employerAltName,
        businessName,
        businessAltName,
        employerCategoryChoices,
        businessCategoryChoices,
        employerDeclaredMonthlyIncome,
        businessDeclaredMonthlyIncome,
      };
      secureStorage.setItem(storageKey, JSON.stringify(payload));
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
    flaggedReasonMode,
    flaggedReasonChoice,
    flaggedReasonOther,
    detectedHolderName,
    ocrUsed,
    employerName,
    employerAltName,
    businessName,
    businessAltName,
    employerCategoryChoices,
    businessCategoryChoices,
    employerDeclaredMonthlyIncome,
    businessDeclaredMonthlyIncome,
    storageKey,
  ]);

  // Direct user report (live, mid-session): "bank statement has been uploaded and analyzed, yet
  // finances is reading 0". Seeds sa_<code>_financial's closing balance + cash flow from this
  // statement the moment it's analyzed (or restored from a previous visit), so the sidebar's
  // Finances score reflects real evidence without requiring a separate trip through the Financial
  // calculator session first — see lib/checklist/financeStatementSync.ts for the non-destructive
  // merge rules. storageKey is always `sa_<lowerCode>_statement` or `sa_<lowerCode>_statement_2`.
  // MUST run after the save effect above (see that effect's comment for why) — kept declared second.
  // Also auto-ticks the document checklist's bank-statement item (see autoTickBankStatementIfAnalyzed
  // above) — same trigger (a successfully analyzed statement), so it lives in the same effect rather
  // than a third one duplicating this effect's guard conditions.
  useEffect(() => {
    if (!txns || txns.length === 0) return;
    const match = storageKey.match(/^sa_(.+?)_statement/);
    if (!match) return;
    syncFinancialInputsFromStatement(match[1]);
    autoTickBankStatementIfAnalyzed(`sa_${match[1]}_checked`);
  }, [txns, storageKey]);

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
      secureStorage.removeItem(storageKey);
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
    setEmployerDeclaredMonthlyIncome(0);
    setBusinessDeclaredMonthlyIncome(0);
    setRecalled(false);
    setFile(null);
    setError(null);
    setFailureReason(null);
    setNeedsPassword(false);
    setPasswordIncorrect(false);
    setPassword('');
  }

  async function handleAnalyze() {
    if (!file) return;
    trackEvent('statement_analysis:attempted');
    setUploading(true);
    setError(null);
    setFailureReason(null);
    try {
      const { lines, ocrUsed: usedOcr } = await getLinesFromFileWithMeta(
        file,
        needsPassword ? password : undefined
      );
      // A password (right or wrong) was only ever asked for because a previous attempt needed one;
      // reaching this line means it worked, so drop that state rather than carry a stale flag.
      setNeedsPassword(false);
      setPasswordIncorrect(false);
      if (!lines.length) {
        setError(
          "We tried reading that file — including on-device OCR for a scanned or photographed statement — but couldn't make out any readable text in it. Try a clearer photo/scan (good lighting, holding it flat and steady), or a regular PDF/spreadsheet export from your bank."
        );
        setFailureReason('no_text');
        trackEvent('statement_analysis:failed_no_text');
        return;
      }
      const result = parseStatementLinesWithFallback(lines);
      if (!result.length) {
        setError(
          "We read the file but couldn't make out any transactions in it. Double-check it's a bank statement export, or try a different file."
        );
        setFailureReason('no_transactions');
        trackEvent('statement_analysis:failed_no_transactions');
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
      if (err instanceof StatementPasswordRequiredError) {
        setNeedsPassword(true);
        setPasswordIncorrect(err.incorrect);
        trackEvent(err.incorrect ? 'statement_analysis:password_incorrect' : 'statement_analysis:password_required');
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      setError(
        `Something went wrong while reading that file (${message}). Try a different PDF or spreadsheet export from your bank.`
      );
      setFailureReason('exception');
      trackEvent('statement_analysis:failed_exception');
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
              setFailureReason(null);
              setNeedsPassword(false);
              setPasswordIncorrect(false);
              setPassword('');
            }}
            className="mb-4 block w-full text-sm text-[#12232e] file:mr-3 file:rounded-lg file:border-0 file:bg-accent-wash file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/10"
          />

          {needsPassword && (
            // Direct request: "how can an applicant open his/her passworded bank statement... we
            // need to make it easier" — instead of a dead end, let them type the password right
            // here and retry in place. Nigerian bank PDF exports are commonly password-protected by
            // default (often with the account number, BVN, or date of birth), so a short hint saves
            // most applicants a trip to find that password.
            <div className="mb-4 rounded-lg bg-accent-wash p-3" role="status">
              <label
                className="mb-1 block text-sm font-medium text-[#12232e]"
                htmlFor={`${storageKey}-pdf-password`}
              >
                🔒 This PDF is password-protected
                {passwordIncorrect ? ' — that password wasn’t right, try again' : ''}
              </label>
              <p className="mb-2 text-xs text-[#4c6270]">
                Most Nigerian banks protect their statement PDFs by default — check the email or app
                screen where you downloaded it. Common defaults include your account number, BVN, or
                date of birth (as DDMMYYYY).
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={`${storageKey}-pdf-password`}
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && file && !uploading && handleAnalyze()}
                  placeholder="PDF password"
                  className={`rounded-lg border px-3 py-2 text-sm text-[#12232e] ${
                    passwordIncorrect ? 'border-warn-text' : 'border-black/20'
                  }`}
                />
                <button
                  type="button"
                  disabled={!file || !password || uploading}
                  onClick={handleAnalyze}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? 'Unlocking…' : 'Unlock & analyze'}
                </button>
              </div>
            </div>
          )}

          {!needsPassword && (
            <button
              type="button"
              disabled={!file || uploading}
              onClick={handleAnalyze}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Analyzing…' : 'Analyze'}
            </button>
          )}
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
            <p>{error}</p>
            {failureReason && (
              <a
                href={buildStatementHelpWhatsAppHref(failureReason, visaName)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
              >
                💬 Still stuck? Message us now on WhatsApp
              </a>
            )}
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
          {/* Direct user question: "why not a refresh button?" — this button already IS that: no raw
              file bytes are ever kept (only the parsed results, by design — see persist.ts), so the
              only way to re-run a fixed/updated parser is to hand it the file again. The old label
              ("Upload a different statement") read as "pick a new document", which confused an
              applicant who just needed to re-feed the SAME file after a parsing fix shipped. Re-worded
              to make clear this re-analyzes the file they already have, same file or a new one either
              way. */}
          <button type="button" onClick={clearSaved} className="text-xs text-accent underline">
            Re-analyze (same or different file)
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
        flaggedReasonMode={flaggedReasonMode}
        onFlaggedReasonModeChange={setFlaggedReasonMode}
        flaggedReasonChoice={flaggedReasonChoice}
        onFlaggedReasonChoiceChange={setFlaggedReasonChoice}
        flaggedReasonOther={flaggedReasonOther}
        onFlaggedReasonOtherChange={setFlaggedReasonOther}
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
        employerDeclaredMonthlyIncome={employerDeclaredMonthlyIncome}
        onEmployerDeclaredMonthlyIncomeChange={setEmployerDeclaredMonthlyIncome}
        businessDeclaredMonthlyIncome={businessDeclaredMonthlyIncome}
        onBusinessDeclaredMonthlyIncomeChange={setBusinessDeclaredMonthlyIncome}
        financialHref={financialHref}
        otherStatementSummary={otherStatementSummary}
      />
    </div>
  );
}
