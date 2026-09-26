import SituationGate from '@/components/checklist/SituationGate';

// Port of index.html's #situationGate for the UK route — see SituationGate's own comment for the
// full design rationale. Reached from /checklist/start after picking UK + agreeing to the
// disclaimer; "Continue" here lands on the real /checklist/uk checklist.
export default function UKSituationPage() {
  return (
    <SituationGate
      name="United Kingdom"
      checklistHref="/checklist/uk"
      statementHref="/checklist/uk/statement"
      passportHref="/checklist/uk/passport"
    />
  );
}
