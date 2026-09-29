'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Answers,
  ChecklistItem,
  computeRequiredPercent,
  missingRequiredItems,
  requiredStatus,
} from '@/lib/checklist/uk';
import {
  DEFAULT_FINANCIAL_INPUTS,
  FinancialInputs,
  computeFinanceReadiness,
  computeFinancials,
} from '@/lib/checklist/financial';

// Phase 1 of the checklist session/sidebar rebuild (task #380 — user compared the live site
// against the original GitHub Pages site and asked to match its real structure: a persistent
// "Readiness scores" / "Still missing" / "Save your progress" sidebar, not just a sticky top bar).
// Ported here, self-contained, ahead of the larger Phase 2 restructuring into numbered sessions —
// see lib/checklist/uk.ts (computeRequiredPercent/requiredStatus/missingRequiredItems) and
// lib/checklist/financial.ts (computeFinanceReadiness) for the ported scoring formulas themselves.
//
// Task #421 (save/report-by-email redesign, direct request): the "Save your progress" card that
// used to live here (window.print() + JSON export) has moved out into SaveProgressPanel.tsx,
// rendered in the page content beneath each session instead of in this sidebar — see that
// component and SessionShell.tsx/CountryChecklistApp.tsx for where it's now wired in. This sidebar
// is Readiness scores + Still missing only from here on.
//
// Deliberately NOT ported yet, disclosed rather than faked: dark mode (a sitewide theming feature,
// out of scope for a checklist-page component), the statement-verification half of the Finances
// score's "evidence" check (needs cross-page state Phase 2's session rebuild is the right place to
// wire up), and the WhatsApp/email waitlist card (a separate, already-shipped feature elsewhere).
export type ChecklistSidebarProps = {
  code: string;
  name: string;
  checklist: ChecklistItem[];
  answers: Answers;
  checked: Record<string, boolean>;
  /** Task #418 (direct request, screenshot): "move 'still missing' to the last session" — this
   * sidebar is persistent across every numbered session (see SessionShell.tsx), so showing "Still
   * missing" on all of them repeated the same list on every single page before the applicant had
   * even reached the document checklist. SessionShell now only passes true here on the flow's last
   * session ('reasons'). Defaults to true so CountryChecklistApp's own flat "everything on one page"
   * view (not part of the numbered flow, so there's no "last session" to gate on) keeps showing it
   * unconditionally, same as before this change. */
  showStillMissing?: boolean;
};

function toneClasses(tone: 'neutral' | 'critical' | 'serious' | 'warning' | 'good') {
  switch (tone) {
    case 'good':
      return { bar: 'bg-good', pill: 'bg-good-wash text-good' };
    case 'warning':
      return { bar: 'bg-accent', pill: 'bg-accent-wash text-accent' };
    case 'serious':
      return { bar: 'bg-warn-text', pill: 'bg-warn-wash text-warn-text' };
    case 'critical':
      return { bar: 'bg-warn-text', pill: 'bg-warn-wash text-warn-text' };
    default:
      return { bar: 'bg-black/20', pill: 'bg-black/5 text-[#566a76]' };
  }
}

export default function ChecklistSidebar({ code, name, checklist, answers, checked, showStillMissing = true }: ChecklistSidebarProps) {
  const financialKey = `sa_${code.toLowerCase()}_financial`;
  const [financialInputs, setFinancialInputs] = useState<FinancialInputs | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(financialKey);
      if (raw) setFinancialInputs({ ...DEFAULT_FINANCIAL_INPUTS, ...JSON.parse(raw) });
    } catch {
      /* no financial data saved yet — sidebar shows the neutral "Enter your figures" state */
    }
  }, [financialKey]);

  const docsPct = useMemo(() => computeRequiredPercent(checklist, answers, checked), [checklist, answers, checked]);
  const docsStatus = requiredStatus(docsPct);
  const docsTone = toneClasses(docsStatus.tone);

  const missing = useMemo(() => missingRequiredItems(checklist, answers, checked), [checklist, answers, checked]);

  const finResult = useMemo(() => computeFinancials(financialInputs ?? DEFAULT_FINANCIAL_INPUTS), [financialInputs]);
  const finReadiness = useMemo(() => computeFinanceReadiness(finResult), [finResult]);
  const finEntered = finResult.totalCost > 0;
  const finTone = !finEntered
    ? toneClasses('neutral')
    : finReadiness.percent >= 100
    ? toneClasses('good')
    : finReadiness.percent >= 50
    ? toneClasses('warning')
    : toneClasses('critical');
  const finLabel = !finEntered
    ? 'Enter your figures'
    : finReadiness.percent >= 100
    ? 'Looking solid'
    : finReadiness.percent >= 50
    ? 'Needs attention'
    : 'Below threshold';

  return (
    <aside className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
      <div className="card-surface p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#566a76]">Readiness scores</p>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[#12232e]">Documents</span>
            <span className="font-semibold text-[#12232e]">{docsPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
            <div className={`h-full rounded-full ${docsTone.bar} transition-all`} style={{ width: `${docsPct}%` }} />
          </div>
          <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${docsTone.pill}`}>
            {docsStatus.label}
          </span>
        </div>

        <div className="mt-4 border-t border-black/10 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[#12232e]">Finances</span>
            <span className="font-semibold text-[#12232e]">{finReadiness.percent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
            <div className={`h-full rounded-full ${finTone.bar} transition-all`} style={{ width: `${finReadiness.percent}%` }} />
          </div>
          <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${finTone.pill}`}>{finLabel}</span>
          {finReadiness.capped && (
            <p className="mt-2 text-xs text-[#566a76]">
              ⚠️ Capped at 50% — this is a self-typed closing balance, not yet checked against a real statement. Fill in
              at least 2 months of cash flow in the financial calculator to unlock the full score.
            </p>
          )}
        </div>
      </div>

      {showStillMissing && (
        <details className="card-surface p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-[#12232e]">
            Still missing {missing.length > 0 && <span className="text-[#566a76]">({missing.length})</span>}
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {missing.length === 0 ? (
              <li className="text-[#4c6270]">
                {docsPct === 0 ? 'Fill in your checklist above to see what still applies.' : 'Nothing outstanding — nicely done.'}
              </li>
            ) : (
              missing.map((item) => (
                <li key={item.id}>
                  <a href={`#item_${item.id}`} className="text-accent underline">
                    {item.label}
                  </a>
                </li>
              ))
            )}
          </ul>
        </details>
      )}
    </aside>
  );
}
