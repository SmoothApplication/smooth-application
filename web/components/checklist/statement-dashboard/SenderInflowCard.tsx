'use client';

import { SenderInflowGroup, FlaggedReasonMode, UNEXPLAINED_REASON_OPTIONS } from '@/lib/statement';
import { formatAmount } from './shared';

export function SenderInflowCard({
  sg,
  mode,
  setMode,
  choice,
  setChoice,
  otherText,
  setOther,
}: {
  sg: SenderInflowGroup;
  mode: FlaggedReasonMode;
  setMode: (v: 'same' | 'different') => void;
  choice: Record<string, string>;
  setChoice: (key: string, value: string) => void;
  otherText: Record<string, string>;
  setOther: (key: string, value: string) => void;
}) {
  const hasMultipleSubGroups = sg.subGroups.length > 1;

  function ReasonDropdown({ forKey }: { forKey: string }) {
    const selected = choice[forKey] || '';
    return (
      <div className="mt-2">
        <label className="mb-1 block text-xs font-medium text-[#566a76]">What was this for?</label>
        <select
          value={selected}
          onChange={(e) => setChoice(forKey, e.target.value)}
          className="w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-[#12232e]"
        >
          <option value="">Choose a reason…</option>
          {UNEXPLAINED_REASON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {selected === 'other' && (
          <textarea
            value={otherText[forKey] || ''}
            onChange={(e) => setOther(forKey, e.target.value)}
            rows={2}
            placeholder="Describe what this was for…"
            className="mt-1.5 w-full rounded-lg border border-black/10 px-2 py-1.5 text-xs text-[#12232e]"
          />
        )}
        {selected && (selected !== 'other' || (otherText[forKey] || '').trim()) && (
          <p role="status" className="mt-1 text-xs font-medium text-green-700">✓ Saved on this device</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-black/10 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[#12232e]">{sg.senderLabel}</p>
        <p className="text-xs text-[#566a76]">
          {sg.count} payment{sg.count === 1 ? '' : 's'} = {formatAmount(sg.total)}
        </p>
      </div>

      {hasMultipleSubGroups && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-[#566a76]">Is this for the same purpose?</span>
          <div className="flex overflow-hidden rounded-full border border-black/10">
            <button
              type="button"
              onClick={() => setMode('same')}
              className={`px-3 py-1 font-medium ${mode === 'same' ? 'bg-accent text-white' : 'bg-white text-[#566a76]'}`}
            >
              Same purpose
            </button>
            <button
              type="button"
              onClick={() => setMode('different')}
              className={`px-3 py-1 font-medium ${mode === 'different' ? 'bg-accent text-white' : 'bg-white text-[#566a76]'}`}
            >
              Different purposes
            </button>
          </div>
        </div>
      )}

      {mode === 'same' ? (
        <>
          {/* Direct user report (screenshot, live): a sender with several payments — 4 from
              "Xpedite Global Concept" in the reported case — used to dump every (month, amount)
              line into one run-on semicolon-separated sentence, which got hard to read once a
              sender had more than a couple of payments. Any sender with more than one distinct
              line now collapses behind a "View N payments" toggle instead, closed by default; a
              sender with only one line (nothing to collapse) still shows it plainly. */}
          {sg.subGroups.length > 1 ? (
            <details className="mt-2 text-xs text-[#566a76]">
              <summary className="cursor-pointer font-medium text-accent">
                View {sg.subGroups.length} payments
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1">
                {sg.subGroups.map((g) => (
                  <li key={g.key}>
                    {g.month} · {formatAmount(g.amount)} × {g.count}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="mt-2 text-xs text-[#566a76]">
              {sg.subGroups.map((g) => (
                <span key={g.key}>
                  {g.month} · {formatAmount(g.amount)} × {g.count}
                </span>
              ))}
            </p>
          )}
          <ReasonDropdown forKey={sg.senderKey} />
        </>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {sg.subGroups.map((g) => (
            <div key={g.key} className="rounded-lg bg-black/[0.02] p-2">
              <p className="text-xs text-[#566a76]">
                {g.month} · {formatAmount(g.amount)} × {g.count} = {formatAmount(g.total)}
              </p>
              <ReasonDropdown forKey={g.key} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
