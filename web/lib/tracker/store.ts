// Pure logic for the personal application tracker — no localStorage/DOM here (that's
// web/app/tracker/page.tsx's job), same split used by lib/passport and lib/statement. Every
// function below takes the current TrackerEntry[] and returns a new one; nothing is mutated in
// place, so a React component can drop these straight into a useState updater.

import { TrackerEntry, TrackerStatus, TRACKER_STATUS_OPTIONS } from './types';

function isValidStatus(value: unknown): value is TrackerStatus {
  return TRACKER_STATUS_OPTIONS.some((s) => s.value === value);
}

function makeEntryId(): string {
  return 'trk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

/** Rebuilds each entry from scratch rather than trusting the stored shape wholesale — ported
 * verbatim from index.html's loadTrackerEntries(), same defensive-normalization approach used for
 * every other imported/restored structure in the original app, so a hand-edited or older-format
 * export/localStorage value can't inject anything unexpected. Anything that isn't an array, or
 * whose entries aren't objects with a string `id`, is dropped. */
export function normalizeTrackerEntries(raw: unknown): TrackerEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && typeof (e as any).id === 'string')
    .map((e) => ({
      id: e.id as string,
      programId: typeof e.programId === 'string' ? (e.programId as string) : null,
      name: typeof e.name === 'string' ? (e.name as string) : '',
      status: isValidStatus(e.status) ? (e.status as TrackerStatus) : 'researching',
      deadline: typeof e.deadline === 'string' ? (e.deadline as string) : '',
      notes: typeof e.notes === 'string' ? (e.notes as string) : '',
    }));
}

export function isTracked(entries: TrackerEntry[], programId: string): boolean {
  return entries.some((e) => e.programId === programId);
}

function newEntry(programId: string | null, name: string): TrackerEntry {
  return { id: makeEntryId(), programId, name, status: 'researching', deadline: '', notes: '' };
}

/** Ported from toggleTrack(programId, name): adds an entry for that program if none exists yet,
 * or removes the existing one if it does — the "+ Add to my tracker" / "✓ In my tracker" toggle
 * button behavior from the curated Opportunities directory. Not reachable from this app's UI yet
 * (no directory port exists here), but kept so wiring one in later is additive. */
export function toggleTrack(entries: TrackerEntry[], programId: string, name: string): TrackerEntry[] {
  const existing = entries.find((e) => e.programId === programId);
  if (existing) return entries.filter((e) => e !== existing);
  return [...entries, newEntry(programId, name)];
}

/** Ported from the btnAddCustomTracker click handler. Returns `entries` unchanged if `name` is
 * empty/whitespace-only, matching the original's silent no-op. */
export function addCustomEntry(entries: TrackerEntry[], name: string): TrackerEntry[] {
  const trimmed = name.trim();
  if (!trimmed) return entries;
  return [...entries, newEntry(null, trimmed)];
}

export function updateEntryStatus(entries: TrackerEntry[], id: string, status: TrackerStatus): TrackerEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, status } : e));
}

export function updateEntryDeadline(entries: TrackerEntry[], id: string, deadline: string): TrackerEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, deadline } : e));
}

export function updateEntryNotes(entries: TrackerEntry[], id: string, notes: string): TrackerEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, notes } : e));
}

/** Returns the updated list plus the removed entry (or null if `id` wasn't found) — the caller
 * needs the removed entry's `programId` to know whether a directory listing's toggle button needs
 * to flip back (ported from renderTracker()'s `if (removed && removed.programId) renderOpportunities();`). */
export function removeEntry(entries: TrackerEntry[], id: string): { entries: TrackerEntry[]; removed: TrackerEntry | null } {
  const removed = entries.find((e) => e.id === id) ?? null;
  return { entries: entries.filter((e) => e.id !== id), removed };
}
