// Applicant-facing landing page. This used to be a separate marketing screen with its own copy and
// a "skip the quiz" fast path — per user feedback comparing the live site against the original
// GitHub Pages site ("the site is not the way i arranged it"), the original's front door IS its
// quiz-intro screen (#quizIntro): same brand header, one mandatory "Start the quick check" button,
// no skip link. Restored that structure by having '/' render the same component as '/quiz' — see
// app/quiz/page.tsx for the actual screen and the full explanation of what changed and why.
export { default } from './quiz/page';
