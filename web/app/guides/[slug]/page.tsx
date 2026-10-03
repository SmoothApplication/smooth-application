import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GUIDES, getGuide } from '@/lib/guides/guides';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = getGuide(params.slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guides/${g.slug}` },
  };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const g = getGuide(params.slug);
  if (!g) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-6 pb-16">
      <Link href="/guides" className="text-xs text-accent underline">
        ← All guides
      </Link>
      <h1 className="font-serif text-2xl font-semibold leading-tight text-[#12232e]">{g.title}</h1>
      <p className="text-sm text-[#4c6270]">{g.intro}</p>

      {g.sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-2 text-sm text-[#4c6270]">
          <h2 className="text-base font-semibold text-[#12232e]">{s.heading}</h2>
          {s.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}

      <div className="card-surface flex flex-col gap-3 p-5">
        <p className="text-sm font-semibold text-[#12232e]">Ready to check your own documents?</p>
        <p className="text-xs text-[#566a76]">Free, takes minutes, and your documents never leave your device.</p>
        <Link href={g.ctaHref} className="btn-primary w-fit text-sm">
          {g.ctaLabel}
        </Link>
      </div>

      <p className="text-xs text-[#8a97a0]">
        This is general guidance, not immigration or legal advice. Requirements and fees change, so always
        confirm them on the official government or embassy website for your visa.
      </p>
    </main>
  );
}
