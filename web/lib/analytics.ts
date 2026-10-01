// Follow-up selection "Wire analytics into the new Next.js app" — the GoatCounter recheck done on
// this session's "Re-check funnel analytics" task turned up a hard scoping fact: GoatCounter was
// (and still is, until this file) wired ONLY into the legacy index.html/GitHub Pages site, never
// into this Next.js app. That meant every feature shipped during this session's port (name-tally
// checks, narration decoder, work-payment categorization, scanned-statement OCR, etc.) had zero
// real-usage data behind it. This module ports index.html's own analytics block (~line 3265-3370)
// so the same kind of anonymous, aggregate funnel data becomes available here going forward.
//
// Same privacy promise as index.html: documents/answers never leave the device. This is a
// completely separate, optional layer — anonymous, aggregate USAGE COUNTS ONLY (e.g. "a session
// reached the statement page"). No cookies, no personal data, no cross-site tracking (GoatCounter
// is privacy-first and honors Do Not Track automatically).
//
// Reuses the SAME GoatCounter site/account as index.html ('smoothapplication') rather than asking
// for a second signup — deliberately. The tradeoff: without a second site, this app's events would
// be indistinguishable from the legacy site's identically-named events on the same dashboard (e.g.
// both sites firing "session_started:UK" would count together, defeating the point of separating
// them). Every event name below is prefixed "app:" specifically so a future funnel check can filter
// the GoatCounter dashboard to just this app's traffic (search/filter box, or the Pages widget) and
// know for certain it's looking at this Next.js app, not the old site. If a dedicated second
// GoatCounter site is ever created for this app, only ANALYTICS_SITE_CODE below needs to change —
// no call-site changes needed.
const ANALYTICS_SITE_CODE = 'smoothapplication';

// Every event name this app fires, kept in sync with the trackEvent() calls below (same discipline
// index.html's own comment block uses) — all under the "app:" prefix explained above:
//   app:quiz_start                 — "Start the quiz" clicked (web/app/quiz/page.tsx)
//   app:quiz_skip                  — "Skip — go straight to the checklist" clicked
//   app:quiz_completed             — "See my result" clicked
//   app:session_started:<CODE>     — country + consent gate "Continue" clicked (checklist/start)
//   app:situation_selected:<kind>  — "Where are you in the process?" option chosen; <kind> is
//                                     "fresh", "refused", or "paid" (SituationGate.tsx)
//   app:situation_continue         — "Continue to my checklist" clicked from the situation gate
//   app:checklist_view             — profile form submitted, real checklist body shown
//   app:session_view:<key>         — a header link into a side page was clicked; <key> is one of
//                                     "financial", "statement", "passport", "business-income",
//                                     "travel-history", "reasons", "tracker" (CountryChecklistApp.tsx)
//   app:statement_analysis:attempted / :completed — the bank-statement analyzer funnel
//                                     (StatementCheck.tsx)
//   app:readiness_kits_view        — the homepage's Readiness Kits section scrolled into view
//                                     (components/ReadinessKits.tsx), fired once per page load
//   app:readiness_kits_cta_click:<kit> — a "Get my ___" CTA clicked; <kit> is "document_review" or
//                                     "full_case_review" (ReadinessKits.tsx) — paired with
//                                     :readiness_kits_view so the GoatCounter dashboard shows a
//                                     real view→click conversion rate, not just raw click counts
//                                     (task #513, direct request)
// Task #419 (direct request: "I want it to count as it counts before so I can trace the number of
// people who hit the website"): previously this script only loaded — and so only ever counted
// anything — the first time a `trackEvent()` call happened to fire on a given page (a country
// picked, "Start the quiz" clicked, etc.). Most session pages in this port (SessionShell and every
// page it wraps: responsibilities, trip-details, the document-checklist categories, final review...)
// never call trackEvent() at all, so a real visitor who landed, read a page, and left without
// clicking one of those specific buttons was never counted anywhere — undercounting total traffic,
// not just funnel steps. `data-goatcounter-settings` below disables GoatCounter's own automatic
// on-load pageview (which would otherwise double-count against the explicit calls this file now
// makes) so this file is the one place that decides when a pageview counts.
let analyticsLoaded = false;
function loadAnalytics() {
  if (!ANALYTICS_SITE_CODE || analyticsLoaded) return;
  analyticsLoaded = true;
  try {
    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-goatcounter', 'https://' + ANALYTICS_SITE_CODE + '.goatcounter.com/count');
    s.setAttribute('data-goatcounter-settings', JSON.stringify({ no_onload: true }));
    s.src = '//gc.zgo.at/count.js';
    document.head.appendChild(s);
  } catch {
    /* analytics must never break the app */
  }
}

type GoatCounter = { count?: (o: { path: string; title?: string; event?: boolean }) => void };
function getGoatCounter(): GoatCounter | undefined {
  return (window as unknown as { goatcounter?: GoatCounter }).goatcounter;
}

// Fires `fn` once GoatCounter's script has finished loading and exposed window.goatcounter — the
// script is injected async, so on the very first call in a page's lifetime it may not be ready the
// instant this runs. Gives up silently after ~2s (a slow/blocked analytics script must never delay
// or break anything else on the page).
function whenReady(fn: (gc: GoatCounter) => void) {
  const gc = getGoatCounter();
  if (gc && typeof gc.count === 'function') {
    fn(gc);
    return;
  }
  let attempts = 0;
  const iv = setInterval(() => {
    attempts += 1;
    const gc2 = getGoatCounter();
    if (gc2 && typeof gc2.count === 'function') {
      clearInterval(iv);
      fn(gc2);
    } else if (attempts > 20) {
      clearInterval(iv);
    }
  }, 100);
}

// Task #419: a plain, unconditional pageview — call this once per route the visitor actually loads
// (see components/Analytics.tsx, mounted in the root layout so it runs on every page except /admin).
// This is deliberately separate from trackEvent()'s "app:"-prefixed funnel events: `path` here is the
// real URL path, so GoatCounter's own Pages widget shows genuine per-page traffic counts, the same
// kind of number the original's single-page analytics setup relied on.
export function trackPageview(path: string): void {
  if (typeof window === 'undefined' || !ANALYTICS_SITE_CODE) return;
  try {
    loadAnalytics();
    whenReady((gc) => gc.count!({ path }));
  } catch {
    /* never let analytics break the app */
  }
}

// trackEvent() only ever sends an event NAME — never a filename, a document's contents, an answer
// typed into a form, or any other identifying detail. Safe to call from anywhere, including during
// server-side rendering (the `typeof window` guard below makes it a no-op there).
export function trackEvent(name: string): void {
  if (typeof window === 'undefined' || !ANALYTICS_SITE_CODE) return;
  try {
    loadAnalytics();
    whenReady((gc) => gc.count!({ path: 'app:' + name, title: 'app:' + name, event: true }));
  } catch {
    /* never let analytics break the app */
  }
}
