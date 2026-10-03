import type { Metadata } from 'next';
import Link from 'next/link';

// Follow-up to the 6-month failure review: the product's strongest claim ("your passport and bank
// statement are never uploaded") is also exactly what a scam site would say, so a claim alone does
// not earn trust from an applicant who has been burned before. This page turns the claim into
// something a stranger can CHECK in under a minute with their own browser, and is honest about the
// few things that do leave the device (so the page itself can't be accused of overclaiming).
export const metadata: Metadata = {
  title: 'Verify it yourself: are my documents really private?',
  description:
    'Smooth Application says your passport and bank statement never leave your device. Here is how to check that yourself in under a minute, and the few things that do get sent.',
  alternates: { canonical: '/verify-privacy' },
};

const GITHUB = 'https://github.com/SmoothApplication/smooth-application';

export default function VerifyPrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6 pb-16">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-[#12232e]">Don&apos;t trust us. Check.</h1>
        <p className="mt-2 text-sm text-[#4c6270]">
          Being careful with your passport and bank statement is the right instinct. We say they never
          leave your device. Here is how to prove that to yourself, whether or not you use this site.
        </p>
      </div>

      <section className="card-surface flex flex-col gap-3 p-5 text-sm text-[#4c6270]">
        <h2 className="text-base font-semibold text-[#12232e]">The 60-second test (on a computer)</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open the statement page in your browser, then press <b>F12</b> (or right-click, then
            &quot;Inspect&quot;) and click the <b>Network</b> tab.
          </li>
          <li>
            Click the small <b>clear</b> icon (🚫) so the list is empty.
          </li>
          <li>Upload your bank statement and press Analyze.</li>
          <li>
            Look at the list. You will not see your file being sent anywhere. Uploads show as a
            <b> POST</b> request carrying your file&apos;s data. There is none, because the reading
            happens inside your own browser tab.
          </li>
        </ol>
        <p>
          The Network tab is the dependable check. (Turning on airplane mode after the page loads
          often works too for a normal text PDF, but scanned or photographed pages may need to
          download reading tools first, so don&apos;t treat a failure there as proof of anything.)
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-base font-semibold text-[#12232e]">Read the code</h2>
        <p>
          The whole app is public. Anyone technical (a developer friend, for example) can open the
          statement and passport readers and see that they run locally:{' '}
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="text-accent underline">
            the source code on GitHub
          </a>
          .
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-base font-semibold text-[#12232e]">What does leave your device (we&apos;d rather tell you)</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <b>Generic tools downloaded to your browser.</b> To read scanned pages, your browser may
            download standard reading tools (such as OCR language data). Everyone receives the same
            files. This is a download to you, not an upload from you.
          </li>
          <li>
            <b>Your email, only if you type it in.</b> If you ask for a report by email, we store that
            email, your destination country and rough progress. Not your documents.
          </li>
          <li>
            <b>Translating a refusal letter, only if you press the button.</b> Translation sends that
            letter&apos;s text to a translation service. You choose whether to use it, and it is
            labelled where it appears.
          </li>
          <li>
            <b>Anonymous page counts.</b> We count visits to pages (no cookies, no personal data).
          </li>
          <li>
            <b>Feedback you write.</b> If you report a problem, we receive what you type, never your
            statement.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2 text-sm text-[#4c6270]">
        <h2 className="text-base font-semibold text-[#12232e]">Add your own lock</h2>
        <p>
          On a shared phone? You can set a PIN so the saved progress on your device is encrypted and
          needs that PIN to open. Look for the prompt inside the checklist.
        </p>
      </section>

      <section className="rounded-lg bg-black/5 p-4 text-sm text-[#4c6270]">
        <p>
          Still unsure? That is fair. Use the free Quick Check first (it asks for no documents at
          all), or ask us anything on WhatsApp before you upload a thing.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/quiz" className="btn-primary text-sm">
            Try the Quick Check
          </Link>
          <Link href="/faq" className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#12232e]">
            Read the FAQ
          </Link>
        </div>
      </section>

      <Link href="/" className="text-center text-xs text-accent underline">
        ← Back home
      </Link>
    </main>
  );
}
