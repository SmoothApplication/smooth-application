'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Answers, DEFAULT_ANSWERS } from '@/lib/checklist/uk';
import { QuizAnswers, computeQuizSignals } from '@/lib/quiz-signals';
import { trackEvent } from '@/lib/analytics';

// Phase 4d of task #244: a scoped port of index.html's pre-checklist "confidence quiz" — a
// short, low-commitment set of questions before the country picker, meant to give a directional
// readiness read and pre-fill the real checklist's qualifying-questions form so the applicant
// doesn't answer the same questions twice. index.html's version is considerably larger (10
// questions across paged steps, a scored rubric, a notify-me card) — this port keeps the same
// question set that actually feeds the ported checklist's Answers type, and keeps the result
// screen honest and simple rather than inventing a numeric score this version can't back up yet.
//
// Email capture (follow-up selection "Wire real checklist into /api/capture-email"): the result
// screen below has an OPTIONAL "email me this" field wired to /api/capture-email — the first
// point anywhere in the real, ported checklist flow that calls it (see that route's own comments).
// Deliberately optional and skippable: the homepage's "no account required" promise stays true
// either way, this is just a perk for anyone who wants a copy of their result.
//
// Handoff to the real checklist: answers are saved to localStorage under 'sa_quiz_prefill' (NOT
// a country-specific key, since the quiz runs before a country is chosen) and read once by
// CountryChecklistApp on first visit to pre-fill its own per-country profile form — see the
// prefill logic there. Privacy is unchanged: nothing here is sent anywhere.
const QUIZ_PREFILL_KEY = 'sa_quiz_prefill';

