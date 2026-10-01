'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// Shared sign-in form for both applicants and admins — Supabase Auth doesn't distinguish account
// "types", so where someone lands after signing in is decided by whether their id shows up in
// admin_users (see middleware.ts) vs applicant_profiles.
// useSearchParams() (for the ?next= redirect target) requires a Suspense boundary at build time,
// so the actual form lives in a child component and this file just wraps it.
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(searchParams.get('next') || '/admin');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col p-8 pt-14 sm:pt-24">
      <div className="card-surface p-6">
        <h1 className="mb-4 font-serif text-xl font-semibold text-[#12232e]">Sign in</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
          <input
            type={visible ? 'text' : 'password'}
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
          <label className="flex items-center gap-2 text-sm text-[#4c6270]">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            Show password
          </label>
          {error && <p className="text-sm text-warn-text">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <Link href="/forgot-password" className="mt-3 inline-block text-sm text-accent underline">
          Forgot password?
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
