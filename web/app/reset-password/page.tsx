'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Task #419: landing page for the recovery link sent by app/api/request-password-reset/route.ts
// (Resend, via sendPasswordResetEmail in lib/resend.ts). Same session-establishing shape as
// app/create-password/page.tsx — Supabase's recovery redirect attaches either a `?code=` (PKCE) or
// `#access_token=&refresh_token=` (implicit) fragment to this URL, and one of those has to be
// exchanged for a real session before updateUser can set a password. See that file's comment for
// why this can't just assume a session already exists.
//
// Differs from create-password in one way: where it lands afterward depends on whether the account
// is an admin or an applicant (the API route decided this and passed it through as `?next=`), since
// unlike the brand-new-applicant flow create-password serves, this page is reachable by both.
// useSearchParams() needs a Suspense boundary at build time, so the form lives in a child component.
type SessionState = 'checking' | 'ready' | 'invalid';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/login';
  // One client instance for the whole page — see create-password/page.tsx for why this matters.
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const supabase = supabaseRef.current;

    async function establishSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          setSessionState('invalid');
          return;
        }
        window.history.replaceState({}, '', url.pathname + url.search.replace(/[?&]code=[^&]*/, ''));
        setSessionState('ready');
        return;
      }

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setErr) {
          setSessionState('invalid');
          return;
        }
        window.history.replaceState({}, '', url.pathname + url.search);
        setSessionState('ready');
        return;
      }

      const { data } = await supabase.auth.getSession();
      setSessionState(data.session ? 'ready' : 'invalid');
    }

    establishSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    const supabase = supabaseRef.current;
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push(next);
      router.refresh();
    }, 1200);
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center p-8 pt-20 text-center sm:pt-32">
        <div className="card-surface w-full p-6">
          <p className="text-lg font-medium text-[#12232e]">Password updated — signing you in…</p>
        </div>
      </main>
    );
  }

  if (sessionState === 'checking') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center p-8 pt-20 text-center sm:pt-32">
        <p className="text-sm text-[#4c6270]">Checking your link…</p>
      </main>
    );
  }

  if (sessionState === 'invalid') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center p-8 pt-20 text-center sm:pt-32">
        <div className="card-surface w-full p-6">
          <h1 className="mb-2 font-serif text-xl font-semibold text-[#12232e]">This link has expired</h1>
          <p className="text-sm text-[#4c6270]">
            Reset links only work once and expire after a while. Go back to the sign-in page and
            request a fresh one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col p-8 pt-14 sm:pt-24">
      <div className="card-surface p-6">
        <h1 className="mb-2 font-serif text-xl font-semibold text-[#12232e]">Set a new password</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type={visible ? 'text' : 'password'}
            required
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
          <input
            type={visible ? 'text' : 'password'}
            required
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="field-input"
          />
          <label className="flex items-center gap-2 text-sm text-[#4c6270]">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            Show password
          </label>
          {error && <p className="text-sm text-warn-text">{error}</p>}
          <button type="submit" className="btn-primary">
            Set password
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
