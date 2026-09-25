// Ported from tests/limited-suffix-truncation.test.js.
// User feedback: "Limited can be Ltd or LTD or Limite because some can be shortened by different bank
// apps." Bank narration fields often truncate the company suffix ("Limited" -> "Limite") rather than
// dropping it cleanly. classifySourceType (via COMPANY_KEYWORDS + LIMITED_SUFFIX_RE) and
// extractNameCandidates (via BANK_NARRATION_STOPWORDS + LIMITED_SUFFIX_RE) both match any word
// starting with "LIMIT" (LIMIT, LIMITE, LIMITED, ...), not just the two exact spellings.
import { classifySourceType, extractNameCandidates, LIMITED_SUFFIX_RE } from '../names';

test('LIMITED_SUFFIX_RE matches any truncation of "Limited", not just the exact word', () => {
  expect(LIMITED_SUFFIX_RE.test('LIMITE')).toBe(true);
  expect(LIMITED_SUFFIX_RE.test('LIMITED')).toBe(true);
  expect(LIMITED_SUFFIX_RE.test('LIMIT')).toBe(true);
  // Matches ANY word starting with "LIMIT" followed by only letters (deliberately broad - see the
  // regex's own comment in names.ts) - it doesn't try to distinguish "Limited" from an unrelated word
  // like "Limitless" that happens to share the same prefix.
  expect(LIMITED_SUFFIX_RE.test('LIMITLESS')).toBe(true);
  expect(LIMITED_SUFFIX_RE.test('SOMELIMIT')).toBe(false); // must start with LIMIT, not just contain it
});

test('classifySourceType recognises a truncated "LIMITE" suffix as a company signal, even with no other company keyword', () => {
  // "ABC" alone isn't a recognized company keyword - "LIMITE" is the ONLY signal this is a company.
  expect(classifySourceType('NIP/ABC LIMITE/April Salary')).toBe('company');
  expect(classifySourceType('NIP/ABC LIMITED/April Salary')).toBe('company');
  expect(classifySourceType('NIP/ABC LTD/April Salary')).toBe('company');
  expect(classifySourceType('NIP/JOHN SMITH/April Salary')).toBe('personal');
});

test('extractNameCandidates strips a truncated "LIMITE" suffix the same way it strips "LTD"/"LIMITED"', () => {
  const candidates = extractNameCandidates('NIP/BRIGHT HOMES CLEANING SOLUTIONS LIMITE/April Salary');
  const joined = candidates.join(' | ');
  expect(/\bLIMITE\b/i.test(joined)).toBe(false);
  const titleCased = candidates.map((s) => s.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase()));
  expect(titleCased).toContain('Bright Homes Cleaning Solutions');
});
