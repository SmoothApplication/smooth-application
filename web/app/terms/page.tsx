import Link from 'next/link';

// Companion to app/privacy/page.tsx — see that file's header comment for why both were added now
// (go-live readiness audit follow-up). Kept to what's actually true about this app: free guidance
// tool, not immigration advice, no outcome guarantee — matching the disclaimer copy already shown
// throughout the checklist (see lib/checklist/countries.ts's disclaimerBullets/disclaimerFullHtml).
export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">Terms of Use</h1>
        <p className="mt-1 text-xs text-[#566a76]">Last updated September 2026</p>
      </div>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">What this is</h2>
        <p>
          Smooth Application is a free, informational document-readiness checklist for people preparing visa
          or travel applications. It helps you see what documents and evidence are commonly expected, and
          gives you tools (a passport scanner, bank statement analyzer, financial calculator, and similar) to
          check your own materials before you submit them.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">What this is not</h2>
        <p>
          This is guidance only, not immigration or legal advice, and not a prediction of whether any
          application will be approved. Only the relevant consulate, embassy, or immigration authority decides
          that. We are not a licensed immigration adviser, and nothing here should be treated as a substitute
          for one. For an actual assessment of your situation — especially after a previous refusal — an
          OISC-registered (UK) or RCIC-registered (Canada) adviser, or the equivalent for your destination
          country, is the right resource.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">Your responsibility</h2>
        <p>
          You are responsible for the accuracy and completeness of anything you submit to a visa or
          immigration authority. This tool can help you organize and double-check your own evidence, but it
          cannot verify facts about your life, your finances, or your documents beyond what you tell it or
          what it can read from a file you provide.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">No warranty</h2>
        <p>
          This service is provided free of charge, &quot;as is&quot;, without warranties of any kind. We do our best
          to keep country requirements and processing-time information accurate and current, but immigration
          rules change, and we can&apos;t guarantee this checklist reflects every rule at every moment.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">Paid services</h2>
        <p>
          Separately from the free checklist, we occasionally offer a paid Document Review where a real
          person looks over your materials before your appointment. Details and pricing are given directly if
          you message us about it — nothing is charged automatically, and using the free checklist never
          requires paying for anything.
        </p>
      </section>

      <p className="text-sm text-[#4c6270]">
        See our{' '}
        <Link href="/privacy" className="text-accent underline">
          Privacy Policy
        </Link>{' '}
        for how we handle any information you choose to give us. Questions? Email{' '}
        <a href="mailto:hello@smoothapplication.com" className="text-accent underline">
          hello@smoothapplication.com
        </a>
        .
      </p>

      <Link href="/" className="text-center text-xs text-accent underline">
        ← Back home
      </Link>
    </main>
  );
}
