'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Landing page for the "Create my password" link in the invite email (see
// lib/resend.ts:sendCreatePasswordEmail). Supabase's invite link signs the browser in with a
// short-lived session automatically on arrival — this form just calls updateUser to set the
// applicant's actual chosen password on that already-authenticated session.
export default function CreatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  const router = useRouter();

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
    const supabase = createClient();
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
