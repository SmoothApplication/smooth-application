// Ported from tests/interest-earned-narration.test.js.
// User-reported bug, off a real Opay statement: automatic daily interest credits on Opay's "OWealth"
// savings wallet narrate with no sender name at all, just a timestamp, the product name, and a long
// opaque reference token — e.g. "07 Aug 2026 01:40:30 OWealth Interest Earned -- Mobile uJ
// 260808994uHYYGJHzJblKYq3Jmt1". The name-extraction logic (built and tuned against Sterling Bank
// narrations) had never seen this shape before, so it swept "Earned"/"Mobile"/"Owealth" plus the
// reference token in as if they were a person's name, producing garbled "sender" groups. Fixed by
// detecting "interest earned" in the narration BEFORE name extraction ever runs and routing it to its
// own dedicated 'interest' group.
import { buildIncomeSourceBreakdown } from '../classify';
import { txn } from './testHelpers';

test('OWealth interest-earned credits are routed to their own group, never a garbled personal name', () => {
  const groups = buildIncomeSourceBreakdown(
    [
      // The two real OWealth interest narrations from the user's own statement.
      txn({ narration: '07 Aug 2026 01:40:30 OWealth Interest Earned -- Mobile uJ 260808994uHYYGJHzJblKYq3Jmt1', credit: 1, dateISO: '2026-08-07' }),
      txn({ narration: '04 Aug 2026 01:26:50 OWealth Interest Earned -- Mobile yA 26080599uWFN9Q3pwd06IcukCo', credit: 1, dateISO: '2026-08-04' }),
      // A third, shorter one to make sure a short reference token doesn't dodge detection either.
      txn({ narration: '09 Aug 2026 02:10:00 OWealth Interest Earned -- Mobile Sm 26080999xYZ1', credit: 1, dateISO: '2026-08-09' }),
      // A genuine, real-named payment must be completely unaffected — still its own "personal" group.
      txn({ narration: 'NIP TRF FROM ADISA BILIKIS ABIOLA', credit: 960000, dateISO: '2026-07-30' }),
    ],
    'AGBOOLA MARY OLUWAFUNMILAYO',
    ''
  );

  // None of the three interest credits should produce a garbled "personal" sender group.
  const garbled = groups.filter((g) => g.type === 'personal' && /Earned|Owealth|Mobile/i.test(g.name));
  expect(garbled.length).toBe(0);

  // They should instead land in one dedicated 'interest' group, all three payments merged together.
  const interestGroups = groups.filter((g) => g.type === 'interest');
  expect(interestGroups.length).toBe(1);
  expect(interestGroups[0].count).toBe(3);

  // A real named sender elsewhere in the same statement must still come through untouched.
  const adisa = groups.filter((g) => g.type === 'personal' && /ADISA BILIKIS ABIOLA/i.test(g.name));
  expect(adisa.length).toBe(1);
});
