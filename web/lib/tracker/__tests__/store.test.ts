// Ported behavior from index.html's loadTrackerEntries/saveTrackerEntries/toggleTrack/
// btnAddCustomTracker handler/renderTracker (see index.html ~line 12807-12929), retargeted at the
// pure functions in ../store.ts.

import {
  normalizeTrackerEntries,
  isTracked,
  toggleTrack,
  addCustomEntry,
  isDuplicateTrackerName,
  updateEntryStatus,
  updateEntryDeadline,
  updateEntryNotes,
  removeEntry,
} from '../store';
import { TrackerEntry } from '../types';

describe('normalizeTrackerEntries', () => {
  test('non-array input returns an empty list', () => {
    expect(normalizeTrackerEntries(null)).toEqual([]);
    expect(normalizeTrackerEntries(undefined)).toEqual([]);
    expect(normalizeTrackerEntries('garbage')).toEqual([]);
    expect(normalizeTrackerEntries({ not: 'an array' })).toEqual([]);
  });

  test('drops entries without a string id', () => {
    const result = normalizeTrackerEntries([{ name: 'No id' }, { id: 42, name: 'Numeric id' }, null, 'not an object']);
    expect(result).toEqual([]);
  });

  test('rebuilds a well-formed entry field by field', () => {
    const result = normalizeTrackerEntries([
      { id: 'trk_1', programId: 'prog_1', name: 'Chevening', status: 'submitted', deadline: '2026-12-01', notes: 'sent it' },
    ]);
    expect(result).toEqual([
      { id: 'trk_1', programId: 'prog_1', name: 'Chevening', status: 'submitted', deadline: '2026-12-01', notes: 'sent it' },
    ]);
  });

  test('defaults an invalid/missing status to "researching", same as the original', () => {
    const result = normalizeTrackerEntries([{ id: 'trk_1', status: 'not-a-real-status' }]);
    expect(result[0].status).toBe('researching');
  });

  test('coerces non-string programId/name/deadline/notes to their empty defaults', () => {
    const result = normalizeTrackerEntries([{ id: 'trk_1', programId: 123, name: null, deadline: 99, notes: [] }]);
    expect(result[0]).toEqual({ id: 'trk_1', programId: null, name: '', status: 'researching', deadline: '', notes: '' });
  });
});

describe('isTracked / toggleTrack', () => {
  test('isTracked is false with no matching entry, true once one exists', () => {
    const entries: TrackerEntry[] = [];
    expect(isTracked(entries, 'prog_1')).toBe(false);

    const withEntry = toggleTrack(entries, 'prog_1', 'Chevening Scholarship');
    expect(isTracked(withEntry, 'prog_1')).toBe(true);
  });

  test('toggleTrack adds a new entry defaulting to researching/blank deadline/blank notes', () => {
    const result = toggleTrack([], 'prog_1', 'Chevening Scholarship');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      programId: 'prog_1',
      name: 'Chevening Scholarship',
      status: 'researching',
      deadline: '',
      notes: '',
    });
    expect(result[0].id).toMatch(/^trk_/);
  });

  test('toggleTrack removes the existing entry for that programId (toggle off)', () => {
    const withEntry = toggleTrack([], 'prog_1', 'Chevening Scholarship');
    const removed = toggleTrack(withEntry, 'prog_1', 'Chevening Scholarship');
    expect(removed).toEqual([]);
  });

  test('toggleTrack only affects the matching programId, leaving other entries alone', () => {
    const one = toggleTrack([], 'prog_1', 'Program One');
    const two = toggleTrack(one, 'prog_2', 'Program Two');
    const removedOne = toggleTrack(two, 'prog_1', 'Program One');
    expect(removedOne).toHaveLength(1);
    expect(removedOne[0].programId).toBe('prog_2');
  });
});

