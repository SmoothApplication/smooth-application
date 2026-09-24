'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Answers, DEFAULT_ANSWERS, ChecklistItem, itemApplies } from '@/lib/checklist/uk';
import { ALL_CHECKLISTS } from '@/lib/checklist/all';

// Phase 4c of task #244: a simplified port of index.html's "Reasons" tab/modal — the end-of-flow
// explanation of WHY each document is asked for. index.html's version sweeps a much wider set of
// standalone explanatory paragraphs (data-reason=1 markup) scattered across ~14 different
// sessions into one place; this version covers the equivalent ground for what's actually been
// ported so far — every checklist item's own "Why?" tip, grouped by category, filtered to the
// items that currently apply to the applicant's answers (same itemApplies() used by the checklist
// body) so it reads as a personal explanation, not a generic dump of every possible document.
export type ReasonsViewProps = {
  code: string;
  flag: string;
  name: string;
  visaName: string;
  answersKey: string;
  checkedKey: string;
  backHref: string;
};

export default function ReasonsView({ code, flag, name, visaName, answersKey, checkedKey, backHref }: ReasonsViewProps) {
  // Looked up here (inside this Client Component) rather than passed as a prop — see the comment
  // at the top of lib/checklist/all.ts for why passing ChecklistItem[] as a prop broke the build.
  const { catOrder, checklist } = ALL_CHECKLISTS[code] ?? { catOrder: [], checklist: [] as ChecklistItem[] };
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const a = localStorage.getItem(answersKey);
      const c = localStorage.getItem(checkedKey);
      if (a) setAnswers({ ...DEFAULT_ANSWERS, ...JSON.parse(a) });
      if (c) setChecked(JSON.parse(c));
    } catch {
      /* nothing saved yet */
    }
    setLoaded(true);
  }, [answersKey, checkedKey]);

  const grouped = useMemo(() => {
    return catOrder
      .map((cat) => ({
        cat,
        items: checklist.filter((it) => it.cat === cat && itemApplies(it, answers) && it.tip),
      }))
      .filter((g) => g.items.length > 0);
  }, [catOrder, checklist, answers]);

  if (!loaded) return null;

  const totalApplicable = checklist.filter((it) => itemApplies(it, answers)).length;
  const totalChecked = checklist.filter((it) => itemApplies(it, answers) && checked[it.id]).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">
          📖 {flag} Why these documents
        </h1>
        <p className="mt-1 text-sm text-[#4c6270]">
          The reasoning behind every document on your {name} {visaName} checklist — {totalChecked} of {totalApplicable} already ticked off.
        </p>
      </div>

      {grouped.length === 0 && (
        <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-[#4c6270]">
          Fill in your qualifying questions on the checklist first — this page explains the documents once they apply to you.
        </div>
      )}

      {grouped.map((g) => (
        <section key={g.cat} className="rounded-lg border border-black/10 bg-white">
          <h2 className="border-b border-black/10 px-4 py-3 text-sm font-semibold text-[#12232e]">{g.cat}</h2>
          <ul className="divide-y divide-black/5">
            {g.items.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${checked[item.id] ? 'text-good' : 'text-[#12232e]'}`}>
                    {checked[item.id] ? '✓ ' : ''}
                    {item.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      item.weight === 'required' ? 'bg-warn-wash text-warn-text' : 'bg-accent-wash text-accent'
                    }`}
                  >
                    {item.weight === 'required' ? 'Required' : 'Recommended'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#4c6270]">{item.tip}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Link href={backHref} className="text-center text-xs text-accent underline">
        ← Back to checklist
      </Link>
    </main>
  );
}
