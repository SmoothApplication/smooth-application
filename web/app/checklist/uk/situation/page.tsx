import SituationGate from '@/components/checklist/SituationGate';

// Port of index.html's #situationGate for the UK route — see SituationGate's own comment for the
// full design rationale. Reached from /checklist/start after picking UK + agreeing to the
// disclaimer; "Continue" here used to land straight on /checklist/uk (Session 6 in the real order:
// the still-combined qualifying-questions/document-checklist screen), skipping every session ahead
// of it -- confirmed live (user screenshot: landing directly on "Session 3 of 3: Document
// checklist" before this session-order fix). The original always opens on Session 1 (Validate your
// International Passport, confirmed directly off the live original's own session pills) first,
// whether the visit is fresh or returning. checklistHref is the "fresh application" default target
// here, so it needs to point at Session 1, not at this session's own /checklist/uk URL.
export default function UKSituationPage() {
  return (
    <SituationGate
      name="United Kingdom"
      checklistHref="/checklist/uk/passport"
      statementHref="/checklist/uk/statement"
      passportHref="/checklist/uk/passport"
    />
  );
}
