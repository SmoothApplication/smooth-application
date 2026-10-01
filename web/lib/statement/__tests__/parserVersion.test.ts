// Direct user pushback: "this is not user friendly, the user would not know he needs to upload
// another bank statement." Relabeling the re-upload button (StatementSlot.tsx) only ever fixed half
// the problem — an applicant has no way to know a parsing fix shipped unless someone tells her.
// CURRENT_PARSER_VERSION/isStatementStale let the app notice that itself: every saved statement is
// stamped with the version that produced it, and a mismatch against the running app's version means
// a parsing/name-cleanup fix has shipped since, so re-uploading the SAME file would likely produce a
// cleaner result. See StatementSlot.tsx for where this drives the visible "Refresh this statement"
// banner.
import { CURRENT_PARSER_VERSION, isStatementStale } from '../parserVersion';

describe('isStatementStale', () => {
  test('a statement saved under the current version is NOT stale', () => {
    expect(isStatementStale(CURRENT_PARSER_VERSION)).toBe(false);
  });

  test('a statement saved under an older version IS stale', () => {
    expect(isStatementStale(CURRENT_PARSER_VERSION - 1)).toBe(true);
    expect(isStatementStale(1)).toBe(true);
  });

  test('a payload saved before this stamp existed (undefined/null/0) is always stale', () => {
    expect(isStatementStale(undefined)).toBe(true);
    expect(isStatementStale(null)).toBe(true);
    expect(isStatementStale(0)).toBe(true);
  });

  test('a hypothetical future version (saved by a newer app) is never flagged stale', () => {
    expect(isStatementStale(CURRENT_PARSER_VERSION + 1)).toBe(false);
  });
});
