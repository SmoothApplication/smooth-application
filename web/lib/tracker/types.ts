// Personal application tracker — ported from index.html's "Phase 2 of the same UNILAG
// street-test feedback that produced the opportunities directory" (see index.html ~line 12807).
// Each entry can point at a curated program (programId set — not yet wired up, since the Next.js
// app has no Opportunities-directory port yet) or be a free-typed custom entry (programId null).
// Kept as its own field on the type now so linking to a future directory port later needs no
// migration of already-stored entries.

export type TrackerStatus =
  | 'researching'
  | 'preparing'
  | 'submitted'
  | 'interview'
  | 'accepted'
  | 'not-selected'
  | 'paused';

export const TRACKER_STATUS_OPTIONS: { value: TrackerStatus; label: string }[] = [
  { value: 'researching', label: 'Researching' },
  { value: 'preparing', label: 'Preparing documents' },
  { value: 'submitted', label: 'Submitted - waiting to hear back' },
  { value: 'interview', label: 'Interview / next stage' },
  { value: 'accepted', label: 'Accepted 🎉' },
  { value: 'not-selected', label: 'Not selected this time' },
  { value: 'paused', label: 'Paused / revisiting later' },
];

export interface TrackerEntry {
  id: string;
  /** Null for a free-typed custom entry. Set when linked to a curated directory program — not
   * currently reachable from this app's UI, but kept so a future Opportunities-directory port can
   * link to this store without a data migration. */
  programId: string | null;
  name: string;
  status: TrackerStatus;
  /** YYYY-MM-DD from an <input type="date">, or '' if unset. */
  deadline: string;
  notes: string;
}

export const APP_TRACKER_KEY = 'smoothApplication_oppTracker_v1';
