'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FinancialInputs,
  DEFAULT_FINANCIAL_INPUTS,
  CF_MONTHS,
  computeFinancials,
  fmtN,
} from '@/lib/checklist/financial';

// Phase 3 of task #244: the financial readiness calculator. Ported math lives in
// lib/checklist/financial.ts (see the comment at the top of that file for exactly what is and
// isn't carried over from index.html's computeFinancials()). This page is just the form + display
// around that pure function — same privacy model as the rest of the checklist: everything typed
// here stays in this browser's localStorage (key sa_uk_financial) and is never sent anywhere.
const STORAGE_KEY = 'sa_uk_financial';

function numOrZero(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

export default function UKFinancialCalculatorPage() {
  const [inputs, setInputs] = useState<FinancialInputs>(DEFAULT_FINANCIAL_INPUTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setInputs({ ...DEFAULT_FINANCIAL_INPUTS, ...JSON.parse(saved) });
    } catch {
      /* start fresh */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      /* ignore */
    }
  }, [inputs, loaded]);

  const result = useMemo(() => computeFinancials(inputs), [inputs]);

  if (!loaded) return null;

  function setCost<K extends keyof FinancialInputs['costs']>(key: K, v: string) {
    setInputs((prev) => ({ ...prev, costs: { ...prev.costs, [key]: numOrZero(v) } }));
  }
  function setFunds<K extends keyof FinancialInputs['funds']>(key: K, v: string) {
    setInputs((prev) => ({ ...prev, funds: { ...prev.funds, [key]: numOrZero(v) } }));
  }
  function setTraveller<K extends keyof FinancialInputs['travellers']>(key: K, v: string) {
    setInputs((prev) => ({ ...prev, travellers: { ...prev.travellers, [key]: numOrZero(v) } }));
  }
  function setCashFlow(i: number, field: 'month' | 'inflow' | 'outflow' | 'balance', v: string) {
    setInputs((prev) => {
      const rows = [...prev.cashFlow];
      rows[i] = {
        ...rows[i],
        [field]: field === 'month' || field === 'balance' ? v : numOrZero(v),
      };
      return { ...prev, cashFlow: rows };
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">💰 Financial readiness calculator</h1>
        <p className="mt-1 text-sm text-[#4c6270]">
          A rough, personal estimate of trip cost vs. the funds a reviewer typically wants to see — not a quote or a guarantee.
        </p>
      </div>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#12232e]">Travellers</h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Field label="Adults" value={String(inputs.travellers.adults)} onChange={(v) => setTraveller('adults', v)} />
          <Field label="Adolescents" value={String(inputs.travellers.adolescents)} onChange={(v) => setTraveller('adolescents', v)} />
          <Field label="Children" value={String(inputs.travellers.children)} onChange={(v) => setTraveller('children', v)} />
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#12232e]">Trip dates</h2>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <Field label="Travel date" type="date" value={inputs.travelDate} onChange={(v) => setInputs((p) => ({ ...p, travelDate: v }))} />
          <Field label="Return date" type="date" value={inputs.returnDate} onChange={(v) => setInputs((p) => ({ ...p, returnDate: v }))} />
          <Field label="Planned application date" type="date" value={inputs.appDate} onChange={(v) => setInputs((p) => ({ ...p, appDate: v }))} />
        </div>
        {result.daysToPrep !== null && (
          <p className="mt-2 text-xs text-[#566a76]">
            {result.daysToPrep < 0
              ? '⚠️ This planned submission date is in the past — update it once you have a new target date.'
              : `⏳ ${result.daysToPrep} day(s) from today to gather and prepare your documents before your planned submission date.`}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#12232e]">Trip cost estimate</h2>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label="Flight, per adult (₦)" value={String(inputs.costs.flightPerAdult)} onChange={(v) => setCost('flightPerAdult', v)} />
          <Field label="Accommodation, per night (₦)" value={String(inputs.costs.accomPerNight)} onChange={(v) => setCost('accomPerNight', v)} />
          <Field label="Nights" value={String(inputs.costs.nights)} onChange={(v) => setCost('nights', v)} />
          <Field label="Local transport, total (₦)" value={String(inputs.costs.transport)} onChange={(v) => setCost('transport', v)} />
          <Field label="Shopping, total (₦)" value={String(inputs.costs.shopping)} onChange={(v) => setCost('shopping', v)} />
          <Field label="Sightseeing, total (₦)" value={String(inputs.costs.sightseeing)} onChange={(v) => setCost('sightseeing', v)} />
        </div>
        <p className="mt-2 text-xs text-[#4c6270]">
          Adolescents are costed at 90% of the adult flight fare, children at 75% — adjust the per-adult figure if your real quote differs.
        </p>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#12232e]">Funds available</h2>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label="Current closing balance (₦)" value={String(inputs.funds.closingBalance)} onChange={(v) => setFunds('closingBalance', v)} />
          <Field label="Forex / travel savings (₦)" value={String(inputs.funds.forexSavings)} onChange={(v) => setFunds('forexSavings', v)} />
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-[#12232e]">Income & bank statement (last {CF_MONTHS} months)</h2>
        <p className="mb-3 text-xs text-[#4c6270]">
          Type in totals from your own statements — enter at least 2 months for the income-stability check below to run.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/10 text-left text-[#566a76]">
                <th className="py-1 pr-2">Month</th>
                <th className="py-1 pr-2">Inflow (₦)</th>
                <th className="py-1 pr-2">Outflow (₦)</th>
                <th className="py-1">Closing balance (₦)</th>
              </tr>
            </thead>
            <tbody>
              {inputs.cashFlow.map((row, i) => (
                <tr key={i} className="border-b border-black/5">
                  <td className="py-1 pr-2">
                    <input
                      value={row.month}
                      onChange={(e) => setCashFlow(i, 'month', e.target.value)}
                      placeholder={`Month ${i + 1}`}
                      className="w-24 rounded border border-gray-300 px-1.5 py-1"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      value={String(row.inflow || '')}
                      onChange={(e) => setCashFlow(i, 'inflow', e.target.value)}
                      placeholder="0"
                      className="w-24 rounded border border-gray-300 px-1.5 py-1"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      value={String(row.outflow || '')}
                      onChange={(e) => setCashFlow(i, 'outflow', e.target.value)}
                      placeholder="0"
                      className="w-24 rounded border border-gray-300 px-1.5 py-1"
                    />
                  </td>
                  <td className="py-1">
                    <input
                      value={row.balance}
                      onChange={(e) => setCashFlow(i, 'balance', e.target.value)}
                      placeholder="0"
                      className="w-24 rounded border border-gray-300 px-1.5 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-accent/30 bg-accent-wash p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#12232e]">Readiness summary</h2>
        <SummaryRow label={`Flight (${result.travellers} traveller${result.travellers === 1 ? '' : 's'})`} value={fmtN(result.totalFlight)} />
        <SummaryRow label="Accommodation" value={fmtN(result.totalAccom)} />
        <SummaryRow label="Rough total trip cost" value={fmtN(result.totalCost)} bold />
        <SummaryRow label="Recommended funds to show (2× buffer)" value={fmtN(result.recommendedFunds)} bold />
        <SummaryRow label="Funds you have available" value={fmtN(result.totalFunds)} />
        <div
          className={`mt-2 rounded-md p-3 text-sm ${
            result.fundsReady ? 'bg-good-wash text-good' : result.totalCost > 0 ? 'bg-warn-wash text-warn-text' : 'bg-white text-[#566a76]'
          }`}
        >
          {result.totalCost === 0
            ? 'Fill in your trip cost estimate above to see a readiness verdict.'
            : result.fundsReady
            ? '🎉 Your available funds already cover the recommended 2× buffer for your estimated trip cost.'
            : `⚠️ You're short of the recommended buffer by ${fmtN(result.shortfall)}.`}
        </div>

        {result.hasCashFlowData && (
          <div className="mt-3 border-t border-black/10 pt-3 text-sm">
            <SummaryRow label="Average monthly income" value={fmtN(result.avgIn)} />
            <SummaryRow label="Average monthly outgoings" value={fmtN(result.avgOut)} />
            <SummaryRow label="Average monthly net savings" value={fmtN(result.monthlyNetSavings)} />
            <SummaryRow label="Recommended monthly income (2× trip cost over 6 months)" value={fmtN(result.recommendedIncome)} />
            {result.incomeStabilityCv > 0.4 && (
              <p className="mt-2 text-xs text-warn-text">
                ⚠️ Your monthly income varies a lot month to month — reviewers tend to read steadier income as a stronger sign than the same average with big swings.
              </p>
            )}
            {result.zeroIncomeMonths > 0 && (
              <p className="mt-1 text-xs text-warn-text">
                ⚠️ {result.zeroIncomeMonths} of your entered month(s) show no income at all.
              </p>
            )}
            {result.monthsToCloseGap !== null && (
              <p className="mt-2 text-xs text-[#4c6270]">
                At your current savings pace, closing the shortfall above would take roughly {Math.ceil(result.monthsToCloseGap)} more month(s).
              </p>
            )}
            {result.timingRealityCheck && (
              <p className="mt-2 text-xs text-warn-text">{result.timingRealityCheck}</p>
            )}
          </div>
        )}
      </section>

      <Link href="/checklist/uk" className="text-center text-xs text-accent underline">
        ← Back to checklist
      </Link>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#12232e]">{label}</span>
      <input
        type={type}
        inputMode={type === 'date' ? undefined : 'numeric'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2"
      />
    </label>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-[#12232e]">{label}</span>
      <span className="text-[#12232e]">{value}</span>
    </div>
  );
}
