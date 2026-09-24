// Ported from index.html's CHECKLIST_MA / CAT_ORDER_MA (as of the September 2026 index.html).
// Item text, tips, and conditional appliesIf logic are carried over verbatim/faithfully — same
// pattern as uk.ts (Phase 2). Phase 4a of task #244 ports the remaining 7 countries.
// Morocco is visa-free for ordinary Nigerian passport holders (stays up to 30 days), so this
// checklist is shorter and has no formal "application"/"visa history"/"translations" sections.
import { Answers, ChecklistItem } from './uk';

export const CAT_ORDER_MA = [
  'Identity & travel documents',
  'Financial evidence',
  'Accommodation & Moroccan host',
  'Travel details',
  'If a child is travelling',
];

export const CHECKLIST_MA: ChecklistItem[] = [
  // Identity & travel documents
  {
    id: 'passport', cat: 'Identity & travel documents', weight: 'required',
    label: 'Valid passport (covers your whole trip, with a blank page)',
    tip: 'Morocco is visa-free for ordinary Nigerian passport holders for stays of up to 30 days - no application needed for this general case. Your passport should be valid for at least 6 months beyond your travel date and carry at least 1 blank page for the entry stamp. (Separately, Morocco also offers a narrow e-Visa at evis.ma, but only for Nigerians who already hold a valid multiple-entry Schengen/UK/US/Canada visa or residence permit - not the general case this checklist covers.)',
  },
  {
    id: 'yellowFeverCert', cat: 'Identity & travel documents', weight: 'recommended',
    label: 'Yellow fever vaccination certificate (recommended)',
    tip: 'Nigeria is a yellow-fever-endemic country, and Morocco has been reported to ask for this from travellers arriving from at-risk countries - carry your International Certificate of Vaccination or Prophylaxis (the yellow card) to be safe, and confirm the current position before you travel.',
  },
  {
    id: 'oldPassports', cat: 'Identity & travel documents', weight: 'recommended',
    label: 'Previous passport(s) showing earlier travel history (optional)',
    tip: 'Not required for visa-free entry, but a record of travelling and returning home before can still be useful to have on hand.',
  },

  // Financial evidence
  {
    id: 'proofOfFunds', cat: 'Financial evidence', weight: 'recommended',
    label: 'Evidence of funds for your trip (bank statement, up to 3 files)',
    tip: 'Not formally required for visa-free entry, but Moroccan border officials can still ask for proof of funds - having a recent bank statement ready avoids an awkward conversation.',
  },

  // Accommodation & Moroccan host
  {
    id: 'invitationLetter', cat: 'Accommodation & Moroccan host', weight: 'recommended', appliesIf: (a) => a.hasHost,
    label: 'Invitation letter from your Moroccan host',
    tip: "Not a formal requirement, but a short letter with the host's name, address, and your relationship makes your entry purpose easy for a border officer to understand at a glance.",
  },
  {
    id: 'hostAddress', cat: 'Accommodation & Moroccan host', weight: 'recommended', appliesIf: (a) => a.hasHost,
    label: "Host's proof of address (recent utility bill)",
    tip: "Confirms where you'll actually be staying.",
  },
  {
    id: 'hotelBooking', cat: 'Accommodation & Moroccan host', weight: 'recommended', appliesIf: (a) => !a.hasHost,
    label: 'Hotel / accommodation booking confirmation',
    tip: "A reservation hold is usually enough - doesn't need to be prepaid. Not a formal requirement for visa-free entry, but useful to have ready if asked.",
  },

  // Travel details
  {
    id: 'flightItinerary', cat: 'Travel details', weight: 'required',
    label: 'Flight / travel itinerary showing return or onward travel',
    tip: 'Airlines and border officials commonly expect to see a return or onward ticket before letting you board or enter, even where no visa is required.',
  },
  {
    id: 'accomVerified', cat: 'Travel details', weight: 'recommended',
    label: 'Accommodation verified (address is real and booking is genuine)',
    tip: "No document to upload here - just double-check the booking reference is live and the address exists.",
  },
  {
    id: 'insurance', cat: 'Travel details', weight: 'recommended',
    label: 'Travel / medical insurance',
    tip: 'Not required for visa-free entry, but sensible to have for any trip.',
  },

  // Children
  {
    id: 'birthCert', cat: 'If a child is travelling', weight: 'recommended', appliesIf: (a) => a.hasChild,
    label: 'Full/unabridged birth certificate showing both parents',
    tip: 'Standard practice for a child travelling internationally - confirm the current position with the airline and Moroccan authorities before you travel, since child-travel document rules vary and can change.',
  },
  {
    id: 'consentLetter', cat: 'If a child is travelling', weight: 'recommended', appliesIf: (a) => a.hasChild,
    label: 'Consent letter from the non-travelling parent(s)/guardian',
    tip: "Needed if the child is travelling with only one parent, or with neither - a signed letter from the other parent/guardian, ideally notarised, plus a copy of their passport data page. Nigerian immigration itself can ask for this on exit, separately from Morocco's own entry rules.",
  },
  {
    id: 'parentsPassports', cat: 'If a child is travelling', weight: 'recommended', appliesIf: (a) => a.hasChild,
    label: "Copies of both parents' passport data pages",
  },
];
