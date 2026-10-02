'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { COUNTRIES, isTravelReadinessCountry } from '@/lib/checklist/countries';
import { trackEvent } from '@/lib/analytics';
import * as secureStorage from '@/lib/security/secureStorage';
import SituationGate from '@/components/checklist/SituationGate';

// Task #540 (redesign option A — audit found 4 near-identical full-screen gates in a row before any
// real content: quiz result, privacy notice, country picker, situation picker; direct go-ahead on
// the proposal's recommendation to collapse them). Every ready, non-travel-readiness country has a
// real "where are you in the process?" step — see components/checklist/SituationGate.tsx — kept
// here as the single source of truth for which route each of its 3 href props points to, mirroring
// exactly what app/checklist/uk/situation/page.tsx and app/checklist/[country]/situation/page.tsx
// already pass. Those two route files are left in place, unlinked, as a safety net for anyone who
// still has an old bookmark or hits the back button to them.
const READY_PORTED = ['UK', 'CA', 'EU', 'ZA', 'GH', 'KE', 'ET', 'MA'];

// Phase 1 port of index.html's #consentGate — country picker + guidance-only disclaimer + consent
// checkbox. Selection is kept in this browser only (localStorage), same as index.html: nothing
// about which visa someone is looking at goes to Supabase until they actually drop an email
// somewhere further into the flow (see /api/capture-email). Continuing here goes to /checklist,
// currently a stub — the real multi-session checklist body is a later phase of task #244.
export default function ChecklistStartPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();

  const country = useMemo(() => COUNTRIES.find((c) => c.code === selected) ?? null, [selected]);
  const canContinue = !!country?.ready && agreed;

  // Task #405: 8 ready countries chunked into 4 pairs for the box grid below; the 3 not-ready
  // countries are surfaced separately as a plain "coming soon" line instead of a 5th half-empty box.
  const countryPairs = useMemo(() => {
    const ready = COUNTRIES.filter((c) => c.ready);
    const pairs: (typeof COUNTRIES)[] = [];
    for (let i = 0; i < ready.length; i += 2) pairs.push(ready.slice(i, i + 2));
    return pairs;
  }, []);
  const comingSoonCountries = useMemo(() => COUNTRIES.filter((c) => !c.ready), []);

  // Task #540: GH/KE/MA are visa-free "travel readiness" countries (see isTravelReadinessCountry's
  // own comment in lib/checklist/countries.ts) with no situation gate at all — direct user
  // feedback confirmed "once you click Ghana, you do not need this page," since every option on
  // that gate is a visa-application concept that doesn't apply to them. Every OTHER ready country
  // does have a real situation step, which now renders inline below (see situationHrefs/
  // showSituation) instead of as a separate full-screen route.
  const situationHrefs = useMemo(() => {
    if (!country) return null;
    const code = country.code;
    if (code === 'UK') return { statement: '/checklist/uk/statement', passport: '/checklist/uk/passport' };
    if (READY_PORTED.includes(code) && !isTravelReadinessCountry(code)) {
      const c = code.toLowerCase();
      return { statement: `/checklist/${c}/statement`, passport: `/checklist/${c}/passport` };
    }
    return null;
  }, [country]);
  const showSituation = canContinue && !!country && !!situationHrefs && !isTravelReadinessCountry(country.code);

  // Fires once the country+consent step is actually settled — for a travel-readiness country
  // that's still the explicit Continue click below (handleContinue); for everyone else it's the
  // moment the inline situation step appears, since there's no separate "continue" click to that
  // step any more (the 4-gates-to-2 redesign — see the file-level comment at the top).
  useEffect(() => {
    if (showSituation && country) {
      trackEvent('session_started:' + country.code);
      try {
        secureStorage.setItem('sa_country', country.code);
      } catch {
        // localStorage unavailable (private browsing, etc.) — not fatal, just no resume pointer.
      }
    }
  }, [showSituation, country]);

  function handleContinue() {
    if (!canContinue || !country) return;
    trackEvent('session_started:' + country.code);
    try {
      secureStorage.setItem('sa_country', country.code);
    } catch {
      // localStorage unavailable (private browsing, etc.) — country still gets passed via query.
    }
    // Phase 4b of task #244: all 7 ready countries now have a real ported checklist — UK keeps
    // its own dedicated route (built in Phase 2), the rest go through the generic
    // /checklist/[country] route (registry in lib/checklist/registry.ts). AU/CN/US aren't
    // selectable here (COUNTRIES marks them ready:false), so this else-branch is unreachable for
    // them, but /checklist?country=CODE stays as a safety-net fallback for any future addition.
    //
    // Task #540: this button is only ever shown/enabled for a travel-readiness country now (see
    // showSituation above) — every other ready country's situation step renders inline instead of
    // through this click, so the old UK/readyPorted routing branches that used to live here moved
    // to situationHrefs.
    if (isTravelReadinessCountry(country.code)) {
      router.push(`/checklist/${country.code.toLowerCase()}/statement`);
    } else {
      router.push(`/checklist?country=${country.code}`);
    }
  }

  return (
    // Task #392 (UI/UX audit): same fix as the quiz-intro/result screens (app/quiz/page.tsx) —
    // `items-center` vertically centers this short card instead of leaving it pinned near the top
    // of a `min-h-screen` canvas with a large blank gap below.
    // Task #406 (direct request, screenshot): "increase the size of this page to the size of the
    // homepage" — the card was `max-w-md` (448px), noticeably narrower than the homepage's
    // `max-w-3xl` (768px) container that the 4-box country grid (task #405) is visually modeled
    // on, so the boxes here were cramped compared to their homepage counterparts. Widened to
    // `max-w-3xl` to match exactly.
    <main className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="card-surface w-full max-w-3xl p-8">
        {/* Task #406: header changed from a stacked icon-then-title (icon box on its own row,
            "Smooth Application" on the row below) to the homepage's own side-by-side header
            layout (app/page.tsx: `flex items-center gap-2`, same icon/text sizing) — "move the
            smooth application beside the image." The "A personal document-readiness checklist."
            subtitle is gone per the direct request to remove it. */}
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-wash text-lg" aria-hidden>
            🛂
          </span>
          <span className="font-serif text-lg font-semibold text-[#12232e]">Smooth Application</span>
        </div>

        <label className="mb-3 block text-sm font-medium text-[#12232e]">
          Which visa are you preparing for?
        </label>

        {/* Task #405 (direct request, using the homepage's stat-box grid as the guide): the country
            picker used to be a plain <select> — this replaces it with the same 2x2 box grid
            language as the homepage (app/page.tsx) and the quiz pages (app/quiz/page.tsx): first 2
            boxes white/`card-surface`/text-good, last 2 dark navy/text-warn, both `p-6`-family
            padding. The 8 "ready" countries split evenly into the 4 boxes, 2 per box; the 3
            not-yet-ready countries (AU/CN/US) move to a small "coming soon" line below the grid
            since they were never really selectable options anyway (the old <select> just showed
            them disabled).
            Each country is a clickable button, not a real navigation link — nothing to navigate to
            yet, it only records a selection, same as the old <select> did — styled to read as a
            tappable list item. Clicking one selects that country AND resets `agreed` to false
            (a country switch shows a different disclaimer below, via the existing `country?.ready
            && agreed` gate on the Continue button), so picking a different country always
            re-mandates ticking "I understand this is guidance only..." for that specific country's
            disclaimer, however many times someone changes their mind. */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {countryPairs.map((pair, i) => (
            <div
              key={i}
              className={
                i < 2
                  ? 'card-surface flex flex-col gap-1 p-4'
                  : 'flex flex-col gap-1 rounded-2xl bg-[#12232e] p-4 text-white'
              }
            >
              {pair.map((c) => {
                const isSelected = selected === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setSelected(c.code);
                      setAgreed(false);
                    }}
                    aria-pressed={isSelected}
                    className={
                      i < 2
                        ? `rounded-lg px-3 py-2 text-left text-base font-extrabold leading-snug transition ${
                            isSelected ? 'bg-good-wash text-good' : 'text-good hover:bg-black/5'
                          }`
                        : `rounded-lg px-3 py-2 text-left text-base font-extrabold leading-snug transition ${
                            isSelected ? 'bg-white/15 text-warn' : 'text-warn hover:bg-white/10'
                          }`
                    }
                  >
                    {c.flag} {c.name}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Task #407 (direct request, screenshot): "move it beside coming soon and name is funded
            opportunities" — the opportunities link (previously above the box grid, task #405
            moved everything else around it) now sits next to the "Coming soon" line as a shorter
            label, since both are the same kind of low-priority secondary text sitting right below
            the main country grid. Still points at /opportunities (index.html's #gateOpportunitiesLink
            / #opportunitiesGate) — only its position and label changed, not its destination. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#8a99a3]">
          {comingSoonCountries.length > 0 ? (
            <p>Coming soon: {comingSoonCountries.map((c) => `${c.flag} ${c.name}`).join(' · ')}</p>
          ) : (
            <span />
          )}
          <Link href="/opportunities" className="text-accent underline">
            🎓 Funded opportunities
          </Link>
        </div>

        <div className="mb-4 flex gap-2 rounded-lg bg-accent-wash p-3 text-sm text-[#12232e]">
          <span aria-hidden>ℹ️</span>
          {country?.ready ? (
            <div>
              <p className="font-medium">{country.disclaimerHeadline}</p>
              <details className="mt-2 text-xs text-[#4c6270]">
                <summary className="cursor-pointer">Read the full disclaimer</summary>
                <ul className="mt-2 list-disc pl-4">
                  {country.disclaimerBullets?.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mt-2" dangerouslySetInnerHTML={{ __html: country.disclaimerFullHtml ?? '' }} />
              </details>
            </div>
          ) : (
            <p>
              {country
                ? "This country isn't available yet — pick United Kingdom or Canada for now, or check back later."
                : 'Pick a country above to see its guidance disclaimer.'}
            </p>
          )}
        </div>

        <label className="mb-4 flex items-start gap-2 text-xs text-[#4c6270]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>I understand this is guidance only, not immigration advice — full details are in the disclaimer above.</span>
        </label>

        {/* Task #540: for a travel-readiness country (no situation step at all) this is still the
            one Continue click straight to the checklist. For every other ready country, the
            situation step now appears inline right below instead of behind this button — see
            showSituation above — so this button is hidden rather than duplicating what
            SituationGate's own "Continue to my checklist" link already does. */}
        {!showSituation && (
          <>
            <button type="button" onClick={handleContinue} disabled={!canContinue} className="btn-primary w-full">
              Continue
            </button>
            <p className="mt-2 text-center text-xs text-[#566a76]">
              {!country
                ? 'Pick a country to continue.'
                : !country.ready
                ? "This country isn't available yet — pick United Kingdom or Canada for now."
                : !agreed
                ? 'Tick the box above to continue.'
                : ''}
            </p>
          </>
        )}

        {showSituation && situationHrefs && country && (
          <div className="mt-2 border-t border-black/10 pt-6">
            <SituationGate
              embedded
              name={country.name}
              checklistHref={situationHrefs.statement}
              statementHref={situationHrefs.statement}
              passportHref={situationHrefs.passport}
            />
          </div>
        )}

        <Link href="/" className="mt-4 block text-center text-xs text-accent underline">
          ← Back
        </Link>
      </div>
    </main>
  );
}
