import SituationGate from '@/components/checklist/SituationGate';

// Port of index.html's #situationGate for the UK route — see SituationGate's own comment for the
// full design rationale. Reached from /checklist/start after picking UK + agreeing to the
// disclaimer; "Continue" here used to land straight on /checklist/uk (Session 3: Document
// checklist), skipping Sessions 1-2 entirely -- confirmed live (user screenshot: landing directly
// on "Session 3 of 3: Document checklist"). The original always opens on Session 1 (Income & bank
// statement analysis) first, whether the visit is fresh or returning (task #236's own reorder).
// checklistHref is the "fresh application" default target here, so it needs to point at Session 1,
// not at this session's own /checklist/uk URL.
export default function UKSituationPage() {
  return (
    <SituationGate
      name="United Kingdom"
      checklistHref="/checklist/uk/statement"
      statementHref="/checklist/uk/statement"
      passportHref="/checklist/uk/passport"
    />
  );
}
