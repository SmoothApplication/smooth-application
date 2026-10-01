import Link from 'next/link';
import { COUNTRIES } from '@/lib/checklist/countries';
import { FOUNDER_WHATSAPP_NUMBER } from '@/lib/statement/supportContact';

// Task #506 (Phase 2 of the homepage mockup rebuild — #505 added the Lora serif font token this
// builds on). Replaces the stats-led front door from task #395/#396 with a fuller homepage matching
// the supplied mockup's structure (hero, "why preparation matters" stat band, how it works, common
// red flags, FAQ, closing CTA, full footer) and the forest-green/gold/cream palette + serif
// headlines already extracted into tailwind.config.ts back in task #479-487.
//
// The mockup's testimonials/experience-stats band ("99% approval rate", "20 yrs") is still NOT
// here — those were unsourced placeholder numbers (task #506) and still are; no real figures for
// them have been supplied. The three real quotes below (direct from the user, this session) are a
// different thing: actual client testimonials, not stats, so they're shown as quotes attributed by
// first name/initials only — exactly what was given, nothing invented or rounded up alongside them.
//
// The "why preparation matters" figures are carried over verbatim from the previous homepage
// (task #395/#396) — same sources, same caveat about the UK's April 2026 fee rise making the
// £115-per-refusal input stale (still unresolved, still flagged here rather than silently fixed).
const COVERED_COUNTRIES = COUNTRIES.filter((c) => c.ready);
const WHATSAPP_HREF = `https://wa.me/${FOUNDER_WHATSAPP_NUMBER}`;

// "Readiness Kits" paid-tier section (direct request, with real pricing/copy supplied by the
// user — this is what the mockup's "[PRICE]" placeholders were standing in for back in #506, now
// filled with the real thing instead of guessed numbers). Same CTA pattern already used for the
// paid Document Review offer in SituationGate.tsx: a WhatsApp link with a pre-filled message,
// no actual checkout/payment flow — the human on the other end of WhatsApp handles that. The
// ₦35,000 Document Review price here is also now the single source of truth for that offer; the
// older $4/₦22,000 "first 100 applicants" test-promo price in SituationGate.tsx was retired to
// match (see that file's own comment) rather than leaving two different prices for the same
// service live at once.
const READINESS_KITS = [
  {
    name: 'Document Review',
    priceNaira: '₦35,000',
    priceUsd: 'about $22',
    deliveryDays: '3 working days',
    description:
      "A person with twenty years' experience reviews your complete application pack: passport, statements, employment letters, sponsor documents and your draft form answers. You get a written report that lists every issue in order of how likely it is to cause a refusal, and exactly what to change or add.",
    bestFor: 'people applying within the next 4 weeks who want a second pair of eyes.',
    whatsappMessage: "Hi, I'd like to get the Document Review (₦35,000). Here's what I'm applying for:",
  },
  {
    name: 'Full Case Review + Correction Plan',
    priceNaira: '₦95,000',
    priceUsd: 'about $60',
    deliveryDays: '5 working days',
    description:
      'Everything in the Document Review, plus a 30-day plan to fix what can be fixed before you apply: how to explain unexplained inflows, how to align your statements with your income, what a sponsor letter needs to say, and how to answer the questions applicants most often get wrong. Includes one round of follow-up questions by email.',
    bestFor: 'applicants whose free check flagged financial issues, and anyone who has been refused before.',
    whatsappMessage:
      "Hi, I'd like to get the Full Case Review + Correction Plan (₦95,000). Here's what I'm applying for:",
  },
];

// Real client testimonials, supplied directly by the user (this session) — shown as quotes, not
// rounded into a stat like "99% approval rate" (there's no data behind a number like that). Kept
// to exactly what was given: first name/initials only, no added detail about who they are.
const TESTIMONIALS = [
  { quote: 'He made me see the errors in my bank statement.', name: 'PJ' },
  { quote: 'I have not seen someone explain to me what inflows can do to my application.', name: 'Sam' },
  { quote: 'With what you wrote for me based on my inflow, I was able to get my Visa.', name: 'Femi' },
];

