'use client';

import { useState, Dispatch, SetStateAction } from 'react';
import {
  TrackerEntry,
  TrackerStatus,
  TRACKER_STATUS_OPTIONS,
  addCustomEntry,
  updateEntryStatus,
  updateEntryDeadline,
  updateEntryNotes,
  removeEntry,
} from '@/lib/tracker';

// Presentational tracker card — the entries list + add-custom-entry form from index.html's
// #appTrackerCard/renderTracker() (see index.html ~line 12807), factored out of
// web/app/tracker/page.tsx so /checklist's standalone /tracker page and /opportunities (which
// combines the directory with the tracker on one screen, same as the original's #opportunitiesGate)
// can share one implementation instead of drifting apart.
//
// No localStorage here — the parent page owns loading/saving `entries` under
// smoothApplication_oppTracker_v1 (see lib/tracker's APP_TRACKER_KEY) and just passes both down,
// same split as everywhere else in this app between pure state and the component that renders it.
export function TrackerCard({
  entries,
  setEntries,
}: {
  entries: TrackerEntry[];
  setEntries: Dispatch<SetStateAction<TrackerEntry[]>>;
}) {
  const [customName, setCustomName] = useState('');

  function handleAddCustom() {
    setEntries((prev) => addCustomEntry(prev, customName));
    setCustomName('');
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4">
      <h2 className="text-base font-semibold text-[#12232e]">📋 My application tracker</h2>
      <p className="mt-1 text-sm text-[#4c6270]">
        Applying to more than one program above? Keep track of where each one stands. This stays on this device only —
        same &quot;nothing leaves your browser&quot; rule as the rest of this tool.
      </p>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-[#4c6270]">
          Nothing tracked yet — click &quot;+ Add to my tracker&quot; on any program above, or type one in below.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {entries.map((entry) => (
            <TrackerRow
              key={entry.id}
              entry={entry}
              onStatusChange={(status) => setEntries((prev) => updateEntryStatus(prev, entry.id, status))}
              onDeadlineChange={(deadline) => setEntries((prev) => updateEntryDeadline(prev, entry.id, deadline))}
              onNotesChange={(notes) => setEntries((prev) => updateEntryNotes(prev, entry.id, notes))}
              onRemove={() => setEntries((prev) => removeEntry(prev, entry.id).entries)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddCustom();
          }}
          placeholder="Track a program not listed above - type its name"
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleAddCustom}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Add to my tracker
        </button>
      </div>
    </div>
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
    <div className="rounded-lg border border-black/10 bg-[#f7fafb] p-4">
      <h3 className="text-sm font-semibold text-[#12232e]">{entry.name || 'Untitled'}</h3>
      <div className="mt-2 flex flex-wrap gap-3">
        <div className="min-w-[160px] flex-1">
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
        <div className="min-w-[160px] flex-1">
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
