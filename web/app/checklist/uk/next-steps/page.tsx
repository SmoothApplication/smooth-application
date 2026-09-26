import NextStepsReport from '@/components/checklist/NextStepsReport';

// Port of index.html's "What to do next" report (renderNextStepsReport) — task #319+ selection
// "'What to do next' report". See components/checklist/NextStepsReport.tsx for the full design
// rationale and its deliberate scope notes.
export default function UKNextStepsPage() {
  return <NextStepsReport countryCode="UK" />;
}
