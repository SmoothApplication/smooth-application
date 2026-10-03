'use client';

import { useEffect, useState } from 'react';
import StatementSlot from '@/components/checklist/StatementSlot';
import SessionShell from '@/components/checklist/SessionShell';
import PersonalLetterPanel from '@/components/checklist/PersonalLetterPanel';
import { COUNTRIES } from '@/lib/checklist/countries';
import { combineStatementSummaries, StatementSummary } from '@/lib/statement';
import * as secureStorage from '@/lib/security/secureStorage';

// Generalized out of the original UK-only web/app/checklist/uk/statement/page.tsx (Phase 4 of
// task #244) so the same bank-statement check can be reused for every supported country's
// /checklist/<country>/statement route.
//
// Task #420 (direct request): "people who work in structured/corporate organizations... have an
// account for salary [and] are not permitted to take in any other money for that account. Now they
// have another account for a side business or inflow from parents or... rental income... let the
// system accept two bank statements, process them at the same time, pick their balances and create
// a place where you can have two statements to take to the embassy." Previously this component only
// ever handled ONE statement (see StatementSlot.tsx, which is what this file's whole body used to
// be before this task pulled it out to be mountable twice). Now a second, fully independent
// statement slot is available on demand, plus a combined-balance summary once both are present.
//
// Each slot analyzes its own statement completely independently — different accounts can have
// different senders, narrations, even a different declared name on the account — and the two are
// never merged into one transaction list (see lib/statement/combined.ts for why: a running balance
// only means anything within its own account). All this file adds on top is the number a combined
// evidence pack actually needs: each account's closing balance and date range, plus their total/span.
//
// Privacy: unchanged — each file is read and parsed entirely in-browser and never uploaded anywhere.
export type StatementCheckProps = {
  countryCode: string;
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function StatementCheck({ countryCode }: StatementCheckProps) {
  const lowerCode = countryCode.toLowerCase();
  const slot1Key = `sa_${lowerCode}_statement`;
  const slot2Key = `sa_${lowerCode}_statement_2`;
  const answersKey = `sa_${lowerCode}_answers`;
  const financialHref = `/checklist/${lowerCode}/financial`;
  const countryInfo = COUNTRIES.find((c) => c.code === countryCode.toUpperCase());
  const visaName = countryInfo?.visaName || 'visa';
  const countryName = countryInfo?.name || countryCode;

  const [showSecondSlot, setShowSecondSlot] = useState(false);
  // Statement-only mode (?focus=1): no session bar, sidebar or questions - just upload, review, download.
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    try {
      setFocus(new URLSearchParams(window.location.search).get('focus') === '1');
    } catch {
      /* ignore */
    }
  }, []);
  const [summary1, setSummary1] = useState<StatementSummary | null>(null);
  const [summary2, setSummary2] = useState<StatementSummary | null>(null);

  // A second slot from an earlier visit should reappear automatically — don't make someone click
  // "+ Add a second bank statement" again just because they refreshed the page.
  useEffect(() => {
    try {
      if (secureStorage.getItem(slot2Key)) setShowSecondSlot(true);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot2Key]);

  function removeSecondSlot() {
    try {
      secureStorage.removeItem(slot2Key);
    } catch {
      /* ignore */
    }
    setSummary2(null);
    setShowSecondSlot(false);
  }

  const combined =
    summary1 || summary2 ? combineStatementSummaries([summary1, summary2].filter((s): s is StatementSummary => !!s)) : null;

  const body = (
    <>
      <div>
        <h1 className="font-serif text-xl font-semibold text-[#12232e]">🏦 Bank statement check</h1>
        <p className="mt-1 text-sm text-[#4c6270]">
          Upload a bank statement to see who&apos;s paying you, and whether a reviewer would find any
          gaps. If your salary account can&apos;t receive other income, add your second account below
          too — we&apos;ll analyze both and total up the balance to take to the embassy.
        </p>
      </div>

      <span className="w-fit rounded-full bg-accent-wash px-3 py-1 text-xs font-medium text-accent">
        🔒 Processed entirely in your browser — these files are never uploaded anywhere
      </span>

      <StatementSlot
        storageKey={slot1Key}
        answersStorageKey={answersKey}
        defaultLabel="Statement 1"
        financialHref={financialHref}
        visaName={visaName}
        onSummaryChange={setSummary1}
        otherStatementSummary={summary2}
        reportExtras={
          summary1 ? (
            <PersonalLetterPanel
              key={`${summary1.txnCount}-${summary1.closingBalance}-${summary2?.txnCount ?? 0}-${summary2?.closingBalance ?? 0}`}
              code={countryCode}
              inline
            />
          ) : null
        }
      />

      {showSecondSlot ? (
        <StatementSlot
          storageKey={slot2Key}
          answersStorageKey={answersKey}
          defaultLabel="Statement 2"
          financialHref={financialHref}
          visaName={visaName}
          onSummaryChange={setSummary2}
          onRemove={removeSecondSlot}
          otherStatementSummary={summary1}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowSecondSlot(true)}
          className="w-fit rounded-lg border border-dashed border-black/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent-wash"
        >
          + Add a second bank statement
        </button>
      )}

      {combined && summary1 && summary2 && (
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-[#12232e]">Combined summary — for the embassy</h2>
          <p className="mb-4 text-xs text-[#566a76]">
            Both statements&apos; own analysis stays separate above (different accounts can have
            different senders); this just totals up what a reviewer would want to see across both.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {combined.statements.map((s, i) => (
              <div key={i} className="rounded-lg border border-black/10 p-3">
                <p className="text-xs text-[#566a76]">{s.label}</p>
                <p className="mt-1 text-base font-semibold text-[#12232e]">{fmtCurrency(s.closingBalance)}</p>
                <p className="mt-1 text-xs text-[#566a76]">
                  {fmtDate(s.firstDate)} – {fmtDate(s.lastDate)}
                </p>
              </div>
            ))}
            <div className="rounded-lg bg-accent-wash p-3">
              <p className="text-xs text-accent">Combined total</p>
              <p className="mt-1 text-base font-semibold text-[#12232e]">{fmtCurrency(combined.totalClosingBalance)}</p>
              <p className="mt-1 text-xs text-[#566a76]">
                {fmtDate(combined.earliestDate)} – {fmtDate(combined.latestDate)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (focus) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 bg-cream p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="text-sm font-semibold text-[#12232e]">Smooth Application</a>
          <a href={`/checklist/${lowerCode}/statement`} className="text-xs text-accent underline">
            Want the full checklist? Open it →
          </a>
        </div>
        {body}
      </main>
    );
  }

  return (
    <SessionShell code={countryCode} name={countryName} session="statement">
      {body}
    </SessionShell>
  );
}
