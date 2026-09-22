'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Forced stop for anyone who signed in with a temp password (see
// supabase/migrations/0003_temp_password_invites.sql and middleware.ts, which redirects here
// whenever admin_users.must_change_password is true and blocks every other /admin route until
// it's cleared). Once they set their own password we call complete-password-change to clear the
// flag server-side (RLS won't let this page's own client do that update — see that route).
export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setSaving(false);
      setError(updateErr.message);
      return;
    }
    const res = await fetch('/api/admin/complete-password-change', { method: 'POST' });
    if (!res.ok) {
      setSaving(false);
      setError('Password was set, but we couldn’t finish setup — try refreshing.');
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col justify-center gap-4 p-8">
      <div>
        <h1 className="text-xl font-semibold">Set your password</h1>
        <p className="mt-2 text-sm text-gray-600">
          You signed in with a temporary password someone shared with you. Set your own now — you&apos;ll use it
          every time from here on.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          required
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </main>
  );
}
