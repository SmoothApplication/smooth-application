import BusinessIncomeLedger from '@/components/checklist/BusinessIncomeLedger';

// Port of index.html's Business Income Record (#bizLedgerCard) — task #319 selection "Business
// income ledger". See components/checklist/BusinessIncomeLedger.tsx for the full design rationale
// and its deliberate scope note. Storage key: sa_uk_bizledger.
export default function UKBusinessIncomePage() {
  return <BusinessIncomeLedger countryCode="UK" />;
}
