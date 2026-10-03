import type { Metadata } from 'next';
import Link from 'next/link';
import { FOUNDER_WHATSAPP_NUMBER } from '@/lib/statement/supportContact';

// Follow-up to the 6-month failure review ("one operator, one WhatsApp number"): the same few
// questions arrive on WhatsApp again and again. A real FAQ page answers them once, doubles as
// search-landing content, and carries FAQPage structured data. Answers are limited to what the app
// actually does (checked against the code and the privacy page) and avoid fee amounts, processing
// times and rules that change, pointing to the official source for those instead.
type QA = { q: string; a: string };
const SECTIONS: { title: string; items: QA[] }[] = [
  {
    title: 'Trust and privacy',
    items: [
      {
        q: 'Do you upload my passport or bank statement?',
        a: 'No. Reading your passport and bank statement happens inside your own browser tab. Nothing about the documents is sent to our servers. You can check this yourself in about a minute (see the "Verify it yourself" page).',
      },
      {
        q: 'Who is behind Smooth Application?',
        a: 'An independent visa-readiness service for Nigerian applicants. Paid reviews are done by a real person, not software. We are not affiliated with any visa authority, embassy or consulate, and we cannot influence a decision.',
      },
      {
        q: 'What do you store about me?',
        a: 'Your checklist progress is saved in your own browser. If you choose to give your email, we store that email, your destination country and rough progress, not your documents. Full details are in the Privacy Policy.',
      },
      {
        q: 'Is it safe on a shared phone?',
        a: 'You can set a PIN inside the checklist so saved progress on that device is encrypted and needs the PIN to open.',
      },
    ],
  },
  {
    title: 'Using the tool',
    items: [
      {
        q: 'Is it really free?',
        a: 'The Quick Check, the checklists and the bank statement check are free. Optional paid human reviews are available if you want a person to go through your whole application.',
      },
      {
        q: 'Which bank statements does it read?',
        a: 'PDF statements (including password-protected ones), spreadsheets, and photographed or scanned pages. Formats vary between banks. If something looks wrongly read, use the "Does something look wrongly read?" button under your results and tell us the bank so we can fix it.',
      },
      {
        q: 'My statement was read wrongly. What should I do?',
        a: 'Check the transactions shown against your original statement. Use the report button under the results (it sends only the bank name and what you type, never your statement), or message us on WhatsApp.',
      },
      {
        q: 'I lost my progress. Can I get it back?',
        a: 'Progress is stored in the browser on the device you used. Clearing browser data or switching devices means starting again. Use the email or report options to keep a copy.',
      },
      {
        q: 'Which countries do you cover?',
        a: 'The UK, Canada, Schengen countries, South Africa, Ghana, Kenya, Morocco and Ethiopia, with more being added.',
      },
    ],
  },
  {
    title: 'What this is, and is not',
    items: [
      {
        q: 'Can you guarantee my visa?',
        a: 'No one can. The decision belongs to the visa authority. We help you check that your documents and evidence are in order before you apply.',
      },
      {
        q: 'Is this immigration advice?',
        a: 'No. It is guidance and a document-readiness check, not legal or immigration advice, and it does not predict approval.',
      },
      {
        q: 'My statement has a deposit I cannot explain. Is it too late?',
        a: 'Often not. The check flags unexplained deposits so you can gather evidence (for example a gift letter or a sale receipt) before you apply, instead of finding out after a refusal.',
      },
      {
        q: 'Can you submit my application for me?',
        a: 'No. We do not file applications or talk to embassies on your behalf.',
      },
      {
        q: 'Where do I check current fees and rules?',
        a: 'Always on the official government or embassy website for your destination. Fees and requirements change, so we do not rely on a number here.',
      },
    ],
  },
];

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'Answers about privacy, bank statement reading, free vs paid, supported countries and what Smooth Application can and cannot do for your visa application.',
  alternates: { canonical: '/faq' },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: SECTIONS.flatMap((s) => s.items).map((i) => ({
    '@type': 'Question',
    name: i.q,
    acceptedAnswer: { '@type': 'Answer', text: i.a },
  })),
};

export default function FaqPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6 pb-16">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <div>
        <h1 className="font-serif text-2xl font-semibold text-[#12232e]">Frequently asked questions</h1>
        <p className="mt-1 text-sm text-[#4c6270]">
          Not here? Message us on{' '}
          <a
            href={`https://wa.me/${FOUNDER_WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            WhatsApp
          </a>
          .
        </p>
      </div>

      {SECTIONS.map((s) => (
        <section key={s.title}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-accent">{s.title}</h2>
          <div className="mt-2">
            {s.items.map((i) => (
              <details key={i.q} className="border-b border-black/10 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#12232e]">{i.q}</summary>
                <p className="mt-2 text-sm text-[#4c6270]">{i.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="text-sm text-[#4c6270]">
        Want proof for the privacy answers?{' '}
        <Link href="/verify-privacy" className="text-accent underline">
          Verify it yourself
        </Link>
        .
      </p>
      <Link href="/" className="text-center text-xs text-accent underline">
        ← Back home
      </Link>
    </main>
  );
}
