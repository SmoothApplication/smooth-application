'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import {
  ParsedTxn,
  SourceGroups,
  TopConsistentSender,
  findUnexplainedLargeInflows,
  WorkNameCheckResult,
  WorkCategoryMap,
  MonthlyCashFlowRow,
  IncomeMatchResult,
  groupFlaggedInflows,
  FlaggedInflowGroup,
  StatementSummary,
  buildFinalSummary,
  nestFlaggedGroupsBySender,
  SenderInflowGroup,
  effectiveReasonMode,
  buildActionPlan,
  ActionPlan,
} from '@/lib/statement';
import { computeFinancials, DEFAULT_FINANCIAL_INPUTS } from '@/lib/checklist/financial';
import { INCOME_VARIANCE_THRESHOLD } from '@/lib/checklist/nextSteps';
import { formatAmount, statusPill } from './shared';
import { SenderInflowCard } from './SenderInflowCard';
import { WorkNameFields } from './WorkNameFields';

export function ReportTab({
  groups,
  topSenders,
  totalIncomeIdentified,
  incomeSourceCount,
  unexplainedInflows,
  cashFlowRows,
  financialSummary,
  financialHref,
  employed,
  selfEmployed,
  employerName,
  setEmployerName,
  employerAltName,
  setEmployerAltName,
  businessName,
  setBusinessName,
  businessAltName,
  setBusinessAltName,
  employerCheck,
  businessCheck,
  employerCategoryChoices,
  setEmployerCategoryChoices,
  businessCategoryChoices,
  setBusinessCategoryChoices,
  employerDeclaredMonthlyIncome,
  setEmployerDeclaredMonthlyIncome,
  businessDeclaredMonthlyIncome,
  setBusinessDeclaredMonthlyIncome,
  employerIncomeMatch,
  businessIncomeMatch,
  applicantName,
  explanations,
  setExplanation,
  onActionPlan,
  flaggedReasonMode,
  setFlaggedMode,
  flaggedReasonChoice,
  setFlaggedChoice,
  flaggedReasonOther,
  setFlaggedOther,
  otherStatementSummary,
  statementCurrencyIssues,
}: {
  totalIncomeIdentified: number;
  incomeSourceCount: number;
  unexplainedInflows: ParsedTxn[];
  cashFlowRows: MonthlyCashFlowRow[];
  financialSummary: ReturnType<typeof computeFinancials>;
  financialHref: string;
  employed: boolean;
  selfEmployed: boolean;
  employerName: string;
  setEmployerName: (v: string) => void;
  employerAltName: string;
  setEmployerAltName: (v: string) => void;
  businessName: string;
  setBusinessName: (v: string) => void;
  businessAltName: string;
  setBusinessAltName: (v: string) => void;
  employerCheck: WorkNameCheckResult | null;
  businessCheck: WorkNameCheckResult | null;
  employerCategoryChoices: WorkCategoryMap;
  setEmployerCategoryChoices: (updater: (prev: WorkCategoryMap) => WorkCategoryMap) => void;
  businessCategoryChoices: WorkCategoryMap;
  setBusinessCategoryChoices: (updater: (prev: WorkCategoryMap) => WorkCategoryMap) => void;
  employerDeclaredMonthlyIncome: number;
  setEmployerDeclaredMonthlyIncome: (v: number) => void;
  businessDeclaredMonthlyIncome: number;
  setBusinessDeclaredMonthlyIncome: (v: number) => void;
  employerIncomeMatch: IncomeMatchResult | null;
  businessIncomeMatch: IncomeMatchResult | null;
  applicantName: string;
  explanations: Record<string, string>;
  setExplanation: (rawName: string, value: string) => void;
  onActionPlan?: (plan: ActionPlan) => void;
  flaggedReasonMode: Record<string, 'same' | 'different'>;
  setFlaggedMode: (key: string, value: 'same' | 'different') => void;
  flaggedReasonChoice: Record<string, string>;
  setFlaggedChoice: (key: string, value: string) => void;
  flaggedReasonOther: Record<string, string>;
  setFlaggedOther: (key: string, value: string) => void;
  otherStatementSummary?: StatementSummary | null;
  groups: SourceGroups;
  topSenders: {
    list: TopConsistentSender[];
    pendingDuplicates: { nameA: string; nameB: string; key: string; shared: string[] }[];
  };
  statementCurrencyIssues: ('stale' | 'short_span')[];
}) {
  const unexplainedTotal = unexplainedInflows.reduce((s, t) => s + t.credit, 0);
  const incomeStatus: 'good' | 'warn' = unexplainedInflows.length === 0 ? 'good' : 'warn';
  // Direct instruction: "pick all transfers... even if 1,000 times... group them, name by name...
  // month by month... group them and ask for narration" — every qualifying transaction is picked up
  // (findUnexplainedLargeInflows is uncapped, see classify.ts), then collapsed here into one row per
  // (sender, month, amount) so a sender who sent ₦50,000 two hundred times in one month reads as one
  // group with a count, not two hundred rows, and needs only one explanation, not two hundred.
  const flaggedGroups: FlaggedInflowGroup[] = useMemo(
    () => groupFlaggedInflows(unexplainedInflows, applicantName || undefined),
    [unexplainedInflows, applicantName]
  );
  // Direct instruction, off a live screenshot showing 4 separate cards all headed "MARY
  // OLUWAFUNMILAYO AFENI": "to group all inflows from similar names together" — nests the same
  // flaggedGroups above one level up, purely for display (see flaggedReasons.ts). flaggedGroups
  // itself stays untouched so unexplainedGroupCount/incomeDetail below keep their existing meaning.
  const senderInflowGroups: SenderInflowGroup[] = useMemo(
    () => nestFlaggedGroupsBySender(flaggedGroups),
    [flaggedGroups]
  );
  const incomeDetail =
    unexplainedInflows.length === 0
      ? 'No large inflows were flagged as unclear - nice, that\'s one less thing a reviewer could question.'
      : `${flaggedGroups.length} distinct pattern${flaggedGroups.length === 1 ? '' : 's'} of unclear inflow${
          flaggedGroups.length === 1 ? '' : 's'
        } - ${unexplainedInflows.length} transaction${unexplainedInflows.length === 1 ? '' : 's'} in total (totaling ${formatAmount(
          unexplainedTotal
        )}) - still ${unexplainedInflows.length === 1 ? 'has' : 'have'} no clear description. Explain each pattern below, or a reviewer will likely ask.`;

  // Financial summary numbers, derived from the same cashFlowRows shown in the table below —
  // total in/out are this 6-month window's totals (matching what the table's own Total row shows),
  // and opening balance is worked back algebraically (closing - netChange) rather than read from a
  // pre-first-transaction balance, since not every statement export exposes one directly.
  const totalInflow = cashFlowRows.reduce((s, r) => s + r.inflow, 0);
  const totalOutflow = cashFlowRows.reduce((s, r) => s + r.outflow, 0);
  const netChange = totalInflow - totalOutflow;
  const lastRow = cashFlowRows[cashFlowRows.length - 1];
  const closingBalance = lastRow ? Number(lastRow.balance) || 0 : 0;
  const openingBalance = closingBalance - netChange;
  const hasCashFlow = cashFlowRows.length > 0;
  const incomeVariancePct = Math.round(financialSummary.incomeStabilityCv * 100);
  const showVarianceWarning = financialSummary.hasCashFlowData && financialSummary.incomeStabilityCv > INCOME_VARIANCE_THRESHOLD;
  const showOverspendWarning = financialSummary.hasCashFlowData && financialSummary.avgOut >= financialSummary.avgIn;

  // Financial summary's Status column + overall verdict. Most lines are judged by sign (negative =
  // bad); average monthly outflow and Total outflow are judged against inflow instead of their own
  // sign (outflow exceeding inflow = bad, regardless of the raw number). Opening balance and closing
  // balance are both judged against a ₦3,000,000 floor (a baseline "basic 5-day UK trip" minimum,
  // used here because this page has no access to the Financial calculator's real per-applicant trip
  // cost — DEFAULT_FINANCIAL_INPUTS always zeroes totalCost/recommendedFunds on this page) so a
  // razor-thin balance can never read "good" in isolation while the Recommended-funds row right next
  // to it flags the same statement as short. 9 scored lines total; overall-good threshold preserves
  // the original 7-line "5 of 7 good" ~71.4% bar, generalized as round(9 × 5/7) = 6 of 9.
  const OUTFLOW_EXCEEDS_INFLOW = totalOutflow > totalInflow;
  const RECOMMENDED_FUNDS_FLOOR = 3_000_000; // ₦3,000,000 — dictated "basic 5-day UK trip" minimum
  const recommendedFundsStatus: 'good' | 'bad' = closingBalance < RECOMMENDED_FUNDS_FLOOR ? 'bad' : 'good';
  const closingBalanceStatus: 'good' | 'bad' = recommendedFundsStatus;
  const financialStatusRows: { label: string; status: 'good' | 'bad' }[] = [
    { label: 'Opening balance', status: openingBalance > 50000 ? 'good' : 'bad' },
    { label: 'Total inflow', status: totalInflow > 0 ? 'good' : 'bad' },
    { label: 'Total outflow', status: OUTFLOW_EXCEEDS_INFLOW ? 'bad' : 'good' },
    { label: 'Net change', status: netChange >= 0 ? 'good' : 'bad' },
    { label: 'Closing balance', status: closingBalanceStatus },
    { label: 'Income generation', status: financialSummary.avgIn > 0 ? 'good' : 'bad' },
    { label: 'Average monthly outflow', status: financialSummary.avgOut > financialSummary.avgIn ? 'bad' : 'good' },
    { label: 'Monthly net savings pace', status: financialSummary.monthlyNetSavings >= 0 ? 'good' : 'bad' },
    { label: 'Recommended funds needed', status: recommendedFundsStatus },
  ];
  const financialScoredCount = financialStatusRows.length;
  const financialGoodCount = financialStatusRows.filter((r) => r.status === 'good').length;
  const financialGoodThreshold = Math.round(financialScoredCount * (5 / 7));
  const financialStatusOverall: 'good' | 'bad' = financialGoodCount >= financialGoodThreshold ? 'good' : 'bad';
  const financialBadLabels = financialStatusRows.filter((r) => r.status === 'bad').map((r) => r.label);

  // Direct instruction, verbatim: "your financial report is ready, your opening balance good,
  // closing balance good, monthly expenses good, total overall inflow good, whichever is bad,
  // bad... no recurring income as salary [is a concern]... recurring income in high esteem [is a
  // strength]." Compresses figures already computed above (financialStatusRows' inputs,
  // statementCurrencyIssues, flaggedGroups) into the short bulleted view via finalSummary.ts —
  // deliberately does not re-derive any number itself.
  const hasSalaryIncome = groups.some((g) => g.type === 'salary');
  const hasOtherRecurringIncome = !hasSalaryIncome && topSenders.list.some((s) => s.monthCount >= 3);
  const finalSummary = buildFinalSummary({
    openingBalance,
    closingBalance,
    totalInflow,
    totalOutflow,
    recommendedFundsFloor: RECOMMENDED_FUNDS_FLOOR,
    hasSalaryIncome,
    hasOtherRecurringIncome,
    statementCurrencyIssues,
    unexplainedGroupCount: flaggedGroups.length,
  });
  const actionPlan = useMemo(
    () =>
      buildActionPlan({
        openingBalance,
        closingBalance,
        totalInflow,
        totalOutflow,
        recommendedFundsFloor: RECOMMENDED_FUNDS_FLOOR,
        hasSalaryIncome,
        hasOtherRecurringIncome,
        statementCurrencyIssues,
        unexplainedGroupCount: flaggedGroups.length,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openingBalance, closingBalance, totalInflow, totalOutflow, hasSalaryIncome, hasOtherRecurringIncome, statementCurrencyIssues.join(','), flaggedGroups.length]
  );
  useEffect(() => {
    onActionPlan?.(actionPlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionPlan]);

  // Task #541 (redesign option B, direct go-ahead on the audit's proposal — see that doc's section
  // 2/4B): this tab used to stack 8-10 cards in one flat scroll with no sub-navigation, and items 5
  // ("Your financial report is ready," a bulleted summary) and 6 ("Financial summary," a 9-row
  // table) scored nearly the same figures back to back in two formats — the clearest duplicate the
  // audit found. Nothing below is removed or recalculated; every card is the exact same component
  // with the exact same props, just regrouped under <details>/<summary> accordion headers (the same
  // pattern already used elsewhere in this app for "Documents best avoided" and item-tips) instead
  // of one flat stack. "Your result" stays open by default; the financial-summary table moved next
  // to the cash-flow table it's built from (same window, same figures) instead of sitting directly
  // under the bulleted summary it duplicates, so a skim no longer reads the same verdict twice in a
  // row. "Anything flagged" auto-opens when there's actually something to review.
  const needsAttention =
    finalSummary.attentionFlags.length > 0 || unexplainedInflows.length > 0 || financialStatusOverall === 'bad';

  return (
    <div className="flex flex-col gap-5">
      <ReportSection title="📋 Your result" defaultOpen>
        <div>
          <p className="mb-3 text-xs text-[#566a76]">
            {finalSummary.goodCount} of {finalSummary.totalCount} good — the short version, compressed
            from everything below.
          </p>
          <ul className="flex flex-col gap-1.5">
            {finalSummary.lines.map((line) => (
              <li key={line.label} className="flex items-start gap-2 text-sm">
                <span>{line.verdict === 'good' ? '✅' : '❌'}</span>
                <span className="text-[#12232e]">
                  <b>{line.label}:</b> {line.verdict === 'good' ? 'Good' : 'Bad'} — {line.detail}
                </span>
              </li>
            ))}
          </ul>
          {finalSummary.attentionFlags.length > 0 && (
            <div className="mt-3 rounded-lg bg-warn-wash p-3">
              <p className="text-xs font-medium text-warn-text">⚠️ Needs your attention:</p>
              <ul className="mt-1 flex flex-col gap-1">
                {finalSummary.attentionFlags.map((flag) => (
                  <li key={flag} className="text-xs text-warn-text">
                    • {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-good-wash p-3">
              <p className="text-xs font-semibold text-good">✅ What to do</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {actionPlan.doList.map((t) => (
                  <li key={t} className="text-xs text-[#12232e]">• {t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-warn-wash p-3">
              <p className="text-xs font-semibold text-warn-text">🚫 What not to do</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {actionPlan.dontList.map((t) => (
                  <li key={t} className="text-xs text-[#12232e]">• {t}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-accent-wash p-3">
            <p className="text-xs font-semibold text-accent">💡 Ways to make your application easier</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {actionPlan.easierList.map((t) => (
                <li key={t} className="text-xs text-[#12232e]">• {t}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <p className="text-xs text-[#566a76]">Total income identified</p>
            <p className="mt-1 text-lg font-semibold text-[#12232e]">{formatAmount(totalIncomeIdentified)}</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <p className="text-xs text-[#566a76]">Income sources found</p>
            <p className="mt-1 text-lg font-semibold text-[#12232e]">{incomeSourceCount}</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <p className="text-xs text-[#566a76]">Unexplained/unclear inflows</p>
            <p className="mt-1 text-lg font-semibold text-[#12232e]">
              {unexplainedInflows.length}{' '}
              <span className="text-sm font-normal text-[#566a76]">({formatAmount(unexplainedTotal)})</span>
            </p>
          </div>
        </div>
      </ReportSection>

      <ReportSection
        title="Income sources"
        teaser={`${incomeSourceCount} source${incomeSourceCount === 1 ? '' : 's'} identified`}
      >
        <p className="text-xs text-[#566a76]">
          Type your employer and/or business name below to see whether it actually shows up as the
          sender on real credits in this statement - stronger evidence than its name just appearing
          somewhere on the page. (You don&apos;t need to have filled in &quot;Your responsibilities&quot;
          yet - fill in whichever of these applies to you, right here.)
        </p>
        <div className="flex flex-col gap-4">
          <WorkNameFields
            label="Employer"
            name={employerName}
            setName={setEmployerName}
            altName={employerAltName}
            setAltName={setEmployerAltName}
            check={employerCheck}
            categoryChoices={employerCategoryChoices}
            setCategoryChoices={setEmployerCategoryChoices}
            declaredMonthlyIncome={employerDeclaredMonthlyIncome}
            setDeclaredMonthlyIncome={setEmployerDeclaredMonthlyIncome}
            incomeMatch={employerIncomeMatch}
          />
          <WorkNameFields
            label="Business"
            name={businessName}
            setName={setBusinessName}
            altName={businessAltName}
            setAltName={setBusinessAltName}
            check={businessCheck}
            categoryChoices={businessCategoryChoices}
            setCategoryChoices={setBusinessCategoryChoices}
            declaredMonthlyIncome={businessDeclaredMonthlyIncome}
            setDeclaredMonthlyIncome={setBusinessDeclaredMonthlyIncome}
            incomeMatch={businessIncomeMatch}
          />
        </div>
      </ReportSection>

      {hasCashFlow && (
        <ReportSection title="Cash flow" teaser={`${cashFlowRows.length}-month window`}>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-[#12232e]">
              Monthly cash flow (last {cashFlowRows.length} months)
            </h3>
            <p className="mb-4 text-xs text-[#566a76]">
              Auto-filled from your uploaded statement — the same figures feeding the Financial
              readiness calculator&apos;s cash-flow table.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-[#566a76]">
                    <th className="py-2 pr-2">Month</th>
                    <th className="py-2 pr-2 text-right">Total inflow (₦)</th>
                    <th className="py-2 pr-2 text-right">Total outflow (₦)</th>
                    <th className="py-2 text-right">Closing balance (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlowRows.map((r) => (
                    <tr key={r.month} className="border-b border-black/5">
                      <td className="py-2 pr-2 text-[#12232e]">{r.month}</td>
                      <td className="py-2 pr-2 text-right text-[#12232e]">{r.inflow.toLocaleString('en-NG')}</td>
                      <td className="py-2 pr-2 text-right text-[#12232e]">{r.outflow.toLocaleString('en-NG')}</td>
                      <td className="py-2 text-right text-[#12232e]">
                        {r.balance ? Number(r.balance).toLocaleString('en-NG') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold text-[#12232e]">
                    <td className="py-2 pr-2">Total</td>
                    <td className="py-2 pr-2 text-right">{formatAmount(totalInflow)}</td>
                    <td className="py-2 pr-2 text-right">{formatAmount(totalOutflow)}</td>
                    <td className="py-2 text-right">{formatAmount(closingBalance)} (most recent)</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {showVarianceWarning && (
              <div className="mt-3 rounded-lg bg-warn-wash p-3 text-sm text-warn-text">
                ⚠️ Your monthly income varies a lot month-to-month (roughly ±{incomeVariancePct}%). A
                steady, recurring monthly salary - backed by an employment letter - reads far better
                than lump sums.
              </div>
            )}
            {showOverspendWarning && (
              <div className="mt-3 rounded-lg bg-warn-wash p-3 text-sm text-warn-text">
                ⚠️ You&apos;re spending nearly all (or more than) you earn most months (avg in{' '}
                {formatAmount(financialSummary.avgIn)} vs avg out {formatAmount(financialSummary.avgOut)}).
                This can make it harder to show a genuine savings cushion.
              </div>
            )}
            <div className="mt-3 rounded-lg bg-accent-wash p-3 text-sm text-accent">
              ℹ️ Enter your trip dates and cost in the{' '}
              <a href={financialHref} className="underline">
                Financial readiness calculator
              </a>{' '}
              to see the recommended funds buffer and a readiness verdict against your closing balance.
            </div>
          </div>

          <div className="border-t border-black/10 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-[#12232e]">Financial summary</h3>
            <p className="mb-4 text-xs text-[#566a76]">
              Everything above, pulled into one summary: what came in and went out over your
              statement window, and how that pace compares income against outflow — plus a status on
              each line, and an overall verdict at the bottom.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-[#566a76]">
                    <th className="py-2 pr-4">Metric</th>
                    <th className="py-2 pr-4 text-right">Value</th>
                    <th className="py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Opening balance (start of statement window)', value: formatAmount(openingBalance), status: openingBalance > 50000 ? 'good' : ('bad' as const) },
                    { label: 'Total inflow (credits)', value: formatAmount(totalInflow), status: totalInflow > 0 ? 'good' : ('bad' as const) },
                    { label: 'Total outflow (debits)', value: formatAmount(totalOutflow), status: OUTFLOW_EXCEEDS_INFLOW ? 'bad' : ('good' as const) },
                    { label: 'Net change (inflow − outflow)', value: formatAmount(netChange), status: netChange >= 0 ? 'good' : ('bad' as const) },
                    { label: 'Closing balance (most recent)', value: formatAmount(closingBalance), status: closingBalanceStatus },
                    { label: 'Income generation (average per month)', value: formatAmount(financialSummary.avgIn), status: financialSummary.avgIn > 0 ? 'good' : ('bad' as const) },
                    // The one row scored against inflow rather than its own sign — "withdrawals more
                    // than inflow" is bad regardless of whether the raw outflow number is positive.
                    { label: 'Average monthly outflow', value: formatAmount(financialSummary.avgOut), status: financialSummary.avgOut > financialSummary.avgIn ? 'bad' : ('good' as const) },
                    { label: 'Monthly net savings pace', value: formatAmount(financialSummary.monthlyNetSavings), status: financialSummary.monthlyNetSavings >= 0 ? 'good' : ('bad' as const) },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-black/5">
                      <td className="py-2 pr-4 text-[#566a76]">{row.label}</td>
                      <td className="py-2 pr-4 text-right font-medium text-[#12232e]">{row.value}</td>
                      <td className="py-2 text-right">
                        {row.status === 'good' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-good-wash px-2 py-0.5 text-[10px] font-medium text-good">
                            ✅ Good
                          </span>
                        )}
                        {row.status === 'bad' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-800">
                            ❌ Bad
                          </span>
                        )}
                        {row.status === null && <span className="text-[10px] text-[#566a76]">—</span>}
                      </td>
                    </tr>
                  ))}
                  {otherStatementSummary && otherStatementSummary.txnCount > 0 && (
                    <tr className="border-b border-black/5 bg-accent-wash/40">
                      <td className="py-2 pr-4 text-[#566a76]">
                        Other account balance ({otherStatementSummary.label})
                        <div className="mt-0.5 text-[10px] font-normal text-[#8a99a3]">
                          From your other uploaded statement — shown here so you see the fuller
                          picture before deciding whether you need it. Not added into this
                          statement&apos;s own status above.
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right font-medium text-[#12232e]">
                        {formatAmount(otherStatementSummary.closingBalance)}
                      </td>
                      <td className="py-2 text-right">
                        <span className="text-[10px] text-[#566a76]">— informational</span>
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-black/5">
                    <td className="py-2 pr-4 text-[#566a76]">
                      Recommended funds needed
                      <div className="mt-0.5 text-[10px] font-normal text-[#8a99a3]">
                        Rough baseline (basic 5-day trip: flight + accommodation + transport + feeding)
                        until you enter real costs in the{' '}
                        <a href={financialHref} className="text-accent hover:underline">
                          calculator
                        </a>{' '}
                        for an exact buffer figure.
                      </div>
                      {recommendedFundsStatus === 'bad' && (
                        <div className="mt-1.5 rounded bg-red-50 px-2 py-1 text-[10px] text-red-800">
                          To bring your total funds closer to this figure, consider: uploading another
                          bank statement, a dollar account, a cooperative account, or a pension account.
                          Any one of these - or a combination - can help close the gap.
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-[#12232e]">
                      {formatAmount(RECOMMENDED_FUNDS_FLOOR)}+
                    </td>
                    <td className="py-2 text-right">
                      {recommendedFundsStatus === 'good' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-good-wash px-2 py-0.5 text-[10px] font-medium text-good">
                          ✅ Good
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-800">
                          ❌ Bad
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              className={`mt-4 rounded-lg p-3 text-sm ${
                financialStatusOverall === 'good' ? 'bg-good-wash text-good' : 'bg-warn-wash text-warn-text'
              }`}
            >
              {financialStatusOverall === 'good' ? '✅' : '⚠️'} Overall: {financialGoodCount} of{' '}
              {financialScoredCount} good
              {financialStatusOverall === 'good'
                ? ' — this statement reads as financially healthy.'
                : ' — this statement needs work before it reads as financially healthy.'}
              {financialBadLabels.length > 0 && (
                <div className="mt-1 text-xs">
                  Needs work on: <b>{financialBadLabels.join(', ')}</b>.
                </div>
              )}
            </div>
          </div>
        </ReportSection>
      )}

      <ReportSection
        title="Anything flagged"
        teaser={
          senderInflowGroups.length > 0
            ? `${senderInflowGroups.length} need${senderInflowGroups.length === 1 ? 's' : ''} an explanation`
            : 'nothing flagged'
        }
        defaultOpen={needsAttention}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 p-3">
            <div>
              <p className="text-sm font-medium text-[#12232e]">Income status</p>
              <p className="mt-1 text-xs text-[#566a76]">{incomeDetail}</p>
            </div>
            {statusPill(incomeStatus, incomeStatus === 'good' ? 'Looks complete' : 'Needs review')}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 p-3">
            <div>
              <p className="text-sm font-medium text-[#12232e]">Balance status</p>
              <p className="mt-1 text-xs text-[#566a76]">
                Closing balance check happens in the{' '}
                <a href={financialHref} className="text-accent hover:underline">
                  Financial readiness calculator
                </a>
                .
              </p>
            </div>
            {statusPill('neutral', 'Not assessed here')}
          </div>
        </div>

        {senderInflowGroups.length > 0 && (
          <div className="border-t border-black/10 pt-4">
            <h3 className="mb-1 text-sm font-semibold text-[#12232e]">
              Inflows that need an explanation ({senderInflowGroups.length})
            </h3>
            <p className="mb-4 text-xs text-[#566a76]">
              Every credit of ₦50,000 or more with no clear description, grouped by sender - one card
              per person, however many months or amounts they show up under. Pick a reason from the
              dropdown; if the same sender paid you for more than one reason, say so and give each
              payment its own answer.
            </p>
            <div className="flex flex-col gap-3">
              {senderInflowGroups.map((sg) => (
                <SenderInflowCard
                  key={sg.senderKey}
                  sg={sg}
                  mode={effectiveReasonMode(sg, flaggedReasonMode)}
                  setMode={(v) => setFlaggedMode(sg.senderKey, v)}
                  choice={flaggedReasonChoice}
                  setChoice={setFlaggedChoice}
                  otherText={flaggedReasonOther}
                  setOther={setFlaggedOther}
                />
              ))}
            </div>
          </div>
        )}
      </ReportSection>
    </div>
  );
}

// Shared accordion card shell for the sections above — same <details>/<summary> pattern already
// used elsewhere in this app (e.g. the "Documents best avoided" card in FinalReviewSession.tsx),
// just with an optional one-line teaser next to the title so a collapsed section still says
// something useful at a glance.
function ReportSection({
  title,
  teaser,
  defaultOpen,
  children,
}: {
  title: string;
  teaser?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm" open={defaultOpen}>
      <summary className="flex cursor-pointer items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#12232e]">{title}</h2>
        {teaser && <span className="text-xs font-normal text-[#566a76]">{teaser}</span>}
      </summary>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </details>
  );
}
