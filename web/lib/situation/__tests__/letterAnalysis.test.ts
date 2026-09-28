// Task #415 (direct request, mid-turn message): "scan through and read and pick words appeared
// often... summarize the reason why you were denied." Tests the pure functions in
// ../letterAnalysis.ts against realistic UK Home Office-style refusal letter wording (same style of
// fixture used in routing.test.ts), plus a non-English fixture and edge cases.

import { wordFrequency, matchReasonCategories, looksEnglish, analyzeLetter } from '../letterAnalysis';

const FINANCIAL_LETTER = `
Dear Applicant,

Thank you for your application for a visit visa to the United Kingdom.

I am not satisfied that you have provided sufficient evidence of funds to cover your trip. Your
bank statements you have provided show a level of funds that is inconsistent with your stated
financial circumstances. I am unable to determine your financial circumstances from the documents
you have provided, as the source of your funds is unclear. Insufficient funds insufficient funds.

For these reasons, your application is refused.

Yours faithfully,
Entry Clearance Officer
`;

const GENUINE_VISITOR_LETTER = `
Dear Applicant,

I have considered your application for a visit visa. I am not satisfied that you are a genuine
visitor who intends to leave the UK at the end of your visit. You have not demonstrated strong
ties to your home country, and I am not satisfied you have a compelling reason for you to leave
at the end of your stay. Genuine visitor genuine visitor genuine visitor.

Your application is therefore refused.
`;

const FRENCH_LETTER = `
Madame, Monsieur,

Nous vous informons que votre demande de visa a été refusée. Les documents fournis ne permettent
pas d'établir de manière suffisante vos ressources financières ni votre intention de quitter le
territoire à l'issue de votre séjour. Nous vous prions d'agréer, Madame, Monsieur, l'expression de
nos salutations distinguées.
`;

describe('wordFrequency', () => {
  test('finds words repeated in the letter, excluding stopwords', () => {
    const result = wordFrequency(FINANCIAL_LETTER);
    const words = result.map((w) => w.word);
    expect(words).toContain('insufficient');
    expect(words).toContain('funds');
    expect(words).not.toContain('the');
    expect(words).not.toContain('your');
  });

  test('excludes letter boilerplate like "application" and "visa"', () => {
    const result = wordFrequency(FINANCIAL_LETTER);
    const words = result.map((w) => w.word);
    expect(words).not.toContain('application');
    expect(words).not.toContain('visa');
  });

  test('excludes words that only appear once', () => {
    const result = wordFrequency('The quick brown fox jumps over the lazy dog.');
    expect(result).toEqual([]);
  });

  test('respects the limit parameter', () => {
    const repeated = 'alpha alpha beta beta gamma gamma delta delta epsilon epsilon';
    expect(wordFrequency(repeated, 2)).toHaveLength(2);
  });

  test('ties are broken alphabetically for stable output', () => {
    const result = wordFrequency('zebra zebra apple apple');
    expect(result.map((w) => w.word)).toEqual(['apple', 'zebra']);
  });

  test('handles empty input', () => {
    expect(wordFrequency('')).toEqual([]);
  });
});

describe('matchReasonCategories', () => {
  test('matches the financial category for a finance-refusal letter', () => {
    const matches = matchReasonCategories(FINANCIAL_LETTER);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].label).toBe('Insufficient or unclear finances');
    expect(matches[0].matchedPhrases).toEqual(expect.arrayContaining(['insufficient funds']));
  });

  test('matches the genuine-visitor category for that style of letter', () => {
    const matches = matchReasonCategories(GENUINE_VISITOR_LETTER);
    expect(matches[0].label).toBe('Not satisfied you are a genuine visitor who will leave after your visit');
  });

  test('ranks the category with more phrase hits first', () => {
    const combined = FINANCIAL_LETTER + FINANCIAL_LETTER + ' ' + GENUINE_VISITOR_LETTER;
    const matches = matchReasonCategories(combined);
    expect(matches[0].label).toBe('Insufficient or unclear finances');
  });

  test('returns an empty array when nothing matches', () => {
    expect(matchReasonCategories('This is a completely unrelated piece of text about gardening.')).toEqual([]);
  });

  test('is case-insensitive', () => {
    const matches = matchReasonCategories('INSUFFICIENT FUNDS were shown.');
    expect(matches[0].label).toBe('Insufficient or unclear finances');
  });
});

describe('looksEnglish', () => {
  test('returns true for ordinary English prose', () => {
    expect(looksEnglish(FINANCIAL_LETTER)).toBe(true);
  });

  test('returns false for a French letter', () => {
    expect(looksEnglish(FRENCH_LETTER)).toBe(false);
  });

  test('gives short text the benefit of the doubt rather than flagging it', () => {
    expect(looksEnglish('Bonjour')).toBe(true);
  });
});

describe('analyzeLetter', () => {
  test('combines word frequency, reason matching, and language check', () => {
    const result = analyzeLetter(FINANCIAL_LETTER);
    expect(result.primaryReason?.label).toBe('Insufficient or unclear finances');
    expect(result.topWords.length).toBeGreaterThan(0);
    expect(result.looksNonEnglish).toBe(false);
  });

  test('flags a non-English letter and still runs without throwing', () => {
    const result = analyzeLetter(FRENCH_LETTER);
    expect(result.looksNonEnglish).toBe(true);
  });

  test('primaryReason is null when nothing matches', () => {
    const result = analyzeLetter('Nothing relevant here at all, just some ordinary sentences.');
    expect(result.primaryReason).toBeNull();
  });

  test('handles empty text without throwing', () => {
    const result = analyzeLetter('');
    expect(result.topWords).toEqual([]);
    expect(result.reasonMatches).toEqual([]);
    expect(result.primaryReason).toBeNull();
  });
});
