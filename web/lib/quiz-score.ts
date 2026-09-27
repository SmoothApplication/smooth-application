// Full port of index.html's quiz scoring / gap-message / tier-copy logic (quizScore(),
// QUIZ_GAP_CHECKS, quizGapMessages(), QUIZ_TIER_COPY — index.html ~lines 15836-15944) plus the
// checklist-prefill mapping (applyQuizPrefillToChecklist() ~line 16171). Replaces the old
// lib/quiz-signals.ts, which only derived a couple of freeform "positives/watch-outs" sentences
// from a smaller field set — this restores the same point-scored rubric, capped 3-item gap list,
// and tier badge the original site has always shown for its "confidence quiz", so the Next.js
// quiz stops being a scaled-down stand-in for it (user feedback: "the test in the github is 10
// questions").
//
// Scope note: the original's 10 questions are 1 country question + 9 readiness questions. This
// app already has a dedicated country picker (/checklist/start) immediately after the quiz, so
// re-asking country here would duplicate a question the applicant is about to answer again one
// screen later — a UX regression, not a faithful port. In its place this keeps the "main purpose
// of your trip" question the Next.js quiz already asked (not part of the original quiz's scoring,
// but it unlocks a real "Purpose-specific" checklist category via Answers.purpose — see the
// appliesIf checks in lib/checklist/uk.ts), so it stays on as the 10th question rather than being
// dropped.
import { Answers } from './checklist/uk';

export type QuizAnswers = {
  work: '' | 'employed' | 'selfEmployed' | 'both' | 'student' | 'child';
  income: '' | 'steady' | 'none';
  savings: '' | 'under500k' | 'to2m' | 'to5m' | 'over5m';
  travel: '' | 'yes' | 'no';
  refusal: '' | 'yes' | 'no';
  ties: '' | 'strong' | 'few';
  host: '' | 'none' | 'host' | 'hostFunding';
  passport: '' | 'yes' | 'no';
  statements: '' | 'yes' | 'notyet';
  purpose: Answers['purpose'];
};

export const DEFAULT_QUIZ_ANSWERS: QuizAnswers = {
  work: '',
  income: '',
  savings: '',
  travel: '',
  refusal: '',
  ties: '',
  host: '',
  passport: '',
  statements: '',
  purpose: '',
};

export type QuizTier = 'strong' | 'some' | 'many';

export type QuizResult = {
  points: number;
  tier: QuizTier;
};

// Verbatim port of index.html's quizScore() — same point values, same 13/7 tier cutoffs, same
// savings-based cap that keeps a thin-savings answer from being fully offset by unrelated
// strengths (see the original function's own comment for the real report that prompted the cap).
// 19 is the max reachable (2+3+3+2+2+3+2+2) — used only to pick a tier cutoff, never shown as a
// literal score.
export function quizScore(a: QuizAnswers): QuizResult {
  let points = 0;
  if (a.work === 'employed' || a.work === 'selfEmployed' || a.work === 'both') points += 2;
  else if (a.work === 'student' || a.work === 'child') points += 1;
  if (a.income === 'steady') points += 3;
  if (a.savings === 'over5m') points += 3;
  else if (a.savings === 'to5m') points += 2;
  else if (a.savings === 'to2m') points += 1;
  if (a.travel === 'yes') points += 2;
  if (a.refusal === 'no') points += 2;
  if (a.ties === 'strong') points += 3;
  if (a.passport === 'yes') points += 2;
  if (a.statements === 'yes') points += 2;

  let tier: QuizTier = points >= 13 ? 'strong' : points >= 7 ? 'some' : 'many';
  if (tier === 'strong' && (a.savings === 'under500k' || a.savings === 'to2m' || a.savings === '')) {
    tier = 'some';
  }
  return { points, tier };
}

export const QUIZ_TIER_COPY: Record<QuizTier, { icon: string; label: string }> = {
  strong: { icon: '🟢', label: 'Strong starting position' },
  some: { icon: '🟡', label: 'A few gaps to close' },
  many: { icon: '🔴', label: 'Some real gaps to address' },
};

// Verbatim port of QUIZ_GAP_CHECKS — checked in priority order, first 3 matches become the
// "biggest gaps" shown in the result. Each message names something concrete to go do, not just a
// restated weak answer.
const QUIZ_GAP_CHECKS: { test: (a: QuizAnswers) => boolean; msg: string }[] = [
  {
    test: (a) => a.passport === 'no',
    msg: "You'll need a valid international passport before you can apply — this alone can take weeks, so start now.",
  },
  {
    test: (a) => a.statements === 'notyet',
    msg: 'Start downloading your last 3-6 months of bank statements now — gathering these takes longer than people expect.',
  },
  {
    test: (a) => a.savings === 'under500k' || a.savings === '',
    msg: "Your savings cushion looks thin for this trip's likely cost — worth building up before you apply.",
  },
  {
    test: (a) => a.savings === 'to2m',
    msg: "Whether ₦500,000–₦2,000,000 is enough depends heavily on your trip length and destination city — the Financial readiness calculator further in the checklist will tell you exactly, so don't skip it.",
  },
  {
    test: (a) => a.refusal === 'yes',
    msg: "A past visa refusal is worth addressing directly in your application, with a clear explanation of what's changed since.",
  },
  {
    test: (a) => a.ties === 'few',
    msg: 'Strengthening your documented ties to Nigeria (property, family, employment) will help your case.',
  },
  {
    test: (a) => a.income === 'none',
    msg: 'Without steady income, lean on a strong, well-explained savings history instead.',
  },
  {
    test: (a) => a.work === '',
    msg: "Fill in your work status in the full checklist — it's one of the first things a reviewer checks.",
  },
];

