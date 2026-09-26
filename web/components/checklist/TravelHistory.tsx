'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TE_COUNTRY_LIST,
  TE_NO_HISTORY_GUIDES,
  TravelHistoryRow,
  OverstayRow,
  computeTravelExperienceGrade,
} from '@/lib/checklist/travelHistory';

// Port of index.html's "Travel Experience" session (task #319+ selection "Build travel history
// first, then the full report"). See lib/checklist/travelHistory.ts for the ported country lists,
// guide data, and grading logic, and its header comment for the full list of deliberate scope
// adaptations (no EU-funds sub-flow, plain <select> instead of the custom combobox, guide content
// rendered inline instead of in a modal).
//
// This session isn't a hard gate in this Next app (no sequential session lock exists here, unlike
// the original's single-session HTML) — reached via a header link like the other side pages, and
// its "grade" summary drops the original's "Continue to Session 3" copy accordingly, replacing it
// with a plain completion note.
export type TravelHistoryProps = {
  countryCode: string;
};

type FirstTimeAnswer = '' | 'yes' | 'no';

interface SavedTravelHistory {
  firstTimeAnswer: FirstTimeAnswer;
  historyRows: TravelHistoryRow[];
  overstayRows: OverstayRow[];
  hasOverstayed: boolean;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CURRENT_YEAR = new Date().getFullYear();
// Travel history is always in the past — the year list runs from this year back 19 more (20 years
// total), same range the original used its own dropdown-year picker for (a plain native
// <input type="month"> shows the year as static text with no way to jump, which is why the
// original avoided it — kept here even though the country combobox itself was simplified).
const YEARS: number[] = Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - i);

function splitDate(date: string): { month: string; year: string } {
  const [year, month] = (date || '').split('-');
  return { month: month || '', year: year || '' };
}

function combineDate(month: string, year: string): string {
  if (!month || !year) return month || year ? `${year}-${month}` : '';
  return `${year}-${month}`;
}

