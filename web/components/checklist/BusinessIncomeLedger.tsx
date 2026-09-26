'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getLinesFromFile } from '@/lib/statement/extractFile';
import {
  ParsedTxn,
  parseStatementLinesWithFallback,
  serializeTxns,
  deserializeTxns,
  PersistedTxn,
  filterBusinessCredits,
  bizLedgerEntryIsFilled,
  countFilledEntries,
  buildBizLedgerRows,
  countUnspecifiedRows,
  BizLedgerMap,
  inflowKey,
} from '@/lib/statement';

// Port of index.html's Business Income Record (task #319 selection "Business income ledger" —
// see web/lib/statement/business.ts for the pure filtering/row logic and its scope note). Some
// genuine business payments never came with a formal receipt — a market sale, a walk-in customer,
// an informal client. Rather than manufacturing paperwork that doesn't exist, this builds one
// honest, dated record in the applicant's own words explaining each incoming payment on their
// business statement, meant to be attached ALONGSIDE that statement, never in place of it.
//
// Its own upload step (separate from StatementCheck's PERSONAL-statement flow) reuses the exact
// same parsing engine (getLinesFromFile + parseStatementLinesWithFallback) against a BUSINESS
// statement — same "processed entirely in your browser" privacy story, same file-then-Analyze UI
// as StatementCheck, so this doesn't feel like a different product bolted on.
//
// Deliberately not ported here: the original's recurring personal-drawing detection off this same
// business statement, and cross-checking those drawings against the personal statement (index.html
// ~12398-12550) — a separate, larger "business statement analysis" feature this pass doesn't build.
export type BusinessIncomeLedgerProps = {
  countryCode: string;
};

function formatAmount(n: number): string {
  if (!n) return '₦0.00';
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: Date): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface SavedBizLedger {
  credits: PersistedTxn[];
  ledger: BizLedgerMap;
  businessName: string;
}

