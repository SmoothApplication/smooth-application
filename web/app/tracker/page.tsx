'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrackerEntry,
  TrackerStatus,
  TRACKER_STATUS_OPTIONS,
  APP_TRACKER_KEY,
  normalizeTrackerEntries,
  addCustomEntry,
  updateEntryStatus,
  updateEntryDeadline,
  updateEntryNotes,
  removeEntry,
} from '@/lib/tracker';

// Port of index.html's Personal application tracker (#appTrackerCard / renderTracker(), see
// index.html ~line 1770 and ~line 12807) — "Phase 2 of the same UNILAG street-test feedback that
// produced the opportunities directory". The Next.js app has no Opportunities-directory port yet,
// so unlike the original (where most entries arrive via a program's "+ Add to my tracker"
// button), every entry here is added through the free-typed custom-name form. The data model
// (lib/tracker/types.ts) still carries `programId` so a future directory port can link into this
// same store without migrating anything already saved.
//
// This isn't scoped to one country's checklist — applicants often track programs across several
// countries at once — so it lives at a global /tracker route rather than under
// /checklist/[country], and is linked from every country's checklist header
// (see CountryChecklistApp's trackerHref).
//
// Privacy: unchanged from the rest of this app — tracked entries live only in this browser's
// localStorage under smoothApplication_oppTracker_v1, never sent anywhere.
export default function TrackerPage() {
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [customName, setCustomName] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(APP_TRACKER_KEY);
      if (raw) setEntries(normalizeTrackerEntries(JSON.parse(raw)));
    } catch {
      /* start fresh */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(APP_TRACKER_KEY, JSON.stringify(entries));
    } catch {
      /* fail silently, same as the rest of this app's autosave */
    }
  }, [entries, loaded]);

  if (!loaded) return null;

  function handleAddCustom() {
    setEntries((prev) => addCustomEntry(prev, customName));
    setCustomName('');
  }

  function handleRemove(id: string) {
    setEntries((prev) => removeEntry(prev, id).entries);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">📋 My application tracker</h1>
        <p className="mt-1 text-sm text-[#4c6270]">
          Keep track of every scholarship, program, or visa application you&apos;re working on, in one place.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-black/10 bg-white p-4 text-sm text-[#4c6270]">
          Nothing tracked yet — type a program or application below to start tracking it.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <TrackerRow
              key={entry.id}
              entry={entry}
              onStatusChange={(status) => setEntries((prev) => updateEntryStatus(prev, entry.id, status))}
              onDeadlineChange={(deadline) => setEntries((prev) => updateEntryDeadline(prev, entry.id, deadline))}
              onNotesChange={(notes) => setEntries((prev) => updateEntryNotes(prev, entry.id, notes))}
              onRemove={() => handleRemove(entry.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-4">
        <label className="text-xs font-medium text-[#12232e]" htmlFor="trackerCustomName">
          Add a program or application to track
        </label>
        <div className="flex gap-2">
          <input
            id="trackerCustomName"
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCustom();
            }}
            placeholder="e.g. Chevening Scholarship"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + Add
          </button>
        </div>
      </div>

      <Link href="/checklist/start" className="text-center text-xs text-accent underline">
        ← Back
      </Link>
    </main>
  );
}

function TrackerRow({
  entry,
  onStatusChange,
  onDeadlineChange,
  onNotesChange,
  onRemove,
}: {
  entry: TrackerEntry;
  onStatusChange: (status: TrackerStatus) => void;
  onDeadlineChange: (deadline: string) => void;
  onNotesChange: (notes: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4">
      <h3 className="text-sm font-semibold text-[#12232e]">{entry.name || 'Untitled'}</h3>
      <div className="mt-2 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-[#12232e]" htmlFor={`track_status_${entry.id}`}>
            Status
          </label>
          <select
            id={`track_status_${entry.id}`}
            value={entry.status}
            onChange={(e) => onStatusChange(e.target.value as TrackerStatus)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {TRACKER_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-[#12232e]" htmlFor={`track_deadline_${entry.id}`}>
            Deadline (optional)
          </label>
          <input
            id={`track_deadline_${entry.id}`}
            type="date"
            value={entry.deadline}
            onChange={(e) => onDeadlineChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <label className="mb-1 mt-3 block text-xs font-medium text-[#12232e]" htmlFor={`track_notes_${entry.id}`}>
        Notes
      </label>
      <textarea
        id={`track_notes_${entry.id}`}
        value={entry.notes}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={2}
        placeholder="e.g. submitted 12 Aug, waiting on a referee letter"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={onRemove}
        className="mt-3 rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-[#4c6270] hover:bg-black/5"
      >
        Remove from tracker
      </button>
    </div>
  );
}
