'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Answers } from '@/lib/checklist/uk';
import {
  DEFAULT_QUIZ_ANSWERS,
  QUIZ_TIER_COPY,
  QuizAnswers,
  quizAnswersToChecklistPrefill,
  quizResultCards,
  quizScore,
} from '@/lib/quiz-score';
import { trackEvent } from '@/lib/analytics';

// Phase 4d of task #244, expanded per user feedback ("the test in the github is 10 questions"):
// index.html's pre-checklist "confidence quiz" is 10 questions across 2 paged steps with a real
// point-scored rubric, a capped 3-item gap list, and a tier badge (see lib/quiz-score.ts for the
// full port + the scope note on why "country" was swapped for the existing "purpose" question
// rather than duplicating /checklist/start one screen later). This replaces the earlier scoped-down
// port, which only asked the subset of fields that fed the real checklist's Answers type and showed
// a couple of freeform sentences instead of a real score.
//
// Email capture: the result screen's OPTIONAL "email me this" field, wired to /api/capture-email,
// is unchanged and already proven working end-to-end (Resend delivery confirmed) — kept exactly as
// it was through this rewrite.
//
// Handoff to the real checklist: quizAnswersToChecklistPrefill() (lib/quiz-score.ts) narrows the 10
// quiz answers down to the same handful of fields the original ever prefilled (work status, refusal,
// host/funding, plus purpose — see that function's comment), saved to localStorage under
// 'sa_quiz_prefill' and read once by CountryChecklistApp on first visit to a country's checklist.
//
// Landing screen merge — SUPERSEDED by task #395/#396, kept here for history: the original port
// (task #379) had this quiz-intro screen (#quizIntro) double as the site's front door, reasoning
// that the original GitHub Pages site's homepage IS its quiz-intro. Task #395 replaced app/page.tsx
// with a dedicated stats-led landing page (real UK/Schengen refusal data), so this screen is no
// longer the front door — it's reached only via that page's "Click here before you apply" CTA.
//
// Task #396 (direct request, with 3 annotated screenshots): once the homepage already exists as its
// own screen with its own trust-building framing (the stats), asking a freshly-arrived applicant to
// read ANOTHER intro card before they even see a question felt like a redundant gate — so the old
// `!started` intro screen (brand header, FREE badge, trust bullets, "Start the quick check" button)
// no longer gates entry: clicking the homepage CTA now drops the applicant straight into quiz
// question 1. That same card's content didn't get deleted, though — it got relocated to AFTER the
// quiz result (see the `showTrust` state below), on the reasoning that the trust/privacy reassurance
// matters most right before the applicant is asked to hand over a passport photo and bank
// statements in the real checklist, not before five multiple-choice questions with no document
// upload at all. The button on that relocated card changed from "Start the quick check" (no longer
// applicable — the quiz is already done) to "Continue to pick your country →", taking over the job
// the result screen's own continue button used to do directly.
//
// One deliberate deviation from the literal original text, unchanged from before: the country list
// implied by this card's copy covers all 8 countries actually live today (UK/Canada/Schengen/South
// Africa/Ghana/Kenya/Ethiopia/Morocco).
const QUIZ_PREFILL_KEY = 'sa_quiz_prefill';
const QUIZ_PAGE_COUNT = 2;

const PURPOSE_OPTIONS: { value: Answers['purpose']; label: string }[] = [
  { value: '', label: 'Select…' },
  { value: 'tourism', label: 'Tourism / holiday' },
  { value: 'business', label: 'Business meetings' },
  { value: 'conference', label: 'Conference / event' },
  { value: 'medical', label: 'Medical treatment' },
  { value: 'family', label: 'Visiting family' },
  { value: 'wedding', label: 'Wedding / registrar appointment' },
  { value: 'academic', label: 'Academic visit / research' },
  { value: 'training', label: 'Paid training / course' },
];

