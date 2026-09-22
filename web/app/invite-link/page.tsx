'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// See lib/invite-link.ts for why this page exists: messaging apps fetch links server-side to
// build a preview card, which would burn Supabase's one-time invite/magic link before a human
// ever taps it. This page does nothing on load — the real link is only resolved (via
// /api/invite-redirect/[id]) and fired from inside a genuine button click.
function InviteLinkContent() {
  const params = useSearchParams();
  const id = params.get('id');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  if (!id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-gray-600">This link is missing its destination. Ask whoever sent it for a fresh one.</p>
      </main>
    );
  }

  async function handleContinue() {
    setStatus('loading');
    try {
      const res = await fetch(`/api/invite-redirect/${id}`);
      const body = await res.json();
      if (!res.ok || !body.target) {
        setStatus('error');
        return;
      }
      window.location.href = body.target;
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">You&apos;ve been invited</h1>
      <p className="text-sm text-gray-600">
        Tap below to open your account and set a password. This link only works once, so use it yourself rather than
        forwarding it.
      </p>
      <button
        type="button"
        onClick={handleContinue}
        disabled={status === 'loading'}
        className="w-full rounded-md bg-brand px-4 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {status === 'loading' ? 'Opening…' : 'Continue to create your password'}
      </button>
      {status === 'error' && (
        <p className="text-sm text-red-600">This link has already been used or has expired. Ask whoever sent it for a fresh one.</p>
      )}
    </main>
  );
}

export default function InviteLinkPage() {
  return (
    <Suspense fallback={null}>
      <InviteLinkContent />
    </Suspense>
  );
}
