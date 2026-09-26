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
import { getSponsorRecommendation, resolveSpouseRef } from '@/lib/checklist/sponsor';

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
  /** Phase 4 of task #244: link to the bank-statement check page. Passed by every country's route
   * (/checklist/uk/page.tsx and /checklist/[country]/page.tsx) as of Phase 4e — still optional
   * here so the link simply doesn't render if a caller omits it. */
  statementHref?: string;
  /** Phase 3 of the passport-MRZ port: link to the passport-scan page. Passed by every country's
   * route as of Phase 4e — same reasoning as statementHref above. */
  passportHref?: string;
  /** Port of index.html's personal application tracker (task #296+): link to the global /tracker
   * page. Unlike the other hrefs above, this is the SAME path for every country (the tracker
   * isn't country-scoped — applicants often track programs across several countries at once), so
   * every caller passes the literal "/tracker" rather than a per-country templated path. Optional
   * for the same reason as the others: the link simply doesn't render if a caller omits it. */
  trackerHref?: string;
};

export default function CountryChecklistApp({
  code,
  flag,
  name,
  visaName,
  changeCountryHref,
  reasonsHref,
  financialHref,
  statementHref,
  passportHref,
  trackerHref,
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

  const percent = useMemo(() => computeOverallPercent(checklist, answers, checked), [checklist, answers, checked]);

  // Spouse/sponsor decision tool (task #319+, port of index.html's renderSponsorRecommendation())
  // — "travel readiness" is the same string the two page.tsx callers already pass as `visaName`
  // for the visa-free countries (GH/KE/MA), so it doubles here as the noVisaRequired signal
  // without needing a new prop threaded through every route.
  const noVisaRequired = visaName === 'travel readiness';
  const sponsorRecommendation = useMemo(
    () =>
      getSponsorRecommendation({
        spouseWilling: answers.spouseWilling,
        spouseEmployed: answers.spouseEmployed,
        spouseUkHistory: answers.spouseUkHistory,
      }),
    [answers.spouseWilling, answers.spouseEmployed, answers.spouseUkHistory]
  );
  const spouseRef = resolveSpouseRef(answers.spouseName);

  // Mirrors the original's own auto-reset: if the underlying answers no longer support the
  // sponsor route (e.g. spouseEmployed flips back to "no" after the box was ticked), un-tick it
  // too, rather than leaving a stale confirmation quietly driving the required-documents list.
  useEffect(() => {
    if (!sponsorRecommendation?.showConfirm && answers.spouseSponsoring) {
      setAnswers((prev) => ({ ...prev, spouseSponsoring: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorRecommendation?.showConfirm]);

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
          {/* Spouse/sponsor decision tool (task #319+) — port of index.html's
              renderSponsorRecommendation(), scoped to just this 3-question advisory tool, not the
              larger "What to do next" hard-gated report session it originally lived inside
              (passport-validity + travel-history + finance-readiness synthesis — out of scope for
              this port). Deliberately advisory only: answers.spouseSponsoring (the flag
              spouseSponsorFinance's appliesIf actually reads) only changes when the applicant
              actively ticks the confirm checkbox below, same "don't silently assume" pattern as
              the rest of this form. */}
          {answers.married && (
            <div className="ml-6 flex flex-col gap-2 rounded-md border border-black/10 bg-[#f7fafb] p-3 text-[#4c6270]">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#12232e]">Spouse&apos;s name (optional)</span>
                <input
                  type="text"
                  value={answers.spouseName}
                  onChange={(e) => setAnswers({ ...answers, spouseName: e.target.value })}
                  placeholder="Helps personalize the guidance below"
                  className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#12232e]">Is your spouse willing to fund this trip?</span>
                <select
                  value={answers.spouseWilling}
                  onChange={(e) => setAnswers({ ...answers, spouseWilling: e.target.value as Answers['spouseWilling'] })}
                  className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
                >
                  <option value="">Select…</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#12232e]">Is your spouse gainfully employed or running a business?</span>
                <select
                  value={answers.spouseEmployed}
                  onChange={(e) => setAnswers({ ...answers, spouseEmployed: e.target.value as Answers['spouseEmployed'] })}
                  className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
                >
                  <option value="">Select…</option>
                  <option value="yes">Yes</option>
                  <option value="no">No / not currently</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#12232e]">
                  {noVisaRequired
                    ? `Has your spouse travelled to ${name} before?`
                    : `Does your spouse currently hold a ${visaName}, or have they travelled to ${name} before?`}
                </span>
                <select
                  value={answers.spouseUkHistory}
                  onChange={(e) => setAnswers({ ...answers, spouseUkHistory: e.target.value as Answers['spouseUkHistory'] })}
                  className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
                >
                  <option value="">Select…</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>

              {sponsorRecommendation?.kind === 'spouse_history' && (
                <p className="rounded bg-accent-wash p-2 text-xs text-[#12232e]">
                  Since {spouseRef}{' '}
                  {noVisaRequired ? `has already travelled to ${name} before` : `already holds a ${visaName}, or has travelled to ${name} before`}
                  , one option worth considering: framing this as {spouseRef} taking you along on their next visit. Their
                  own travel history and proven return to Nigeria can strengthen your ties in a reviewer&apos;s eyes —
                  make sure this is stated clearly {noVisaRequired ? 'on this checklist' : 'in your application'}, and
                  that your marriage certificate is included as evidence of the relationship. This is a narrative choice,
                  not a document requirement change here, so nothing else on this checklist is affected by it.
                </p>
              )}
              {sponsorRecommendation?.kind === 'sponsor_eligible' && (
                <p className="rounded bg-green-50 p-2 text-xs text-green-800">
                  Since {spouseRef} is employed and willing, they can act as your financial sponsor instead of you
                  self-funding. Guidance is consistent on one point: money in an account that isn&apos;t declared as a
                  sponsor&apos;s is usually disregarded by a caseworker rather than counted in your favour — so this
                  needs to be stated plainly, not left implicit. If you go this route you&apos;ll need {spouseRef}&apos;s
                  own bank statements for the last 6 months, plus a signed letter from them explaining your relationship
                  and confirming they&apos;re funding this trip. Tick the box below if this is the route you want — it
                  adds that document to your checklist below.
                </p>
              )}
              {sponsorRecommendation?.kind === 'sponsor_weak' && (
                <p className="rounded bg-warn-wash p-2 text-xs text-warn-text">
                  Sponsor evidence needs to show genuine, provable income of its own — if {spouseRef} doesn&apos;t
                  currently have a steady income, their statement alone may not strengthen your case the way it&apos;s
                  meant to. Worth considering whether combining both your finances (clearly declared as such) makes more
                  sense, or building up your own evidence instead.
                </p>
              )}
              {sponsorRecommendation?.kind === 'no_sponsor' && (
                <p className="rounded bg-black/5 p-2 text-xs text-[#4c6270]">
                  No changes needed — you&apos;ll continue as your own main applicant, funded by your own finances, same
                  as the rest of this checklist already covers.
                </p>
              )}

              {sponsorRecommendation?.showConfirm && (
                <label className="flex items-center gap-2 text-sm text-[#12232e]">
                  <input
                    type="checkbox"
                    checked={answers.spouseSponsoring}
                    onChange={(e) => setAnswers({ ...answers, spouseSponsoring: e.target.checked })}
                  />
                  Yes — {spouseRef} will sponsor this trip as my financial sponsor
                </label>
              )}
            </div>
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
          {statementHref && (
            <Link href={statementHref} className="inline-block text-xs text-accent underline">
              🏦 Bank statement check
            </Link>
          )}
          {passportHref && (
            <Link href={passportHref} className="inline-block text-xs text-accent underline">
              🛂 Passport scan
            </Link>
          )}
          <Link href={reasonsHref} className="inline-block text-xs text-accent underline">
            📖 Why these documents
          </Link>
          {trackerHref && (
            <Link href={trackerHref} className="inline-block text-xs text-accent underline">
              📋 My application tracker
            </Link>
          )}
          {/* Business Income Record (task #319+) — only relevant to a self-employed applicant, so
              unlike statementHref/passportHref/trackerHref above this isn't a caller-supplied prop:
              it's derived from `code` (same per-country route shape as statement/passport) and
              gated on answers.selfEmployed rather than always shown. */}
          {answers.selfEmployed && (
            <Link href={`/checklist/${code.toLowerCase()}/business-income`} className="inline-block text-xs text-accent underline">
              🧾 Business Income Record
            </Link>
          )}
          {/* Travel Experience (task #319+ "Build travel history first, then the full report") —
              always shown, same per-country route shape as the other side pages above. */}
          <Link href={`/checklist/${code.toLowerCase()}/travel-history`} className="inline-block text-xs text-accent underline">
            🌍 Travel Experience
          </Link>
          {/* "What to do next" report (task #319+ selection "'What to do next' report") — reads
              passport/travel-history/finance data saved elsewhere, so it's safe to reach any time,
              unlike the original's hard-gated version. */}
          <Link href={`/checklist/${code.toLowerCase()}/next-steps`} className="inline-block text-xs text-accent underline">
            📋 What to do next
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