export default function ConfidenceQuizPage() {
  const [page, setPage] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>(DEFAULT_QUIZ_ANSWERS);
  const [done, setDone] = useState(false);
  // Task #396: gates the relocated trust/privacy card (see the file-level comment above) — shown
  // after the result screen's own "Continue" click, before handing off to /checklist/start.
  const [showTrust, setShowTrust] = useState(false);
  const router = useRouter();

  const [reportEmail, setReportEmail] = useState('');
  const [reportEmailStatus, setReportEmailStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  // Task #402 (direct request, screenshot of the result screen): "make the webpages... not busy" —
  // the caveat sentence under the "Here's what we noticed" heading (this isn't a prediction, just a
  // first read) is real, useful context, but it was the first thing under the heading, competing with
  // the actual result for attention. Moved into a small "Reasons" tab in the bottom-right corner —
  // same declutter-by-tucking-explanations-away idea as the checklist flow's own "Why these
  // documents"/Reasons page (components/checklist/ReasonsView.tsx), scaled down to a one-line popover
  // since there's only one sentence to explain here, not a whole per-document breakdown.
  // NOTE on positioning: the first version of this used `fixed bottom-4 right-4`, matching the
  // literal "bottom right" of the request — live-verification on the deployed page caught it sitting
  // on top of the dark "Ties to home country" card while scrolling past that corner, the same
  // overlap bug SessionShell.tsx (task #391) already hit and fixed. Switched to an in-flow,
  // right-aligned button placed after the Continue button instead (see the `done` block below) —
  // still visually "bottom right" of the result card, but it can never sit on top of anything else.
  const [reasonsOpen, setReasonsOpen] = useState(false);

  const result = useMemo(() => quizScore(answers), [answers]);
  // Task #397: fixed 4-card breakdown (Finance / Travel history / Ties to home country / Savings
  // for trip) shown on the result screen, replacing the old variable-length gap-message bullet
  // list — see lib/quiz-score.ts's quizResultCards() for the full rationale.
  const resultCards = useMemo(() => quizResultCards(answers), [answers]);
  const tierCopy = QUIZ_TIER_COPY[result.tier];

  function set<K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function handleEmailResult(e: React.FormEvent) {
    e.preventDefault();
    if (!reportEmail.trim()) return;
    setReportEmailStatus('saving');
    trackEvent('quiz_email_result_clicked');
    try {
      const res = await fetch('/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: reportEmail.trim(),
          country: null, // no country chosen yet at the quiz-result stage
          sessionKey: 'quiz_result',
          percentComplete: 0,
        }),
      });
      setReportEmailStatus(res.ok ? 'done' : 'error');
    } catch {
      setReportEmailStatus('error');
    }
  }

  function handleContinue() {
    try {
      localStorage.setItem(QUIZ_PREFILL_KEY, JSON.stringify(quizAnswersToChecklistPrefill(answers)));
    } catch {
      /* prefill just won't carry over — not fatal, the checklist form still works manually */
    }
    router.push('/checklist/start');
  }

  if (done && showTrust) {
    return (
      // Relocated from the old pre-quiz `!started` gate (task #396 — see file-level comment).
      // Layout/centering unchanged from task #392's fix.
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7fafb] p-6">
        <div className="relative w-full max-w-2xl">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl"
            aria-hidden
          />
          <div className="card-surface relative w-full max-w-2xl p-8">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-wash text-lg" aria-hidden>
                ⚡
              </span>
              <span className="text-lg font-semibold text-[#12232e]">Smooth Application</span>
              <span className="rounded-full bg-good-wash px-2 py-0.5 text-xs font-bold tracking-wide text-good">
                FREE
              </span>
            </div>

            {/* Task #393 (PickFu cold-tester poll — see CHANGELOG): 5/5 respondents who only saw a
                two-sentence description of this site (no login, passport scanner, bank statement
                analyzer) flagged trust/privacy as their single biggest hesitation, and a second
                group weren't sure what the site does itself vs. elsewhere (e.g. whether "tracking"
                talks to the actual visa system). Now shown right before the applicant is asked to
                hand over a passport photo and bank statements in the real checklist (task #396),
                which is arguably where this reassurance carries the most weight anyway.
                Task #400 (direct request, numbered breakdown of the two trust sentences into 4
                shorter lines): "convert these ... lines of statement into boxes like the home
                page" — the two paragraphs above became a 2x2 grid of 4 stat-style cards, reusing
                the exact same treatment as the quiz result grid (task #397-#399): first two cards
                white/`text-good`, last two dark navy/`text-warn`, fixed by position, same
                `text-xl font-extrabold` headline weight, same `p-6` padding. "under it add 'Pick
                Your Country'" is the heading directly below the grid, introducing the existing
                Continue button (unchanged). */}
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <div className="card-surface p-6">
                <p className="text-xl font-extrabold leading-snug text-good">
                  <span aria-hidden>🔒</span> Everything runs on your device
                </p>
              </div>
              <div className="card-surface p-6">
                <p className="text-xl font-extrabold leading-snug text-good">
                  Your international passport and bank statements are never uploaded anywhere
                </p>
              </div>
              <div className="rounded-2xl bg-[#12232e] p-6 text-white">
                <p className="text-xl font-extrabold leading-snug text-warn">
                  <span aria-hidden>📋</span> This is a personal prep tool, not the government&apos;s
                  system
                </p>
              </div>
              <div className="rounded-2xl bg-[#12232e] p-6 text-white">
                <p className="text-xl font-extrabold leading-snug text-warn">
                  It doesn&apos;t submit your application or check its official status for you
                </p>
              </div>
            </div>

            {/* Task #403 (direct request, screenshot): the "Pick Your Country" heading (added in
                task #400, right above this same button) was removed — the button's own label
                ("Continue to pick your country →") already says the same thing, so the heading was
                pure repetition sitting right on top of it. */}
            <button type="button" onClick={handleContinue} className="btn-primary mt-1 w-full">
              Continue to pick your country →
            </button>

            <details className="mt-5 rounded-lg border border-black/10 p-3 text-sm text-[#4c6270]">
              <summary className="cursor-pointer font-medium text-[#12232e]">What you need to know</summary>
              <div className="mt-2 flex flex-col gap-2">
                <p>
                  <b>What&apos;s actually in here:</b> a readiness checklist per country, a passport
                  photo-page reader, and a bank statement reader that flags gaps a visa reviewer might
                  question (irregular deposits, thin balances) — all just checks against your own
                  documents, not a submission to anyone.
                </p>
                <p>
                  <b>Cost:</b> 🆓 free, always.
                </p>
                <p>
                  <b>Who it&apos;s for:</b> 🇳🇬 built for Nigerian applicants.
                </p>
                <p>
                  <b>Don&apos;t take our word for it:</b>{' '}
                  <a
                    href="https://github.com/SmoothApplication/smooth-application"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    the source code is public
                  </a>
                  .
                </p>
                <p>
                  <b>Not an approval predictor:</b> this is guidance, not immigration advice — it checks how
                  ready your documents and evidence look, not your chances of approval. Only the consulate or
                  embassy decides that.
                </p>
              </div>
            </details>

            <p className="mt-6 text-center text-xs text-[#566a76]">
              <Link href="/privacy" className="text-accent underline">
                Privacy Policy
              </Link>{' '}
              ·{' '}
              <Link href="/terms" className="text-accent underline">
                Terms of Use
              </Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      // Same fix as the !started screen above (task #392) — vertically center this short result
      // card too, instead of pinning it near the top with a large blank gap underneath.
      <main className="flex min-h-screen items-center justify-center bg-[#f7fafb] p-6">
        <div className="card-surface w-full max-w-2xl p-8">
          <h1 className="text-xl font-semibold text-[#12232e]">Here&apos;s what we noticed</h1>

          <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-wash px-3 py-2.5 text-sm font-semibold text-[#12232e]">
            <span aria-hidden>{tierCopy.icon}</span>
            {tierCopy.label}
          </div>

          {/* Task #397 (direct request, 2 annotated screenshots): "design page 2 to look like the
              landing page. 4 boxes" — a 2x2 grid of stat-style cards, one per topic, always all 4
              regardless of whether that answer was a strength or a gap — unlike the old bullet
              list, which only spoke up about problems and capped at 3.
              Task #398 matched the font/size/padding to the homepage's headline treatment
              (`text-xl font-extrabold`, `text-[#4c6270]`/`text-white/60` labels, `p-6`) — that part
              is unchanged below.
              Task #399 (direct follow-up, screenshot of the all-blank case rendering as 4 solid
              dark boxes, captioned "the above is wrong"): the previous pass coloured each card by
              a per-answer `tone` (good/warn), so a bad set of answers could turn all 4 boxes dark.
              Re-checking the homepage itself: its white-vs-navy split is a fixed LAYOUT position,
              not a sentiment signal — the top two white boxes show refusal counts (bad news) in
              green, the bottom two navy boxes show money lost (also bad news) in orange. So this
              now colours by fixed index instead of content: cards 0-1 (Finance, Travel history)
              are always the white/text-good treatment, cards 2-3 (Ties to home country, Savings
              for trip) are always the dark navy/text-warn treatment — a literal, always-the-same
              2-white-then-2-dark match to the homepage's own layout, regardless of what was
              answered. quizResultCards() no longer computes a tone at all (see lib/quiz-score.ts). */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {resultCards.map((c, i) =>
              // Task #422 (direct request, live screenshot): "increase the [label] font a little
              // and make it bold... reduce the font [of the answer text] a little bit" — applied
              // to all 4 cards. Label goes text-xs/font-medium -> text-sm/font-bold; the answer
              // line goes text-xl -> text-lg (still font-extrabold, just less overwhelming next to
              // the now-bolder label).
              i < 2 ? (
                <div key={c.label} className="card-surface p-6">
                  <p className="text-sm font-bold uppercase tracking-wide text-[#4c6270]">{c.label}</p>
                  <p className="mt-2 text-lg font-extrabold leading-snug text-good">{c.message}</p>
                </div>
              ) : (
                <div key={c.label} className="rounded-2xl bg-[#12232e] p-6 text-white">
                  <p className="text-sm font-bold uppercase tracking-wide text-white/60">{c.label}</p>
                  <p className="mt-2 text-lg font-extrabold leading-snug text-warn">{c.message}</p>
                </div>
              ),
            )}
          </div>

          {reportEmailStatus === 'done' ? (
            <p className="mt-4 rounded-md bg-good-wash p-3 text-sm text-good">
              ✅ Sent — check your inbox for a link to set up a free account and keep this result.
            </p>
          ) : (
            <form onSubmit={handleEmailResult} className="mt-4 rounded-md border border-black/10 p-3">
              <label htmlFor="quiz-report-email" className="mb-1 block text-xs font-medium text-[#12232e]">
                Add your email to get the comprehensive report
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="quiz-report-email"
                  type="email"
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="field-input min-w-0 flex-1"
                />
                <button
                  type="submit"
                  disabled={!reportEmail.trim() || reportEmailStatus === 'saving'}
                  className="rounded-full bg-accent px-3 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-accent-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {reportEmailStatus === 'saving' ? 'Sending…' : 'Get full report'}
                </button>
              </div>
              {reportEmailStatus === 'error' && (
                <p className="mt-1 text-xs text-warn-text">Something went wrong — you can skip this and continue below.</p>
              )}
            </form>
          )}

          {/* Task #396: this used to call handleContinue() directly. Now opens the relocated
              trust/privacy card (above) as one more screen before actually navigating away — see
              the file-level comment for why that card moved here. */}
          <button type="button" onClick={() => setShowTrust(true)} className="btn-primary mt-5 w-full">
            Continue →
          </button>

          {/* Task #402: small "Reasons" tab holding the "not a prediction" caveat, in the
              bottom-right corner AS REQUESTED — but in normal document flow, not `fixed`. A `fixed`
              bottom-right pill sits over whatever content is currently in that screen corner at the
              CURRENT scroll position, not just the final one — confirmed live on this exact page,
              where it landed on top of the dark "Ties to home country" card while scrolling past it.
              This is the identical bug SessionShell.tsx (task #391) already hit and fixed the same
              way: put it in the page's own flow, right-aligned, so it only ever appears once, after
              the Continue button, and never overlaps anything else. */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setReasonsOpen(true)}
              className="rounded-full bg-[#12232e] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              📖 Reasons
            </button>
          </div>
        </div>

        {reasonsOpen && (
          <div
            className="fixed inset-0 z-40 flex items-end justify-end bg-black/30 p-4"
            onClick={() => setReasonsOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-[#12232e]">Why this isn&apos;t a prediction</p>
                <button
                  type="button"
                  onClick={() => setReasonsOpen(false)}
                  aria-label="Close"
                  className="shrink-0 rounded-full px-2 text-[#566a76] hover:bg-black/5"
                >
                  ✕
                </button>
              </div>
              <p className="mt-2 text-sm text-[#4c6270]">
                Not a prediction of your outcome — just a first read on your situation before the full checklist.
              </p>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-5 bg-[#f7fafb] p-8 pt-10 sm:pt-16">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#566a76]">
          <span>Step {page} of {QUIZ_PAGE_COUNT}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: page === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>
        <h1 className="text-xl font-semibold text-[#12232e]">A few quick questions</h1>
        <p className="mt-1 text-sm text-[#4c6270]">We&apos;ll carry these straight into your checklist.</p>
      </div>

      {page === 1 && (
        <div className="card-surface flex flex-col gap-3 p-4">
          <Field label="What's your current work status?">
            <select value={answers.work} onChange={(e) => set('work', e.target.value as QuizAnswers['work'])} className="field-input">
              <option value="">Select…</option>
              <option value="employed">Employed</option>
              <option value="selfEmployed">Self-employed</option>
              <option value="both">Employed &amp; Self-employed</option>
              <option value="student">Student</option>
              <option value="child">Applying for a child</option>
            </select>
          </Field>

          <Field label="Is your income steady?">
            <select value={answers.income} onChange={(e) => set('income', e.target.value as QuizAnswers['income'])} className="field-input">
              <option value="">Select…</option>
              <option value="steady">Yes</option>
              <option value="none">No</option>
            </select>
          </Field>

          <Field label="How much do you have saved for this trip?">
            <select value={answers.savings} onChange={(e) => set('savings', e.target.value as QuizAnswers['savings'])} className="field-input">
              <option value="">Select…</option>
              <option value="under500k">Under ₦500,000</option>
              <option value="to2m">₦500,000 – ₦2,000,000</option>
              <option value="to5m">₦2,000,000 – ₦5,000,000</option>
              <option value="over5m">Over ₦5,000,000</option>
            </select>
          </Field>

          <Field label="Have you travelled outside Nigeria before?">
            <select value={answers.travel} onChange={(e) => set('travel', e.target.value as QuizAnswers['travel'])} className="field-input">
              <option value="">Select…</option>
              <option value="yes">Yes — I&apos;ve travelled before</option>
              <option value="no">No — this would be my first time</option>
            </select>
          </Field>

          <Field label="Main purpose of your trip">
            <select value={answers.purpose} onChange={(e) => set('purpose', e.target.value as Answers['purpose'])} className="field-input">
              {PURPOSE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {page === 2 && (
        <div className="card-surface flex flex-col gap-3 p-4">
          <Field label="Have you ever been refused a visa (any country) in the last 5 years?">
            <select value={answers.refusal} onChange={(e) => set('refusal', e.target.value as QuizAnswers['refusal'])} className="field-input">
              <option value="">Select…</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>

          <Field label="Do you own property, or have strong family ties in Nigeria (spouse, children, dependants)?">
            <select value={answers.ties} onChange={(e) => set('ties', e.target.value as QuizAnswers['ties'])} className="field-input">
              <option value="">Select…</option>
              <option value="strong">Yes</option>
              <option value="few">No</option>
            </select>
          </Field>

          <Field label="Who will be funding or hosting this trip?">
            <select value={answers.host} onChange={(e) => set('host', e.target.value as QuizAnswers['host'])} className="field-input">
              <option value="">Select…</option>
              <option value="none">Self-funded</option>
              <option value="host">Hosting by family or friend</option>
              <option value="hostFunding">Partly funded by company</option>
            </select>
          </Field>

          <Field label="Do you already have a valid international passport?">
            <select value={answers.passport} onChange={(e) => set('passport', e.target.value as QuizAnswers['passport'])} className="field-input">
              <option value="">Select…</option>
              <option value="yes">Yes</option>
              <option value="no">No, not yet</option>
            </select>
          </Field>

          <Field label="Do you have 3-6 months of bank statements ready to download?">
            <select value={answers.statements} onChange={(e) => set('statements', e.target.value as QuizAnswers['statements'])} className="field-input">
              <option value="">Select…</option>
              <option value="yes">Yes</option>
              <option value="notyet">Not yet</option>
            </select>
          </Field>
        </div>
      )}

      <div className="flex gap-2">
        {page === 2 && (
          <button type="button" onClick={() => setPage(1)} className="rounded-lg border border-black/10 px-4 py-3 text-sm font-semibold text-[#12232e]">
            ← Back
          </button>
        )}
        {page === 1 ? (
          <button type="button" onClick={() => setPage(2)} className="btn-primary flex-1">
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              trackEvent('quiz_completed');
              setDone(true);
            }}
            className="btn-primary flex-1"
          >
            See my result
          </button>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#12232e]">{label}</label>
      {children}
    </div>
  );
}
