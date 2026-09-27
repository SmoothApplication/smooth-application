'use client';

import { useEffect, useMemo } from 'react';
import { Answers } from '@/lib/checklist/uk';
import { COUNTRIES } from '@/lib/checklist/countries';
import { getSponsorRecommendation, resolveSpouseRef } from '@/lib/checklist/sponsor';
import { useEditableChecklistState } from '@/lib/checklist/useEditableChecklistState';
import SessionShell from '@/components/checklist/SessionShell';

// Task #382 ("split qualifying-questions form into Sessions 3 and 4"): the original's real session
// 3 is "Your responsibilities" (see lib/checklist/sessions.ts's header comment for the full ground-
// truth order) — everything in the old flat qualifying-questions form (CountryChecklistApp's
// view==='profile') about who the applicant is answerable for/to: their own employment situation,
// marital status + the spouse/sponsor decision tool, who they're staying with, and whether a child
// is travelling with them. Session 4 (TripDetailsSession.tsx) covers the rest of that same form —
// what the trip itself is for and its current state.
//
// Reuses the same sa_<code>_answers localStorage key CountryChecklistApp's own (now-orphaned,
// fallback-only) profile view still reads/writes, via useEditableChecklistState — so filling this
// session in and later visiting the bare /checklist/<code> fallback (or vice versa) shows the same
// answers, not two diverging copies.
//
// Same visaName-shortening map CountryChecklistApp's two page.tsx callers already use inline
// (web/app/checklist/uk/page.tsx passes "Standard Visitor visa" directly; web/app/checklist/
// [country]/page.tsx has its own visaNameByCode literal) — duplicated here rather than threaded
// through as a prop, since this session page (like ChecklistCategorySession.tsx) only receives a
// plain `code` string from its own Server Component page.tsx wrapper.
const VISA_NAME_BY_CODE: Record<string, string> = {
  UK: 'Standard Visitor visa',
  CA: 'Visitor visa',
  EU: 'Short-stay visa',
  ZA: 'Visitor visa',
  GH: 'travel readiness',
  KE: 'travel readiness',
  ET: 'Tourist e-Visa',
  MA: 'travel readiness',
};

export type ResponsibilitiesSessionProps = {
  code: string;
};

export default function ResponsibilitiesSession({ code }: ResponsibilitiesSessionProps) {
  const { answers, setAnswers, loaded } = useEditableChecklistState(code);
  const country = COUNTRIES.find((c) => c.code === code.toUpperCase());
  const name = country?.name ?? code;
  const visaName = VISA_NAME_BY_CODE[code.toUpperCase()] ?? 'checklist';
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

  // Same auto-reset CountryChecklistApp's own profile view already applies — see the comment there.
  useEffect(() => {
    if (!sponsorRecommendation?.showConfirm && answers.spouseSponsoring) {
      setAnswers((prev: Answers) => ({ ...prev, spouseSponsoring: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorRecommendation?.showConfirm]);

  if (!loaded) return null;

  return (
    <SessionShell code={code} name={name} session="responsibilities">
      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-[#12232e]">Your responsibilities</h2>
        <p className="mb-3 text-xs text-[#4c6270]">
          This decides which of the documents in later sessions actually apply to you — a few won&apos;t.
        </p>

        <div className="flex flex-col gap-3 text-sm">
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
        </div>
      </section>
    </SessionShell>
  );
}
