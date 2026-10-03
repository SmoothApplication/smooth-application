'use client';

import { useMemo, useState } from 'react';
import {
  ParsedTxn,
  SourceGroup,
  SourceGroups,
  TopConsistentSender,
  isReversalNarration,
  classifySourceType,
  senderPairKey,
  MonthlyCashFlowRow,
  researchNoteKey,
  splitSalaryForSheet,
} from '@/lib/statement';
import { formatAmount, formatDate } from './shared';
import { SourceGroupCard } from './SourceGroupCard';

export function AnalysisTab({
  view,
  groups,
  topSenders,
  topInflows,
  cashFlowRows,
  breakdownEmailOpen,
  onOpenBreakdownEmail,
  breakdownEmail,
  setBreakdownEmail,
  onSendBreakdownEmail,
  sendingBreakdownEmail,
  breakdownEmailError,
  breakdownEmailSent,
  displayName,
  editingName,
  editValue,
  setEditValue,
  startEditingName,
  saveNameCorrection,
  cancelEditingName,
  isExpanded,
  toggleExpanded,
  explanations,
  setExplanation,
  resolveSenderDuplicate,
}: {
  /** Which part to show: 'income' (non-workplace source cards), 'workplace' (salary/allowance cards),
   * 'lists' (income summary, Top 10 inflows, Top 10 senders - the flat Report lists). */
  view: 'income' | 'workplace' | 'lists';
  groups: SourceGroups;
  topSenders: {
    list: TopConsistentSender[];
    pendingDuplicates: { nameA: string; nameB: string; key: string; shared: string[] }[];
  };
  topInflows: ParsedTxn[];
  cashFlowRows: MonthlyCashFlowRow[];
  breakdownEmailOpen: boolean;
  onOpenBreakdownEmail: () => void;
  breakdownEmail: string;
  setBreakdownEmail: (v: string) => void;
  onSendBreakdownEmail: () => void;
  sendingBreakdownEmail: boolean;
  breakdownEmailError: string | null;
  breakdownEmailSent: boolean;
  displayName: (rawName: string) => string;
  editingName: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  startEditingName: (rawName: string) => void;
  saveNameCorrection: (rawName: string) => void;
  cancelEditingName: () => void;
  isExpanded: (g: SourceGroup) => boolean;
  toggleExpanded: (g: SourceGroup) => void;
  explanations: Record<string, string>;
  setExplanation: (rawName: string, value: string) => void;
  resolveSenderDuplicate: (key: string, decision: 'merge' | 'separate') => void;
}) {
  // Direct instruction: "do a total for [Top 10 senders], then a ratio of the total from the top
  // senders to the total you have in your bank account within the six months. If those top senders
  // do above 50% of your inflow, we'll take it as good to go." totalInflow6mo is recomputed from
  // cashFlowRows (the same 6-month window already driving the Report tab's own totals) rather than
  // passed down as an already-summed number, so this can never drift from that other total.
  // Once the Salary / Allowances cards above are filled in, the employer needs no "who is this?" prompt:
  // that sender's payments are exactly the ones those cards already explain.
  const salaryGroupsExplained = splitSalaryForSheet(groups).filter((g) => g.type === 'salary' && !!explanations[g.name]);
  const coveredBySalary = (senderName: string) =>
    salaryGroupsExplained.some((g) => g.txns.some((t) => (t.narration || '').toUpperCase().includes(senderName.toUpperCase())));
  // The employer is already shown (and explained) in the Salary / Allowances cards, so it is left out of the
  // Top 10 table, its total and the concentration check below (employer pay is taken out of both sides).
  const shownSenders = topSenders.list.filter((s) => !coveredBySalary(s.name));
  const employerPay = salaryGroupsExplained.reduce((s, g) => s + g.total, 0);
  const topSendersTotal = shownSenders.reduce((s, x) => s + x.total, 0);
  const totalInflow6mo = cashFlowRows.reduce((s, r) => s + r.inflow, 0) - employerPay;
  const topSendersRatio = totalInflow6mo > 0 ? topSendersTotal / totalInflow6mo : 0;
  const topSendersGood = topSendersRatio >= 0.5;

  // Direct instruction: "create where we can arrange the names alphabetically or the amount in
  // highest or lowest form" — sorting this table only ever changes display order, never the
  // underlying topSenders.list the totals/ratio/duplicate-merge logic above and below still read
  // from, so re-sorting can't silently change what counts as "good to go" or which senders show up
  // in the 6-months-recurring warning further down.
  const [senderSort, setSenderSort] = useState<{ key: 'name' | 'total'; dir: 'asc' | 'desc' } | null>(
    null
  );

  function toggleSenderSort(key: 'name' | 'total') {
    setSenderSort((prev) => {
      if (prev && prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      // Sensible first click per column: names read naturally A→Z, amounts read naturally
      // highest-first (matching the table's original default order).
      return { key, dir: key === 'name' ? 'asc' : 'desc' };
    });
  }

  const sortedSenders = useMemo(() => {
    if (!senderSort) return topSenders.list;
    const list = [...topSenders.list];
    list.sort((a, b) => {
      const cmp =
        senderSort.key === 'name'
          ? displayName(a.name).localeCompare(displayName(b.name))
          : a.total - b.total;
      return senderSort.dir === 'asc' ? cmp : -cmp;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topSenders.list, senderSort]);

  function sortArrow(key: 'name' | 'total') {
    if (!senderSort || senderSort.key !== key) return '';
    return senderSort.dir === 'asc' ? ' ▲' : ' ▼';
  }

  return (
    <div className="flex flex-col gap-5">
      {view === 'workplace' && groups.missingSalaryMonths && groups.missingSalaryMonths.length > 0 && (
        <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text">
          Salary looks recurring, but no payment was found for: <b>{groups.missingSalaryMonths.join(', ')}</b>.
          Worth double-checking those months, or explaining the gap.
        </div>
      )}

      {view === 'lists' && (
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-[#12232e]">Income sources</h2>
          <p className="mb-3 text-xs text-[#566a76]">Who paid you, and how much, over this statement.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-[#566a76]">
                  <th className="py-2 pr-2">Source</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2 text-right">Payments</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {splitSalaryForSheet(groups)
                  .filter((g) => !['self', 'reversal', 'interest', 'internal'].includes(g.type))
                  .map((g) => (
                    <tr key={g.name} className="border-b border-black/5">
                      <td className="py-2 pr-2 text-[#12232e]">{displayName(g.name)}</td>
                      <td className="py-2 pr-2 text-[#566a76]">{g.type === 'salary' ? 'Employer' : g.type}</td>
                      <td className="py-2 pr-2 text-right text-[#12232e]">{g.count}</td>
                      <td className="py-2 text-right font-medium text-[#12232e]">{formatAmount(g.total)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view !== 'lists' && (
      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-[#12232e]">
          {view === 'workplace' ? 'Salary and allowances from your employer' : 'Income sources'}
        </h2>
        <p className="mb-4 text-xs text-[#566a76]">
          {view === 'workplace'
            ? 'Your employer pays are filled in for you. Check them, and add a note if a payment needs explaining.'
            : 'Every other credit on this statement, grouped by who (or what) it came from. Employer pay is under Workplace income.'}
        </p>
        {groups.filter((g) => g.type === 'self').length > 0 && (
          <p className="mb-2 text-xs text-[#566a76]">
            {formatAmount(groups.filter((g) => g.type === 'self').reduce((a, g) => a + g.total, 0))} moved between your own accounts is left out below - it is not income.
          </p>
        )}
        {groups.length === 0 ? (
          <p className="text-sm text-[#566a76]">No credits were found on this statement.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {splitSalaryForSheet(groups).filter((g) => g.type !== 'self' && (view === 'workplace' ? g.type === 'salary' : g.type !== 'salary')).map((g) => (
              <SourceGroupCard
                key={g.name}
                group={g}
                displayName={displayName}
                editingName={editingName}
                editValue={editValue}
                setEditValue={setEditValue}
                startEditingName={startEditingName}
                saveNameCorrection={saveNameCorrection}
                cancelEditingName={cancelEditingName}
                expanded={isExpanded(g)}
                onToggle={() => toggleExpanded(g)}
                explanation={explanations[g.name] || ''}
                setExplanation={(v) => setExplanation(g.name, v)}
                researchNote={explanations[researchNoteKey(g.name)] || ''}
                setResearchNote={(v) => setExplanation(researchNoteKey(g.name), v)}
              />
            ))}
          </div>
        )}
        {view === 'income' && groups.length > 0 && !breakdownEmailOpen && (
          <button
            type="button"
            onClick={onOpenBreakdownEmail}
            className="mt-4 rounded-lg border border-black/10 px-3 py-2 text-xs font-medium text-[#12232e] hover:bg-black/5"
          >
            ⬇️ Download breakdown as spreadsheet
          </button>
        )}
        {view === 'income' && breakdownEmailOpen && (
          <div className="mt-4 rounded-lg border border-black/10 bg-black/[0.02] p-4">
            {breakdownEmailSent ? (
              <p className="text-sm text-good">
                ✅ Sent — check <b>{breakdownEmail}</b> for the spreadsheet (and your spam folder,
                just in case).
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-[#566a76]">
                  Enter your email and we&apos;ll send the income breakdown spreadsheet there.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    value={breakdownEmail}
                    onChange={(e) => setBreakdownEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="min-w-[14rem] flex-1 rounded-lg border border-black/10 px-2 py-1.5 text-sm text-[#12232e]"
                  />
                  <button
                    type="button"
                    onClick={onSendBreakdownEmail}
                    disabled={sendingBreakdownEmail}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {sendingBreakdownEmail ? 'Sending…' : 'Send to my email'}
                  </button>
                </div>
                {breakdownEmailError && (
                  <p className="mt-2 text-xs text-red-800">{breakdownEmailError}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
      )}

      {view === 'lists' && topInflows.length > 0 && (
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-[#12232e]">
              Top {topInflows.length} inflow{topInflows.length === 1 ? '' : 's'}
            </h2>
            <p className="mb-4 mt-1 text-xs text-[#566a76]">
              The single biggest payments in, ranked by amount - not the same as Top 10 senders
              below, which ranks by how consistently someone pays you, not by size.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-[#566a76]">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2 text-right">Amount</th>
                    <th className="py-2 pr-2">Narration</th>
                    <th className="py-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {topInflows.map((t, i) => {
                    const hasNarration = !!(t.narration && t.narration.trim());
                    const tag = isReversalNarration(t)
                      ? { label: 'Reversal', className: 'bg-black/5 text-[#4c6270]' }
                      : !hasNarration
                      ? { label: 'No narration', className: 'bg-warn-wash text-warn-text' }
                      : classifySourceType(t.narration) === 'company'
                      ? { label: 'Company', className: 'bg-good-wash text-good' }
                      : { label: 'Personal', className: 'bg-black/5 text-[#4c6270]' };
                    return (
                      <tr key={i} className="border-b border-black/5">
                        <td className="py-2 pr-2 text-[#566a76]">{i + 1}</td>
                        <td className="py-2 pr-2 text-[#12232e]">{formatDate(t.date)}</td>
                        <td className="py-2 pr-2 text-right font-medium text-[#12232e]">{formatAmount(t.credit)}</td>
                        <td className="py-2 pr-2 text-[#4c6270]">{t.narration || '(none)'}</td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tag.className}`}>
                            {tag.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'lists' && (
      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-[#12232e]">Top 10 senders</h2>
        <p className="mb-4 text-xs text-[#566a76]">
          Whoever pays you most consistently - ranked by how many different months they&apos;ve sent
          money in, not just the total amount. If a name was misread, or the same person shows up
          twice under two slightly different names, fix it right here.
        </p>
        {topSenders.pendingDuplicates.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {topSenders.pendingDuplicates.map((pair) => (
              <div key={pair.key} className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text">
                <p>
                  <b>{pair.nameA}</b> and <b>{pair.nameB}</b> share the name{pair.shared.length === 1 ? '' : 's'}{' '}
                  &quot;{pair.shared.join('", "')}&quot; — is this the same person, extracted differently
                  from different narrations?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => resolveSenderDuplicate(pair.key, 'merge')}
                    className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white"
                  >
                    Same person — merge
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveSenderDuplicate(pair.key, 'separate')}
                    className="rounded-lg border border-black/10 px-3 py-1 text-xs font-medium text-[#12232e]"
                  >
                    Different people — keep separate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {shownSenders.length === 0 ? (
          <p className="text-sm text-[#566a76]">No named senders were found on this statement.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-[#566a76]">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">
                    <button
                      type="button"
                      onClick={() => toggleSenderSort('name')}
                      className="font-medium uppercase tracking-wide text-[#566a76] hover:text-accent"
                    >
                      Sender{sortArrow('name')}
                    </button>
                  </th>
                  <th className="py-2 pr-2 text-right">Distinct months</th>
                  <th className="py-2 pr-2 text-right">Payment(s)</th>
                  <th className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSenderSort('total')}
                      className="font-medium uppercase tracking-wide text-[#566a76] hover:text-accent"
                    >
                      Total{sortArrow('total')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSenders.filter((s) => !coveredBySalary(s.name)).map((s, i) => {
                  const isEditingThis = editingName === s.name;
                  const otherSenders = topSenders.list.filter((o) => o.name !== s.name);
                  return (
                    <tr key={s.name} className="border-b border-black/5">
                      <td className="py-2 pr-2 text-[#566a76]">{i + 1}</td>
                      <td className="py-2 pr-2 font-medium text-[#12232e]">
                        {isEditingThis ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              autoFocus
                              className="max-w-[10rem] rounded-lg border border-black/10 px-2 py-1 text-sm text-[#12232e]"
                            />
                            <button
                              type="button"
                              onClick={() => saveNameCorrection(s.name)}
                              className="rounded-lg bg-accent px-2 py-1 text-xs font-medium text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingName}
                              className="text-xs text-[#566a76] hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{displayName(s.name)}</span>
                            <button
                              type="button"
                              onClick={() => startEditingName(s.name)}
                              className="text-[10px] font-medium text-accent hover:underline"
                            >
                              ✏️ Fix name
                            </button>
                            {otherSenders.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    resolveSenderDuplicate(senderPairKey(s.name, e.target.value), 'merge');
                                  }
                                }}
                                className="rounded-lg border border-black/10 bg-white px-1 py-0.5 text-[10px] text-[#566a76]"
                              >
                                <option value="">🔗 Same as…</option>
                                {otherSenders.map((o) => (
                                  <option key={o.name} value={o.name}>
                                    {displayName(o.name)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right text-[#12232e]">{s.monthCount}</td>
                      <td className="py-2 pr-2 text-right text-[#12232e]">{s.count}</td>
                      <td className="py-2 text-right text-[#12232e]">{formatAmount(s.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-[#12232e]">
                  <td className="py-2 pr-2" colSpan={4}>
                    Total from these {shownSenders.length} sender{shownSenders.length === 1 ? '' : 's'}
                  </td>
                  <td className="py-2 text-right">{formatAmount(shownSenders.reduce((a, x) => a + x.total, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {/* Direct instruction, verbatim: "count the number of times a particular sender has paid the
            applicant... if somebody has sent you in six months back, there's six times and above, you
            need to ask the person: who is this, and what do you do with them... as a visa officer,
            when they see a repeated name of inflow and you cannot explain, it's a red flag." */}
        {topSenders.list.filter((s) => s.monthCount >= 6 && !coveredBySalary(s.name)).length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {topSenders.list
              .filter((s) => s.monthCount >= 6 && !coveredBySalary(s.name))
              .map((s) => {
                const key = `freq6mo__${s.name}`;
                return (
                  <div key={key} className="rounded-lg border border-warn-text/30 bg-warn-wash p-3">
                    <p className="text-sm font-medium text-warn-text">
                      ⚠️ {displayName(s.name)} paid you in {s.monthCount} of your last{' '}
                      {cashFlowRows.length || s.monthCount} months
                    </p>
                    <p className="mt-1 text-xs text-warn-text">
                      A visa officer who sees a name sending money almost every month, with no
                      explanation, tends to flag it as a red flag. Who is this, and what do you do
                      with them?
                    </p>
                    <textarea
                      value={explanations[key] || ''}
                      onChange={(e) => setExplanation(key, e.target.value)}
                      rows={2}
                      placeholder="e.g. My business partner - this is my share of our monthly proceeds, my landlord refunding a deposit in instalments, a relative I care for financially…"
                      className="mt-2 w-full rounded-lg border border-black/10 px-2 py-1.5 text-xs text-[#12232e]"
                    />
                  </div>
                );
              })}
          </div>
        )}
        {shownSenders.length > 0 && totalInflow6mo > 0 && (
          <div
            className={`mt-3 rounded-lg p-3 text-sm ${
              topSendersGood ? 'bg-good-wash text-good' : 'bg-warn-wash text-warn-text'
            }`}
          >
            {topSendersGood ? '✅' : '⚠️'} These {shownSenders.length} sender
            {shownSenders.length === 1 ? '' : 's'} account for{' '}
            <b>{Math.round(topSendersRatio * 100)}%</b> ({formatAmount(topSendersTotal)} of{' '}
            {formatAmount(totalInflow6mo)}) of your {employerPay > 0 ? 'non-employer ' : 'total '}inflow over the last{' '}
            {cashFlowRows.length} month{cashFlowRows.length === 1 ? '' : 's'}.
            {topSendersGood
              ? ' Above 50% — good to go: a reviewer can trace most of your money to a short, identifiable list of payers.'
              : ' Below 50% — your income looks spread across many smaller, less consistent payers, which can be harder for a reviewer to trace back to a clear source.'}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