function loadSaved(storageKey: string): SavedTravelHistory | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedTravelHistory;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function TravelHistory({ countryCode }: TravelHistoryProps) {
  const lowerCode = countryCode.toLowerCase();
  const storageKey = `sa_${lowerCode}_travelhistory`;
  const backHref = `/checklist/${lowerCode}`;

  const [loaded, setLoaded] = useState(false);
  const [firstTimeAnswer, setFirstTimeAnswer] = useState<FirstTimeAnswer>('');
  const [historyRows, setHistoryRows] = useState<TravelHistoryRow[]>([]);
  const [overstayRows, setOverstayRows] = useState<OverstayRow[]>([]);
  const [hasOverstayed, setHasOverstayed] = useState(false);
  const [selectedGuideCountry, setSelectedGuideCountry] = useState('');

  useEffect(() => {
    const saved = loadSaved(storageKey);
    if (saved) {
      setFirstTimeAnswer(saved.firstTimeAnswer || '');
      setHistoryRows(saved.historyRows || []);
      setOverstayRows(saved.overstayRows || []);
      setHasOverstayed(!!saved.hasOverstayed);
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Same debounce-free "save on every change, once loaded" pattern used across every other page in
  // this port. Only saves once the applicant has actually answered the first question.
  useEffect(() => {
    if (!loaded || !firstTimeAnswer) return;
    try {
      const payload: SavedTravelHistory = { firstTimeAnswer, historyRows, overstayRows, hasOverstayed };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [loaded, firstTimeAnswer, historyRows, overstayRows, hasOverstayed, storageKey]);

  const grade = useMemo(
    () => computeTravelExperienceGrade(historyRows, hasOverstayed ? overstayRows : []),
    [historyRows, overstayRows, hasOverstayed]
  );

  function addHistoryRow() {
    setHistoryRows((rows) => [...rows, { country: '', date: '', reason: '', days: '' }]);
  }
  function updateHistoryRow(i: number, patch: Partial<TravelHistoryRow>) {
    setHistoryRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeHistoryRow(i: number) {
    setHistoryRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  function addOverstayRow() {
    setOverstayRows((rows) => [...rows, { country: '', days: '' }]);
  }
  function updateOverstayRow(i: number, patch: Partial<OverstayRow>) {
    setOverstayRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeOverstayRow(i: number) {
    setOverstayRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  if (!loaded) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 p-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">🌍 Travel Experience</h1>
        <p className="mt-1 text-sm text-[#4c6270]">
          Your past travel — or a plan to start building some — is one of the things a reviewer weighs
          alongside your finances and passport.
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-[#12232e]" htmlFor="te-first-time">
          Have you travelled outside Nigeria before?
        </label>
        <select
          id="te-first-time"
          value={firstTimeAnswer}
          onChange={(e) => setFirstTimeAnswer(e.target.value as FirstTimeAnswer)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          <option value="yes">Yes - I&apos;ve travelled before</option>
          <option value="no">No - this would be my first time</option>
        </select>
      </div>

      {firstTimeAnswer === 'no' && (
        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="mb-2 font-medium text-[#12232e]">
            No travel history yet - that&apos;s fine, plenty of successful applicants start here.
          </p>
          <p className="mb-3 text-sm text-[#4c6270]">
            Having visited an African country before is genuinely useful travel history for a UK/Schengen
            application. These five are commonly picked because they&apos;re straightforward for Nigerians
            to visit - tap one to see exactly what&apos;s involved.
          </p>
          <label className="mb-2 block text-sm font-medium text-[#12232e]">
            Plan a visit to build travel history
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.keys(TE_NO_HISTORY_GUIDES).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedGuideCountry(c === selectedGuideCountry ? '' : c)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  c === selectedGuideCountry
                    ? 'border-accent bg-accent text-white'
                    : 'border-accent/40 text-accent'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {selectedGuideCountry && TE_NO_HISTORY_GUIDES[selectedGuideCountry] && (
            <CountryGuide country={selectedGuideCountry} guide={TE_NO_HISTORY_GUIDES[selectedGuideCountry]} />
          )}

          <a
            href="https://wa.me/2349081389969?text=Hi%21%20I%20don%27t%20have%20travel%20history%20yet%20and%20could%20use%20some%20guidance%20before%20applying%20for%20my%20UK/Canada%20visa."
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent"
          >
            Click here for more assistance
          </a>
        </div>
      )}

      {firstTimeAnswer === 'yes' && (
        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-[#12232e]">Countries you&apos;ve travelled to</label>
          <div className="flex flex-col gap-3">
            {historyRows.map((row, i) => {
              const { month, year } = splitDate(row.date);
              return (
                <div key={i} className="rounded-lg border border-black/10 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-[#4c6270]">Trip {i + 1}</span>
                    <button type="button" onClick={() => removeHistoryRow(i)} className="text-xs text-accent underline">
                      Remove
                    </button>
                  </div>
                  <label className="mb-1 block text-xs font-medium text-[#12232e]">Country</label>
                  <select
                    value={row.country}
                    onChange={(e) => updateHistoryRow(i, { country: e.target.value })}
                    className="mb-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">Select a country…</option>
                    {TE_COUNTRY_LIST.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <label className="mb-1 block text-xs font-medium text-[#12232e]">Date travelled</label>
                  <div className="mb-2 flex gap-2">
                    <select
                      value={month}
                      onChange={(e) => updateHistoryRow(i, { date: combineDate(e.target.value, year) })}
                      className="w-1/2 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    >
                      <option value="">Month…</option>
                      {MONTH_NAMES.map((name, idx) => {
                        const val = String(idx + 1).padStart(2, '0');
                        return (
                          <option key={val} value={val}>
                            {name}
                          </option>
                        );
                      })}
                    </select>
                    <select
                      value={year}
                      onChange={(e) => updateHistoryRow(i, { date: combineDate(month, e.target.value) })}
                      className="w-1/2 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    >
                      <option value="">Year…</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="mb-1 block text-xs font-medium text-[#12232e]">Reason</label>
                  <input
                    type="text"
                    value={row.reason}
                    onChange={(e) => updateHistoryRow(i, { reason: e.target.value })}
                    placeholder="e.g. Holiday, family visit, work trip"
                    className="mb-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <label className="mb-1 block text-xs font-medium text-[#12232e]">Days spent</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.days}
                    onChange={(e) => updateHistoryRow(i, { days: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
              );
            })}
          </div>

          <button type="button" onClick={addHistoryRow} className="mt-3 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent">
            + Add a country
          </button>

          <div className="mt-4 flex items-center gap-2">
            <input
              id="te-overstayed"
              type="checkbox"
              checked={hasOverstayed}
              onChange={(e) => setHasOverstayed(e.target.checked)}
            />
            <label htmlFor="te-overstayed" className="text-sm text-[#12232e]">
              I&apos;ve overstayed a visa at some point in the past
            </label>
          </div>

          {hasOverstayed && (
            <div className="mt-3">
              <label className="mb-2 block text-sm font-medium text-[#12232e]">Where, and for how long</label>
              <div className="flex flex-col gap-2">
                {overstayRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={row.country}
                      onChange={(e) => updateOverstayRow(i, { country: e.target.value })}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    >
                      <option value="">Select a country…</option>
                      {TE_COUNTRY_LIST.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={row.days}
                      onChange={(e) => updateOverstayRow(i, { days: e.target.value })}
                      placeholder="Days"
                      className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    />
                    <button type="button" onClick={() => removeOverstayRow(i)} className="text-xs text-accent underline">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addOverstayRow} className="mt-2 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent">
                + Add a country
              </button>
            </div>
          )}

          {grade && (
            <div className="mt-4 flex flex-col gap-2">
              {grade.infoLines.map((line, i) => (
                <div key={i} className="rounded-lg bg-accent-wash p-3 text-sm text-accent">
                  {line}
                </div>
              ))}
              {grade.overstayedAny && (
                <div className="rounded-lg bg-warn-wash p-3 text-sm text-warn-text">
                  ⚠️ An overstay on your record is a real concern reviewers weigh heavily - being upfront
                  about it, with a clear explanation, matters more than trying to leave it out.
                </div>
              )}
              <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                ✅ You&apos;ve completed this section.
              </div>
            </div>
          )}
        </div>
      )}

      <Link href={backHref} className="text-center text-xs text-accent underline">
        ← Back to checklist
      </Link>
    </main>
  );
}

function CountryGuide({
  country,
  guide,
}: {
  country: string;
  guide: (typeof TE_NO_HISTORY_GUIDES)[string];
}) {
  return (
    <div className="mt-3 rounded-lg bg-accent-wash p-3 text-sm text-[#12232e]">
      <div className="mb-1 font-semibold">
        {country} — {guide.visaType}
      </div>
      <div className="mb-2">{guide.summary}</div>
      <ol className="list-decimal space-y-1 pl-5">
        {guide.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-[#4c6270]">
        Requirements, fees, and processing times change - always confirm on the official government site
        before paying anything or booking travel. This is a starting point, current as of August 2026,
        not a guarantee.
      </p>
      {guide.costEstimate && (
        <div className="mt-3 rounded-lg border border-black/10 bg-white p-3">
          <div className="mb-1 font-semibold">Roughly, getting there and back (3–5 day trip)</div>
          <div className="mb-1">
            <b>By road:</b>{' '}
            {guide.costEstimate.road || `Not a realistic option from Nigeria - no safe or practical overland route exists to ${country}.`}
          </div>
          <div className="mb-1">
            <b>By flight:</b> {guide.costEstimate.flight}
          </div>
          {guide.costEstimate.note && <p className="mt-1 text-xs text-[#4c6270]">{guide.costEstimate.note}</p>}
          <p className="mt-1 text-xs text-[#4c6270]">
            Rough figures only - fares and fuel prices move constantly. Check current prices directly with
            an airline/transport operator before booking.
          </p>
        </div>
      )}
    </div>
  );
}
