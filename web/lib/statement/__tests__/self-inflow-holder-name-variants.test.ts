// Ported from tests/self-inflow-holder-name-variants.test.js.
// User-reported bug, off a real Sterling statement: a payment narrated "SENDER: MARY 380
// OLUWAFUNMILAYO AFENI" landed in "Other / one-off inflows (no clear sender name)" instead of Self,
// even though it's unmistakably the account holder's own name in a different order/subset than the
// statement's MOST common recipient-side narration. Root cause: detectStatementHolderName picked only
// the SINGLE most-recurring recipient-side variant and discarded every other one. Fixed by
// detectStatementHolderNames (plural), returning EVERY recipient-side variant recurring at least
// twice, with looksLikeSelfInflow checking a candidate against ALL of them. Calls
// buildIncomeSourceBreakdown directly with the same fixture shape the original test drove through the
// __testBuildIncomeSourceBreakdown DOM escape hatch.
import { buildIncomeSourceBreakdown } from '../classify';
import { txn } from './testHelpers';

test('recognises a self-transfer narrated with a less-common (but still recurring) holder-name variant', () => {
  const txns = [
    // Establishes "Agboola Mary Oluwafunmilayo" as the MOST-recurring recipient-side variant (3x).
    txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO AGBOOLA MARY OLUWAFUNMILAYO', credit: 300000, dateISO: '2026-01-15' }),
    txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO AGBOOLA MARY OLUWAFUNMILAYO', credit: 300000, dateISO: '2026-02-15' }),
    txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO AGBOOLA MARY OLUWAFUNMILAYO', credit: 300000, dateISO: '2026-03-15' }),
    // Establishes "Oluwafunmilayo Afeni" as a LESS-common but still-recurring recipient-side variant
    // (2x) — the crux of the bug: this one never wins "best", so the old single-variant code never
    // even considered it.
    txn({ narration: 'ONEBANK TRANSFER FROM XYZ VENTURES IFO OLUWAFUNMILAYO AFENI', credit: 5000, dateISO: '2026-02-01' }),
    txn({ narration: 'ONEBANK TRANSFER FROM XYZ VENTURES IFO OLUWAFUNMILAYO AFENI', credit: 6000, dateISO: '2026-03-01' }),
    // The actual self-transfer in question — narrated with the LESS-common variant plus one extra
    // word ("Mary"), a real name-order quirk, not a different person.
    txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY OLUWAFUNMILAYO AFENI', credit: 20000, dateISO: '2026-04-04' }),
  ];

  const groups = buildIncomeSourceBreakdown(txns, 'Agboola Mary Oluwafunmilayo');

  const selfGroups = groups.filter((g) => g.type === 'self');
  expect(selfGroups.length).toBe(1);
  expect(selfGroups[0].total).toBe(20000);
  expect(selfGroups[0].count).toBe(1);

  // It must not have landed in "Other / one-off inflows" (the originally-reported symptom).
  const otherGroups = groups.filter((g) => g.type === 'other');
  const otherTotal = otherGroups.reduce((s, g) => s + g.total, 0);
  expect(otherTotal).toBe(0);
});
