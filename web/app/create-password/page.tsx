'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Landing page for the "Create my password" link in the invite email (see
// lib/resend.ts:sendCreatePasswordEmail, wired from the real Supabase action_link in
// app/api/capture-email/route.ts). That link is what actually signs the browser in — Supabase's
// verify redirect attaches either a `?code=` (PKCE) or `#access_token=&refresh_token=` (implicit)
// to this URL, and one of those has to be exchanged for a real session BEFORE updateUser can set
// a password. Previously this page just assumed a session already existed (it never did for our
// own email, since that email used to link here with no token at all — see CHANGELOG) and called
// updateUser straight away, which failed with "Auth session missing!" every time.
type SessionState = 'checking' | 'ready' | 'invalid';

export default function CreatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const router = useRouter();
  // One client instance for the whole page — the code/hash exchange on mount has to be the same
  // client instance handleSubmit later calls updateUser on, since the session lives on the client
  // object (and, via @supabase/ssr, in cookies that a fresh createClient() call would still pick
  // up — but reusing one instance removes any doubt about timing between the two).
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
        // Clean the one-time code out of the visible URL so a refresh/share doesn't resend it.
        window.history.replaceState({}, '', url.pathname);
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
        window.history.replaceState({}, '', url.pathname);
        setSessionState('ready');
        return;
      }

      // No code/hash at all — maybe this is a reload of an already-established session (rare, but
      // cheap to check) rather than a first arrival from the email link.
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
    setTimeout(() => router.push('/account'), 1200);
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-8 text-center">
        <p className="text-lg font-medium">Password set — taking you to your checklist…</p>
      </main>
    );
  }

  if (sessionState === 'checking') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-gray-600">Checking your link…</p>
      </main>
    );
  }

  if (sessionState === 'invalid') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold">This link has expired</h1>
        <p className="text-sm text-gray-600">
          Invite links only work once and expire after a while. Go back to the checklist and drop
          your email in again — we&apos;ll send a fresh one.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <h1 className="mb-2 text-xl font-semibold">Create your password</h1>
      <p className="mb-6 text-sm text-gray-600">
        This is so you can come back and view your saved progress — we still only keep your email and which step you&apos;ve reached, nothing else.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type={visible ? 'text' : 'password'}
          required
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        <input
          type={visible ? 'text' : 'password'}
          required
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Show password
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
          Create password
        </button>
      </form>
    </main>
  );
}
