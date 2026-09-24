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
export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7fafb] p-6">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
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

        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-accent-wash px-3 py-1 text-xs font-medium text-accent">
            🔒 Runs in your browser — nothing you upload is ever sent to a server
          </span>
          <span className="rounded-full bg-accent-wash px-3 py-1 text-xs font-medium text-accent">
            🆓 Free, always
          </span>
          <span className="rounded-full bg-accent-wash px-3 py-1 text-xs font-medium text-accent">
            🇳🇬 Built for Nigerian applicants
          </span>
        </div>

        <p className="mb-5 text-xs text-[#566a76]">
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

        <Link
          href="/checklist/start"
          className="block w-full rounded-lg bg-accent px-4 py-3 text-center font-semibold text-white hover:opacity-90"
        >
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
          </div>
        </details>

        <p className="mt-6 text-center text-xs text-[#566a76]">
          Work at Smooth Application?{' '}
          <Link href="/login" className="text-accent underline">
            Admin sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