describe('addCustomEntry', () => {
  test('adds a free-typed entry with programId null', () => {
    const result = addCustomEntry([], 'Fulbright Foreign Student Program');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      programId: null,
      name: 'Fulbright Foreign Student Program',
      status: 'researching',
      deadline: '',
      notes: '',
    });
  });

  test('trims surrounding whitespace, matching the original\'s (input.value || "").trim()', () => {
    const result = addCustomEntry([], '   MEXT Scholarship   ');
    expect(result[0].name).toBe('MEXT Scholarship');
  });

  test('is a silent no-op for empty/whitespace-only input', () => {
    const entries: TrackerEntry[] = [];
    expect(addCustomEntry(entries, '')).toBe(entries);
    expect(addCustomEntry(entries, '   ')).toBe(entries);
  });
});

describe('isDuplicateTrackerName', () => {
  const existing: TrackerEntry = {
    id: 'trk_1',
    programId: null,
    name: 'Harvard Scholarships',
    status: 'researching',
    deadline: '',
    notes: '',
  };

  test('matches case-insensitively — the exact real-world bug this guards against', () => {
    expect(isDuplicateTrackerName([existing], 'harvard scholarships')).toBe(true);
    expect(isDuplicateTrackerName([existing], 'HARVARD SCHOLARSHIPS')).toBe(true);
  });

  test('matches with surrounding whitespace trimmed on both sides', () => {
    expect(isDuplicateTrackerName([existing], '  Harvard Scholarships  ')).toBe(true);
  });

  test('a genuinely different name is not a duplicate', () => {
    expect(isDuplicateTrackerName([existing], 'Chevening Scholarship')).toBe(false);
  });

  test('empty/whitespace-only input is never treated as a duplicate', () => {
    expect(isDuplicateTrackerName([existing], '')).toBe(false);
    expect(isDuplicateTrackerName([existing], '   ')).toBe(false);
  });

  test('an empty tracker has no duplicates', () => {
    expect(isDuplicateTrackerName([], 'Harvard Scholarships')).toBe(false);
  });
});

describe('updateEntryStatus / updateEntryDeadline / updateEntryNotes', () => {
  const base: TrackerEntry = {
    id: 'trk_1',
    programId: null,
    name: 'Chevening Scholarship',
    status: 'researching',
    deadline: '',
    notes: '',
  };

  test('updateEntryStatus only touches the matching id', () => {
    const other: TrackerEntry = { ...base, id: 'trk_2', name: 'Other' };
    const result = updateEntryStatus([base, other], 'trk_1', 'submitted');
    expect(result.find((e) => e.id === 'trk_1')?.status).toBe('submitted');
    expect(result.find((e) => e.id === 'trk_2')?.status).toBe('researching');
  });

  test('updateEntryDeadline sets the deadline string', () => {
    const result = updateEntryDeadline([base], 'trk_1', '2026-12-01');
    expect(result[0].deadline).toBe('2026-12-01');
  });

  test('updateEntryNotes sets the notes string', () => {
    const result = updateEntryNotes([base], 'trk_1', 'submitted 12 Aug, waiting on a referee letter');
    expect(result[0].notes).toBe('submitted 12 Aug, waiting on a referee letter');
  });

  test('an unknown id leaves the list unchanged', () => {
    expect(updateEntryStatus([base], 'nope', 'accepted')).toEqual([base]);
  });
});

describe('removeEntry', () => {
  test('removes the matching entry and returns it', () => {
    const a: TrackerEntry = { id: 'trk_1', programId: 'prog_1', name: 'A', status: 'researching', deadline: '', notes: '' };
    const b: TrackerEntry = { id: 'trk_2', programId: null, name: 'B', status: 'researching', deadline: '', notes: '' };
    const { entries, removed } = removeEntry([a, b], 'trk_1');
    expect(entries).toEqual([b]);
    expect(removed).toEqual(a);
  });

  test('returns removed: null and the list unchanged when the id is not found', () => {
    const a: TrackerEntry = { id: 'trk_1', programId: null, name: 'A', status: 'researching', deadline: '', notes: '' };
    const { entries, removed } = removeEntry([a], 'nope');
    expect(entries).toEqual([a]);
    expect(removed).toBeNull();
  });
});
