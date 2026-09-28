import Link from 'next/link';

// New front door (task #395, direct request + supplied screenshot — replaces the earlier "homepage
// IS the quiz-intro" merge from task #379). Leads with real UK/Schengen visa-refusal data for
// Nigerian applicants before any quiz or checklist, then a single CTA into the existing quiz-intro
// screen (app/quiz/page.tsx, still reachable at /quiz and unchanged) — same "one mandatory next
// step, no skip link" philosophy as before, just a different opening beat.
//
// Figures verified against public sources before shipping (see CHANGELOG for the full search
// trail):
// - 1.13M UK visitor-visa refusals for Nigerian applicants, 2005–Q1 2026, and the 38.65% refusal
//   rate for the year ending March 2026 both match UK Home Office Immigration System Statistics
//   reporting (multiple outlets cite the same Home Office release: 1.34M total refusals across all
//   visa types 2005–Q1 2026, of which 1,127,088 / 83.8% were visitor visas — the 1.13M here).
// - Schengen 2024 figures (50,376 of 111,201 applications refused, 45.9%) match EU Commission /
//   consulate-reported Schengen visa statistics for Nigeria, 2024 — corroborated by multiple
//   independent outlets reporting the same numbers.
// - CAVEAT flagged to the user, not yet resolved: the "£115 base fee" the UK money-lost figure
//   multiplies by was the standard 6-month visitor visa fee for most of the period these figures
//   were compiled, but UK visa fees rose in April 2026 (to roughly £127–£135 depending on source) —
//   so as of today this specific input is stale. Left as supplied pending the user's call on
//   whether to recompute with the current fee; the NGN 246bn+ / £129.6M figure is arithmetically
//   exactly 1,127,088 × £115, so it's internally consistent, just anchored to a since-superseded fee.
export default function HomePage() {
  return (
    // Task #396 (direct request, annotated screenshot): the original py-10 sm:py-16 top padding left
    // a large blank gap between the browser chrome and the "Smooth Application" header before any
    // content appeared — cut to a small top gap (pt-6) while keeping comfortable bottom breathing
    // room (pb-10 sm:pb-16), so the stat cards start higher up the viewport instead of being pushed
    // down by unused space.
    <main className="min-h-screen bg-[#f7fafb] px-4 pb-10 pt-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-wash text-lg" aria-hidden>
            ⚡
          </span>
          <span className="text-lg font-semibold text-[#12232e]">Smooth Application</span>
        </div>

        {/* Task #404 (direct request, 3 screenshots comparing this page's boxes to the quiz-result
            and trust-card boxes): "make sure the images... have the same sizes and same font and
            use the same colour where it applies." Box padding (p-6) and the good/warn colour split
            already matched the quiz pages, but the headline number here was text-4xl/text-3xl —
            much bigger than the quiz pages' text-xl headline sentences. Per the user's explicit
            call (leave the quiz pages alone, bring this page in line with them), shrunk both
            headline sizes here to text-xl font-extrabold leading-snug, matching the quiz-result
            grid (app/quiz/page.tsx, task #397-#399) and trust card (task #400) exactly. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card-surface p-6">
            <p className="text-xl font-extrabold leading-snug text-good">1.13M</p>
            <p className="mt-2 text-sm text-[#4c6270]">
              UK visitor-visa refusals for Nigerian applicants, 2005–Q1 2026
            </p>
          </div>
          <div className="card-surface p-6">
            <p className="text-xl font-extrabold leading-snug text-good">38.65%</p>
            <p className="mt-2 text-sm text-[#4c6270]">
              Nigeria&apos;s UK visitor-visa refusal rate, year ending March 2026 — more than 2× the
              UK&apos;s global average
            </p>
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-[#566a76]">
          Money lost on non-refundable fees
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#12232e] p-6 text-white">
            <p className="text-xs font-medium uppercase tracking-wide text-white/60">
              UK · 2005–Q1 2026
            </p>
            <p className="mt-2 text-xl font-extrabold leading-snug text-warn">NGN 246bn+</p>
            <p className="mt-2 text-xs text-white/70">≈£129.6M · 1.13M refusals × £115 base fee</p>
          </div>
          <div className="rounded-2xl bg-[#12232e] p-6 text-white">
            <p className="text-xs font-medium uppercase tracking-wide text-white/60">
              Schengen · 2024 only
            </p>
            <p className="mt-2 text-xl font-extrabold leading-snug text-warn">NGN 7.1bn+</p>
            <p className="mt-2 text-xs text-white/70">
              ≈$5.1M · 50,376 of 111,201 applications refused (45.9%)
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-[#8a99a3]">
          Sources: UK Home Office Immigration System Statistics (year ending March 2026) · Schengen
          visa statistics, 2024.
        </p>

        <Link
          href="/quiz"
          className="mt-2 block rounded-lg bg-accent px-6 py-4 text-center text-lg font-extrabold uppercase tracking-wide text-white transition-all duration-150 hover:bg-[#0e5a80] active:scale-[0.98]"
        >
          Click here before you apply
        </Link>
      </div>
    </main>
  );
}
