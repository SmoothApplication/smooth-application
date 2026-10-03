'use client';

import { useState } from 'react';

// Follow-up to the 6-month failure review ("one operator, one WhatsApp number" risk): a parsing
// problem used to reach the founder only if the applicant bothered to open WhatsApp. This gives a
// one-tap, in-page way to flag "my statement was read wrong" that lands in the existing
// site_feedback admin view (no new table/migration) as a clearly-tagged row, so recurring bank
// formats show up as a fix list instead of scattered chats.
//
// Privacy: sends ONLY the bank name, an issue category and an optional note typed by the applicant.
// It never reads, attaches or derives anything from the statement's own contents — the statement
// is processed on-device and this component has no access to it by design.
const ISSUES = [
  'Some transactions are missing',
  'Amounts or dates look wrong',
  'My name was read wrongly',
  'A sender was grouped or labelled wrongly',
  'Something else',
];

type Step = 'collapsed' | 'open' | 'sending' | 'sent' | 'error';

export default function ParseProblemReport({ countryCode }: { countryCode?: string }) {
  const [step, setStep] = useState<Step>('collapsed');
  const [bank, setBank] = useState('');
  const [issue, setIssue] = useState(ISSUES[0]);
  const [note, setNote] = useState('');

  async function submit() {
    setStep('sending');
    const message = `[Statement reading problem] Bank: ${bank.trim() || 'not given'} | Issue: ${issue}${
      note.trim() ? ` | Note: ${note.trim()}` : ''
    }`;
    try {
      const res = await fetch('/api/site-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagePath: typeof window !== 'undefined' ? window.location.pathname : '/statement',
          countryCode,
          sentiment: 'confusing',
          message,
        }),
      });
      setStep(res.ok ? 'sent' : 'error');
    } catch {
      setStep('error');
    }
  }

  if (step === 'sent') {
    return (
      <div className="rounded-lg bg-good-wash p-3 text-sm font-medium text-good">
        ✅ Thanks — this helps us fix how that bank&apos;s statements are read. Your statement itself was never sent.
      </div>
    );
  }

  if (step === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => setStep('open')}
        className="w-full rounded-lg border border-black/10 bg-white p-3 text-left text-xs font-medium text-[#566a76] hover:text-[#12232e]"
      >
        🛠 Does something look wrongly read? Tell us which bank — it helps us fix it.
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4">
      <p className="text-sm font-semibold text-[#12232e]">What looks wrong?</p>
      <input
        value={bank}
        onChange={(e) => setBank(e.target.value)}
        maxLength={60}
        placeholder="Which bank or app? (e.g. GTBank, OPay, Access)"
        className="rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
      />
      <select
        value={issue}
        onChange={(e) => setIssue(e.target.value)}
        className="rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
      >
        {ISSUES.map((i) => (
          <option key={i}>{i}</option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={400}
        placeholder="Optional note. Please don't paste account numbers or personal details."
        className="rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
      />
      {step === 'error' && (
        <p className="text-xs font-medium text-warn-text">Couldn&apos;t send that — please try again.</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={step === 'sending'}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {step === 'sending' ? 'Sending…' : 'Send report'}
        </button>
        <button
          type="button"
          onClick={() => setStep('collapsed')}
          className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-semibold text-[#12232e]"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-[#8a97a0]">
        Only the bank name and what you type here are sent — never your statement or its contents.
      </p>
    </div>
  );
}
