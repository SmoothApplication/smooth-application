'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Answers, DEFAULT_ANSWERS } from '@/lib/checklist/uk';

// Phase 4d of task #244: a scoped port of index.html's pre-checklist "confidence quiz" — a
// short, low-commitment set of questions before the country picker, meant to give a directional
// readiness read and pre-fill the real checklist's qualifying-questions form so the applicant
// doesn't answer the same questions twice. index.html's version is considerably larger (10
// questions across paged steps, a scored rubric, an email-capture "get full report" flow, and a
// notify-me card) — this port keeps the same question set that actually feeds the ported
// checklist's Answers type, and keeps the result screen honest and simple rather than inventing a
// numeric score this version can't back up yet.
//
// Handoff to the real checklist: answers are saved to localStorage under 'sa_quiz_prefill' (NOT
// a country-specific key, since the quiz runs before a country is chosen) and read once by
// CountryChecklistApp on first visit to pre-fill its own per-country profile form — see the
// prefill logic there. Privacy is unchanged: nothing here is sent anywhere.
const QUIZ_PREFILL_KEY = 'sa_quiz_prefill';

type QuizAnswers = Pick<
  Answers,
  'employed' | 'selfEmployed' | 'student' | 'married' | 'hasHost' | 'hasChild' | 'hasRefusal' | 'translation' | 'purpose'
>;

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

  const signals = useMemo(() => {
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
  }, [answers]);

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
        <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 text-center shadow-sm">
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
            onClick={() => setStarted(true)}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white hover:opacity-90"
          >
            Start the quiz
          </button>
          <Link href="/checklist/start" className="mt-3 block text-center text-xs text-accent underline">
            Skip — go straight to the checklist
          </Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7fafb] p-6">
        <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
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

          <button
            type="button"
            onClick={handleContinue}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white hover:opacity-90"
          >
            Continue to pick your country →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-5 p-8">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">A few quick questions</h1>
        <p className="mt-1 text-sm text-[#4c6270]">We&apos;ll carry these straight into your checklist.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={answers.employed} onChange={(e) => setAnswers({ ...answers, employed: e.target.checked })} />
          I&apos;m employed
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={answers.selfEmployed} onChange={(e) => setAnswers({ ...answers, selfEmployed: e.target.checked })} />
          I&apos;m self-employed / run a business
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={answers.student} onChange={(e) => setAnswers({ ...answers, student: e.target.checked })} />
          I&apos;m a student
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={answers.married} onChange={(e) => setAnswers({ ...answers, married: e.target.checked })} />
          I&apos;m married
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={answers.hasHost} onChange={(e) => setAnswers({ ...answers, hasHost: e.target.checked })} />
          I&apos;ll be staying with a host (not a hotel)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={answers.hasChild} onChange={(e) => setAnswers({ ...answers, hasChild: e.target.checked })} />
          A child is travelling with me
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={answers.hasRefusal} onChange={(e) => setAnswers({ ...answers, hasRefusal: e.target.checked })} />
          I&apos;ve had a visa refused before
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={answers.translation} onChange={(e) => setAnswers({ ...answers, translation: e.target.checked })} />
          Some of my documents aren&apos;t in English
        </label>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#12232e]">Main purpose of your trip</label>
          <select
            value={answers.purpose}
            onChange={(e) => setAnswers({ ...answers, purpose: e.target.value as Answers['purpose'] })}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
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
        onClick={() => setDone(true)}
        className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white hover:opacity-90"
      >
        See my result
      </button>
    </main>
  );
}
