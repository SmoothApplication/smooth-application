'use client';

import { useEffect } from 'react';
import { COUNTRIES } from '@/lib/checklist/countries';
import { computeRequiredPercent, missingRequiredItems } from '@/lib/checklist/uk';
import { useEditableChecklistState } from '@/lib/checklist/useEditableChecklistState';
import SessionShell from '@/components/checklist/SessionShell';

// Task #386 (Final review/declaration session, the last piece of the original 14-session ground
// truth — see lib/checklist/sessions.ts's header comment): port of the original's "review" session,
// which bundles three cards under one session (confirmed directly off the live original's own
// markup/JS, not guessed): an "Are you ready?" summary of required documents still missing
// (verbatim reuse of missingRequiredItems/computeRequiredPercent from lib/checklist/uk.ts — the same
// helpers ChecklistSidebar.tsx's own "Still missing" card already uses, so the two never disagree),
// a static "Documents best avoided as sole evidence" note, and the Declaration form itself
// (decl_name/decl_date/decl_confirm in the original) with a live "Declared by X on Y" confirmation
// message once all three fields are filled — same wording/logic as the original's updateDeclaration().
//
// decl_date defaults to today's date on first load, same as the original's todayStr() default —
// only applied once (when declarationDate is still empty), so navigating back to an already-filled
// declaration never overwrites what the applicant chose.
export type FinalReviewSessionProps = {
  code: string;
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function FinalReviewSession({ code }: FinalReviewSessionProps) {
  const { checklist, answers, setAnswers, checked, loaded } = useEditableChecklistState(code);
  const country = COUNTRIES.find((c) => c.code === code.toUpperCase());
  const name = country?.name ?? code;
  const visaName = country?.visaName ?? 'checklist';

  useEffect(() => {
    if (loaded && !answers.declarationDate) {
      setAnswers((prev) => ({ ...prev, declarationDate: todayStr() }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!loaded) return null;

  const requiredPct = computeRequiredPercent(checklist, answers, checked);
  const missing = missingRequiredItems(checklist, answers, checked);
  const requiredCount = checklist.filter((it) => it.weight === 'required').length;

  const { declarationName, declarationDate, declarationConfirmed } = answers;
  const declared = declarationName.trim() && declarationDate && declarationConfirmed;
  const declarationPartial = !declared && (declarationName.trim() || declarationDate || declarationConfirmed);
  const declaredPretty = declared
    ? new Date(`${declarationDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  // Same free, on-device mailto: draft as the original's "Email myself this summary" (buildPayload's
  // sibling in index.html) and this port's own buildEmailReminderHref (lib/checklist/resumeReminder.ts)
  // — a real <a href="mailto:...">, not a click handler doing location.href, since that pattern was
  // already found broken on phones with no mail app configured (see resumeReminder.ts's own comment).
  const emailLines = [
    `Your Smooth Application checklist status — ${new Date().toLocaleDateString()}`,
    '',
    `Visa: ${visaName}`,
    `Document readiness: ${requiredPct}%`,
    '',
    ...(missing.length
      ? [`Still missing (${missing.length} of ${requiredCount} required):`, ...missing.map((it) => `- ${it.label}`)]
      : ['All required documents are checked off.']),
  ];
  const emailHref =
    'mailto:?subject=' +
    encodeURIComponent(`Smooth Application — your ${visaName} checklist status`) +
    '&body=' +
    encodeURIComponent(emailLines.join('\n'));

  return (
    <SessionShell code={code} name={name} session="final-review">
      <div className="flex flex-col gap-4">
        <section className="rounded-lg border-l-4 border-l-accent border border-black/10 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-[#12232e]">Are you ready?</h2>
          {requiredCount === 0 ? (
            <p className="text-sm text-[#4c6270]">
              Fill in your earlier sessions to see your personalized checklist here.
            </p>
          ) : missing.length === 0 ? (
            <p className="text-sm text-[#4c6270]">
              ✅ <b>Yes — all {requiredCount} required document(s) are checked off.</b> Double-check the
              &quot;avoid&quot; list below and your financial-readiness figures, and you&apos;re set to move on to
              the formal application steps.
            </p>
          ) : (
            <>
              <p className="text-sm text-[#4c6270]">
                ⚠️ <b>Not yet — {missing.length} of {requiredCount} required document(s) still need attention:</b>
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {missing.map((it) => (
                  <li key={it.id}>
                    <a href={`/checklist/${code.toLowerCase()}#item_${it.id}`} className="text-accent underline">
                      {it.label}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <a
            href={emailHref}
            className="mt-3 inline-block rounded-lg border border-black/10 px-4 py-2.5 text-sm font-semibold text-[#12232e]"
          >
            ✉️ Email myself this summary
          </a>
          <p className="mt-1 text-xs text-[#4c6270]">
            Opens a draft in your own email app, already filled in — you send it to yourself. Nothing is sent
            anywhere by this tool; it never leaves your device until you hit send.
          </p>
        </section>

        <details className="rounded-lg border-l-4 border-l-[#5b6b7a] border border-black/10 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#12232e]">
            🚫 Documents best avoided as sole evidence
          </summary>
          <p className="mt-2 text-sm text-[#4c6270]">
            Caseworkers across most visa systems give little weight to these on their own — use them only
            alongside stronger evidence above: <b>credit card statements</b> (not bank statements),{' '}
            <b>driving licence</b> as identity proof, <b>flight/hotel bookings alone</b> as proof of ties,{' '}
            <b>photocopies</b> where an original is reasonably available, and <b>leisure or short-course
            certificates</b> unrelated to your visit purpose.
          </p>
        </details>

        <section className="rounded-lg border-l-4 border-l-[#4a5d8a] border border-black/10 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#12232e]">✍️ Declaration</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-[#12232e]">Full name</span>
              <input
                type="text"
                value={declarationName}
                onChange={(e) => setAnswers({ ...answers, declarationName: e.target.value })}
                placeholder="e.g. Adaeze Grace Nnamdi"
                className="rounded border border-black/10 px-2 py-1.5 text-sm text-[#12232e]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#12232e]">Date</span>
              <input
                type="date"
                value={declarationDate}
                onChange={(e) => setAnswers({ ...answers, declarationDate: e.target.value })}
                className="rounded border border-black/10 px-2 py-1.5 text-sm text-[#12232e]"
              />
            </label>
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-[#12232e]">
            <input
              type="checkbox"
              checked={declarationConfirmed}
              onChange={(e) => setAnswers({ ...answers, declarationConfirmed: e.target.checked })}
              className="mt-0.5"
            />
            I confirm the information I&apos;ve entered in this checklist is accurate to the best of my knowledge.
          </label>
          {declared && (
            <p className="mt-2 text-sm font-medium text-good">
              ✅ Declared by {declarationName} on {declaredPretty}.
            </p>
          )}
          {declarationPartial && (
            <p className="mt-2 text-sm text-warn-text">
              Add your full name, the date, and tick the confirmation box to complete your declaration.
            </p>
          )}
        </section>
      </div>
    </SessionShell>
  );
}
