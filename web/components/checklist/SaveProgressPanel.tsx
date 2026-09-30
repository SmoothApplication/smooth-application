'use client';

import { useEffect, useState } from 'react';
import { Answers } from '@/lib/checklist/uk';
import { DEFAULT_FINANCIAL_INPUTS, FinancialInputs } from '@/lib/checklist/financial';
import { COUNTRIES } from '@/lib/checklist/countries';
import { trackEvent } from '@/lib/analytics';
import * as secureStorage from '@/lib/security/secureStorage';

// Task #421 (save/report-by-email redesign, direct request): "this save file, I want it to be a
// link or a tab beneath the page where you have your responsibility... when you save, it shows you
// option to download PDF. That option is to request for your email... you'll be asked to create a
// password to save your document in your browser." Confirmed via AskUserQuestion: this replaces the
// old "Save your progress" card that lived in ChecklistSidebar's <aside> (see that file's git
// history) — it's now rendered inline in the page content instead, on every session (wired into
// both SessionShell.tsx and CountryChecklistApp.tsx), and the PDF option is email-only (no instant
// download) while the JSON export stays instant, matching the confirmed design exactly.
//
// Subset of ChecklistSidebar's core props (code/answers/checked) so both existing call sites can
// pass values they already have in scope with no new plumbing.
export type SaveProgressPanelProps = {
  code: string;
  answers: Answers;
  checked: Record<string, boolean>;
};

type EmailStep = 'idle' | 'form' | 'sending' | 'sent' | 'error';

export default function SaveProgressPanel({ code, answers, checked }: SaveProgressPanelProps) {
  const lowerCode = code.toLowerCase();
  const financialKey = `sa_${lowerCode}_financial`;
  const statement1Key = `sa_${lowerCode}_statement`;
  const statement2Key = `sa_${lowerCode}_statement_2`;
  const countryInfo = COUNTRIES.find((c) => c.code === code.toUpperCase());
  const countryName = countryInfo?.name || code;

  const [financialInputs, setFinancialInputs] = useState<FinancialInputs | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [emailStep, setEmailStep] = useState<EmailStep>('idle');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    try {
      const raw = secureStorage.getItem(financialKey);
      if (raw) setFinancialInputs({ ...DEFAULT_FINANCIAL_INPUTS, ...JSON.parse(raw) });
    } catch {
      /* no financial data saved yet */
    }
  }, [financialKey]);

  // Same "reflects a real save just happened" idiom ChecklistSidebar used — re-checked whenever
  // answers/checked change (i.e. whenever the page's own autosave effect just ran).
  useEffect(() => {
    setSavedAt(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, checked]);

  function handleExport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      country: code,
      answers,
      checked,
      financial: financialInputs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smooth-application-${lowerCode}-progress.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function readRawStatement(key: string): unknown | null {
    try {
      const raw = secureStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function handleSendReport() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Enter a valid email address.');
      return;
    }
    setEmailStep('sending');
    setErrorMsg('');
    try {
      const statements = [readRawStatement(statement1Key), readRawStatement(statement2Key)].filter(Boolean);
      const res = await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, countryCode: code, answers, checked, financialInputs, statements }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.error || 'Something went wrong sending your report — try again.');
        setEmailStep('error');
        return;
      }
      setEmailStep('sent');
      // Fix 1 (launch-day priority: "we need to know how many people downloaded"): mirrors the
      // server-side count (email_log + report_outcomes) in GoatCounter too, so a quick dashboard
      // check doesn't require a database query.
      trackEvent('report_downloaded');
    } catch {
      setErrorMsg('Something went wrong sending your report — try again.');
      setEmailStep('error');
    }
  }

  return (
    <div className="card-surface p-4">
      <p className="text-sm font-semibold text-[#12232e]">💾 Save your progress</p>
      <p className="mt-1 text-xs text-[#4c6270]">
        Your answers are automatically saved in this browser as you go — close the tab and come back anytime. Nothing
        leaves your device unless you choose to email yourself a copy below.
      </p>
      {savedAt && <p className="mt-1 text-xs font-semibold text-good">✅ Saved in this browser — {savedAt}</p>}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-semibold text-[#12232e]"
        >
          ⬇️ Export progress (.json)
        </button>

        {emailStep === 'idle' && (
          <button type="button" onClick={() => setEmailStep('form')} className="btn-primary text-sm">
            📧 Email me my full report (PDF)
          </button>
        )}
      </div>

      {(emailStep === 'form' || emailStep === 'sending' || emailStep === 'error') && (
        <div className="mt-3 rounded-lg border border-black/10 bg-[#f7fafb] p-3">
          <p className="text-xs text-[#4c6270]">
            We&apos;ll send a PDF of your {countryName} checklist progress — responsibilities answers, document status,
            financial readiness, and bank statement summary — to this email, along with a link to create a password
            so you can come back and pick up where you left off.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={emailStep === 'sending'}
              className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSendReport}
              disabled={emailStep === 'sending'}
              className="btn-primary text-sm disabled:opacity-60"
            >
              {emailStep === 'sending' ? 'Sending…' : 'Send my report'}
            </button>
          </div>
          {errorMsg && <p className="mt-2 text-xs font-semibold text-warn-text">{errorMsg}</p>}
        </div>
      )}

      {emailStep === 'sent' && (
        <p className="mt-3 rounded-lg bg-good-wash px-3 py-2 text-sm font-semibold text-good">
          ✅ Sent to {email} — check your inbox for the PDF and a link to create your password.
        </p>
      )}
    </div>
  );
}
