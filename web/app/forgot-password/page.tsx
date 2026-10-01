'use client';

import { useState } from 'react';
import Link from 'next/link';

// Task #419: linked from "Forgot password?" on app/login/page.tsx. Deliberately shows the same
// confirmation message whether or not the email has an account (see the generic-response comment
// in app/api/request-password-reset/route.ts) — this page just relays whatever that endpoint says.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Something went wrong — try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('Something went wrong — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col p-8 pt-14 sm:pt-24">
        <div className="card-surface p-6">
          <h1 className="mb-2 font-serif text-xl font-semibold text-[#12232e]">Check your email</h1>
          <p className="text-sm text-[#4c6270]">
            If <b>{email}</b> has an account here, we&apos;ve sent a link to reset the password. It
            only works once and expires after a while.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm text-accent underline">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col p-8 pt-14 sm:pt-24">
      <div className="card-surface p-6">
        <h1 className="mb-2 font-serif text-xl font-semibold text-[#12232e]">Reset your password</h1>
        <p className="mb-6 text-sm text-[#4c6270]">
          Enter the email on your account and we&apos;ll send you a link to set a new password.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
          {error && <p className="text-sm text-warn-text">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <Link href="/login" className="mt-4 inline-block text-sm text-accent underline">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
