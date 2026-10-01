// Tester feedback (forwarded WhatsApp message): "the sites process looks too long Like too many
// questions." These tests lock down the DISPLAY-only chapter grouping added to fix the perceived
// length of the flow — chapterInfoForSession must always collapse the flat, country-variable
// buildSessionOrder() list down to a small, FIXED number of chapters, regardless of how many
// document-checklist categories a given country has. Deliberately does not touch, and does not
// re-assert, buildSessionOrder's own exact-shape guarantees (see sessions.test.ts) — this is a
// separate, additive view over the same data.
import { buildSessionOrder } from '../sessions';
import { chapterInfoForSession } from '../chapters';

describe('chapterInfoForSession', () => {
  test('chapter count is fixed at 6 regardless of country (UK has more checklist categories than GH)', () => {
    const uk = buildSessionOrder('UK');
    const gh = buildSessionOrder('GH');
    expect(uk.length).not.toBe(gh.length); // sanity: these ARE different lengths underneath
    expect(chapterInfoForSession(uk, 0).chapterCount).toBe(6);
    expect(chapterInfoForSession(gh, 0).chapterCount).toBe(6);
  });

  test('first session (statement, due to the flow-order permutation) is in the "Income & finances" chapter, chapter 1 of 6', () => {
    const order = buildSessionOrder('UK');
    const info = chapterInfoForSession(order, 0);
    expect(order[0].key).toBe('statement');
    expect(info.chapterIndex).toBe(0);
    expect(info.chapterLabel).toBe('Income & finances');
    expect(info.subLabel).toBe('Income & bank statement analysis');
  });

  test('every checklist:N session shares one "Document checklist" chapter, with a sub-position inside it', () => {
    const order = buildSessionOrder('UK');
    const checklistIdxs = order
      .map((s, i) => ({ key: s.key, i }))
      .filter((s) => s.key.startsWith('checklist:'))
      .map((s) => s.i);
    expect(checklistIdxs.length).toBeGreaterThan(1);

    const infos = checklistIdxs.map((i) => chapterInfoForSession(order, i));
    // all share the same chapter index/label
    const [first, ...rest] = infos;
    rest.forEach((info) => {
      expect(info.chapterIndex).toBe(first.chapterIndex);
      expect(info.chapterLabel).toBe('Document checklist');
    });
    // sub-position counts up correctly and matches the total category count
    infos.forEach((info, pos) => {
      expect(info.subPosition).not.toBeNull();
      expect(info.subPosition?.index).toBe(pos + 1);
      expect(info.subPosition?.count).toBe(infos.length);
    });
  });

  test('final-review and reasons share the last chapter, "Review & submit"', () => {
    const order = buildSessionOrder('UK');
    const finalReviewIdx = order.findIndex((s) => s.key === 'final-review');
    const reasonsIdx = order.findIndex((s) => s.key === 'reasons');
    const finalInfo = chapterInfoForSession(order, finalReviewIdx);
    const reasonsInfo = chapterInfoForSession(order, reasonsIdx);
    expect(finalInfo.chapterLabel).toBe('Review & submit');
    expect(reasonsInfo.chapterLabel).toBe('Review & submit');
    expect(finalInfo.chapterIndex).toBe(5); // last of 6 (0-indexed)
    expect(finalInfo.subPosition).toEqual({ index: 1, count: 2 });
    expect(reasonsInfo.subPosition).toEqual({ index: 2, count: 2 });
  });

  test('a chapter with exactly one session (e.g. "What to do next") has no sub-position noise', () => {
    const order = buildSessionOrder('UK');
    const nextStepsIdx = order.findIndex((s) => s.key === 'next-steps');
    const info = chapterInfoForSession(order, nextStepsIdx);
    expect(info.chapterLabel).toBe('What to do next');
    expect(info.subPosition).toBeNull();
  });
});
