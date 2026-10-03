import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDES } from '@/lib/guides/guides';

export const metadata: Metadata = {
  title: 'Visa application guides for Nigerian applicants',
  description:
    'Plain-language guides on bank statements, unexplained deposits, proof of funds, ties to home and what to do after a refusal.',
  alternates: { canonical: '/guides' },
};

export default function GuidesIndexPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-[#12232e]">Visa application guides</h1>
        <p className="mt-1 text-sm text-[#4c6270]">
          Short, practical reads on the things reviewers most often question. Guidance only, not
          immigration advice.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="card-surface block p-4 hover:bg-black/5">
              <h2 className="text-sm font-semibold text-[#12232e]">{g.title}</h2>
              <p className="mt-1 text-xs text-[#566a76]">{g.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/" className="text-center text-xs text-accent underline">
        ← Back home
      </Link>
    </main>
  );
}
