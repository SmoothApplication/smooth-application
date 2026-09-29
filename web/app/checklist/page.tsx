import { redirect } from 'next/navigation';

// This used to be a stub that told visitors "the real checklist isn't ready on this new site"
// and sent them to the old GitHub Pages mirror (smoothapplication.github.io) — true back when
// task #244's port was still in progress, false since Phase 4 finished. Left in place, it was
// actively misdirecting anyone who hit bare /checklist (an old bookmark or stale link, since the
// real country picker at /checklist/start always routes onward to /checklist/[country]/situation
// and never to this bare path) to the old site's known-buggy bank-statement flow. Direct request,
// found live the same day: replaced with a redirect to the real country picker.
export default function ChecklistIndexRedirect() {
  redirect('/checklist/start');
}
