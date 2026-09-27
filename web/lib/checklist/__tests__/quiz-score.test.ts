import {
  DEFAULT_QUIZ_ANSWERS,
  quizAnswersToChecklistPrefill,
  quizGapMessages,
  quizResultCards,
  quizScore,
  QuizAnswers,
} from '../../quiz-score';

const BEST: QuizAnswers = {
  work: 'employed',
  income: 'steady',
  savings: 'over5m',
  travel: 'yes',
  refusal: 'no',
  ties: 'strong',
  host: 'none',
  passport: 'yes',
  statements: 'yes',
  purpose: 'tourism',
};

describe('quizScore', () => {
  it('reaches the maximum 19 points and "strong" tier on the best possible answers', () => {
    const result = quizScore(BEST);
    expect(result.points).toBe(19);
    expect(result.tier).toBe('strong');
  });

  it('caps "strong" down to "some" when savings are thin, even with a high point total', () => {
    const result = quizScore({ ...BEST, savings: 'under500k' });
    // 19 - 3 (savings) = 16, still >= 13, but the savings cap should still apply.
    expect(result.tier).toBe('some');
  });

  it('also caps "strong" to "some" for the to2m savings band', () => {
    const result = quizScore({ ...BEST, savings: 'to2m' });
    expect(result.tier).toBe('some');
  });

  it('gives "many" on an all-blank/worst-case answer set', () => {
    const result = quizScore(DEFAULT_QUIZ_ANSWERS);
    expect(result.points).toBe(0);
    expect(result.tier).toBe('many');
  });

  it('gives partial credit for student/child work status and steady income only', () => {
    const result = quizScore({ ...DEFAULT_QUIZ_ANSWERS, work: 'student', income: 'steady' });
    expect(result.points).toBe(4);
    expect(result.tier).toBe('many');
  });

  it('lands on "some" in the 7-12 point range', () => {
    const result = quizScore({ ...DEFAULT_QUIZ_ANSWERS, work: 'both', income: 'steady', travel: 'yes' });
    expect(result.points).toBe(7);
    expect(result.tier).toBe('some');
  });
});

describe('quizGapMessages', () => {
  it('returns nothing for the best-case answers', () => {
    expect(quizGapMessages(BEST)).toHaveLength(0);
  });

  it('flags a missing passport first, ahead of everything else', () => {
    const gaps = quizGapMessages({ ...BEST, passport: 'no', statements: 'notyet', refusal: 'yes' });
    expect(gaps[0]).toContain('international passport');
  });

  it('caps the list at 3 even when more apply', () => {
    const gaps = quizGapMessages({
      ...DEFAULT_QUIZ_ANSWERS,
      passport: 'no',
      statements: 'notyet',
      savings: 'under500k',
      refusal: 'yes',
      ties: 'few',
      income: 'none',
    });
    expect(gaps).toHaveLength(3);
  });

  it('flags a thin savings cushion when savings is blank', () => {
    const gaps = quizGapMessages({ ...BEST, savings: '' });
    expect(gaps.some((g) => g.includes('savings cushion looks thin'))).toBe(true);
  });

  it('falls back to the work-status prompt when nothing else applies', () => {
    const gaps = quizGapMessages({ ...BEST, work: '' });
    expect(gaps.some((g) => g.includes('work status'))).toBe(true);
  });
});

