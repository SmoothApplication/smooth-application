'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Answers,
  DEFAULT_ANSWERS,
  ChecklistItem,
  itemApplies,
  computeOverallPercent,
} from '@/lib/checklist/uk';
import { ALL_CHECKLISTS } from '@/lib/checklist/all';

// Phase 4b of task #244: the shared checklist app UI, factored out of the UK-only
// web/app/checklist/uk/page.tsx (Phase 2) so the same profile-form + categorized-document-list
// experience can drive every country's checklist, not just the UK's. Each route (uk/page.tsx,
// [country]/page.tsx) is now a thin wrapper that passes this component its country's data —
// the qualifying-questions form is identical everywhere because it's keyed off the one shared
// `Answers` type every country's `appliesIf` closures use (see lib/checklist/uk.ts).
//
// Privacy: unchanged from Phase 2 — answers/checked state live only in this browser's
// localStorage under country-specific keys, never sent anywhere.
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

export type CountryChecklistAppProps = {
  code: string;
  flag: string;
  name: string;
  visaName: string;
  changeCountryHref: string;
  reasonsHref: string;
  financialHref: string;
};

export default function CountryChecklistApp({
  code,
  flag,
  name,
  visaName,
  changeCountryHref,
  reasonsHref,
  financialHref,
}: CountryChecklistAppProps) {
  // Looked up here (inside this Client Component) rather than passed as a prop — see the comment
  // at the top of lib/checklist/all.ts for why passing ChecklistItem[] as a prop broke the build.
  const { catOrder, checklist } = ALL_CHECKLISTS[code] ?? { catOrder: [], checklist: [] as ChecklistItem[] };
  const answersKey = `sa_${code.toLowerCase()}_answers`;
  const checkedKey = `sa_${code.toLowerCase()}_checked`;

  const [view, setView] = useState<'profile' | 'checklist'>('profile');
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const a = localStorage.getItem(answersKey);
      const c = localStorage.getItem(checkedKey);
      if (a) {
        setAnswers({ ...DEFAULT_ANSWERS, ...JSON.parse(a) });
        setView('checklist');
      } else {
        // No answers saved for THIS country yet — check for a quiz pre-fill (Phase 4d) from
        // /quiz, which runs before a country is picked and can't know the country-specific key.
        // Only used once as a starting point; from here on this country's own answersKey wins.
        const quizPrefill = localStorage.getItem('sa_quiz_prefill');
        if (quizPrefill) setAnswers({ ...DEFAULT_ANSWERS, ...JSON.parse(quizPrefill) });
      }
      if (c) setChecked(JSON.parse(c));
    } catch {
      /* start fresh */
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(answersKey, JSON.stringify(answers));
    } catch {
      /* ignore */
    }
  }, [answers, loaded, answersKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(checkedKey, JSON.stringify(checked));
    } catch {
      /* ignore */
    }
  }, [checked, loaded, checkedKey]);

  const percent = useMemo(() => computeOverallPercent(answers, checked), [answers, checked]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!loaded) return null;

  if (view === 'profile') {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-5 p-8">
        <div>
          <h1 className="text-xl font-semibold text-[#12232e]">
            {flag} A few quick questions
          </h1>
          <p className="mt-1 text-sm text-[#4c6270]">
            This decides which of the documents below actually apply to you — a few won&apos;t.
          </p>
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
          {answers.student && (
            <label className="ml-6 flex items-center gap-2 text-[#4c6270]">
              <input type="checkbox" checked={answers.studentSponsor} onChange={(e) => setAnswers({ ...answers, studentSponsor: e.target.checked })} />
              Someone else is sponsoring my trip
            </label>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={answers.married} onChange={(e) => setAnswers({ ...answers, married: e.target.checked })} />
            I&apos;m married
          </label>
          {answers.married && (
            <label className="ml-6 flex items-center gap-2 text-[#4c6270]">
              <input type="checkbox" checked={answers.spouseSponsoring} onChange={(e) => setAnswers({ ...answers, spouseSponsoring: e.target.checked })} />
              My spouse is sponsoring this trip
            </label>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={answers.hasHost} onChange={(e) => setAnswers({ ...answers, hasHost: e.target.checked })} />
            I&apos;m staying with a host in {name} (not a hotel)
          </label>
          {answers.hasHost && (
            <label className="ml-6 flex items-center gap-2 text-[#4c6270]">
              <input type="checkbox" checked={answers.hostFunding} onChange={(e) => setAnswers({ ...answers, hostFunding: e.target.checked })} />
              My host is covering some/all of my costs
            </label>
          )}
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
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={answers.readyToSubmit} onChange={(e) => setAnswers({ ...answers, readyToSubmit: e.target.checked })} />
            I&apos;ve already started my online application
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
          onClick={() => setView('checklist')}
          className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white hover:opacity-90"
        >
          Show my checklist
        </button>
        <Link href={changeCountryHref} className="text-center text-xs text-accent underline">
          ← Change country
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <div className="sticky top-0 z-10 -mx-6 border-b border-black/10 bg-[#f7fafb]/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-[#12232e]">
            {flag} {name} {visaName} checklist
          </span>
          <span className="font-medium text-accent">{percent}% ready</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href={financialHref} className="inline-block text-xs text-accent underline">
            💰 Financial readiness calculator
          </Link>
          <Link href={reasonsHref} className="inline-block text-xs text-accent underline">
            📖 Why these documents
          </Link>
        </div>
      </div>

      {catOrder.map((cat) => {
        const items = checklist.filter((it) => it.cat === cat && itemApplies(it, answers));
        if (!items.length) return null;
        const subcats = Array.from(new Set(items.map((it) => it.subcat).filter(Boolean))) as string[];
        const mainItems = items.filter((it) => !it.subcat);

        return (
          <section key={cat} className="rounded-lg border border-black/10 bg-white">
            <h2 className="border-b border-black/10 px-4 py-3 text-sm font-semibold text-[#12232e]">{cat}</h2>
            <ul className="divide-y divide-black/5">
              {mainItems.map((item) => (
                <ChecklistRow key={item.id} item={item} checked={!!checked[item.id]} onToggle={() => toggle(item.id)} />
              ))}
            </ul>
            {subcats.map((sc) => (
              <div key={sc}>
                <h3 className="border-t border-black/10 bg-[#f7fafb] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#566a76]">
                  {sc}
                </h3>
                <ul className="divide-y divide-black/5">
                  {items
                    .filter((it) => it.subcat === sc)
                    .map((item) => (
                      <ChecklistRow key={item.id} item={item} checked={!!checked[item.id]} onToggle={() => toggle(item.id)} />
                    ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}

      <button type="button" onClick={() => setView('profile')} className="text-center text-xs text-accent underline">
        ← Edit your answers
      </button>
    </main>
  );
}

function ChecklistRow({
  item,
  checked,
  onToggle,
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm ${checked ? 'text-[#566a76] line-through' : 'text-[#12232e]'}`}>{item.label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              item.weight === 'required' ? 'bg-warn-wash text-warn-text' : 'bg-accent-wash text-accent'
            }`}
          >
            {item.weight === 'required' ? 'Required' : 'Recommended'}
          </span>
        </div>
        {item.tip && (
          <details className="mt-1 text-xs text-[#4c6270]">
            <summary className="cursor-pointer text-accent">Why?</summary>
            <p className="mt-1">{item.tip}</p>
          </details>
        )}
      </div>
    </li>
  );
}
