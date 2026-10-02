'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

// Follow-up to the UX audit (smoothapplication.com "too clumsy" feedback, direct request): instead
// of a one-off 50-person PickFu poll, real visitors leave honest feedback as they use the live site.
// Mounted in SessionShell.tsx on every session, same non-floating placement as SaveProgressPanel
// (task #391 already found that a `fixed` bottom-corner element ends up overlapping whatever content
// happens to scroll underneath it — this sits in the normal page flow instead).
//
// Collapsed by default (a one-line prompt), so it never competes with the session's own Next/Back
// CTAs for attention — only expands into the actual form once the applicant chooses to open it.
export type SiteFeedbackPanelProps = {
  countryCode?: string;
};

type Sentiment = 'confusing' | 'fine' | 'great';
type Step = 'collapsed' | 'open' | 'sending' | 'sent' | 'error';

const SENTIMENT_OPTIONS: { value: Sentiment; label: string }[] = [
  { value: 'confusing', label: '😕 Confusing' },
  { value: 'fine', label: '🙂 It’s fine' },
  { value: 'great', label: '🎉 This is great' },
];

export default function SiteFeedbackPanel({ countryCode }: SiteFeedbackPanelProps) {
  const pathname = usePathname();
  const [step, setStep] = useState<Step>('collapsed');
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit() {
    if (!sentiment && !message.trim()) {
      setErrorMsg('Pick a reaction or add a note first.');
      return;
    }
    setStep('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/site-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagePath: pathname, countryCode, sentiment, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data?.error || 'Something went wrong sending this — try again.');
        setStep('open');
        return;
      }
      setStep('sent');
    } catch {
      setErrorMsg('Something went wrong sending this — try again.');
      setStep('open');
    }
  }

  if (step === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => setStep('open')}
        className="card-surface w-full p-3 text-left text-xs font-medium text-[#566a76] hover:text-[#12232e]"
      >
        💬 Something confusing on this page? Tell us — takes 10 seconds.
      </button>
    );
  }

  if (step === 'sent') {
    return (
      <div className="card-surface p-4 text-sm font-medium text-good">
        ✅ Thanks — that goes straight to the team, not into a void.
      </div>
    );
  }

  return (
    <div className="card-surface flex flex-col gap-3 p-4">
      <p className="text-sm font-semibold text-[#12232e]">What did you think of this page?</p>
      <div className="flex flex-wrap gap-2">
        {SENTIMENT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSentiment(opt.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              sentiment === opt.value ? 'border-accent bg-accent-wash text-accent' : 'border-black/10 text-[#566a76]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Optional: what was confusing, or what would make this easier?"
        rows={3}
        className="rounded-lg border border-black/10 px-3 py-2 text-sm text-[#12232e]"
      />
      {errorMsg && <p className="text-xs font-medium text-warn-text">{errorMsg}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={step === 'sending'}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {step === 'sending' ? 'Sending…' : 'Send feedback'}
        </button>
        <button
          type="button"
          onClick={() => setStep('collapsed')}
          className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-semibold text-[#12232e]"
        >
          Not now
        </button>
      </div>
      <p className="text-xs text-[#8a97a0]">Anonymous — we don’t collect your name or email here.</p>
    </div>
  );
}
