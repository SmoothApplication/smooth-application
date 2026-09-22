'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// See lib/invite-link.ts for why this page exists: messaging apps fetch links server-side to
// build a preview card, which would burn Supabase's one-time invite/magic link before a human
// ever taps it. This page does nothing on load — the real link only fires from a genuine click.
function InviteLinkContent() {
  const params = useSearchParams();
  const to = params.get('to');
  const [clicked, setClicked] = useState(false);

  if (!to) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-gray-600">This link is missing its destination. Ask whoever sent it for a fresh one.</p>
      </main>
    );
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
        onClick={() => {
          setClicked(true);
          window.location.href = decodeURIComponent(to);
        }}
        className="w-full rounded-md bg-brand px-4 py-3 font-medium text-white hover:bg-brand-dark"
      >
        {clicked ? 'Opening…' : 'Continue to create your password'}
      </button>
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
