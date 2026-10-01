import { SessionDescriptor, SessionKey } from './sessions';

// Direct user feedback (forwarded WhatsApp message from a real tester, "the sites process looks too
// long, like too many questions"): the flat "Session 1 of 18" framing in SessionShell.tsx is honest
// about how much work is left, but the raw count is itself discouraging before the applicant has
// even started — a 6-category document checklist on a country like the UK means the headline number
// keeps climbing well past what "18 short sessions" actually feels like once you're in one. Nothing
// about the underlying flow (buildSessionOrder in sessions.ts, the fixed per-session routes, the
// progress pills) changes here — this is a pure DISPLAY regrouping: the same sessions, bucketed into
// a small, fixed number of named "chapters" that stays the same size (6) regardless of how many
// document-checklist categories a given country has, with a secondary line showing exactly where
// within that chapter the applicant actually is.
//
// Deliberately NOT a time estimate ("~25 minutes left") — this codebase has no real per-session
// completion-time telemetry to back a number like that with, and a wrong guess (especially an
// optimistic one that turns out short) would cost more trust than the vague "Session 1 of 18" ever
// did. A smaller, truthful step count is a safe improvement; a fabricated time estimate is not.
export type ChapterKey =
  | 'income-and-docs'
  | 'passport-and-travel'
  | 'your-details'
  | 'next-steps'
  | 'document-checklist'
  | 'review-and-submit';

const CHAPTER_LABELS: Record<ChapterKey, string> = {
  'income-and-docs': 'Income & finances',
  'passport-and-travel': 'Passport & travel history',
  'your-details': 'Your details',
  'next-steps': 'What to do next',
  'document-checklist': 'Document checklist',
  'review-and-submit': 'Review & submit',
};

// Every SessionKey maps to exactly one chapter. `checklist:${number}` keys all share the same
// chapter regardless of index (see chapterKeyFor below) — they're the ones whose COUNT varies by
// country, which is exactly the part of the raw session count that felt the longest.
function chapterKeyFor(key: SessionKey): ChapterKey {
  if (key === 'statement' || key === 'financial') return 'income-and-docs';
  if (key === 'passport' || key === 'travel-history') return 'passport-and-travel';
  if (key === 'responsibilities' || key === 'trip-details') return 'your-details';
  if (key === 'next-steps') return 'next-steps';
  if (key === 'final-review' || key === 'reasons') return 'review-and-submit';
  return 'document-checklist'; // every `checklist:${number}` key
}

// The fixed display order chapters appear in — independent of CHAPTER_LABELS's declaration order
// (a Record's key order isn't a safe thing to rely on) and independent of exactly which SessionKey
// happens to appear first in a given country's buildSessionOrder (which could, in principle, change
// without this needing to).
const CHAPTER_ORDER: ChapterKey[] = [
  'income-and-docs',
  'passport-and-travel',
  'your-details',
  'next-steps',
  'document-checklist',
  'review-and-submit',
];

export type ChapterInfo = {
  chapterIndex: number; // 0-based
  chapterCount: number; // always CHAPTER_ORDER.length — fixed regardless of country
  chapterLabel: string;
  /** This specific session's own label (e.g. "Income & bank statement analysis"), same string
   * SessionShell already showed before this change — kept so the exact page identity is never lost,
   * just demoted to a secondary line under the new chapter heading. */
  subLabel: string;
  /** 1-based position of this session within its OWN chapter (e.g. "category 2 of 6" inside the
   * document-checklist chapter) — null when the chapter has only one session, where restating "1 of
   * 1" would be noise rather than useful orientation. */
  subPosition: { index: number; count: number } | null;
};

export function chapterInfoForSession(order: SessionDescriptor[], sessionIdx: number): ChapterInfo {
  const session = order[sessionIdx];
  const thisChapterKey = chapterKeyFor(session.key);
  const chapterIndex = CHAPTER_ORDER.indexOf(thisChapterKey);

  const sessionsInChapter = order.filter((s) => chapterKeyFor(s.key) === thisChapterKey);
  const positionInChapter = sessionsInChapter.findIndex((s) => s.key === session.key);

  return {
    chapterIndex,
    chapterCount: CHAPTER_ORDER.length,
    chapterLabel: CHAPTER_LABELS[thisChapterKey],
    subLabel: session.label,
    subPosition:
      sessionsInChapter.length > 1 ? { index: positionInChapter + 1, count: sessionsInChapter.length } : null,
  };
}
