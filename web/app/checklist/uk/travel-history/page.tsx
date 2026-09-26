import TravelHistory from '@/components/checklist/TravelHistory';

// Port of index.html's Travel Experience session (#travelExperience) — task #319+ selection
// "Build travel history first, then the full report". See
// components/checklist/TravelHistory.tsx for the full design rationale and its deliberate scope
// note. Storage key: sa_uk_travelhistory.
export default function UKTravelHistoryPage() {
  return <TravelHistory countryCode="UK" />;
}
