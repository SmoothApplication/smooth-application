import SituationGate from '@/components/checklist/SituationGate';

// Port of index.html's #situationGate for the UK route — see SituationGate's own comment for the
// full design rationale. Reached from /checklist/start after picking UK + agreeing to the
// disclaimer; "Continue" here used to land straight on /checklist/uk (Session 6 in the real order:
// the still-combined qualifying-questions/document-checklist screen), skipping every session ahead
// of it -- confirmed live (user screenshot: landing directly on "Session 3 of 3: Document
// checklist" before this session-order fix).
//
// Task #417: this used to point at /checklist/uk/passport based on an earlier (wrong) reading of
// which session the original opens on first — see lib/checklist/sessions.ts's header comment for
// how that was corrected using the original's actual source rather than a DOM/text read of the live
// page. The original's real Session 1 is Income & bank statement analysis (finance2), not passport,
// so checklistHref (the "fresh application" default target) now points there instead.
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
