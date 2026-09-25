// Ported from tests/internal-wallet-movement-narration.test.js.
// Real-data finding (two genuine Opay wallet/savings statements for the same applicant): beyond
// "OWealth Interest Earned", Opay's auto-save/sub-balance feature produces several OTHER credit
// narrations that are just as clearly not income — the applicant's own money moving between their
// main wallet and its OWealth/Targets/SafeBox sub-balances — but none of them contain the word
// "interest". Fixed by detecting this internal-movement vocabulary before name extraction runs and
// routing it to its own dedicated 'internal' group.
import { buildIncomeSourceBreakdown } from '../classify';
import { txn } from './testHelpers';

test('internal wallet-movement credits are grouped separately, never as a name or "Other"', () => {
  const groups = buildIncomeSourceBreakdown(
    [
      txn({ narration: '12 May 2026 09:03:10 Auto-save to OWealth Balance -- Mobile aB 260512001xYZ', credit: 5000, dateISO: '2026-05-12' }),
      txn({ narration: '13 May 2026 10:00:00 OWealth Withdrawal(Transaction Payment) -- Mobile cD 260513002xYZ', credit: 3000, dateISO: '2026-05-13' }),
      txn({ narration: '14 May 2026 11:15:00 OWealth Deposit(from Targets) -- Mobile eF 260514003xYZ', credit: 2000, dateISO: '2026-05-14' }),
      txn({ narration: '15 May 2026 12:20:00 OWealth Deposit(from Fixed) -- Mobile gH 260515004xYZ', credit: 10000, dateISO: '2026-05-15' }),
      txn({ narration: '16 May 2026 13:25:00 OWealth Deposit(Transaction Refund) -- Mobile iJ 260516005xYZ', credit: 1500, dateISO: '2026-05-16' }),
      txn({ narration: '17 May 2026 14:30:00 Targets Deposit -- Mobile kL 260517006xYZ', credit: 4000, dateISO: '2026-05-17' }),
      txn({ narration: '18 May 2026 15:35:00 SafeBox Deposit -- Mobile mN 260518007xYZ', credit: 6000, dateISO: '2026-05-18' }),
      txn({ narration: '19 May 2026 16:40:00 SafeBox Withdrawal -- Mobile oP 260519008xYZ', credit: 6000, dateISO: '2026-05-19' }),
      // A genuine, real-named payment must be completely unaffected - still its own "personal" group.
      txn({ narration: 'NIP TRF FROM ADISA BILIKIS ABIOLA', credit: 960000, dateISO: '2026-07-30' }),
    ],
    'AGBOOLA MARY OLUWAFUNMILAYO',
    ''
  );

  // None of the eight internal-movement credits should produce a garbled "personal"/"other" sender group.
  const garbled = groups.filter((g) => g.type !== 'internal' && /Owealth|Safebox|Targets|Auto-?save/i.test(g.name || ''));
  expect(garbled.length).toBe(0);

  // They should instead land in one dedicated 'internal' group, all eight payments merged together.
  const internalGroups = groups.filter((g) => g.type === 'internal');
  expect(internalGroups.length).toBe(1);
  expect(internalGroups[0].count).toBe(8);

  // None of them should have piled into "Other / one-off inflows" instead.
  const otherGroups = groups.filter((g) => g.type === 'other');
  expect(otherGroups.length).toBe(0);

  // A real named sender elsewhere in the same statement must still come through untouched.
  const adisa = groups.filter((g) => g.type === 'personal' && /ADISA BILIKIS ABIOLA/i.test(g.name));
  expect(adisa.length).toBe(1);
});
