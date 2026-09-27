'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import ChecklistSidebar from '@/components/checklist/ChecklistSidebar';
import { useChecklistState } from '@/lib/checklist/useChecklistState';
import { SESSION_ORDER, SessionKey, sessionIndex, prevSessionHref, nextSessionHref } from '@/lib/checklist/sessions';

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
  const idx = sessionIndex(session);
  const total = SESSION_ORDER.length;
  const prev = prevSessionHref(session, code);
  const next = nextSessionHref(session, code);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 p-6 pb-16 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="sticky top-0 z-10 -mx-6 border-b border-black/10 bg-[#f7fafb]/95 px-6 py-3 backdrop-blur lg:mx-0 lg:rounded-lg lg:border">
          <p className="text-xs font-medium text-[#566a76]">
            Session {idx + 1} of {total}:{' '}
            <span className="font-semibold text-[#12232e]">{SESSION_ORDER[idx]?.label}</span>
          </p>
          <div className="mt-2 flex gap-1.5">
            {SESSION_ORDER.map((s, i) => (
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
      </div>

      <ChecklistSidebar code={code} name={name} checklist={checklist} answers={answers} checked={checked} />

      {/* Reasons was only ever reachable from the checklist session's own header row before this
          shell existed — now that Statement/Financial are earlier sessions in the same flow, an
          applicant landing on Session 1 had no way to reach it at all. Matches the original's own
          persistent floating "Reasons" tab, visible from every session regardless of scroll
          position. */}
      <Link
        href={`/checklist/${code.toLowerCase()}/reasons`}
        className="fixed bottom-5 right-5 z-20 rounded-full bg-[#12232e] px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-90"
      >
        📖 Why these documents
      </Link>
    </main>
  );
}
