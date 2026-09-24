// Regression tests for itemApplies() and computeOverallPercent(). These specifically guard
// against the bug found while writing this suite: computeOverallPercent used to be hardcoded to
// CHECKLIST_UK internally, so every non-UK country's progress bar was silently computed against
// the UK's (much longer) item list instead of its own. It now takes the checklist explicitly.
import { itemApplies, computeOverallPercent, DEFAULT_ANSWERS, ChecklistItem, Answers } from '../uk';
import { ALL_CHECKLISTS } from '../all';

describe('itemApplies', () => {
  const base: ChecklistItem = { id: 'x', cat: 'c', weight: 'required', label: 'X' };

  it('applies unconditional items regardless of answers', () => {
    expect(itemApplies(base, DEFAULT_ANSWERS)).toBe(true);
  });

  it('honors a truthy appliesIf', () => {
    const item: ChecklistItem = { ...base, appliesIf: (a) => a.employed };
    expect(itemApplies(item, { ...DEFAULT_ANSWERS, employed: true })).toBe(true);
    expect(itemApplies(item, { ...DEFAULT_ANSWERS, employed: false })).toBe(false);
  });
});

describe('computeOverallPercent', () => {
  it('returns 0 for an empty checklist', () => {
    expect(computeOverallPercent([], DEFAULT_ANSWERS, {})).toBe(0);
  });

  it('returns 0 when nothing applicable is checked', () => {
    const checklist: ChecklistItem[] = [
      { id: 'a', cat: 'c', weight: 'required', label: 'A' },
      { id: 'b', cat: 'c', weight: 'required', label: 'B' },
    ];
    expect(computeOverallPercent(checklist, DEFAULT_ANSWERS, {})).toBe(0);
  });

  it('returns 100 when every applicable item is checked', () => {
    const checklist: ChecklistItem[] = [
      { id: 'a', cat: 'c', weight: 'required', label: 'A' },
      { id: 'b', cat: 'c', weight: 'required', label: 'B' },
    ];
    expect(computeOverallPercent(checklist, DEFAULT_ANSWERS, { a: true, b: true })).toBe(100);
  });

  it('excludes items whose appliesIf is false from both numerator and denominator', () => {
    const checklist: ChecklistItem[] = [
      { id: 'always', cat: 'c', weight: 'required', label: 'Always' },
      { id: 'employedOnly', cat: 'c', weight: 'required', label: 'Employed only', appliesIf: (a) => a.employed },
    ];
    const answers: Answers = { ...DEFAULT_ANSWERS, employed: false };
    // Only "always" applies, and it's checked -> 100%, not 50%.
    expect(computeOverallPercent(checklist, answers, { always: true })).toBe(100);
  });

  it('rounds to the nearest whole percent', () => {
    const checklist: ChecklistItem[] = [
      { id: 'a', cat: 'c', weight: 'required', label: 'A' },
      { id: 'b', cat: 'c', weight: 'required', label: 'B' },
      { id: 'c', cat: 'c', weight: 'required', label: 'C' },
    ];
    // 1/3 checked = 33.33...% -> rounds to 33
    expect(computeOverallPercent(checklist, DEFAULT_ANSWERS, { a: true })).toBe(33);
  });

  it('computes each ported country against its OWN checklist, not the UK one', () => {
    // This is the actual regression case: before the fix, calling computeOverallPercent for a
    // short country checklist (e.g. GH, 13 items) with the UK's 30+-item list hardcoded inside
    // would produce a far lower, wrong percentage than checking every GH item should give.
    for (const code of Object.keys(ALL_CHECKLISTS)) {
      const { checklist } = ALL_CHECKLISTS[code];
      const applicable = checklist.filter((it) => itemApplies(it, DEFAULT_ANSWERS));
      const allChecked: Record<string, boolean> = {};
      for (const it of applicable) allChecked[it.id] = true;
      expect(computeOverallPercent(checklist, DEFAULT_ANSWERS, allChecked)).toBe(100);
    }
  });

  it('GH (a short checklist) reaching 100% does not require checking UK-only item ids', () => {
    const { checklist } = ALL_CHECKLISTS['GH'];
    const applicable = checklist.filter((it) => itemApplies(it, DEFAULT_ANSWERS));
    const ghOnlyChecked: Record<string, boolean> = {};
    for (const it of applicable) ghOnlyChecked[it.id] = true;
    // Sanity: GH's applicable set is materially smaller than UK's.
    const ukApplicable = ALL_CHECKLISTS['UK'].checklist.filter((it) => itemApplies(it, DEFAULT_ANSWERS));
    expect(applicable.length).toBeLessThan(ukApplicable.length);
    expect(computeOverallPercent(checklist, DEFAULT_ANSWERS, ghOnlyChecked)).toBe(100);
  });
});

describe('ALL_CHECKLISTS data integrity', () => {
  const codes = Object.keys(ALL_CHECKLISTS);

  it('includes all 8 ported countries', () => {
    expect(codes.sort()).toEqual(['CA', 'ET', 'EU', 'GH', 'KE', 'MA', 'UK', 'ZA'].sort());
  });

  it.each(codes)('%s has a non-empty checklist and catOrder', (code) => {
    const { checklist, catOrder } = ALL_CHECKLISTS[code];
    expect(checklist.length).toBeGreaterThan(0);
    expect(catOrder.length).toBeGreaterThan(0);
  });

  it.each(codes)('%s has no duplicate item ids', (code) => {
    const { checklist } = ALL_CHECKLISTS[code];
    const ids = checklist.map((it) => it.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(codes)('%s: every item.cat appears in that country\'s catOrder', (code) => {
    const { checklist, catOrder } = ALL_CHECKLISTS[code];
    const cats = new Set(checklist.map((it) => it.cat));
    for (const cat of cats) {
      expect(catOrder).toContain(cat);
    }
  });
});
