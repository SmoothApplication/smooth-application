'use client';

import { useState } from 'react';

export default function InviteSubAdminForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '');
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setInviteLink(null);
    setCopied(false);
    const res = await fetch('/api/admin/invite-sub-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        departmentId: departmentId || undefined,
        newDepartmentName: newDepartmentName || undefined,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setStatus('error');
      setMessage(body.error || 'Something went wrong');
      return;
    }
    setStatus('done');
    setMessage(`Invited ${email} as a sub-admin.`);
    setInviteLink(body.inviteLink || null);
    setEmail('');
    setNewDepartmentName('');
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      // clipboard API unavailable — the link is still selectable/visible below
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Sub-admin email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="coo@company.com"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Department</label>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">— New department below —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      {!departmentId && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">New department name</label>
          <input
            type="text"
            value={newDepartmentName}
            onChange={(e) => setNewDepartmentName(e.target.value)}
            placeholder="e.g. COO"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      )}
      <button
        type="submit"
        disabled={status === 'saving'}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {status === 'saving' ? 'Inviting…' : 'Invite sub-admin'}
      </button>
      {message && (
        <p className={`w-full text-sm ${status === 'error' ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
      )}
      {inviteLink && (
        <div className="w-full rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="mb-2 text-amber-800">
            We can&apos;t auto-email this address yet (no verified sending domain) — copy this link and send it to
            them yourself:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={inviteLink}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dark"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
