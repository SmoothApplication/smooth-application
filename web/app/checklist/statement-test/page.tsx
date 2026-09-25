import StatementUpload from '@/components/checklist/StatementUpload';

// Standalone manual-verification route for Phase 2 of the bank-statement port (file intake +
// parse pipeline). Deliberately NOT linked from anywhere in the app yet — the statement feature
// isn't wired into the real checklist flow until a later phase. Reach it directly at
// /checklist/statement-test to try a real PDF/spreadsheet against the pipeline.
export default function StatementTestPage() {
  return <StatementUpload />;
}
