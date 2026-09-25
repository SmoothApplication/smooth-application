// Ported from tests/mrz-line1-garbled-fixture.test.js. The original PDF fixture reproduced a real
// client photo where line 1 (the name line, small/dense text often sitting over a security pattern)
// OCR'd as pure garbage while line 2 (mostly digits) came back perfectly clean. Reconstructed here
// with the exact garbled line-1 text quoted in the original test's own comment ("eA CHE SLATE RTOS
// SRERESE") next to a valid, checksum-consistent line 2 for a fictional passport.
//
// Real user report: "MRZ checksum: not detected" even though the physical document was genuine. Fixed
// by findMrzLine2Standalone(): the checksum check only ever needs line 2, so it now also searches for
// a standalone, structurally line-2-shaped line anywhere on the page, gated on that candidate's own
// check digits corroborating the shape.
import { validateMrz, mrzCheckSummary } from '../mrz';

const TEXT = [
  'REPUBLIC OF NIGERIA',
  'PASSPORT',
  'eA CHE SLATE RTOS SRERESE',
  'D9988776<1NGA9206067M2901019<<<<<<<<<<<<<<06',
].join('\n');

test('validateMrz recovers a clean 4/4 checksum match from line 2 alone despite line 1 being unreadable garbage', () => {
  const mrz = validateMrz(TEXT);
  expect(mrz).not.toBeNull();
  expect(mrz?.passedCount).toBe(4);
  expect(mrz?.totalCount).toBe(4);
  expect(mrzCheckSummary(mrz)).toBe('4/4 digit(s) matched');
});
