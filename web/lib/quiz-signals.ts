// Extracted from app/quiz/page.tsx so the "what we noticed" logic can be unit-tested without a
// full React render — see lib/checklist/__tests__/quiz-signals.test.ts. Behavior is unchanged
// from the original inline useMemo in the quiz page; only the shape moved.
import { Answers } from './checklist/uk';

export type QuizAnswers = Pick<
  Answers,
  'employed' | 'selfEmployed' | 'student' | 'married' | 'hasHost' | 'hasChild' | 'hasRefusal' | 'translation' | 'purpose'
>;

export type QuizSignals = {
  positives: string[];
  watchOuts: string[];
};

export function computeQuizSignals(answers: QuizAnswers): QuizSignals {
  const positives: string[] = [];
  const watchOuts: string[] = [];
  if (answers.employed || answers.selfEmployed || answers.student) {
    positives.push(
      answers.employed
        ? "Being employed gives you a clean income story and a leave-approval letter — both strong ties documents."
        : answers.selfEmployed
        ? "Running a business is a valid ground for travel funds — just keep business and personal finances clearly separated on paper."
        : "As a student, your enrolment letter is strong evidence you're expected back — sponsor documents matter if someone else is funding the trip."
    );
  } else {
    watchOuts.push("Without employment, self-employment, or study, you'll want to lean harder on other ties to Nigeria — property, family, or other commitments.");
  }
  if (answers.hasRefusal) {
    watchOuts.push('A previous refusal is not disqualifying, but reviewers expect to see what changed since then — be ready to explain it plainly.');
  }
  if (!answers.purpose) {
    watchOuts.push('Pin down your main purpose of travel — it drives a whole category of purpose-specific documents on the checklist.');
  }
  return { positives, watchOuts };
}