function loadSaved(storageKey: string): SavedBizLedger | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedBizLedger;
    if (!parsed || !Array.isArray(parsed.credits)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function BusinessIncomeLedger({ countryCode }: BusinessIncomeLedgerProps) {
  const lowerCode = countryCode.toLowerCase();
  const storageKey = `sa_${lowerCode}_bizledger`;
  const backHref = `/checklist/${lowerCode}`;

  const [loaded, setLoaded] = useState(false);
  const [recalled, setRecalled] = useState(false);

  // null = not scanned yet; [] = scanned, but no incoming payments found on it.
  const [credits, setCredits] = useState<ParsedTxn[] | null>(null);
  const [ledger, setLedger] = useState<BizLedgerMap>({});
  const [businessName, setBusinessName] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBuilt, setShowBuilt] = useState(false);

  useEffect(() => {
    const saved = loadSaved(storageKey);
    if (saved) {
      setCredits(deserializeTxns(saved.credits));
      setLedger(saved.ledger || {});
      setBusinessName(saved.businessName || '');
      setRecalled(true);
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Same debounce-free "save on every change, once loaded" pattern as StatementCheck.tsx — only
  // once a scan has actually happened (credits !== null), so an untouched page never writes.
  useEffect(() => {
    if (!loaded || credits === null) return;
    try {
      const payload: SavedBizLedger = { credits: serializeTxns(credits), ledger, businessName };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [credits, ledger, businessName, loaded, storageKey]);

  const filledCount = useMemo(() => countFilledEntries(credits || [], ledger), [credits, ledger]);
  const builtRows = useMemo(() => buildBizLedgerRows(credits || [], ledger), [credits, ledger]);
  const unspecifiedCount = useMemo(() => countUnspecifiedRows(builtRows), [builtRows]);

  function clearSaved() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setCredits(null);
    setLedger({});
    setBusinessName('');
    setRecalled(false);
    setFile(null);
    setError(null);
    setShowBuilt(false);
  }

  function updateEntry(t: ParsedTxn, field: 'payer' | 'purpose', value: string) {
    const key = inflowKey(t);
    setLedger((prev) => {
      const existing = prev[key] || { payer: '', purpose: '' };
      const next = { ...existing, [field]: value };
      return { ...prev, [key]: next };
    });
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
      setCredits(filterBusinessCredits(result));
      setLedger({});
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

  if (credits === null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
        <div>
          <h1 className="text-xl font-semibold text-[#12232e]">🧾 Business Income Record</h1>
          <p className="mt-1 text-sm text-[#4c6270]">
            Some genuine business payments never came with a formal receipt — a market sale, a walk-in
            customer, an informal client. Rather than manufacturing paperwork that doesn&apos;t exist, this
            builds one honest, dated record in your own words explaining each incoming payment on your
            business statement. Attach it <b>alongside</b> your business statement — it explains the
            inflows, it doesn&apos;t replace them.
          </p>
        </div>

        <span className="w-fit rounded-full bg-accent-wash px-3 py-1 text-xs font-medium text-accent">
          🔒 Processed entirely in your browser — this file is never uploaded anywhere
        </span>

        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-[#12232e]" htmlFor="biz-statement-file">
            Business statement file
          </label>
          <input
            id="biz-statement-file"
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
            {uploading ? 'Scanning…' : 'Scan statement'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text" role="alert">
            {error}
          </div>
        )}

        <Link href={backHref} className="text-center text-xs text-accent underline">
          ← Back to checklist
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[#12232e]">🧾 Business Income Record</h1>
          <p className="mt-1 text-sm text-[#4c6270]">
            {credits.length
              ? `Found ${credits.length} incoming payment${credits.length === 1 ? '' : 's'} on this business statement.`
              : "Scanned this statement, but didn't find any incoming payments worth noting on it."}
          </p>
        </div>
        <button type="button" onClick={clearSaved} className="text-xs text-accent underline">
          Scan a different statement
        </button>
      </div>

      {recalled && (
        <div className="rounded-lg bg-accent-wash p-3 text-sm text-accent" role="status">
          📄 Business Income Record recalled from your last visit — no need to re-scan.
        </div>
      )}

      {credits.length > 0 && (
        <>
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-xs font-medium text-[#12232e]" htmlFor="biz-name">
              Business name (optional — used on the record below)
            </label>
            <input
              id="biz-name"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="my business"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <p className="text-sm text-[#4c6270]">
            {filledCount} of {credits.length} payment(s) noted so far. For each, add who paid and what it
            was for — from your own knowledge of the transaction, in your own words.
          </p>

          <div className="flex flex-col gap-3">
            {credits.map((t) => {
              const key = inflowKey(t);
              const entry = ledger[key] || { payer: '', purpose: '' };
              const filled = bizLedgerEntryIsFilled(entry);
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-3 text-sm ${filled ? 'border-accent/40 bg-accent-wash/30' : 'border-black/10 bg-white'}`}
                >
                  <div className="mb-2 text-xs text-[#4c6270]">
                    {formatDate(t.date)} — {formatAmount(t.credit)}
                    {t.narration ? ` ("${t.narration}")` : ' (no narration on statement)'}
                  </div>
                  <label className="mb-1 block text-xs font-medium text-[#12232e]">Who paid this?</label>
                  <input
                    type="text"
                    value={entry.payer}
                    onChange={(e) => updateEntry(t, 'payer', e.target.value)}
                    placeholder='e.g. Chidinma Okeke, or "walk-in customer"'
                    className="mb-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <label className="mb-1 block text-xs font-medium text-[#12232e]">What was it for?</label>
                  <input
                    type="text"
                    value={entry.purpose}
                    onChange={(e) => updateEntry(t, 'purpose', e.target.value)}
                    placeholder="e.g. Payment for 2 bags of rice"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowBuilt(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            📄 Build my Business Income Record
          </button>

          {showBuilt && (
            <div className="rounded-lg border border-black/10 bg-white p-4 text-sm">
              {unspecifiedCount > 0 && (
                <div className="mb-2 rounded bg-warn-wash p-2 text-xs text-warn-text">
                  {unspecifiedCount} row(s) still say &quot;(not specified)&quot; — go back and fill those in
                  above before attaching this, so every payment is actually explained.
                </div>
              )}
              <h3 className="mb-1 font-semibold text-[#12232e]">
                Business Income Record — {businessName.trim() || 'my business'}
              </h3>
              <p className="mb-3 text-xs text-[#4c6270]">
                Prepared by the business owner on {new Date().toDateString()}, from their own knowledge of
                these transactions, to accompany the business bank statement submitted with this
                application. This is the applicant&apos;s own account of each payment — not a receipt
                issued at the time of the transaction.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="border-b border-black/10 px-2 py-1 text-left">Date</th>
                      <th className="border-b border-black/10 px-2 py-1 text-left">Amount</th>
                      <th className="border-b border-black/10 px-2 py-1 text-left">Paid by</th>
                      <th className="border-b border-black/10 px-2 py-1 text-left">What it was for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {builtRows.map((r, i) => (
                      <tr key={i}>
                        <td className="border-b border-black/5 px-2 py-1">{formatDate(r.date)}</td>
                        <td className="border-b border-black/5 px-2 py-1">{formatAmount(r.amount)}</td>
                        <td className="border-b border-black/5 px-2 py-1">{r.payer}</td>
                        <td className="border-b border-black/5 px-2 py-1">{r.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-[#4c6270]">
                Attach this alongside your business bank statement — it explains the inflows shown there;
                it does not replace the statement itself.
              </p>
            </div>
          )}
        </>
      )}

      <Link href={backHref} className="text-center text-xs text-accent underline">
        ← Back to checklist
      </Link>
    </main>
  );
}
