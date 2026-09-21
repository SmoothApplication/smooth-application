'use client';

import { useState } from 'react';

export default function InviteStaffForm({ departmentId }: { departmentId: string }) {
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    const res = await fetch('/api/admin/invite-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, title, departmentId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setStatus('error');
      setMessage(body.error || 'Something went wrong');
      return;
    }
    setStatus('done');
    setMessage(`Invited ${email} as "${title}".`);
    setEmail('');
    setTitle('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Staff email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Role title (e.g. Support Agent)</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={status === 'saving'}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {status === 'saving' ? 'Inviting…' : 'Invite staff'}
      </button>
      {message && (
        <p className={`w-full text-sm ${status === 'error' ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
      )}
    </form>
  );
}
