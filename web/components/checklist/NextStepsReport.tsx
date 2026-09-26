'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DEFAULT_FINANCIAL_INPUTS,
  FinancialInputs,
  computeFinancials,
} from '@/lib/checklist/financial';
import { deserializePassportFields, PersistedPassportFields } from '@/lib/passport/persist';
import { TravelHistoryRow, OverstayRow } from '@/lib/checklist/travelHistory';
import { buildNextStepsReport, NextStepsReport as ReportResult, SectionStatus } from '@/lib/checklist/nextSteps';
import { COUNTRIES } from '@/lib/checklist/countries';

// Port of index.html's "What to do next" report — renderNextStepsReport() (~line 7483-7592) —
// task #319+ selection "'What to do next' report", the last of the three prerequisite features
// built for it this batch (spouse/sponsor and business-income were separate earlier selections;
// travel history was built specifically to feed this report). See lib/checklist/nextSteps.ts for
// the full synthesis logic and its deliberate scope notes (a simplified finance-readiness proxy,
// and a fresh travel-date-aware passport check rather than reusing lib/passport/validity.ts's
// today-only one).
//
// Unlike the original, which hard-gates this report behind completing every earlier session, this
// page is reachable any time from the checklist header (like every other side page in this port) —
// the report itself already handles "not entered yet" for each section, so nothing breaks if the
// applicant jumps here first.
export type NextStepsReportProps = {
  countryCode: string;
};

interface SavedTravelHistory {
  firstTimeAnswer: '' | 'yes' | 'no';
  historyRows: TravelHistoryRow[];
  overstayRows: OverstayRow[];
  hasOverstayed: boolean;
}

function loadJson<T>(storageKey: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function sectionClasses(status: SectionStatus): string {
  if (status === 'ok') return 'bg-green-50 text-green-800';
  if (status === 'warn') return 'bg-warn-wash text-warn-text';
  return 'bg-black/5 text-[#4c6270]';
}

function sectionIcon(status: SectionStatus): string {
  if (status === 'ok') return '✅ ';
  if (status === 'warn') return '⚠️ ';
  return '';
}

export default function NextStepsReport({ countryCode }: NextStepsReportProps) {
  const lowerCode = countryCode.toLowerCase();
  const backHref = `/checklist/${lowerCode}`;
  const upperCode = countryCode.toUpperCase();
  const visaShortLabel = COUNTRIES.find((c) => c.code === upperCode)?.visaName || 'visa';

  const [loaded, setLoaded] = useState(false);
  const [passportExpiry, setPassportExpiry] = useState('');
  const [financialInputs, setFinancialInputs] = useState<FinancialInputs>(DEFAULT_FINANCIAL_INPUTS);
  const [travelHistory, setTravelHistory] = useState<SavedTravelHistory | null>(null);

  useEffect(() => {
    const passportFields = loadJson<PersistedPassportFields>(`sa_${lowerCode}_passport`);
    setPassportExpiry(deserializePassportFields(passportFields).expiryDate);

    const financial = loadJson<FinancialInputs>(`sa_${lowerCode}_financial`);
    if (financial) setFinancialInputs({ ...DEFAULT_FINANCIAL_INPUTS, ...financial });

    setTravelHistory(loadJson<SavedTravelHistory>(`sa_${lowerCode}_travelhistory`));

    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowerCode]);

  const report: ReportResult = useMemo(() => {
    const financial = computeFinancials(financialInputs);
    return buildNextStepsReport({
      visaShortLabel,
      // Neither field exists in this port's COUNTRIES data (index.html's own c.authority /
      // c.statementsMonthsText aren't ported) — same deliberate simplification already disclosed
      // for the spouse/sponsor tool (hardcoded "6 months", no per-country override).
      authority: 'the visa authority',
      statementsMonthsText: '6 months',
      passportExpiry,
      travelDate: financialInputs.travelDate,
      firstTimeAnswer: travelHistory?.firstTimeAnswer || '',
      historyRows: travelHistory?.historyRows || [],
      overstayRows: travelHistory?.hasOverstayed ? travelHistory.overstayRows : [],
      financial,
    });
  }, [visaShortLabel, passportExpiry, financialInputs, travelHistory]);

  if (!loaded) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 p-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">📋 What to do next</h1>
        <p className="mt-1 text-sm text-[#4c6270]">
          A quick read of where things stand across your passport, travel history, and finances, and
          what&apos;s worth prioritizing first.
        </p>
      </div>

      <ReportBlock title="🛂 Passport validity" section={report.passport} />
      <ReportBlock title="✈️ Travel history" section={report.travelHistory} />
      <ReportBlock title="💰 Finance readiness" section={report.finance} />

      {report.timeToTravel && (
        <div className={`rounded-2xl p-4 text-sm ${sectionClasses(report.timeToTravel.priorities.length ? 'warn' : 'ok')}`}>
          <p className="font-semibold">You have about {report.timeToTravel.daysToTravel} day(s) until your travel date</p>
          {report.timeToTravel.priorities.length ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {report.timeToTravel.priorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          ) : (
            <p className="mt-1">and you&apos;re tracking well across passport, travel history, and finances.</p>
          )}
        </div>
      )}

      <div className={`rounded-2xl p-4 text-sm font-semibold ${sectionClasses(report.overall.status)}`}>
        {sectionIcon(report.overall.status)}
        {report.overall.message}
      </div>

      <Link href={backHref} className="text-center text-xs text-accent underline">
        ← Back to checklist
      </Link>
    </main>
  );
}

function ReportBlock({ title, section }: { title: string; section: { status: SectionStatus; message: string } }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-[#12232e]">{title}</h3>
      <div className={`rounded-lg p-3 text-sm ${sectionClasses(section.status)}`}>
        {sectionIcon(section.status)}
        {section.message}
      </div>
    </div>
  );
}
