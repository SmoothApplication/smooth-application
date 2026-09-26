import Link from 'next/link';

// Follow-up selection "Add Privacy Policy + Terms pages" (go-live readiness audit): no /privacy or
// /terms route existed anywhere in web/app before this. Written to describe ONLY what the app
// actually does, checked against the real code rather than boilerplate: the checklist itself
// (country picker, quiz, passport scan, bank statement check, financial calculator, travel
// history, business income ledger, tracker) reads/writes localStorage only — see the repeated
// "never sent anywhere" comments across lib/statement, lib/passport, lib/situation. The one real
// exception is the optional "email me this" capture (quiz result page, wired to
// /api/capture-email) added alongside this page, which does reach Supabase + Resend — described
// honestly below rather than glossed over.
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-[#12232e]">Privacy Policy</h1>
        <p className="mt-1 text-xs text-[#566a76]">Last updated September 2026</p>
      </div>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">The short version</h2>
        <p>
          Smooth Application is built so your documents and answers never leave your device. Everything the
          checklist does — reading a passport, scanning a bank statement, calculating financial readiness,
          tracking travel history — runs entirely in your own browser. We never see, store, or receive the
          actual contents of anything you upload.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">What stays on your device only</h2>
        <p>
          Your country choice, quiz answers, checklist progress, passport/MRZ fields, bank statement
          transactions and analysis, financial calculator figures, travel history, and business income records
          are all saved using your browser&apos;s local storage. This data is never transmitted to us or anyone
          else. Clearing your browser data or using a different device/browser means starting over.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">If you choose to give us your email</h2>
        <p>
          Some optional moments in the app (for example, &quot;email me this result&quot; after the readiness quiz)
          let you type in your email address. If you do, we save your email, the country you&apos;re applying for,
          and your rough progress — nothing about the actual documents or answers — to our database (hosted by
          Supabase), and send you a one-time email (via Resend) with a link to set up a free account. This is
          entirely optional; the checklist itself never requires an account or an email address to use.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">Anonymous usage analytics</h2>
        <p>
          We use GoatCounter, a privacy-first analytics tool, to see in aggregate which pages and features get
          used (e.g. &quot;a session reached the statement check&quot;). It uses no cookies, collects no personal
          data, and never records anything you typed or uploaded — only anonymous counts of named events.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">Contact and WhatsApp</h2>
        <p>
          If you message us on WhatsApp or by email (for example about a visa refusal, or the paid Document
          Review), a real person reads and replies personally. Nothing from that conversation is automated or
          shared beyond what&apos;s needed to help you.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-sm font-semibold text-[#12232e]">What we don&apos;t do</h2>
        <p>
          No ads, no ad trackers, no selling or sharing your data with third parties for marketing, no reading
          of your uploaded documents on a server anywhere.
        </p>
      </section>

      <p className="text-sm text-[#4c6270]">
        Questions about this policy? Email{' '}
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
