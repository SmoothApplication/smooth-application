// Direct user report (live, with a real Providus statement, cross-checked against the applicant's
// own manual Excel extraction of the same statement — "PJ BANK ANALYSIS"): 12 genuinely-same-
// employer REMITA inflow transactions were being split into many garbled singleton groups
// ("Remita Inflow R Nigerian U Oneoffproductivityrecognitionall", etc.) instead of one combined
// employer group, because Remita's own narration format puts a free-text payment description
// AFTER a literal "U:" field separator ("REMITA INFLOW R-<ref>/<SENDER NAME> U:<description>:CBN:
// <code>/..."), and the extractor was absorbing that varying description into the "name" every
// time. Two fixes in names.ts:
//   1. REMITA_NARRATION_FIELD_RE truncates the narration at "U:" before name extraction even
//      starts, so the varying free-text description is never considered.
//   2. trimLeadingBoilerplate strips Remita's own "REMITA INFLOW R" transaction-type/reference
//      boilerplate from the FRONT of an already-built candidate (applied only after the >=2-word
//      length check that decided the run was worth keeping at all — NOT via BANK_NARRATION_STOPWORDS,
//      which was tried first and rejected: a stopword flushes/discards the run entirely, and a lone
//      surviving word with no SENDER_MARKERS context gets silently dropped by flush() — see that
//      function's own comment).
// Verified end-to-end against the real statement: all 12 txns merge into one group, displayed as
// "Nigerian" (not the full garbled narration), total matching the applicant's own manual figure
// exactly (₦34,708,376.20).
import { extractNameCandidatesDetailed, extractNameCandidates } from '../names';
import { getTopConsistentSenders } from '../classify';
import { txn } from './testHelpers';

describe('REMITA "U:" field separator + leading boilerplate trim', () => {
  test('extractNameCandidatesDetailed truncates at "U:" and strips "REMITA INFLOW R" boilerplate', () => {
    const narration =
      'REMITA INFLOW R-1445788162/NIGERIAN U:STAFFSALARYFORMARCH2026:CBN:14457955/90144578';
    const candidates = extractNameCandidatesDetailed(narration);
    expect(candidates.map((c) => c.name)).toContain('NIGERIAN');
    // The varying free-text description after "U:" must never show up in a candidate name.
    expect(candidates.some((c) => /STAFFSALARY|CBN/i.test(c.name))).toBe(false);
  });

  test('a 2+ word sender name after REMITA INFLOW R also has the boilerplate stripped', () => {
    const narration = 'REMITA INFLOW R-998211/ADEOLA FASANYA U:APRIL ALLOWANCE:CBN:1234/5678';
    const names = extractNameCandidates(narration);
    expect(names).toContain('ADEOLA FASANYA');
    expect(names.some((n) => /Remita|Inflow/i.test(n))).toBe(false);
  });

  test('12 differently-worded REMITA/NIGERIAN payment narrations merge into ONE sender group with the correct total', () => {
    const descriptions = [
      'STAFFSALARYFORMARCH2026',
      'STAFFSALARYFORAPRIL2026',
      'NUPRCSTAFFSALARY',
      'STAFFSALARYJULY',
      '2NDQUARTERALLOWANCESTOSTAFF',
      'ENDOFNEGOTIATIONBONUS',
      'EMPLOYEEFAMILYBURIALASSISTANCE',
      'ONEOFFPRODUCTIVITYRECOGNITIONALL',
      'STAFFSALARYFORMAY2026',
      'STAFFSALARYFORJUNE2026',
      'ALLOWANCE',
      'PRODUCTIVITYBONUS',
    ];
    const txns = descriptions.map((desc, i) =>
      txn({
        narration: `REMITA INFLOW R-${1000000 + i}/NIGERIAN U:${desc}:CBN:${2000000 + i}/${3000000 + i}`,
        credit: 100000 + i,
        dateISO: `2026-${String((i % 12) + 1).padStart(2, '0')}-10`,
      })
    );
    const result = getTopConsistentSenders(txns, 10, null);
    const nigerianGroups = result.list.filter((r) => /nigerian/i.test(r.name));
    expect(nigerianGroups.length).toBe(1);
    expect(nigerianGroups[0].count).toBe(12);
    expect(nigerianGroups[0].name).toBe('Nigerian');
    const expectedTotal = descriptions.reduce((sum, _d, i) => sum + 100000 + i, 0);
    expect(nigerianGroups[0].total).toBe(expectedTotal);
  });

  test('does not regress ordinary non-REMITA narrations containing the letter sequence U or a colon', () => {
    const narration = 'NIP/CHIDI OKAFOR/SALARY: MARCH';
    const names = extractNameCandidates(narration);
    expect(names).toContain('CHIDI OKAFOR');
  });
});
