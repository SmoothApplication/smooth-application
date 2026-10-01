import { notFound, redirect } from 'next/navigation';
import SituationGate from '@/components/checklist/SituationGate';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';
import { isTravelReadinessCountry } from '@/lib/checklist/countries';

// Generic route for the 7 non-UK ready countries (CA/EU/ZA/GH/KE/ET/MA) — see
// web/app/checklist/uk/situation/page.tsx for UK's own dedicated route, same split as every other
// per-country sub-route in this app (financial/statement/passport/reasons).
export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

export default function CountrySituationPage({ params }: { params: { country: string } }) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();

  // Direct user feedback: "once you click Ghana, you do not need this page." GH/KE/MA are
  // visa-free "travel readiness" countries (see isTravelReadinessCountry's own comment in
  // lib/checklist/countries.ts) — every option on this gate ("Refused before", "Already paid &
  // filled", "Re-Applying") is a visa-application concept that doesn't apply to them, so there's
  // nothing relevant for this page to ask. app/checklist/start/page.tsx already skips straight
  // past this route for these 3 codes; this redirect is just a safety net for anyone who lands
  // here anyway (an old bookmark, the back button, a shared link) rather than a blank/pointless
  // screen or a dead end.
  if (isTravelReadinessCountry(data.code)) {
    redirect(`/checklist/${params.country}/statement`);
  }

  return (
    <SituationGate
      name={data.name}
      // Task #417, same fix as web/app/checklist/uk/situation/page.tsx: checklistHref is the
      // "fresh application" default entry point, so it needs to land on the real Session 1 —
      // Income & bank statement analysis (finance2), not passport — see lib/checklist/sessions.ts's
      // header comment for how that was confirmed off the original's actual source.
      checklistHref={`/checklist/${params.country}/statement`}
      statementHref={`/checklist/${params.country}/statement`}
      passportHref={`/checklist/${params.country}/passport`}
    />
  );
}
