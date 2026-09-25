// Ported from tests/sender-self-and-recipient-side.test.js — the pure-function parts only (this app
// has no rendered "Fix name"/matched-inflow dropdown UI wired to persistence yet).
//
// User feedback, off a real statement, several distinct fixes bundled together:
//   1. A single word immediately after an explicit sender-context marker (SENDER/FROM/FRM) is kept as
//      a name candidate (previously required 2+ words, so "SENDER: BILIKIS" produced zero candidates).
//      An unmarked lone word is still dropped.
//   2/3. extractNameCandidatesDetailed tracks which stopword marker preceded each run, so a
//      recipient-side (IFO/TO) run can be told apart from the sender-side run; "BOO" (a channel/
//      processor code) is stopworded so it never glues onto the front of a sender-side run.
//   4. A short single-word candidate ("SENDER: CRISP") merges into an existing fuller-name group
//      ("SENDER: CRISP N") via the whole-word merge rule in mergeNameVariants, bypassing the normal
//      NAME_MERGE_MIN_LEN length gate.
//   5. A recurring amount narrated with the account holder's own recipient-side identity ("SENDER:
//      MARY", where the holder is "Agboola Mary Oluwafunmilayo") is classified 'self', never 'salary'
//      — and a full-name candidate that merely shares the applicant's surname (a family member) is
//      NOT swept into 'self'.
import { extractNameCandidates, extractNameCandidatesDetailed } from '../names';
import { buildIncomeSourceBreakdown } from '../classify';
import { txn } from './testHelpers';

test('a single word after an explicit sender-context marker is kept as a candidate; unmarked lone words are dropped', () => {
  const cases = [
    { narration: 'BANKNIP From 000014 PAYREF: -60426004740242514 SENDER: BILIKIS', expect: 'Bilikis' },
    { narration: 'BANKNIP From 000014 PAYREF: -60426004740242514 SENDER: CRISP', expect: 'Crisp' },
    { narration: 'BANKNIP From 090405 PAYREF: -6030607045990263 SENDER: YARO', expect: 'Yaro' },
  ];
  cases.forEach((c) => {
    const candidates = extractNameCandidates(c.narration);
    const titleCased = candidates.map((s) => s.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase()));
    expect(titleCased).toContain(c.expect);
  });

  expect(extractNameCandidates('NIP TRF ZUBI VALUE DATE')).toEqual([]);
});

test('sender-side vs recipient-side runs are distinguished, and "BOO" is stripped as a channel code', () => {
  const narration = 'TRF BOO XPEDITE GLOBAL - CONCEPT LTD IFO AGBOOLA MARY OLUWAFUNMILAYO';
  const detailed = extractNameCandidatesDetailed(narration);
  const senderRun = detailed.filter((r) => r.precededBy !== 'IFO' && r.precededBy !== 'TO');
  const recipientRun = detailed.filter((r) => r.precededBy === 'IFO' || r.precededBy === 'TO');

  expect(senderRun.some((r) => r.name === 'XPEDITE GLOBAL CONCEPT')).toBe(true);
  expect(detailed.some((r) => /\bBOO\b/.test(r.name))).toBe(false);
  expect(recipientRun.some((r) => r.name === 'AGBOOLA MARY OLUWAFUNMILAYO')).toBe(true);
});

test('"mint" trailing a real name is stripped as an account-product label', () => {
  const cands = extractNameCandidates('OneBank Transfer from AFENI - IBUKUNOLUWA ADEDAYO to AGBOOLA MARY OLUWAFUNMILAYO mint');
  expect(cands).toContain('AGBOOLA MARY OLUWAFUNMILAYO');
  expect(cands.some((c) => /\bMINT\b/.test(c))).toBe(false);
});

test('a short single-word candidate merges into its fuller-name group', () => {
  const groups = buildIncomeSourceBreakdown(
    [
      txn({ narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-04-04' }),
      txn({ narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP', credit: 105000, dateISO: '2026-05-30' }),
    ],
    'Test Applicant'
  );
  const crispGroups = groups.filter((g) => /crisp/i.test(g.name));
  expect(crispGroups.length).toBe(1);
  expect(crispGroups[0].count).toBe(2);
  expect(crispGroups[0].total).toBe(455000);
});

test('Self classification is resolved from the statement\'s own recipient-side identity, not the salary bucket', () => {
  const groups = buildIncomeSourceBreakdown(
    [
      // Establishes the account-holder identity from the RECIPIENT side across 2 distinct months.
      txn({ narration: 'NIP TRF XPEDITE GLOBAL CONCEPT LTD IFO AGBOOLA MARY OLUWAFUNMILAYO', credit: 500000, dateISO: '2026-01-10' }),
      txn({ narration: 'FT XPEDITE GLOBAL CONCEPT LTD IFO AGBOOLA MARY OLUWAFUNMILAYO', credit: 480000, dateISO: '2026-02-10' }),
      // Same recurring rounded amount across 2 distinct months, narrated "SENDER: MARY" - must route
      // to 'self', not 'salary'.
      txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY', credit: 20000, dateISO: '2026-03-05' }),
      txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY', credit: 20000, dateISO: '2026-04-05' }),
    ],
    'Test Applicant'
  );

  const selfGroup = groups.filter((g) => g.type === 'self');
  expect(selfGroup.length).toBe(1);
  expect(selfGroup[0].count).toBe(2);
  expect(selfGroup[0].total).toBe(40000);
  expect(groups.filter((g) => g.type === 'salary').length).toBe(0);
  const xpediteGroup = groups.filter((g) => /xpedite/i.test(g.name));
  expect(xpediteGroup.length).toBe(1);
  expect(xpediteGroup[0].type).toBe('company');
});

test('a full name merely sharing the applicant\'s surname (a family member) is never swept into Self', () => {
  const groups = buildIncomeSourceBreakdown(
    [
      txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-01-15' }),
      txn({ narration: 'FT GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-02-15' }),
      txn({ narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-03-15' }),
      txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY SMITH', credit: 15000, dateISO: '2026-03-01' }),
      txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY SMITH', credit: 18000, dateISO: '2026-04-01' }),
    ],
    'Test Applicant Smith'
  );

  const marySmithGroup = groups.filter((g) => /mary smith/i.test(g.name));
  expect(marySmithGroup.length).toBe(1);
  expect(marySmithGroup[0].type).toBe('family');
  expect(groups.filter((g) => g.type === 'self').length).toBe(0);
});