export function quizGapMessages(a: QuizAnswers): string[] {
  const out: string[] = [];
  for (const check of QUIZ_GAP_CHECKS) {
    if (out.length >= 3) break;
    if (check.test(a)) out.push(check.msg);
  }
  return out;
}

export type QuizResultCard = { label: string; message: string };

// Task #397 (direct request, 2 annotated screenshots): the result screen's "Biggest things to
// work on" section — a variable-length (0-3), priority-ordered bullet list drawn from
// QUIZ_GAP_CHECKS above — gets replaced ON THE RESULT SCREEN by a fixed 2x2 grid of 4 cards
// styled like the homepage's stat cards, one per topic requested: Finance, Travel history, Ties
// to home country, Savings for trip. Unlike quizGapMessages() (which only speaks up about
// problems, and only shows the top 3), this always shows all 4, with the message adapting to
// whichever answer was actually given — including a neutral prompt when a question was skipped,
// since "Continue" is reachable without answering everything. quizGapMessages() itself is left
// untouched (still exported, still tested) — this is a new, separate function alongside it, not
// a replacement of it in lib/quiz-score.ts, only in how the result screen renders.
export function quizResultCards(a: QuizAnswers): QuizResultCard[] {
  const finance =
    a.income === 'steady'
      ? 'Steady income — a solid foundation for this application.'
      : a.income === 'none'
      ? 'No steady income — lean on a strong, well-explained savings history instead.'
      : "Not answered yet — it's one of the first things a reviewer checks.";

  const travelHistory =
    a.travel === 'yes'
      ? "You've travelled internationally before — that history works in your favor."
      : a.travel === 'no'
      ? 'This would be your first trip abroad — first-time travellers often face extra scrutiny, so the rest of your documents matter more.'
      : 'Not answered yet — travel history affects how closely other documents get checked.';

  const ties =
    a.ties === 'strong'
      ? "Property or strong family ties in Nigeria — solid evidence you'll return."
      : a.ties === 'few'
      ? 'Limited documented ties to Nigeria — worth strengthening with property, family, or employment evidence.'
      : "Not answered yet — ties to Nigeria are core evidence you'll return.";

  const savings =
    a.savings === 'over5m'
      ? 'Over ₦5,000,000 saved — comfortably covers most trip budgets.'
      : a.savings === 'to5m'
      ? '₦2,000,000–₦5,000,000 saved — likely enough; the Financial calculator further in the checklist will confirm.'
      : a.savings === 'to2m'
      ? "₦500,000–₦2,000,000 saved — whether it's enough depends on trip length and destination; check the Financial calculator."
      : a.savings === 'under500k'
      ? 'This looks thin for most trip costs — worth building up before you apply.'
      : 'Not answered yet — savings are one of the first things a reviewer checks.';

  return [
    { label: 'Finance', message: finance },
    { label: 'Travel history', message: travelHistory },
    { label: 'Ties to home country', message: ties },
    { label: 'Savings for trip', message: savings },
  ];
}

// Verbatim port of applyQuizPrefillToChecklist()'s scope: only work status, refusal, and
// host/host-funding carry over onto the real checklist form. Travel history is deliberately left
// out — the original's own comment explains that pre-answering it read as "the tool deciding for
// the applicant" rather than confirming what they said, so the applicant answers it fresh on the
// checklist even though the quiz already asked. married/hasChild/translation were never part of
// the original quiz and stay checklist-only here too. purpose is carried over in addition — see
// this module's header comment for why it's kept as the 10th question.
export function quizAnswersToChecklistPrefill(a: QuizAnswers): Partial<Answers> {
  const prefill: Partial<Answers> = {};

  if (a.work) {
    prefill.employed = a.work === 'employed' || a.work === 'both';
    prefill.selfEmployed = a.work === 'selfEmployed' || a.work === 'both';
    prefill.student = a.work === 'student';
  }
  if (a.refusal) {
    prefill.hasRefusal = a.refusal === 'yes';
  }
  if (a.host === 'host' || a.host === 'hostFunding') {
    prefill.hasHost = true;
    prefill.hostFunding = a.host === 'hostFunding';
  } else if (a.host === 'none') {
    prefill.hasHost = false;
    prefill.hostFunding = false;
  }
  if (a.purpose) {
    prefill.purpose = a.purpose;
  }

  return prefill;
}
