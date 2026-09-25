import StatementCheck from '@/components/checklist/StatementCheck';

// Phase 4e of task #244: refactored to use the shared StatementCheck component (see
// components/checklist/StatementCheck.tsx) instead of its own copy of the statement-check UI, so
// the UK bank statement check and the 7 newly-ported countries' checks
// (/checklist/[country]/statement) stay in sync rather than drifting apart. Storage key is
// unchanged from Phase 4 — still sa_uk_statement.
export default function UKStatementCheckPage() {
  return <StatementCheck countryCode="UK" />;
}
