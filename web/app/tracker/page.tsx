'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrackerEntry, APP_TRACKER_KEY, normalizeTrackerEntries } from '@/lib/tracker';
import { TrackerCard } from '@/components/opportunities/TrackerCard';

// Port of index.html's Personal application tracker (#appTrackerCard / renderTracker(), see
// index.html ~line 1770 and ~line 12807) — "Phase 2 of the same UNILAG street-test feedback that
// produced the opportunities directory". The tracker UI itself now lives in
// components/opportunities/TrackerCard.tsx, shared with /opportunities (which combines the
// directory with this same tracker on one screen, matching the original's #opportunitiesGate) —
// this page is a standalone shortcut straight to just the tracker, reached from every country
// checklist's header (see CountryChecklistApp's trackerHref).
//
// Privacy: unchanged from the rest of this app — tracked entries live only in this browser's
// localStorage under smoothApplication_oppTracker_v1, never sent anywhere.
export default function TrackerPage() {
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
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

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <TrackerCard entries={entries} setEntries={setEntries} />
      <Link href="/checklist/start" className="text-center text-xs text-accent underline">
        ← Back
      </Link>
    </main>
  );
}
