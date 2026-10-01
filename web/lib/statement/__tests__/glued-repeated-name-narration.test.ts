// Direct user report, same real Providus statement: "INWARD TRANSFER (N) FROM FBN/ POPOOLA ADEPEJU
// ADETUTU-FIPIBPSPOPOOLA ADEPEJU ADPHUBOUTWARD23015711POPOOLA ADEPEJU ADETUTUPOPOPOP/0000162607221
// 42819002399411432" is FBN's own narration format for this transfer type: it prints the sender's
// name ONCE cleanly ("POPOOLA ADEPEJU ADETUTU"), then glues an internal channel/session-ID blob
// directly onto more repeats of that SAME name with no delimiting space at all. Every one of those
// glued words still "looks name-shaped" (has a vowel) and isn't a recognised stopword, so without a
// fix the run just kept absorbing them, producing one garbled 9-word candidate name per transaction
// — which then surfaced as a wall of nonsensical "same person — merge?" prompts in the Top 10
// senders table (sharing a few words with the applicant's real name, because they're literally
// built from it). Fixed in names.ts: a later word that repeats-with-extra-letters an earlier word
// already in the SAME run (contains it as a substring, and is itself longer) ends the run right
// there — the rest of the narration is dropped as corrupted channel/session noise.
import { extractNameCandidatesDetailed, extractNameCandidates } from '../names';
import { getTopConsistentSenders } from '../classify';
import { txn } from './testHelpers';

describe('glued-repeated-name narration noise (FBN inward-transfer channel/session-ID blob)', () => {
  test('extractNameCandidatesDetailed stops at the first glued repeat of an earlier run word', () => {
    const narration =
      'INWARD TRANSFER (N) FROM FBN/ POPOOLA ADEPEJU ADETUTU-FIPIBPSPOPOOLA ADEPEJU ADPHUBOUTWARD23015711POPOOLA ADEPEJU ADETUTUPOPOPOP/000016260722142819002399411432';
    const candidates = extractNameCandidatesDetailed(narration);
    const names = candidates.map((c) => c.name);
    expect(names).toContain('POPOOLA ADEPEJU ADETUTU');
    expect(names.some((n) => /FIPIBPS|ADPHUBOUTWARD|POPOPOP/i.test(n))).toBe(false);
  });

  test('a second real narration shape (different glued suffix) is cleaned the same way', () => {
    const narration =
      'INWARD TRANSFER (N) FROM FBN/ POPOOLA ADEPEJU ADETUTU-FIPBRPOPOOLA ADEPEJU ADTRFPOPOOLA ADEPEJU AD/000016260811133458002522214027';
    const names = extractNameCandidates(narration);
    expect(names).toContain('POPOOLA ADEPEJU ADETUTU');
    expect(names.some((n) => /FIPBR|ADTRF/i.test(n))).toBe(false);
  });

  test('both garbled narrations above merge into ONE clean sender group, not two separate singleton groups', () => {
    const txns = [
      txn({
        narration:
          'INWARD TRANSFER (N) FROM FBN/ POPOOLA ADEPEJU ADETUTU-FIPIBPSPOPOOLA ADEPEJU ADPHUBOUTWARD23015711POPOOLA ADEPEJU ADETUTUPOPOPOP/000016260722142819002399411432',
        credit: 50000,
        dateISO: '2026-07-22',
      }),
      txn({
        narration:
          'INWARD TRANSFER (N) FROM FBN/ POPOOLA ADEPEJU ADETUTU-FIPBRPOPOOLA ADEPEJU ADTRFPOPOOLA ADEPEJU AD/000016260811133458002522214027',
        credit: 75000,
        dateISO: '2026-08-11',
      }),
    ];
    const result = getTopConsistentSenders(txns, 10, null);
    const popoolaGroups = result.list.filter((r) => /popoola/i.test(r.name));
    expect(popoolaGroups.length).toBe(1);
    expect(popoolaGroups[0].count).toBe(2);
    expect(popoolaGroups[0].name).toBe('Popoola Adepeju Adetutu');
  });

  test('does not misfire on an ordinary two-word name where neither word repeats inside the other', () => {
    const names = extractNameCandidates('NIP/CHIDI OKAFOR/TRF');
    expect(names).toContain('CHIDI OKAFOR');
  });
});