function Header() {
  return (
    <header className="border-b border-black/5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-white" aria-hidden>
            ✓
          </span>
          <span className="font-serif text-lg font-semibold text-[#12232e]">Smooth Application</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-[#39505c] md:flex">
          <a href="#how-it-works" className="hover:text-[#12232e]">
            How it works
          </a>
          <Link href="/checklist/start" className="hover:text-[#12232e]">
            Free checklists
          </Link>
          <Link href="/opportunities" className="hover:text-[#12232e]">
            Funded opportunities
          </Link>
          <a href="#readiness-kits" className="hover:text-[#12232e]">
            Readiness Kits
          </a>
          <a href="#faq" className="hover:text-[#12232e]">
            FAQ
          </a>
          <Link href="/login" className="hover:text-[#12232e]">
            Sign in
          </Link>
        </nav>
        <Link href="/quiz" className="btn-primary text-sm">
          Start free Quick Check
        </Link>
      </div>
    </header>
  );
}

export default function HomePage() {
  return (
    <main className="bg-cream">
      <Header />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-10 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full bg-accent-wash px-3 py-1 text-xs font-semibold text-accent">
              For Nigerian applicants — 8 countries, free
            </span>
            <h1 className="font-serif text-4xl font-semibold leading-tight text-[#12232e] sm:text-5xl">
              Get your application ready <em className="italic text-accent">before</em> you pay the visa fee.
            </h1>
            <p className="max-w-lg text-base text-[#4c6270]">
              Most refusals come down to finances that don&apos;t add up on paper. Answer a few quick
              questions and get a personal checklist of what to fix — so you apply once, and apply
              ready.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/quiz" className="btn-primary">
                Start the free Quick Check →
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border border-black/10 px-5 py-3 text-center font-semibold text-[#12232e] hover:bg-black/5"
              >
                See how it works
              </a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#4c6270]">
              <span>✓ Free</span>
              <span>✓ About 2 minutes</span>
              <span>✓ Personal to your situation</span>
            </div>
          </div>

          {/* Illustrative sample of what the quiz produces — generic placeholder figures, not a
              claim about any real applicant's actual result. */}
          <div className="card-surface mx-auto w-full max-w-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#566a76]">
              Your screening checklist
            </p>
            <p className="mt-1 font-serif text-lg font-semibold text-[#12232e]">UK visitor visa — Tourism</p>
            <ul className="mt-4 flex flex-col gap-3 text-sm">
              <li className="flex items-center justify-between rounded-lg bg-good-wash px-3 py-2 text-good">
                <span>Six months of statements, stamped by your bank</span>
                <span className="font-semibold">Ready</span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-good-wash px-3 py-2 text-good">
                <span>Salary credits match your employment letter</span>
                <span className="font-semibold">Ready</span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-warn-wash px-3 py-2 text-warn-text">
                <span>Large deposit last month — needs a paper trail</span>
                <span className="font-semibold">Fix first</span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2 text-[#4c6270]">
                <span>Leave letter from your employer</span>
                <span className="font-semibold">To-do</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Why preparation matters — real, sourced figures carried over from the previous homepage. */}
      <section className="bg-accent-dark px-4 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">Why preparation matters</p>
          <h2 className="mt-3 max-w-3xl font-serif text-3xl font-semibold leading-tight sm:text-4xl">
            A refusal costs more than the fee. It follows every application after it.
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-white/70">
            Nigerian applicants are refused for more often than the global average — and the visa fee
            is never refunded. These are the numbers we help you stay out of.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
            <div>
              <p className="font-serif text-3xl font-bold text-gold sm:text-4xl">38.65%</p>
              <p className="mt-2 text-xs text-white/60">
                Nigeria&apos;s UK visitor-visa refusal rate, year ending March 2026 — more than 2× the
                UK&apos;s global average
              </p>
            </div>
            <div>
              <p className="font-serif text-3xl font-bold text-gold sm:text-4xl">1.13M</p>
              <p className="mt-2 text-xs text-white/60">UK visitor-visa refusals for Nigerian applicants, 2005–Q1 2026</p>
            </div>
            <div>
              <p className="font-serif text-3xl font-bold text-gold sm:text-4xl">₦246bn+</p>
              <p className="mt-2 text-xs text-white/60">Lost on non-refundable fees for refused UK applications, 2005–Q1 2026 (≈£129.6M)</p>
            </div>
            <div>
              <p className="font-serif text-3xl font-bold text-gold sm:text-4xl">45.9%</p>
              <p className="mt-2 text-xs text-white/60">
                Schengen refusal rate for Nigerian applicants in 2024 — 50,376 of 111,201 applications
              </p>
            </div>
          </div>
          <p className="mt-8 text-[11px] text-white/40">
            Sources: UK Home Office Immigration System Statistics (year ending March 2026) · Schengen
            visa statistics, 2024. The ₦246bn+ figure uses the UK&apos;s standard visitor-visa base fee
            at the time most of these refusals occurred (£115) — that fee rose in April 2026, so this
            specific input is now a little stale.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">How it works</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-[#12232e]">
              From worried to ready, in three steps.
            </h2>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              n: '1',
              title: 'Take the Quick Check',
              body: 'A few questions about your work, income, savings, travel history and trip. About two minutes, free.',
            },
            {
              n: '2',
              title: 'See what a reviewer will check',
              body: 'A personal checklist flags the gaps in your documents, and your bank statement is auto-checked for issues reviewers commonly flag.',
            },
            {
              n: '3',
              title: 'Fix it, then apply',
              body: 'Work through what’s outstanding until you’re genuinely ready — so you apply once, and apply right.',
            },
          ].map((step) => (
            <div key={step.n} className="card-surface p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-wash font-serif text-lg font-bold text-gold">
                {step.n}
              </span>
              <h3 className="mt-4 text-base font-semibold text-[#12232e]">{step.title}</h3>
              <p className="mt-2 text-sm text-[#4c6270]">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Common red flags — matches real checks this app's statement/checklist tools already run. */}
      <section className="bg-[#f0ebe0] px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Common red flags</p>
          <h2 className="mt-2 max-w-2xl font-serif text-3xl font-semibold text-[#12232e]">
            Most refusals aren&apos;t about who you are. They&apos;re about what your papers say.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: '💰',
                title: 'Unexplained lump sums',
                body: 'A big deposit just before you apply, with no paper trail, can look like borrowed money.',
              },
              {
                icon: '📊',
                title: "Income that doesn't match",
                body: 'Your salary credits, payslips and employment letter all need to tell the same story.',
              },
              {
                icon: '✈️',
                title: 'A trip bigger than your savings',
                body: 'Reviewers weigh your trip cost against your usual balance — not just the closing figure.',
              },
              {
                icon: '🏠',
                title: 'Ties to home left unproven',
                body: 'Your job, family and commitments at home need to be evidenced, not just stated.',
              },
            ].map((flag) => (
              <div key={flag.title} className="card-surface flex gap-4 p-5">
                <span className="text-2xl" aria-hidden>
                  {flag.icon}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#12232e]">{flag.title}</h3>
                  <p className="mt-1 text-sm text-[#4c6270]">{flag.body}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/quiz" className="btn-primary mt-8 inline-block">
            Check my application
          </Link>
        </div>
      </section>

      {/* Readiness Kits — paid human review tiers, see READINESS_KITS above for sourcing notes. */}
      <section id="readiness-kits" className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Want a second pair of eyes?</p>
        <h2 className="mt-2 max-w-2xl font-serif text-3xl font-semibold text-[#12232e]">
          The checklist is free. If you want someone experienced to check it for you, that&apos;s here too.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-[#4c6270]">
          These are paid, done-by-hand reviews — not automated, and separate from the free Quick Check
          and checklist above.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {READINESS_KITS.map((kit) => (
            <div key={kit.name} className="card-surface border-t-4 border-accent p-6">
              <p className="font-serif text-2xl font-bold text-[#12232e]">
                {kit.priceNaira} <span className="text-lg font-semibold">{kit.name}</span>
              </p>
              <p className="mt-1 text-sm italic text-[#8a99a3]">
                {kit.priceUsd} · delivered within {kit.deliveryDays}
              </p>
              <p className="mt-4 text-sm text-[#4c6270]">{kit.description}</p>
              <p className="mt-4 text-sm text-[#12232e]">
                <span className="font-semibold">Best for:</span> {kit.bestFor}
              </p>
              <a
                href={`https://wa.me/${FOUNDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(kit.whatsappMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block font-semibold text-accent underline"
              >
                Get my {kit.name} →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials — real client quotes, see TESTIMONIALS above for sourcing notes. */}
      <section className="bg-accent-wash px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">What applicants say</p>
          <h2 className="mt-2 max-w-2xl font-serif text-3xl font-semibold text-[#12232e]">
            From people who used the Document Review.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="card-surface p-6">
                <p className="font-serif text-lg italic leading-snug text-[#12232e]">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-3 text-sm font-semibold text-accent">— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Questions, answered</p>
        <div className="mt-6 grid gap-x-10 gap-y-2 sm:grid-cols-2">
          {[
            {
              q: 'Is the Quick Check really free?',
              a: 'Yes. It takes about two minutes and gives you a personal readiness checklist. No card, no sign-up required to see it.',
            },
            {
              q: 'Can you guarantee my visa?',
              a: 'No one can. The decision belongs to the relevant visa authority, not us. Our job is to help your application give them every reason to say yes.',
            },
            {
              q: 'Which countries do you cover?',
              a: `${COVERED_COUNTRIES.map((c) => c.name).join(', ')} — with more being added.`,
            },
            {
              q: "My statement has a deposit I can't explain. Is it too late?",
              a: 'Usually not — the checklist flags it so you can gather a paper trail (a gift letter, a sale receipt) before you apply, rather than finding out after a refusal.',
            },
            {
              q: 'Can you fill in the application form for me?',
              a: "No — this is guidance, not a filing service or immigration advice. It's built to make sure your own paperwork is in order before you apply.",
            },
            {
              q: 'Is my data private?',
              a: 'Your bank statement and documents are processed entirely in your browser and are never uploaded anywhere. Saving your progress is optional and only stores your email, destination and progress.',
            },
          ].map((item) => (
            <details key={item.q} className="border-b border-black/10 py-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#12232e]">{item.q}</summary>
              <p className="mt-2 text-sm text-[#4c6270]">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm text-[#4c6270]">
          Something else on your mind?{' '}
          <a href={WHATSAPP_HREF} target="_blank" rel="noopener" className="text-accent underline">
            Send us a message
          </a>{' '}
          and we&apos;ll reply.
        </p>
      </section>

      {/* Closing CTA */}
      <section className="px-4 pb-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 rounded-3xl bg-accent-dark px-6 py-10 text-center text-white sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">
              Apply once. <em className="italic text-gold">Apply ready.</em>
            </h2>
            <p className="mt-2 text-sm text-white/70">
              Two minutes now can save you a refusal — and the fee that goes with it.
            </p>
          </div>
          <Link href="/quiz" className="btn-gold shrink-0">
            Start the free Quick Check →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-[#ece6d8] px-4 py-12 text-sm">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs text-white" aria-hidden>
                ✓
              </span>
              <span className="font-serif font-semibold text-[#12232e]">Smooth Application</span>
            </div>
            <p className="mt-3 max-w-xs text-xs text-[#566a76]">
              An independent visa-readiness service for Nigerian applicants. We are not affiliated with
              any visa authority or consulate, and we cannot influence a visa decision.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#12232e]">Get ready</p>
            <ul className="mt-3 flex flex-col gap-2 text-[#566a76]">
              <li>
                <Link href="/quiz" className="hover:text-accent">
                  Free Quick Check
                </Link>
              </li>
              <li>
                <Link href="/checklist/start" className="hover:text-accent">
                  Free checklists
                </Link>
              </li>
              <li>
                <Link href="/opportunities" className="hover:text-accent">
                  Funded opportunities
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-accent">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-[#12232e]">Checklists by destination</p>
            <ul className="mt-3 flex flex-col gap-2 text-[#566a76]">
              {COVERED_COUNTRIES.map((c) => (
                <li key={c.code}>
                  <Link href={`/checklist/${c.code.toLowerCase()}`} className="hover:text-accent">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-[#12232e]">Smooth Application</p>
            <ul className="mt-3 flex flex-col gap-2 text-[#566a76]">
              <li>
                <a href={WHATSAPP_HREF} target="_blank" rel="noopener" className="hover:text-accent">
                  Contact
                </a>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-accent">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-accent">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-6xl border-t border-black/10 pt-6 text-xs text-[#8a99a3]">
          © {new Date().getFullYear()} Smooth Application. Guidance only, not immigration advice.
        </p>
      </footer>
    </main>
  );
}
