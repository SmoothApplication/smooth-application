'use client';

import { useState } from 'react';
import { getLinesFromFile } from '@/lib/statement/extractFile';
import { parseStatementLinesWithFallback, ParsedTxn } from '@/lib/statement';
import StatementDashboard from '@/components/checklist/StatementDashboard';

// Phase 2 of the bank-statement port (task #244-ish — see lib/statement/index.ts for Phase 1).
// Standalone test surface only: proves file-intake (PDF text layer / spreadsheet) -> the pure
// parse/classify engine -> a plain transaction list works end-to-end in a real browser, before
// this gets wired into the actual checklist flow in a later phase. Not linked from anywhere yet;
// reached directly at /checklist/statement-test.
//
// Privacy: matches the promise already made on /checklist/start ("🔒 Your documents never leave
// your device") — the file is read and parsed entirely in this tab via pdf.js/SheetJS running in
// the browser. Nothing about the file or its contents is ever sent to a server.

function formatAmount(n: number): string {
  if (!n) return '—';
  return n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: Date): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function StatementUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txns, setTxns] = useState<ParsedTxn[] | null>(null);

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setTxns(null);
    try {
      const lines = await getLinesFromFile(file);
      if (!lines.length) {
        setError(
          "We tried reading that file — including on-device OCR for a scanned or photographed statement — but couldn't make out any readable text in it. Try a clearer photo/scan, or a regular PDF/spreadsheet export from your bank."
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        `Something went wrong while reading that file (${message}). Try a different PDF or spreadsheet export from your bank.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-5 p-8">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">Statement check (test page)</h1>
        <p className="mt-1 text-sm text-[#4c6270]">
          Upload a bank statement (PDF, Excel export, or a clear photo/scan) to see what we can read
          from it.
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
          accept=".pdf,.xlsx,.xls,image/*"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setTxns(null);
            setError(null);
          }}
          className="mb-4 block w-full text-sm text-[#12232e] file:mr-3 file:rounded-lg file:border-0 file:bg-accent-wash file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/10"
        />
        <button
          type="button"
          disabled={!file || loading}
          onClick={handleAnalyze}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
        {loading && (
          <p className="mt-2 text-xs text-[#566a76]">
            This can take a few minutes for a scanned or photographed statement (on-device OCR).
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text" role="alert">
          {error}
        </div>
      )}

      {txns && (
        <>
          <p className="text-sm font-medium text-[#12232e]">
            Found {txns.length} transaction{txns.length === 1 ? '' : 's'}
          </p>

          <StatementDashboard txns={txns} />

          <details className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-[#12232e]">
              Show raw transaction list
            </summary>
            <div className="mt-3 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-[#566a76]">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Narration</th>
                    <th className="py-2 pr-2 text-right">Debit</th>
                    <th className="py-2 pr-2 text-right">Credit</th>
                    <th className="py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t, i) => (
                    <tr key={i} className="border-b border-black/5 align-top">
                      <td className="py-2 pr-2 whitespace-nowrap text-[#12232e]">{formatDate(t.date)}</td>
                      <td className="py-2 pr-2 text-[#4c6270]">{t.narration || '—'}</td>
                      <td className="py-2 pr-2 text-right text-[#12232e]">
                        {t.debit ? formatAmount(t.debit) : '—'}
                      </td>
                      <td className="py-2 pr-2 text-right text-[#12232e]">
                        {t.credit ? formatAmount(t.credit) : '—'}
                      </td>
                      <td className="py-2 text-right text-[#12232e]">{formatAmount(t.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </main>
  );
}
