'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getLinesFromFile } from '@/lib/statement/extractFile';
import {
  parseStatementLinesWithFallback,
  ParsedTxn,
  serializeTxns,
  deserializeTxns,
  PersistedStatement,
} from '@/lib/statement';
import StatementDashboard from '@/components/checklist/StatementDashboard';

// Phase 4 of the bank-statement port (task #244): the real, linked checklist page - StatementUpload
// (Phase 2) + StatementDashboard (Phase 3) wired together here rather than duplicated, plus
// localStorage persistence so revisiting this page doesn't require re-uploading the statement.
//
// Privacy: unchanged from every earlier phase - the file itself is read and parsed entirely in this
// tab (pdf.js/SheetJS in the browser) and is never sent anywhere. What DOES get saved is a small
// plain-data reduction of the parsed transactions (see lib/statement/persist.ts) plus the applicant
// name / maiden name / "Fix name" corrections - all under one localStorage key, sa_uk_statement.
// No raw file bytes and no original file are ever stored.
const STORAGE_KEY = 'sa_uk_statement';

function formatDate(d: Date): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function loadSaved(): PersistedStatement | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedStatement;
    if (!parsed || !Array.isArray(parsed.txns) || parsed.txns.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function UKStatementCheckPage() {
  const [loaded, setLoaded] = useState(false);
  const [recalled, setRecalled] = useState(false);

  const [txns, setTxns] = useState<ParsedTxn[] | null>(null);
  const [applicantName, setApplicantName] = useState('');
  const [maidenName, setMaidenName] = useState('');
  const [nameCorrections, setNameCorrections] = useState<Record<string, string>>({});

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore a previously-saved statement on mount, so this page can skip straight to the dashboard
  // instead of asking the applicant to re-upload every visit - same "recalled, no re-upload needed"
  // UX the rest of this app already uses for other saved answers.
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setTxns(deserializeTxns(saved.txns));
      setApplicantName(saved.applicantName || '');
      setMaidenName(saved.maidenName || '');
      setNameCorrections(saved.nameCorrections || {});
      setRecalled(true);
    }
    setLoaded(true);
  }, []);

  // Save on every change, once loaded - same debounce-free pattern as
  // web/app/checklist/uk/financial/page.tsx. Only saves once there's a parsed statement to save;
  // an empty/aborted upload never touches localStorage.
  useEffect(() => {
    if (!loaded || !txns || txns.length === 0) return;
    try {
      const payload: PersistedStatement = {
        txns: serializeTxns(txns),
        applicantName,
        maidenName,
        nameCorrections,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [loaded, txns, applicantName, maidenName, nameCorrections]);

  function clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setTxns(null);
    setApplicantName('');
    setMaidenName('');
    setNameCorrections({});
    setRecalled(false);
    setFile(null);
    setError(null);
  }

  async function handleAnalyze() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const lines = await getLinesFromFile(file);
      if (!lines.length) {
        setError(
          "We couldn't find any readable text in that file. If it's a scanned or photographed statement, this quick check doesn't support those yet — a regular PDF or spreadsheet export from your bank works best."
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
      setRecalled(false);
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

  if (!txns) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-5 p-6 pb-16">
        <div>
          <h1 className="text-xl font-semibold text-[#12232e]">🏦 Bank statement check</h1>
          <p className="mt-1 text-sm text-[#4c6270]">
            Upload a bank statement (PDF or Excel export) to see who&apos;s paying you, and whether a
            reviewer would find any gaps.
          </p>
        </div>

        <span className="w-fit rounded-full bg-accent-wash px-3 py-1 text-xs font-medium text-accent">
          🔒 Processed entirely in your browser — this file is never uploaded anywhere
        </span>

        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-[#12232e]" htmlFor="statement-file">
            Statement file
          </label>
          <input
            id="statement-file"
            type="file"
            accept=".pdf,.xlsx,.xls"
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
        </div>

        {error && (
          <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text" role="alert">
            {error}
          </div>
        )}

        <Link href="/checklist/uk" className="text-center text-xs text-accent underline">
          ← Back to checklist
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-5 p-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[#12232e]">🏦 Bank statement check</h1>
          <p className="mt-1 text-sm text-[#4c6270]">
            Found {txns.length} transaction{txns.length === 1 ? '' : 's'} · {formatDate(txns[0]?.date)} –{' '}
            {formatDate(txns[txns.length - 1]?.date)}
          </p>
        </div>
        <button
          type="button"
          onClick={clearSaved}
          className="text-xs text-accent underline"
        >
          Upload a different statement
        </button>
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
      />

      <Link href="/checklist/uk" className="text-center text-xs text-accent underline">
        ← Back to checklist
      </Link>
    </main>
  );
}

