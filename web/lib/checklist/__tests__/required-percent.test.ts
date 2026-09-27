// Regression tests for computeRequiredPercent()/requiredStatus()/missingRequiredItems() — the
// sidebar's "Documents" readiness score (task #380), a verbatim port of index.html's updateScore()
// (~line 6328). Unlike computeOverallPercent (percent.test.ts), these three are required-items-ONLY:
// a recommended-but-unchecked item must not move the denominator or the missing list.
import {
  computeRequiredPercent,
  requiredStatus,
  missingRequiredItems,
  DEFAULT_ANSWERS,
  ChecklistItem,
  Answers,
} from '../uk';

describe('computeRequiredPercent', () => {
  it('returns 0 for an empty checklist', () => {
    expect(computeRequiredPercent([], DEFAULT_ANSWERS, {})).toBe(0);
  });

  it('ignores recommended items entirely (denominator is required-only)', () => {
    const checklist: ChecklistItem[] = [
      { id: 'req', cat: 'c', weight: 'required', label: 'Required' },
      { id: 'rec', cat: 'c', weight: 'recommended', label: 'Recommended' },
    ];
    // Only the required item is checked; the unchecked recommended item must not drag this below 100.
    expect(computeRequiredPercent(checklist, DEFAULT_ANSWERS, { req: true })).toBe(100);
  });

  it('excludes required items whose appliesIf is false', () => {
    const checklist: ChecklistItem[] = [
      { id: 'always', cat: 'c', weight: 'required', label: 'Always' },
      { id: 'employedOnly', cat: 'c', weight: 'required', label: 'Employed only', appliesIf: (a) => a.employed },
    ];
    const answers: Answers = { ...DEFAULT_ANSWERS, employed: false };
    expect(computeRequiredPercent(checklist, answers, { always: true })).toBe(100);
  });

  it('rounds to the nearest whole percent', () => {
    const checklist: ChecklistItem[] = [
      { id: 'a', cat: 'c', weight: 'required', label: 'A' },
      { id: 'b', cat: 'c', weight: 'required', label: 'B' },
      { id: 'c', cat: 'c', weight: 'required', label: 'C' },
    ];
    expect(computeRequiredPercent(checklist, DEFAULT_ANSWERS, { a: true })).toBe(33);
  });
});

describe('requiredStatus', () => {
  it('matches updateScore()\'s exact 5-tier thresholds and copy', () => {
    expect(requiredStatus(0)).toEqual({ label: 'Getting started', tone: 'neutral' });
    expect(requiredStatus(1)).toEqual({ label: 'Just getting going', tone: 'critical' });
    expect(requiredStatus(49)).toEqual({ label: 'Just getting going', tone: 'critical' });
    expect(requiredStatus(50)).toEqual({ label: 'Making progress', tone: 'serious' });
    expect(requiredStatus(79)).toEqual({ label: 'Making progress', tone: 'serious' });
    expect(requiredStatus(80)).toEqual({ label: 'Almost there', tone: 'warning' });
    expect(requiredStatus(99)).toEqual({ label: 'Almost there', tone: 'warning' });
    expect(requiredStatus(100)).toEqual({ label: 'All required documents ready', tone: 'good' });
  });
});

describe('missingRequiredItems', () => {
  it('returns only applicable, unchecked, required items, in checklist order', () => {
    const checklist: ChecklistItem[] = [
      { id: 'a', cat: 'c', weight: 'required', label: 'A' },
      { id: 'b', cat: 'c', weight: 'recommended', label: 'B (recommended, unchecked)' },
      { id: 'c', cat: 'c', weight: 'required', label: 'C' },
      { id: 'd', cat: 'c', weight: 'required', label: 'D (not applicable)', appliesIf: () => false },
    ];
    expect(missingRequiredItems(checklist, DEFAULT_ANSWERS, { a: true }).map((it) => it.id)).toEqual(['c']);
  });

  it('returns an empty list once every applicable required item is checked', () => {
    const checklist: ChecklistItem[] = [
      { id: 'a', cat: 'c', weight: 'required', label: 'A' },
      { id: 'b', cat: 'c', weight: 'required', label: 'B' },
    ];
    expect(missingRequiredItems(checklist, DEFAULT_ANSWERS, { a: true, b: true })).toEqual([]);
  });
});
