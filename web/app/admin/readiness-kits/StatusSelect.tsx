'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'done', label: 'Done' },
];

// PATCHes app/api/readiness-kit-request/route.ts, which relies on Postgres RLS (not this
// component) to actually enforce "only a signed-in admin can do this" — see migration
// 0006_readiness_kit_requests.sql. router.refresh() re-runs the server component so the list
// reflects the change without a full page reload.
export default function StatusSelect({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleChange(next: string) {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch('/api/readiness-kit-request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      });
      if (!res.ok) {
        setValue(prev); // revert on failure — e.g. the RLS policy rejected it
      } else {
        router.refresh();
      }
    } catch {
      setValue(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-md border border-gray-200 px-2 py-1 text-xs disabled:opacity-50"
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
