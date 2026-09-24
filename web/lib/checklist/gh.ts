// Ported from index.html's CHECKLIST_GH / CAT_ORDER_GH (as of the September 2026 index.html).
// Item text, tips, and conditional appliesIf logic are carried over verbatim/faithfully — same
// pattern as uk.ts (Phase 2). Phase 4a of task #244 ports the remaining 7 countries.
// Ghana is visa-free for Nigerian passport holders under the ECOWAS Protocol on Free Movement,
// so this checklist is shorter and has no formal "application"/"visa history"/"translations" sections.
import { Answers, ChecklistItem } from './uk';

export const CAT_ORDER_GH = [
  'Identity & travel documents',
  'Financial evidence',
  'Accommodation & Ghanaian host',
  'Travel details',
  'If a child is travelling',
];

export const CHECKLIST_GH: ChecklistItem[] = [
  // Identity & travel documents
  {
    id: 'passport', cat: 'Identity & travel documents', weight: 'required',
    label: 'Valid passport (covers your whole trip)',
    tip: "Ghana is visa-free for Nigerian passport holders under the ECOWAS Protocol on Free Movement, so there is no visa application here - but your passport should still be valid for the length of your stay, and airlines/border officials commonly expect at least 6 months of remaining validity even where it isn't a strict legal rule.",
  },
  {
    id: 'yellowFeverCert', cat: 'Identity & travel documents', weight: 'required',
    label: 'Yellow fever vaccination certificate',
    tip: 'Ghana requires this from travellers arriving from a yellow-fever-endemic country, which includes Nigeria. Carry your International Certificate of Vaccination or Prophylaxis (the yellow card) - you can be turned back at the border without it, even though no visa is needed.',
  },
  {
    id: 'oldPassports', cat: 'Identity & travel documents', weight: 'recommended',
    label: 'Previous passport(s) showing earlier travel history (optional)',
    tip: 'Not required for ECOWAS free movement, but a record of travelling and returning home before can still be useful evidence to have on hand.',
  },

  // Financial evidence
  {
    id: 'proofOfFunds', cat: 'Financial evidence', weight: 'recommended',
    label: 'Evidence of funds for your trip (bank statement, up to 3 files)',
    tip: "ECOWAS free movement doesn't formally require proof of funds, but Ghana Immigration Service officers can still ask for it at the border - having a recent bank statement ready avoids an awkward conversation.",
  },

  // Accommodation & Ghanaian host
  {
    id: 'invitationLetter', cat: 'Accommodation & Ghanaian host', weight: 'recommended', appliesIf: (a) => a.hasHost,
    label: 'Invitation letter from your Ghanaian host',
    tip: "Not a formal requirement, but a short letter with the host's name, address, and your relationship makes your entry purpose easy for a border officer to understand at a glance.",
  },
  {
    id: 'hostAddress', cat: 'Accommodation & Ghanaian host', weight: 'recommended', appliesIf: (a) => a.hasHost,
    label: "Host's proof of address (recent utility bill)",
    tip: "Confirms where you'll actually be staying.",
  },
  {
    id: 'hotelBooking', cat: 'Accommodation & Ghanaian host', weight: 'recommended', appliesIf: (a) => !a.hasHost,
    label: 'Hotel / accommodation booking confirmation',
    tip: "A reservation hold is usually enough - doesn't need to be prepaid. Not a formal ECOWAS requirement, but useful to have ready if asked.",
  },

  // Travel details
  {
    id: 'flightItinerary', cat: 'Travel details', weight: 'required',
    label: 'Flight / travel itinerary showing return or onward travel',
    tip: "Airlines and border officials commonly expect to see a return or onward ticket before letting you board or enter, even where a visa isn't required.",
  },
  {
    id: 'accomVerified', cat: 'Travel details', weight: 'recommended',
    label: 'Accommodation verified (address is real and booking is genuine)',
    tip: "No document to upload here - just double-check the booking reference is live and the address exists.",
  },
  {
    id: 'insurance', cat: 'Travel details', weight: 'recommended',
    label: 'Travel / medical insurance',
    tip: 'Not required for ECOWAS entry, but sensible to have for any trip.',
  },

  // Children
  {
    id: 'birthCert', cat: 'If a child is travelling', weight: 'recommended', appliesIf: (a) => a.hasChild,
    label: 'Full/unabridged birth certificate showing both parents',
    tip: 'Standard practice for a child travelling internationally - confirm the current position with the airline and Ghana Immigration Service before you travel, since child-travel document rules vary and can change.',
  },
  {
    id: 'consentLetter', cat: 'If a child is travelling', weight: 'recommended', appliesIf: (a) => a.hasChild,
    label: 'Consent letter from the non-travelling parent(s)/guardian',
    tip: "Needed if the child is travelling with only one parent, or with neither - a signed letter from the other parent/guardian, ideally notarised, plus a copy of their passport data page. Nigerian immigration itself can ask for this on exit, separately from Ghana's own entry rules.",
  },
  {
    id: 'parentsPassports', cat: 'If a child is travelling', weight: 'recommended', appliesIf: (a) => a.hasChild,
    label: "Copies of both parents' passport data pages",
  },
];
