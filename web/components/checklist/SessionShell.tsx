'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import ChecklistSidebar from '@/components/checklist/ChecklistSidebar';
import SaveProgressPanel from '@/components/checklist/SaveProgressPanel';
import SiteFeedbackPanel from '@/components/checklist/SiteFeedbackPanel';
import { useChecklistState } from '@/lib/checklist/useChecklistState';
import { buildSessionOrder, SessionKey, prevSessionHref, nextSessionHref } from '@/lib/checklist/sessions';
import { chapterInfoForSession } from '@/lib/checklist/chapters';

// The shared shell for the 3-session flow added in task #381 (see lib/checklist/sessions.ts for the
// full scope note): a "Session X of N" nav bar with progress pills and Back/Next, the persistent
// readiness/still-missing/save-progress sidebar from Phase 1, and a slot for whatever that specific
// session's own page already renders. Session content itself (StatementCheck, FinancialCalculator,
// CountryChecklistApp's checklist view) is unchanged by this — only the page-level wrapper around
// it moved here so switching between sessions feels continuous instead of like 3 unrelated pages.
export type SessionShellProps = {
  code: string;
  name: string;
  session: SessionKey;
  children: ReactNode;
};

export default function SessionShell({ code, name, session, children }: SessionShellProps) {
  const { checklist, answers, checked } = useChecklistState(code);
  // Built fresh per render from this country's own catOrder length (task #383 — sessions 8-13 are
  // now real per-category sessions, and every country's category list is a different length/set of
  // names, so this can't be a fixed array — see lib/checklist/sessions.ts).
  const order = buildSessionOrder(code);
  const idx = order.findIndex((s) => s.key === session);
  const total = order.length;
  // Tester feedback (forwarded WhatsApp message, verbatim): "the sites process looks too long Like
  // too many questions." The flat "Session 1 of 18" framing below was honest but discouraging before
  // the applicant even started — a 6-category document checklist pushes the raw count well past what
  // "18 sessions" sounds like once you're actually moving through them. chapterInfoForSession groups
  // the SAME underlying flat `order` (unchanged — buildSessionOrder and its locked-down test
  // assertions aren't touched) into a small, fixed number of named chapters (6, regardless of how
  // many document-checklist categories this country has), so the headline number the applicant sees
  // first stays small and constant across every country. See lib/checklist/chapters.ts for the full
  // rationale, including why this is a step count and not a fabricated time estimate.
  const chapter = chapterInfoForSession(order, idx);
  const prev = prevSessionHref(code, session);
  const next = nextSessionHref(code, session);
  // Task #418 (direct request): "move 'still missing' to the last session" — the sidebar is
  // persistent across every session (rendered below), so this only turns it on once the applicant
  // reaches the flow's actual last session ('reasons') rather than repeating it on every page.
  const isLastSession = idx === total - 1;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 p-6 pb-16 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {/* Homepage-mockup restyle: warm cream-tinted bar (was a cool blue-white, #f7fafb) so the
            sticky chrome on every session matches the new cream/green palette. */}
        <div className="sticky top-0 z-10 -mx-6 border-b border-black/10 bg-cream-soft/95 px-6 py-3 backdrop-blur lg:mx-0 lg:rounded-lg lg:border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#566a76]">
                Step {chapter.chapterIndex + 1} of {chapter.chapterCount}:{' '}
                <span className="font-semibold text-[#12232e]">{chapter.chapterLabel}</span>
              </p>
              {/* Secondary line — keeps the exact page identity visible (same label this bar always
                  showed) and, inside the document-checklist chapter where this actually varies by
                  country, shows the applicant's real position within that chapter ("category 2 of
                  6") without that number dominating the headline above it. */}
              <p className="mt-0.5 text-[11px] text-[#8a97a0]">
                {chapter.subLabel}
                {chapter.subPosition ? ` · ${chapter.subPosition.index} of ${chapter.subPosition.count}` : ''}
              </p>
            </div>
            {/* Task #391 (mobile audit): this used to be a `fixed bottom-5 right-5` pill that stayed
                on screen during scroll, matching the original's own persistent floating "Reasons"
                tab — but "fixed" meant it sat over whatever content happened to be in that screen
                corner at any scroll position, not just the very end of the page (padding at the
                bottom of <main> only helps the LAST scroll position, not the ones passing through).
                Confirmed overlapping the sidebar's "Still missing" list, "Export progress" button,
                and readiness score bar on both mobile and narrower desktop widths, where the sidebar
                sits directly under this same bottom-right corner. Moved into this sticky top bar's
                own row instead: still visible at every scroll position (the bar itself is
                `sticky top-0`), but as part of the row's normal flow rather than floating over
                whatever's beneath it — so it can never cover another interactive element again,
                on any viewport width. */}
            {session !== 'reasons' && (
              <Link
                href={`/checklist/${code.toLowerCase()}/reasons`}
                className="shrink-0 whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                📖 Reasons
              </Link>
            )}
          </div>
          <div className="mt-2 flex gap-1.5">
            {order.map((s, i) => (
              <Link
                key={s.key}
                href={s.href(code)}
                aria-current={i === idx ? 'step' : undefined}
                aria-label={s.label}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= idx ? 'bg-accent' : 'bg-black/10'}`}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {prev ? (
              <Link
                href={prev}
                className="rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-[#12232e]"
              >
                ← Back
              </Link>
            ) : (
              <span className="rounded-md border border-black/5 px-4 py-2 text-sm font-semibold text-black/20">
                ← Back
              </span>
            )}
            {next ? (
              <Link href={next} className="btn-primary flex-1 text-center">
                Next →
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </div>
        </div>

        {children}

        {/* Task #421 (save/report-by-email redesign): moved out of ChecklistSidebar's <aside> and
            into the page content itself, per the confirmed "apply to all pages" placement — this
            renders beneath every session's own content, not in the sidebar. */}
        <SaveProgressPanel code={code} answers={answers} checked={checked} />

        {/* Task #537/#538 (direct request, following the UX audit): replaces the "share with 50
            people" one-off poll idea with an ongoing on-site mechanism — real applicants leave honest
            feedback as they actually use the live site. Same non-floating placement convention as
            SaveProgressPanel directly above (task #391's anti-overlap fix), collapsed by default so it
            never competes with the Back/Next nav for attention. */}
        <SiteFeedbackPanel countryCode={code} />
      </div>

      <ChecklistSidebar
        code={code}
        name={name}
        checklist={checklist}
        answers={answers}
        checked={checked}
        showStillMissing={isLastSession}
      />
    </main>
  );
}
