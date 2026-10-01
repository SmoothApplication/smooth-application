'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

// Pulled out of app/page.tsx (which stays a server component for the rest of the homepage) because
// this section needs client-side behavior the rest of the page doesn't: a GoatCounter funnel
// ("saw Readiness Kits" vs "clicked a CTA" — direct request: "No way to track whether the free
// Quick Check → paid upsell is actually converting... create a goatcounter count") and a log of
// each CTA click in Supabase (see app/api/readiness-kit-request/route.ts and migration
// 0006_readiness_kit_requests.sql — direct request: "create" an admin-visible record of requests).
//
// Both are deliberately fire-and-forget and non-blocking: neither the view tracker nor the click
// logger ever calls preventDefault() or awaits anything before the WhatsApp link follows through,
// and both are wrapped so a failure (ad blocker, network issue, GoatCounter down) never stops the
// applicant from reaching WhatsApp.
export type ReadinessKit = {
  slug: 'document_review' | 'full_case_review';
  name: string;
  priceNaira: string;
  priceUsd: string;
  deliveryDays: string;
  description: string;
  bestFor: string;
  whatsappMessage: string;
};

function logRequest(kit: ReadinessKit) {
  try {
    fetch('/api/readiness-kit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kit: kit.slug, priceLabel: kit.priceNaira }),
      keepalive: true, // survives the WhatsApp tab-switch/navigation that follows the click
    }).catch(() => {
      /* logging must never block or break the CTA */
    });
  } catch {
    /* same */
  }
}

export default function ReadinessKits({ kits, whatsappNumber }: { kits: ReadinessKit[]; whatsappNumber: string }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (viewed.current) return;
        if (entries.some((e) => e.isIntersecting)) {
          viewed.current = true;
          trackEvent('readiness_kits_view');
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="readiness-kits" className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Want a second pair of eyes?</p>
      <h2 className="mt-2 max-w-2xl font-serif text-3xl font-semibold text-[#12232e]">
        The checklist is free. If you want someone experienced to check it for you, that&apos;s here too.
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-[#4c6270]">
        These are paid, done-by-hand reviews — not automated, and separate from the free Quick Check
        and checklist above.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {kits.map((kit) => (
          <div key={kit.slug} className="card-surface border-t-4 border-accent p-6">
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
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(kit.whatsappMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent('readiness_kits_cta_click:' + kit.slug);
                logRequest(kit);
              }}
              className="mt-4 inline-block font-semibold text-accent underline"
            >
              Get my {kit.name} →
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
