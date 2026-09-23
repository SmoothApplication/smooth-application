'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { COUNTRIES } from '@/lib/checklist/countries';

// Phase 1 port of index.html's #consentGate — country picker + guidance-only disclaimer + consent
// checkbox. Selection is kept in this browser only (localStorage), same as index.html: nothing
// about which visa someone is looking at goes to Supabase until they actually drop an email
// somewhere further into the flow (see /api/capture-email). Continuing here goes to /checklist,
// currently a stub — the real multi-session checklist body is a later phase of task #244.
export default function ChecklistStartPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();

  const country = useMemo(() => COUNTRIES.find((c) => c.code === selected) ?? null, [selected]);
  const canContinue = !!country?.ready && agreed;

  function handleContinue() {
    if (!canContinue || !country) return;
    try {
      localStorage.setItem('sa_country', country.code);
    } catch {
      // localStorage unavailable (private browsing, etc.) — country still gets passed via query.
    }
    router.push(`/checklist?country=${country.code}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7fafb] p-6">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
        <div className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-accent-wash text-xl" aria-hidden>
          🛂
        </div>
        <h1 className="text-xl font-semibold text-[#12232e]">Smooth Application</h1>
        <p className="mb-4 text-sm text-[#4c6270]">A personal document-readiness checklist.</p>

        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-accent-wash px-3 py-1 text-xs font-medium text-accent">
            🔒 Your documents never leave your device
          </span>
          <span className="rounded-full bg-accent-wash px-3 py-1 text-xs font-medium text-accent">
            🆓 Free, always
          </span>
        </div>

        <label className="mb-2 block text-sm font-medium text-[#12232e]">
          Which visa are you preparing for?
        </label>
        <div className="mb-5 flex flex-col gap-2" role="listbox" aria-label="Country">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              role="option"
              aria-selected={selected === c.code}
              disabled={!c.ready}
              onClick={() => setSelected(c.code)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                selected === c.code
                  ? 'border-accent bg-accent-wash'
                  : c.ready
                  ? 'border-black/10 hover:border-accent/50'
                  : 'cursor-not-allowed border-black/10 opacity-50'
              }`}
            >
              <span>
                {c.flag} {c.name} — {c.visaName}
              </span>
              {!c.ready && <span className="text-xs text-[#566a76]">Coming soon</span>}
            </button>
          ))}
        </div>

        <div className="mb-4 flex gap-2 rounded-lg bg-accent-wash p-3 text-sm text-[#12232e]">
          <span aria-hidden>ℹ️</span>
          {country?.ready ? (
            <div>
              <p className="font-medium">{country.disclaimerHeadline}</p>
              <details className="mt-2 text-xs text-[#4c6270]">
                <summary className="cursor-pointer">Read the full disclaimer</summary>
                <ul className="mt-2 list-disc pl-4">
                  {country.disclaimerBullets?.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mt-2" dangerouslySetInnerHTML={{ __html: country.disclaimerFullHtml ?? '' }} />
              </details>
            </div>
          ) : (
            <p>
              {country
                ? "This country isn't available yet — pick United Kingdom or Canada for now, or check back later."
                : 'Pick a country above to see its guidance disclaimer.'}
            </p>
          )}
        </div>

        <label className="mb-4 flex items-start gap-2 text-xs text-[#4c6270]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>I understand this is guidance only, not immigration advice — full details are in the disclaimer above.</span>
        </label>

        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
        <p className="mt-2 text-center text-xs text-[#566a76]">
          {!country
            ? 'Pick a country to continue.'
            : !country.ready
            ? "This country isn't available yet — pick United Kingdom or Canada for now."
            : !agreed
            ? 'Tick the box above to continue.'
            : ''}
        </p>

        <Link href="/" className="mt-4 block text-center text-xs text-accent underline">
          ← Back
        </Link>
      </div>
    </main>
  );
}