describe('quizResultCards', () => {
  it('always returns exactly 4 cards, in Finance/Travel history/Ties/Savings order', () => {
    const cards = quizResultCards(BEST);
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.label)).toEqual([
      'Finance',
      'Travel history',
      'Ties to home country',
      'Savings for trip',
    ]);
  });

  it('gives a positive message for each topic on the best-case answers', () => {
    const [finance, travel, ties, savings] = quizResultCards(BEST);
    expect(finance.message).toContain('Steady income');
    expect(travel.message).toContain("travelled internationally before");
    expect(ties.message).toContain("strong family ties");
    expect(savings.message).toContain('Over ₦5,000,000');
  });

  it('gives a constructive message for each topic on the worst-case (blank) answers', () => {
    const cards = quizResultCards(DEFAULT_QUIZ_ANSWERS);
    for (const c of cards) {
      expect(c.message).toContain('Not answered yet');
    }
  });

  it('flags a thin savings cushion for the under500k band specifically', () => {
    const [, , , savings] = quizResultCards({ ...BEST, savings: 'under500k' });
    expect(savings.message).toContain('looks thin');
  });

  it('flags limited ties and no steady income distinctly from the strong/steady case', () => {
    const cards = quizResultCards({ ...BEST, ties: 'few', income: 'none' });
    const finance = cards.find((c) => c.label === 'Finance')!;
    const ties = cards.find((c) => c.label === 'Ties to home country')!;
    expect(finance.message).toContain('No steady income');
    expect(ties.message).toContain('Limited documented ties');
  });

});

describe('quizAnswersToChecklistPrefill', () => {
  it('maps "both" to employed and selfEmployed both true', () => {
    const prefill = quizAnswersToChecklistPrefill({ ...DEFAULT_QUIZ_ANSWERS, work: 'both' });
    expect(prefill.employed).toBe(true);
    expect(prefill.selfEmployed).toBe(true);
    expect(prefill.student).toBe(false);
  });

  it('maps "child" to all three work booleans false', () => {
    const prefill = quizAnswersToChecklistPrefill({ ...DEFAULT_QUIZ_ANSWERS, work: 'child' });
    expect(prefill.employed).toBe(false);
    expect(prefill.selfEmployed).toBe(false);
    expect(prefill.student).toBe(false);
  });

  it('leaves work fields untouched when unanswered', () => {
    const prefill = quizAnswersToChecklistPrefill(DEFAULT_QUIZ_ANSWERS);
    expect(prefill.employed).toBeUndefined();
    expect(prefill.selfEmployed).toBeUndefined();
    expect(prefill.student).toBeUndefined();
  });

  it('maps refusal yes/no to hasRefusal', () => {
    expect(quizAnswersToChecklistPrefill({ ...DEFAULT_QUIZ_ANSWERS, refusal: 'yes' }).hasRefusal).toBe(true);
    expect(quizAnswersToChecklistPrefill({ ...DEFAULT_QUIZ_ANSWERS, refusal: 'no' }).hasRefusal).toBe(false);
  });

  it('maps host="hostFunding" to hasHost + hostFunding both true', () => {
    const prefill = quizAnswersToChecklistPrefill({ ...DEFAULT_QUIZ_ANSWERS, host: 'hostFunding' });
    expect(prefill.hasHost).toBe(true);
    expect(prefill.hostFunding).toBe(true);
  });

  it('maps host="host" to hasHost true, hostFunding false', () => {
    const prefill = quizAnswersToChecklistPrefill({ ...DEFAULT_QUIZ_ANSWERS, host: 'host' });
    expect(prefill.hasHost).toBe(true);
    expect(prefill.hostFunding).toBe(false);
  });

  it('maps host="none" to both false', () => {
    const prefill = quizAnswersToChecklistPrefill({ ...DEFAULT_QUIZ_ANSWERS, host: 'none' });
    expect(prefill.hasHost).toBe(false);
    expect(prefill.hostFunding).toBe(false);
  });

  it('never includes travel, married, hasChild, or translation', () => {
    const prefill = quizAnswersToChecklistPrefill(BEST);
    expect('travel' in prefill).toBe(false);
    expect('married' in prefill).toBe(false);
    expect('hasChild' in prefill).toBe(false);
    expect('translation' in prefill).toBe(false);
  });

  it('carries purpose over when chosen', () => {
    expect(quizAnswersToChecklistPrefill({ ...DEFAULT_QUIZ_ANSWERS, purpose: 'business' }).purpose).toBe('business');
  });
});
