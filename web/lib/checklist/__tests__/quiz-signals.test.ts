import { computeQuizSignals, QuizAnswers } from '../../quiz-signals';

const BASE: QuizAnswers = {
  employed: false,
  selfEmployed: false,
  student: false,
  married: false,
  hasHost: false,
  hasChild: false,
  hasRefusal: false,
  translation: false,
  purpose: '',
};

describe('computeQuizSignals', () => {
  it('flags no employment/self-employment/study as a watch-out', () => {
    const { watchOuts, positives } = computeQuizSignals(BASE);
    expect(watchOuts.some((w) => w.includes('Without employment'))).toBe(true);
    expect(positives).toHaveLength(0);
  });

  it('gives a positive for being employed', () => {
    const { positives } = computeQuizSignals({ ...BASE, employed: true });
    expect(positives).toHaveLength(1);
    expect(positives[0]).toContain('employed');
  });

  it('gives a positive for self-employment when not employed', () => {
    const { positives } = computeQuizSignals({ ...BASE, selfEmployed: true });
    expect(positives[0]).toContain('business');
  });

  it('gives a positive for being a student when neither employed nor self-employed', () => {
    const { positives } = computeQuizSignals({ ...BASE, student: true });
    expect(positives[0]).toContain('student');
  });

  it('prioritizes employed over self-employed/student when multiple are true', () => {
    const { positives } = computeQuizSignals({ ...BASE, employed: true, selfEmployed: true, student: true });
    expect(positives).toHaveLength(1);
    expect(positives[0]).toContain('employed');
  });

  it('flags a previous refusal as a watch-out', () => {
    const { watchOuts } = computeQuizSignals({ ...BASE, hasRefusal: true });
    expect(watchOuts.some((w) => w.includes('previous refusal'))).toBe(true);
  });

  it('flags missing purpose as a watch-out', () => {
    const { watchOuts } = computeQuizSignals({ ...BASE, purpose: '' });
    expect(watchOuts.some((w) => w.includes('purpose of travel'))).toBe(true);
  });

  it('does not flag purpose when one is chosen', () => {
    const { watchOuts } = computeQuizSignals({ ...BASE, purpose: 'tourism' });
    expect(watchOuts.some((w) => w.includes('purpose of travel'))).toBe(false);
  });

  it('a fully "good" profile has no watch-outs beyond what genuinely applies', () => {
    const { watchOuts } = computeQuizSignals({ ...BASE, employed: true, purpose: 'business', hasRefusal: false });
    expect(watchOuts).toHaveLength(0);
  });
});
