'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Opportunity,
  Pathway,
  PATHWAY_META,
  OPPORTUNITIES,
  OPPORTUNITIES_LAST_VERIFIED,
  getVisibleFilterKeys,
  filterOpportunities,
} from '@/lib/opportunities';
import { TrackerEntry, APP_TRACKER_KEY, normalizeTrackerEntries, isTracked, toggleTrack } from '@/lib/tracker';
import { TrackerCard } from '@/components/opportunities/TrackerCard';

// Port of index.html's #opportunitiesGate (~line 1753) — "Funded opportunities & exchange
// programs", combined on one screen with the personal application tracker (#appTrackerCard), same
// as the original. Reached directly from the country picker (see the link added to
// /checklist/start) rather than from inside any country's checklist — no country pick, no consent
// checkbox, no situation gate — for exactly the applicant this is meant to help most: someone who
// can't yet afford ANY visa and just wants to see funded alternatives.
//
// The directory itself (OPPORTUNITIES) is static and country-independent, same as the original —
// built once, not tied to answers/checked state. The tracker card shares one `entries` state with
// this page (lifted up here) so toggling "+ Add to my tracker" on a program immediately flips its
// button to "✓ In my tracker" AND shows up in the tracker list below, without a reload — the same
// two-way wiring toggleTrack()/isTracked() had in the original between renderOpportunities() and
// renderTracker().
export default function OpportunitiesPage() {
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [oppFilter, setOppFilter] = useState<'all' | Pathway>('all');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(APP_TRACKER_KEY);
      if (raw) setEntries(normalizeTrackerEntries(JSON.parse(raw)));
    } catch {
      /* start fresh */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(APP_TRACKER_KEY, JSON.stringify(entries));
    } catch {
      /* fail silently, same as the rest of this app's autosave */
    }
  }, [entries, loaded]);

  if (!loaded) return null;

  const filterKeys = getVisibleFilterKeys(OPPORTUNITIES);
  const shown = filterOpportunities(OPPORTUNITIES, oppFilter);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">🎓 Funded opportunities &amp; exchange programs</h1>
        <p className="mt-1 text-sm text-[#4c6270]">Browse real, currently-running programs — no visa pick or checklist needed.</p>
      </div>

      <div className="rounded-lg border border-black/10 bg-white p-4">
        <p className="text-sm text-[#4c6270]">
          Can&apos;t yet afford the trip you&apos;re preparing for? These are real, currently-running programs -
          scholarships, exchanges, and fellowships - that cover some or all of the cost for students in Nigeria. This
          list is separate from the visa checklist; it isn&apos;t visa-specific, and Smooth Application isn&apos;t
          affiliated with any program on it.
        </p>
        <div className="mt-3 rounded-md border border-[#a83d3d]/30 bg-[#a83d3d]/10 p-3 text-sm text-[#7a2c2c]">
          <b>⚠️ Watch for scams.</b> A genuine scholarship, exchange, or fellowship never asks you to pay to be
          selected, to release your winnings, or to &quot;process&quot; your visa through them. Apply only through the
          official link shown for each program below - never through an agent, a WhatsApp/Telegram group, or a
          lookalike site that contacts you first. If in doubt, search the program&apos;s name plus the word
          &quot;scam&quot; before you pay anything or share your documents.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filterKeys.map((k) => {
            const label = k === 'all' ? `All (${OPPORTUNITIES.length})` : PATHWAY_META[k].label;
            const active = oppFilter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setOppFilter(k)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  active ? 'border-accent bg-accent-wash text-accent' : 'border-black/10 text-[#4c6270] hover:border-accent/50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <p className="mt-4 text-sm text-[#4c6270]">No programs currently listed in this category.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {shown.map((o) => (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                tracked={isTracked(entries, o.id)}
                onToggleTrack={() => setEntries((prev) => toggleTrack(prev, o.id, o.name))}
              />
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-[#566a76]">
          Details above (funding, eligibility, deadlines) change year to year - always confirm the current cycle on
          the program&apos;s own official site before relying on anything here. Last checked: {OPPORTUNITIES_LAST_VERIFIED}.
        </p>
      </div>

      <TrackerCard entries={entries} setEntries={setEntries} />

      <Link href="/checklist/start" className="text-center text-xs text-accent underline">
        ← Back to the visa checklist
      </Link>
    </main>
  );
}

function OpportunityCard({
  opportunity,
  tracked,
  onToggleTrack,
}: {
  opportunity: Opportunity;
  tracked: boolean;
  onToggleTrack: () => void;
}) {
  const meta = PATHWAY_META[opportunity.pathway];
  return (
    <div className="rounded-lg border border-black/10 bg-[#f7fafb] p-4">
      <span
        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: meta.color }}
      >
        {meta.label}
      </span>
      <h3 className="mt-2 text-sm font-semibold text-[#12232e]">{opportunity.name}</h3>
      <p className="mt-1 text-sm text-[#4c6270]">{opportunity.summary}</p>
      <p className="mt-2 text-sm text-[#4c6270]">
        <span className="font-medium text-[#12232e]">Funding: </span>
        {opportunity.funding}
      </p>
      <p className="mt-1 text-sm text-[#4c6270]">
        <span className="font-medium text-[#12232e]">Eligibility: </span>
        {opportunity.eligibilityNote}
      </p>
      <p className="mt-1 text-sm text-[#4c6270]">
        <span className="font-medium text-[#12232e]">When to apply: </span>
        {opportunity.whenToApply}
      </p>
      <a
        href={opportunity.officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs font-semibold text-accent underline"
      >
        Official site: {opportunity.officialUrlText} ↗
      </a>
      <button
        type="button"
        onClick={onToggleTrack}
        className={`mt-3 block rounded-md px-3 py-1.5 text-xs font-medium ${
          tracked ? 'bg-accent-wash text-accent' : 'bg-accent text-white hover:opacity-90'
        }`}
      >
        {tracked ? '✓ In my tracker' : '+ Add to my tracker'}
      </button>
    </div>
  );
}