const DEFAULT_QUIZ: QuizAnswers = {
  employed: DEFAULT_ANSWERS.employed,
  selfEmployed: DEFAULT_ANSWERS.selfEmployed,
  student: DEFAULT_ANSWERS.student,
  married: DEFAULT_ANSWERS.married,
  hasHost: DEFAULT_ANSWERS.hasHost,
  hasChild: DEFAULT_ANSWERS.hasChild,
  hasRefusal: DEFAULT_ANSWERS.hasRefusal,
  translation: DEFAULT_ANSWERS.translation,
  purpose: DEFAULT_ANSWERS.purpose,
};

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
  const [answers, setAnswers] = useState<QuizAnswers>(DEFAULT_QUIZ);
  const [done, setDone] = useState(false);
  const router = useRouter();

  // Follow-up selection "Wire real checklist into /api/capture-email": the endpoint has existed
  // since the original admin-platform scaffold (task #243) but the real, client-side checklist
  // that eventually got built (task #244+) never had anywhere an applicant actually types an
  // email — the only email inputs anywhere in the app were the admin sign-in and an orphaned,
  // unreachable dev stub. This is the first real capture point: optional, same contract the stub
  // already used (email/country/sessionKey/percentComplete), and deliberately NOT required to
  // continue — the homepage's "no account required" promise stays true either way.
  const [reportEmail, setReportEmail] = useState('');
  const [reportEmailStatus, setReportEmailStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  const signals = useMemo(() => computeQuizSignals(answers), [answers]);

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
      localStorage.setItem(QUIZ_PREFILL_KEY, JSON.stringify(answers));
    } catch {
      /* prefill just won't carry over — not fatal, the checklist form still works manually */
    }
    router.push('/checklist/start');
  }

  if (!started) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7fafb] p-6">
        <div className="card-surface w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full bg-accent-wash text-xl" aria-hidden>
            🧭
          </div>
          <h1 className="text-xl font-semibold text-[#12232e]">2-minute readiness check</h1>
          <p className="mt-2 text-sm text-[#4c6270]">
            A handful of quick questions about your situation — we&apos;ll use your answers to pre-fill the checklist so you don&apos;t
            have to repeat yourself.
          </p>
          <button
            type="button"
            onClick={() => {
              trackEvent('quiz_start');
              setStarted(true);
            }}
            className="btn-primary mt-5 w-full"
          >
            Start the quiz
          </button>
          <Link
            href="/checklist/start"
            onClick={() => trackEvent('quiz_skip')}
            className="mt-3 block text-center text-xs text-accent underline"
          >
            Skip — go straight to the checklist
          </Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7fafb] p-6">
        <div className="card-surface w-full max-w-md p-8">
          <h1 className="text-xl font-semibold text-[#12232e]">Here&apos;s what we noticed</h1>
          <p className="mt-1 text-sm text-[#4c6270]">
            Not a score or a prediction — just a first read on your situation before the full checklist.
          </p>

          {signals.positives.length > 0 && (
            <div className="mt-4 rounded-md bg-good-wash p-3 text-sm text-good">
              <p className="font-medium">Working in your favour</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {signals.positives.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {signals.watchOuts.length > 0 && (
            <div className="mt-3 rounded-md bg-warn-wash p-3 text-sm text-warn-text">
              <p className="font-medium">Worth paying attention to</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {signals.watchOuts.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {signals.positives.length === 0 && signals.watchOuts.length === 0 && (
            <p className="mt-4 text-sm text-[#4c6270]">Answer a few questions and we&apos;ll show you what stands out.</p>
          )}

          {reportEmailStatus === 'done' ? (
            <p className="mt-4 rounded-md bg-good-wash p-3 text-sm text-good">
              ✅ Sent — check your inbox for a link to set up a free account and keep this result.
            </p>
          ) : (
            <form onSubmit={handleEmailResult} className="mt-4 rounded-md border border-black/10 p-3">
              <label htmlFor="quiz-report-email" className="mb-1 block text-xs font-medium text-[#12232e]">
                Want this emailed to you? <span className="font-normal text-[#566a76]">(optional)</span>
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
                  {reportEmailStatus === 'saving' ? 'Sending…' : 'Email me'}
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
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 bg-[#f7fafb] p-8">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">A few quick questions</h1>
        <p className="mt-1 text-sm text-[#4c6270]">We&apos;ll carry these straight into your checklist.</p>
      </div>

      <div className="card-surface flex flex-col gap-1 p-2 text-sm">
        <label className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent-wash/40">
          <input type="checkbox" checked={answers.employed} onChange={(e) => setAnswers({ ...answers, employed: e.target.checked })} />
          I&apos;m employed
        </label>
        <label className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent-wash/40">
          <input type="checkbox" checked={answers.selfEmployed} onChange={(e) => setAnswers({ ...answers, selfEmployed: e.target.checked })} />
          I&apos;m self-employed / run a business
        </label>
        <label className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent-wash/40">
          <input type="checkbox" checked={answers.student} onChange={(e) => setAnswers({ ...answers, student: e.target.checked })} />
          I&apos;m a student
        </label>
        <label className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent-wash/40">
          <input type="checkbox" checked={answers.married} onChange={(e) => setAnswers({ ...answers, married: e.target.checked })} />
          I&apos;m married
        </label>
        <label className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent-wash/40">
          <input type="checkbox" checked={answers.hasHost} onChange={(e) => setAnswers({ ...answers, hasHost: e.target.checked })} />
          I&apos;ll be staying with a host (not a hotel)
        </label>
        <label className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent-wash/40">
          <input type="checkbox" checked={answers.hasChild} onChange={(e) => setAnswers({ ...answers, hasChild: e.target.checked })} />
          A child is travelling with me
        </label>
        <label className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent-wash/40">
          <input type="checkbox" checked={answers.hasRefusal} onChange={(e) => setAnswers({ ...answers, hasRefusal: e.target.checked })} />
          I&apos;ve had a visa refused before
        </label>
        <label className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent-wash/40">
          <input type="checkbox" checked={answers.translation} onChange={(e) => setAnswers({ ...answers, translation: e.target.checked })} />
          Some of my documents aren&apos;t in English
        </label>
        <div className="px-3 py-2">
          <label className="mb-1 block text-xs font-medium text-[#12232e]">Main purpose of your trip</label>
          <select
            value={answers.purpose}
            onChange={(e) => setAnswers({ ...answers, purpose: e.target.value as Answers['purpose'] })}
            className="field-input"
          >
            {PURPOSE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          trackEvent('quiz_completed');
          setDone(true);
        }}
        className="btn-primary w-full"
      >
        See my result
      </button>
    </main>
  );
}
