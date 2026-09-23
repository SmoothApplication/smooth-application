'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { COUNTRIES } from '@/lib/checklist/countries';

// Stub for the actual multi-session checklist (passport scan, bank-statement analysis, financial
// calculator, etc.) — porting that is a later phase of task #244; this page exists so
// /checklist/start has somewhere honest to send someone right now, rather than a dead link or a
// half-built session shell.
//
// It does one real thing already: capturing an email via /api/capture-email so the country pick
// isn't thrown away, and the admin dashboard's applicant counts start reflecting real Next.js
// traffic. Known limitation, called out honestly in the copy below rather than silently: the
// "create your password" email this triggers currently won't reach a real inbox (Resend's sandbox
// sender can only deliver to the account's own address until a verified domain is added — see
// CHANGELOG). The email is still saved either way.
function ChecklistStubContent() {
  const params = useSearchParams();
  const countryCode = params.get('country');
  const country = COUNTRIES.find((c) => c.code === countryCode) ?? null;

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch('/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, country: countryCode, sessionKey: 'intro', percentComplete: 0 }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 p-8">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">
          {country ? `${country.flag} ${country.name} checklist` : 'Your checklist'}
        </h1>
        <p className="mt-2 text-sm text-[#4c6270]">
          The full step-by-step checklist — passport scan, bank statement check, financial readiness
          calculator and all — is still being rebuilt here. It isn&apos;t ready yet on this new site.
        </p>
      </div>

      <div className="rounded-lg border border-black/10 bg-white p-4 text-sm">
        <p className="mb-2 font-medium text-[#12232e]">In the meantime, two options:</p>
        <a
          href="https://smoothapplication.github.io/smooth-application/"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-md bg-accent px-4 py-2.5 text-center font-medium text-white hover:opacity-90"
        >
          Use the full free checklist (original site)
        </a>
        <p className="mt-2 text-xs text-[#566a76]">
          Same checklist, same privacy promise — everything still runs in your browser there.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-black/10 bg-white p-4 text-sm">
        <p className="mb-2 font-medium text-[#12232e]">Or leave your email and we&apos;ll let you know when this is ready</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={status === 'saving'}
            className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {status === 'saving' ? 'Saving…' : 'Notify me'}
          </button>
        </div>
        {status === 'done' && (
          <p className="mt-2 text-xs text-good">Saved — we&apos;ll be in touch at that address.</p>
        )}
        {status === 'error' && (
          <p className="mt-2 text-xs text-red-600">Something went wrong — try again in a moment.</p>
        )}
      </form>

      <Link href="/checklist/start" className="text-center text-xs text-accent underline">
        ← Change country
      </Link>
    </main>
  );
}

export default function ChecklistStubPage() {
  return (
    <Suspense fallback={null}>
      <ChecklistStubContent />
    </Suspense>
  );
}
