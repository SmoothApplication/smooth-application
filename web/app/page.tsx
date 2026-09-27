import Link from 'next/link';

// Applicant-facing landing page — Phase 1 of porting the free checklist (index.html) into this
// app (see CHANGELOG / task #244). This replaces the earlier placeholder that only linked to
// admin sign-in.
//
// The primary CTA still goes straight to the country picker (/checklist/start) — that's the
// fastest path for someone who already knows what they need. A scoped version of index.html's
// pre-checklist confidence quiz shipped in Phase 4d at /quiz (a handful of qualifying questions
// + a directional readiness read, pre-filling the checklist's profile form) and is offered here
// as a secondary link for anyone who wants a warm-up first, rather than replacing the fast path.
//
// Copy note: index.html's subtitle still says "UK, Canada, Schengen & South Africa" — stale by
// the time this was ported (Ghana, Kenya, Ethiopia and Morocco all shipped since). Corrected here.
//
// Simplified per user feedback ("too busy for a front page", live screenshot): collapsed the
// three separate pill badges into one plain trust line, dropped the "source code is public"
// paragraph (moved the same link into the "What you need to know" details, so it's still findable
// but no longer a fourth line of copy before the CTA), and merged the admin-sign-in and legal
// links into one small footer line instead of two stacked ones.
//
// Design pass ("this site needs a UI/UX designer"): swapped the flat shadow-sm card and
// hover:opacity-90 button for the new .card-surface / .btn-primary classes (globals.css) — real
// depth on the card, a proper hover/press state on the button — plus a very subtle radial accent
// glow behind the card so the page doesn't read as a flat gray rectangle.
export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7fafb] p-6">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />
      <div className="card-surface relative w-full max-w-md p-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-wash text-lg" aria-hidden>
            ⚡
          </span>
          <span className="text-lg font-semibold text-[#12232e]">Smooth Application</span>
          <span className="rounded-full bg-good-wash px-2 py-0.5 text-xs font-bold tracking-wide text-good">
            FREE
          </span>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-[#4c6270]">
          A free document checklist for{' '}
          <b className="text-[#12232e]">
            UK, Canada, Schengen, South Africa, Ghana, Kenya, Ethiopia &amp; Morocco
          </b>{' '}
          travel.
        </p>

        <p className="mb-5 rounded-lg bg-accent-wash px-3 py-2 text-xs font-medium text-accent">
          🔒 Runs entirely in your browser, free always, built for Nigerian applicants
        </p>

        <Link href="/checklist/start" className="btn-primary block">
          Start your free checklist
        </Link>
        <Link href="/quiz" className="mt-2 block text-center text-xs text-accent underline">
          Not sure where you stand? Take the 2-minute readiness check
        </Link>

        <details className="mt-5 rounded-lg border border-black/10 p-3 text-sm text-[#4c6270]">
          <summary className="cursor-pointer font-medium text-[#12232e]">What you need to know</summary>
          <div className="mt-2 flex flex-col gap-2">
            <p>
              <b>Your privacy:</b> your documents and files are scanned entirely in your browser and never
              uploaded anywhere. No account required to use the checklist, no ads, no catch.
            </p>
            <p>
              <b>Not an approval predictor:</b> this is guidance, not immigration advice — it checks how ready
              your documents and evidence look, not your chances of approval. Only the consulate or embassy
              decides that.
            </p>
            <p>
              <b>Countries covered:</b> UK Standard Visitor, Canada visitor (TRV), Schengen short-stay (Type C),
              South Africa, Ghana, Kenya, Ethiopia and Morocco are all live. United States, Australia and China
              are coming soon.
            </p>
            <p>
              Don&apos;t take our word for it —{' '}
              <a
                href="https://github.com/SmoothApplication/smooth-application"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                the source code is public
              </a>
              .
            </p>
          </div>
        </details>

        <p className="mt-6 text-center text-xs text-[#566a76]">
          <Link href="/login" className="text-accent underline">
            Admin sign in
          </Link>{' '}
          ·{' '}
          <Link href="/privacy" className="text-accent underline">
            Privacy Policy
          </Link>{' '}
          ·{' '}
          <Link href="/terms" className="text-accent underline">
            Terms of Use
          </Link>
        </p>
      </div>
    </main>
  );
}
