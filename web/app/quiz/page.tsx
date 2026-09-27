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
  quizGapMessages,
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
// Landing screen merge ("the site is not the way i arranged it" — user compared the live homepage
// against the original GitHub Pages site): in the original, this quiz-intro screen (#quizIntro) IS
// the site's front door — same brand header, tagline, visible trust badges, "source code is
// public" line, and a single "Start the quick check" button with no skip-to-checklist link (a code
// comment in index.html explains the skip link was deliberately removed so every applicant sees a
// real preview before committing). Our earlier port had split this into two things: a separate
// marketing homepage (app/page.tsx) offering a direct "skip the quiz" path, plus this screen with
// its own, shorter copy. Restored as one mandatory landing+quiz screen matching the original's
// structure; app/page.tsx now renders this same component so '/' and '/quiz' show the same thing.
// One deliberate deviation from the literal original text: the country list here says all 8
// countries actually live today (UK/Canada/Schengen/South Africa/Ghana/Kenya/Ethiopia/Morocco)
// rather than the original's older "UK, Canada, Schengen & South Africa" wording, which predates
// the other four shipping — reverting to that would misinform applicants about what's covered.
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
  const [started, setStarted] = useState(false);
  const [page, setPage] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>(DEFAULT_QUIZ_ANSWERS);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const [reportEmail, setReportEmail] = useState('');
  const [reportEmailStatus, setReportEmailStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  const result = useMemo(() => quizScore(answers), [answers]);
  const gapMessages = useMemo(() => quizGapMessages(answers), [answers]);
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

  if (!started) {
    return (
      // Task #392 (UI/UX audit — "overall look and feel"): this used to be `justify-center` (which
      // only centers horizontally in a row flexbox) with a top-heavy `pt-14 sm:pt-24`, so the card
      // sat pinned near the top of a `min-h-screen` canvas with a large, un-designed-looking blank
      // gap below it — confirmed on both desktop and mobile widths, worst on mobile where over half
      // the viewport was empty. `items-center` centers the single card vertically too, so the
      // leftover space splits evenly above/below instead of piling up at the bottom.
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7fafb] p-6">
        <div className="relative w-full max-w-md">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl"
            aria-hidden
          />
          <div className="card-surface relative w-full max-w-md p-8">
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
                talks to the actual visa system). The real reassurance for both already existed here
                — it was just sitting inside the collapsed "What you need to know" details below,
                which a scanning cold visitor has no reason to open. Promoted the two load-bearing
                lines to always-visible text right under the brand header, before any click is
                needed. The details section below is unchanged/still available for anyone who wants
                the fuller explanation. */}
            <div className="mb-5 flex flex-col gap-1.5 rounded-lg bg-accent-wash p-3 text-xs text-[#12232e]">
              <p>
                <span aria-hidden>🔒</span> Everything runs on your device — your passport photo and
                bank statements are never uploaded anywhere, and there&apos;s no account or login.
              </p>
              <p>
                <span aria-hidden>📋</span> This is a personal prep tool, not the government&apos;s
                system — it doesn&apos;t submit your application or check its official status for you.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                trackEvent('quiz_start');
                setStarted(true);
              }}
              className="btn-primary w-full"
            >
              Start the quick check
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
                <p>
                  <b>Why a quick check first:</b> a couple of minutes of questions gives you a real preview of
                  what the full checklist will ask, plus a directional read on where you stand, before you
                  commit to it.
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
        <div className="card-surface w-full max-w-md p-8">
          <h1 className="text-xl font-semibold text-[#12232e]">Here&apos;s what we noticed</h1>
          <p className="mt-1 text-sm text-[#4c6270]">
            Not a prediction of your outcome — just a first read on your situation before the full checklist.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent-wash px-3 py-2.5 text-sm font-semibold text-[#12232e]">
            <span aria-hidden>{tierCopy.icon}</span>
            {tierCopy.label}
          </div>

          {gapMessages.length > 0 ? (
            <div className="mt-3 rounded-md bg-warn-wash p-3 text-sm text-warn-text">
              <p className="font-medium">Biggest things to work on</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {gapMessages.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#4c6270]">Nothing major stands out — the full checklist will confirm the details.</p>
          )}

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
                  className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#0e5a80] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {reportEmailStatus === 'saving' ? 'Sending…' : 'Get full report'}
                </button>
              </div>
              {reportEmailStatus === 'error' && (
                <p className="mt-1 text-xs text-warn-text">Something went wrong — you can skip this and continue below.</p>
              )}
            </form>
          )}

          <button type="button" onClick={handleContinue} className="btn-primary mt-5 w-full">
            Continue to pick your country →
          </button>
        </div>
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
