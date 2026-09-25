import PassportScan from '@/components/checklist/PassportScan';

// Standalone manual-verification route for Phase 2 of the passport-MRZ port (camera/file capture +
// OCR + parse pipeline). Deliberately NOT linked from anywhere in the app yet — the passport-scan
// feature isn't wired into the real checklist flow until a later phase. Reach it directly at
// /checklist/passport-test to try a real passport photo/PDF against the pipeline.
export default function PassportTestPage() {
  return <PassportScan />;
}
