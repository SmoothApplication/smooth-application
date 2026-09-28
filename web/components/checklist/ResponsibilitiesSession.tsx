'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Answers } from '@/lib/checklist/uk';
import { COUNTRIES } from '@/lib/checklist/countries';
import { getSponsorRecommendation, resolveSpouseRef } from '@/lib/checklist/sponsor';
import { useEditableChecklistState } from '@/lib/checklist/useEditableChecklistState';
import SessionShell from '@/components/checklist/SessionShell';
import { NIGERIA_STATES, NIGERIA_STATES_LGA } from '@/lib/checklist/nigeriaLocations';
import { Bedrooms, LAGOS_PREMIUM_POCKET, ETI_OSA_SUB_AREA_RENT, getEstimatedAnnualRent, computeYearlyCostSummary } from '@/lib/checklist/livingCost';
import { fmtN } from '@/lib/checklist/financial';

// Task #382 ("split qualifying-questions form into Sessions 3 and 4"): the original's real session
// 3 is "Your responsibilities" (see lib/checklist/sessions.ts's header comment for the full ground-
// truth order) — everything in the old flat qualifying-questions form (CountryChecklistApp's
// view==='profile') about who the applicant is answerable for/to: their own employment situation,
// marital status + the spouse/sponsor decision tool, who they're staying with, and whether a child
// is travelling with them. Session 4 (TripDetailsSession.tsx) covers the rest of that same form —
// what the trip itself is for and its current state.
//
// Task #418 (direct request, screenshot comparing this page against the original's own live "Your
// responsibilities" session): the original's data-session-key="responsibilities" section turned out
// to hold a second, entirely separate set of fields this port never carried over — it was built in
// the pre-Next.js-rebuild vanilla-JS codebase (before task #238) and simply never ported. Added here:
// how many children the applicant has (separate from hasChild's "is a child travelling on THIS
// trip"), a State/LGA/bedrooms picker for their Nigerian residence (lib/checklist/nigeriaLocations.ts
// + lib/checklist/livingCost.ts) feeding an auto-filled "Estimated yearly cost of living" (rent +
// upkeep + school fees), and an "aged parents I support" section with a monthly remittance figure.
// Confirmed the original's own responsibilities section actually has NO employment/host/child
// checkboxes at all — those came from this port's earlier decision (task #382) to fold the old flat
// form's qualifying questions into this session by name-matching alone. Left them in place rather
// than relocating them: the user's request was to restore the MISSING fields, not to reshuffle
// working ones, and nothing here conflicts with them. Deliberately NOT porting the original's
// separate Gender/maiden-name fields — see the Answers.maritalStatus doc comment in lib/checklist/
// uk.ts for why (gender's already on the passport scan; maiden name already has its own field on the
// statement page).
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

  // Task #418: LGAs available for the currently-picked state (empty until a state is chosen).
  const lgaOptions = useMemo(() => NIGERIA_STATES_LGA[answers.livingState] ?? [], [answers.livingState]);
  const showEtiOsaArea = answers.livingState === 'Lagos' && answers.livingLga === 'Eti Osa';
  const premiumPocketInfo = answers.livingState === 'Lagos' ? LAGOS_PREMIUM_POCKET[answers.livingLga] : undefined;
  const numKidsNum = parseInt(answers.numKids, 10) || 0;

  // Rent gets pre-filled the moment enough is known to estimate it, but ONLY while the field still
  // holds exactly what was last auto-filled — the instant the applicant types their own number, this
  // stops touching it. Same idiom as the original's data-autofilled DOM attribute, just as a ref
  // instead, since this is a controlled React input rather than an imperative DOM one.
  const lastAutofilledRent = useRef<string | null>(null);
  useEffect(() => {
    if (!answers.livingState) return;
    if (answers.annualRent !== '' && answers.annualRent !== lastAutofilledRent.current) return;
    const [lo, hi] = getEstimatedAnnualRent(answers.livingState, answers.livingLga, answers.bedrooms, answers.etiOsaArea, answers.premiumPocket);
    const estimate = String(Math.round((lo + hi) / 2));
    if (estimate !== answers.annualRent) {
      lastAutofilledRent.current = estimate;
      setAnswers((prev: Answers) => ({ ...prev, annualRent: estimate }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.livingState, answers.livingLga, answers.bedrooms, answers.etiOsaArea, answers.premiumPocket]);

  // Monthly upkeep / school fee per term only ever get a ONE-TIME generic starting figure (never
  // refined further like rent above), same as the original — so these just check "still blank".
  useEffect(() => {
    if (answers.livingState && !answers.monthlyUpkeep) {
      setAnswers((prev: Answers) => ({ ...prev, monthlyUpkeep: '120000' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.livingState]);
  useEffect(() => {
    if (numKidsNum > 0 && !answers.schoolFeePerTerm) {
      setAnswers((prev: Answers) => ({ ...prev, schoolFeePerTerm: '300000' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numKidsNum]);

  const yearlyCost = useMemo(
    () => computeYearlyCostSummary(answers.annualRent, answers.monthlyUpkeep, answers.schoolFeePerTerm, numKidsNum),
    [answers.annualRent, answers.monthlyUpkeep, answers.schoolFeePerTerm, numKidsNum]
  );

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
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#12232e]">Marital status</span>
            <select
              value={answers.maritalStatus}
              onChange={(e) => {
                const maritalStatus = e.target.value as Answers['maritalStatus'];
                setAnswers({
                  ...answers,
                  maritalStatus,
                  married: maritalStatus === 'married',
                  // Task #418: picking "Single" clears the children count, same as the original —
                  // otherwise a stale child count (and its school-fee estimate) could keep sitting
                  // there for someone who isn't a parent.
                  numKids: maritalStatus === 'single' ? '' : answers.numKids,
                });
              }}
              className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
            >
              <option value="">Select…</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
            </select>
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

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#12232e]">How many children do you have?</span>
            <select
              value={answers.numKids}
              onChange={(e) => setAnswers({ ...answers, numKids: e.target.value })}
              className="w-40 rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
            >
              <option value="">Select…</option>
              <option value="0">0 / None</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-black/10 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-[#12232e]">Where do you live?</h2>
        <p className="mb-3 text-xs text-[#4c6270]">
          Used only to pre-fill a starting estimate below for your own cost of living in Nigeria — not shared with anyone,
          and not part of your visa application itself.
        </p>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-[#12232e]">State</span>
              <select
                value={answers.livingState}
                onChange={(e) => setAnswers({ ...answers, livingState: e.target.value, livingLga: '', etiOsaArea: '', premiumPocket: false })}
                className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
              >
                <option value="">Select a state…</option>
                {NIGERIA_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-[#12232e]">Local government area</span>
              <select
                value={answers.livingLga}
                onChange={(e) => setAnswers({ ...answers, livingLga: e.target.value, etiOsaArea: '', premiumPocket: false })}
                disabled={!answers.livingState}
                className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e] disabled:bg-black/5"
              >
                <option value="">{answers.livingState ? 'Select…' : 'Select a state first…'}</option>
                {lgaOptions.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-[#12232e]">How many bedrooms?</span>
              <select
                value={answers.bedrooms}
                onChange={(e) => setAnswers({ ...answers, bedrooms: e.target.value as Bedrooms })}
                className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
              >
                <option value="">Select…</option>
                <option value="room">A room (self-contain)</option>
                <option value="1bed">1 bedroom</option>
                <option value="2bed">2 bedroom</option>
                <option value="3bed">3 bedroom</option>
                <option value="4bedDuplex">4 bedroom duplex</option>
                <option value="5bedDuplex">5 bedroom duplex</option>
                <option value="other">Others</option>
              </select>
            </label>
            {showEtiOsaArea && (
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-medium text-[#12232e]">Which part of Eti Osa?</span>
                <select
                  value={answers.etiOsaArea}
                  onChange={(e) => setAnswers({ ...answers, etiOsaArea: e.target.value })}
                  className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
                >
                  <option value="">Select…</option>
                  {Object.keys(ETI_OSA_SUB_AREA_RENT).map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <span className="text-[11px] text-[#4c6270]">
                  Eti Osa spans very different rent levels — this refines the estimate below instead of blending them all into one number.
                </span>
              </label>
            )}
          </div>

          {premiumPocketInfo && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={answers.premiumPocket} onChange={(e) => setAnswers({ ...answers, premiumPocket: e.target.checked })} />
              This address is in {premiumPocketInfo.label} ({premiumPocketInfo.hint})
            </label>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-[#12232e]">House/street number</span>
              <input
                type="text"
                value={answers.addressNumber}
                onChange={(e) => setAnswers({ ...answers, addressNumber: e.target.value })}
                placeholder="e.g. 14"
                className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-[#12232e]">Street/address name</span>
              <input
                type="text"
                value={answers.addressName}
                onChange={(e) => setAnswers({ ...answers, addressName: e.target.value })}
                placeholder="e.g. Adeola Odeku Street"
                className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
              />
            </label>
          </div>

          <div className="rounded-md border border-black/10 bg-[#f7fafb] p-3">
            <p className="mb-1 text-sm font-semibold text-[#12232e]">Estimated yearly cost of living</p>
            <p className="mb-2 text-xs text-[#4c6270]">
              Rent is pre-filled with a typical range for your state/LGA, adjusted for how many bedrooms you picked above,
              and upkeep/school fees with common starting figures — not a guarantee of what you actually pay. Check every
              number below and correct it to match your real costs.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-medium text-[#12232e]">Annual rent (₦)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={answers.annualRent}
                  onChange={(e) => setAnswers({ ...answers, annualRent: e.target.value })}
                  placeholder="e.g. 1500000"
                  className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-medium text-[#12232e]">Monthly upkeep / feeding (₦)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={answers.monthlyUpkeep}
                  onChange={(e) => setAnswers({ ...answers, monthlyUpkeep: e.target.value })}
                  placeholder="e.g. 120000"
                  className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
                />
              </label>
            </div>
            {numKidsNum > 0 && (
              <label className="mt-3 flex flex-col gap-1">
                <span className="text-xs font-medium text-[#12232e]">School fees per child, per term (₦)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={answers.schoolFeePerTerm}
                  onChange={(e) => setAnswers({ ...answers, schoolFeePerTerm: e.target.value })}
                  placeholder="e.g. 300000"
                  className="w-full max-w-xs rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
                />
              </label>
            )}
            {(answers.livingState || yearlyCost.rent > 0 || yearlyCost.upkeepMonthly > 0) && (
              <div className="mt-3 rounded bg-white p-2 text-xs text-[#12232e]">
                <div>Rent: <b>{fmtN(yearlyCost.rent)}</b>/year</div>
                <div>Upkeep: <b>{fmtN(yearlyCost.upkeepMonthly)}</b>/month ({fmtN(yearlyCost.upkeepYearly)}/year)</div>
                {numKidsNum > 0 && (
                  <div>
                    School fees: <b>{fmtN(yearlyCost.schoolFeePerTerm)}</b>/term × 3 terms × {numKidsNum} child{numKidsNum === 1 ? '' : 'ren'} = {fmtN(yearlyCost.schoolFeesYearly)}/year
                  </div>
                )}
                <div className="mt-1 font-semibold">Estimated total: {fmtN(yearlyCost.total)}/year</div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-black/10 bg-white p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={answers.agedParents} onChange={(e) => setAnswers({ ...answers, agedParents: e.target.checked })} />
          I have aged parents I support
        </label>
        {answers.agedParents && (
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 flex-col gap-1">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[#12232e]">Father&apos;s name</span>
                  <input
                    type="text"
                    value={answers.fatherName}
                    disabled={answers.fatherDeceased}
                    onChange={(e) => setAnswers({ ...answers, fatherName: e.target.value })}
                    placeholder="e.g. Emeka Okafor"
                    className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e] disabled:bg-black/5"
                  />
                </label>
                <label className="mt-1 flex items-center gap-2 text-xs text-[#4c6270]">
                  <input
                    type="checkbox"
                    checked={answers.fatherDeceased}
                    onChange={(e) => setAnswers({ ...answers, fatherDeceased: e.target.checked, fatherName: e.target.checked ? '' : answers.fatherName })}
                  />
                  Father has passed away / not applicable
                </label>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[#12232e]">Mother&apos;s name</span>
                  <input
                    type="text"
                    value={answers.motherName}
                    disabled={answers.motherDeceased}
                    onChange={(e) => setAnswers({ ...answers, motherName: e.target.value })}
                    placeholder="e.g. Ngozi Okafor"
                    className="rounded border border-black/10 px-2 py-1 text-sm text-[#12232e] disabled:bg-black/5"
                  />
                </label>
                <label className="mt-1 flex items-center gap-2 text-xs text-[#4c6270]">
                  <input
                    type="checkbox"
                    checked={answers.motherDeceased}
                    onChange={(e) => setAnswers({ ...answers, motherDeceased: e.target.checked, motherName: e.target.checked ? '' : answers.motherName })}
                  />
                  Mother has passed away / not applicable
                </label>
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#12232e]">How much do you send them (per month, ₦)?</span>
              <input
                type="text"
                inputMode="numeric"
                value={answers.remittanceAmount}
                onChange={(e) => setAnswers({ ...answers, remittanceAmount: e.target.value })}
                placeholder="e.g. 50000"
                className="w-full max-w-xs rounded border border-black/10 px-2 py-1 text-sm text-[#12232e]"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[#4c6270]">
              <input
                type="checkbox"
                checked={answers.remittanceVerifyConsent}
                onChange={(e) => setAnswers({ ...answers, remittanceVerifyConsent: e.target.checked })}
              />
              This is fine to cross-check against my bank statement above
            </label>
          </div>
        )}
      </section>
    </SessionShell>
  );
}
