'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
];

// PATCHes app/api/site-feedback/route.ts, which relies on Postgres RLS (not this component) to
// enforce "only a signed-in admin can do this" — see migration 0007_site_feedback.sql. Mirrors
// app/admin/readiness-kits/StatusSelect.tsx exactly.
export default function FeedbackStatusSelect({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleChange(next: string) {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch('/api/site-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      });
      if (!res.ok) {
        setValue(prev);
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
