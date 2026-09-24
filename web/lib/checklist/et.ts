// Ported from index.html's CHECKLIST_ET / CAT_ORDER_ET (as of the September 2026 index.html).
// Item text, tips, and conditional appliesIf logic are carried over verbatim/faithfully — same
// pattern as uk.ts (Phase 2). Phase 4a of task #244 ports the remaining 7 countries.
import { Answers, ChecklistItem } from './uk';

export const CAT_ORDER_ET = [
  'Identity & application',
  'Financial evidence',
  'Ties to Nigeria',
  'Accommodation & Ethiopian host',
  'Travel details',
  'Purpose-specific',
  'If a child is travelling',
  'Visa history',
  'Translations',
];

export const CHECKLIST_ET: ChecklistItem[] = [
  // Identity & application
  {
    id: 'passport', cat: 'Identity & application', weight: 'required',
    label: 'Valid passport (covers your whole trip)',
    tip: 'Must be valid for at least 6 months beyond your intended entry to Ethiopia, with a clear colour scan of the bio page for the eVisa application.',
  },
  {
    id: 'photo', cat: 'Identity & application', weight: 'required',
    label: 'Recent colour passport photo (white background, ≤6 months old)',
    tip: "Uploaded directly to the eVisa application at evisa.gov.et - check the portal's current exact spec before you apply, since photo requirements are strictly enforced.",
  },
  {
    id: 'evisaApplication', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'eVisa application submitted at evisa.gov.et',
    tip: "Ethiopia's only official eVisa portal - be wary of look-alike third-party sites that charge extra fees. As of 2026 Ethiopia issues a 30-day tourist e-Visa only (the 90-day option was discontinued); processing is typically around 3 business days, with a faster paid option on some reports.",
  },
  {
    id: 'feePaid', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'eVisa fee payment confirmation',
    tip: 'Widely reported at around $82 for the 30-day tourist e-Visa as of 2026 (an older, lower figure of around $62 has also been reported) - fees can change, so confirm the exact current amount directly on evisa.gov.et before paying.',
  },
  {
    id: 'oldPassports', cat: 'Identity & application', weight: 'recommended',
    label: 'Previous passport(s) showing earlier travel history (optional)',
    tip: "Not always required by the portal, but evidence you've travelled abroad and returned home before can strengthen your application.",
  },
  {
    id: 'oldVisas', cat: 'Identity & application', weight: 'recommended',
    label: 'Previous visa(s) / entry stamps from earlier travel (optional)',
    tip: 'A track record of visiting other countries and returning home on time is a positive signal - attach photos of past visa pages and entry/exit stamps if you have them.',
  },

  // Financial evidence
  {
    id: 'bankStatements', cat: 'Financial evidence', weight: 'recommended',
    label: 'Bank statements — last 3 to 6 months (up to 3 files)',
    tip: "Reports on exactly what evisa.gov.et requires are mixed - some sources say a bank statement isn't strictly mandatory for the tourist e-Visa, others recommend one ideally stamped/signed by your bank on every page showing a healthy balance. Given the mixed signal, it's treated as strongly recommended here rather than required.",
  },
  {
    id: 'forexProof', cat: 'Financial evidence', weight: 'recommended',
    label: 'Proof of foreign currency savings/income (optional)',
    tip: 'If you added foreign currency savings in the calculator above, a supporting document makes that figure easier to trust.',
  },

  // Ties to Nigeria
  {
    id: 'leaveLetter', cat: 'Ties to Nigeria', weight: 'recommended', appliesIf: (a) => a.employed,
    label: "Employer's leave-approval letter",
    tip: 'Not a strict eVisa portal requirement, but should state the exact days approved, matching your travel dates - useful to have ready in case of questions on arrival.',
  },
  {
    id: 'employmentLetter', cat: 'Ties to Nigeria', weight: 'recommended', appliesIf: (a) => a.employed,
    label: 'Employment letter on company letterhead (role, salary, start date)',
    tip: 'Not always required by the eVisa portal itself, but useful supporting evidence - your name here should match your name on your bank statement exactly.',
  },
  {
    id: 'enrolmentLetter', cat: 'Ties to Nigeria', weight: 'recommended', appliesIf: (a) => a.student,
    label: 'School/university admission or enrolment letter',
    tip: 'Confirms your current studies and that the institution expects you back.',
  },

  // Accommodation & Ethiopian host
  {
    id: 'invitationLetter', cat: 'Accommodation & Ethiopian host', weight: 'recommended', appliesIf: (a) => a.hasHost,
    label: 'Invitation letter from your Ethiopian host',
    tip: "Should include the host's full name, address, ID/status, your relationship, and exact dates of your stay.",
  },
  {
    id: 'hostAddress', cat: 'Accommodation & Ethiopian host', weight: 'recommended', appliesIf: (a) => a.hasHost,
    label: "Host's proof of address (recent utility bill)",
    tip: "Confirms where you'll actually be staying.",
  },
  {
    id: 'hotelBooking', cat: 'Accommodation & Ethiopian host', weight: 'recommended', appliesIf: (a) => !a.hasHost,
    label: 'Hotel / accommodation booking confirmation',
    tip: "A reservation hold is usually enough - doesn't need to be prepaid. Not strictly mandatory for the tourist e-Visa per the portal, but advisable to have ready.",
  },

  // Travel details
  {
    id: 'arrivalAirportNote', cat: 'Travel details', weight: 'required',
    label: 'Confirmed your arrival flight lands at Addis Ababa Bole International Airport',
    tip: 'The eVisa is currently only valid for arrival via Addis Ababa Bole International Airport - no document to upload here, just double-check your flight itinerary matches this before you book, then tick this once confirmed.',
  },
  {
    id: 'flightItinerary', cat: 'Travel details', weight: 'recommended',
    label: 'Flight itinerary / reservation (round-trip)',
    tip: 'Advisable to have, though not always strictly mandatory for the tourist e-Visa per the portal. A reservation hold showing your planned dates is usually enough.',
  },
  {
    id: 'returnEvidence', cat: 'Travel details', weight: 'recommended',
    label: 'Evidence of return or onward travel',
    tip: 'Shows you plan to leave Ethiopia at the end of your visit.',
  },
  {
    id: 'insurance', cat: 'Travel details', weight: 'recommended',
    label: 'Travel / medical insurance',
    tip: 'Not a stated eVisa portal requirement, but sensible to have for any trip.',
  },

  // Purpose-specific
  {
    id: 'bizLetterPair', cat: 'Purpose-specific', weight: 'recommended', appliesIf: (a) => a.purpose === 'business',
    label: "Letters from your Nigerian employer and the Ethiopian company you're visiting",
    tip: 'Should detail the business relationship and the purpose of your meetings.',
  },
  {
    id: 'confInvite', cat: 'Purpose-specific', weight: 'recommended', appliesIf: (a) => a.purpose === 'conference',
    label: 'Letter of invitation from the conference/event organiser',
    tip: 'Plus your registration confirmation if you have one - Addis Ababa is a common hub for conferences and AU-related events.',
  },
  {
    id: 'medLetter', cat: 'Purpose-specific', weight: 'recommended', appliesIf: (a) => a.purpose === 'medical',
    label: 'Letter from the Ethiopian medical practitioner/clinic',
    tip: 'Diagnosis, proposed treatment, estimated cost and expected duration.',
  },
  {
    id: 'familyProof', cat: 'Purpose-specific', weight: 'recommended', appliesIf: (a) => a.purpose === 'family',
    label: "Proof of relationship to the family you're visiting",
    tip: 'Birth/marriage certificates or similar linking you to your Ethiopia-based family.',
  },

  // Children
  {
    id: 'birthCert', cat: 'If a child is travelling', weight: 'recommended', appliesIf: (a) => a.hasChild,
    label: 'Full/unabridged birth certificate showing both parents',
    tip: 'Standard practice for a child travelling internationally - confirm the current position with the airline and evisa.gov.et before you travel, since child-travel document rules vary and can change.',
  },
  {
    id: 'consentLetter', cat: 'If a child is travelling', weight: 'recommended', appliesIf: (a) => a.hasChild,
    label: 'Consent letter from the non-travelling parent(s)/guardian',
    tip: "Needed if the child is travelling with only one parent, or with neither - a signed letter from the other parent/guardian, ideally notarised, plus a copy of their passport data page.",
  },
  {
    id: 'parentsPassports', cat: 'If a child is travelling', weight: 'recommended', appliesIf: (a) => a.hasChild,
    label: "Copies of both parents' passport data pages",
  },

  // Visa history
  {
    id: 'refusalDocs', cat: 'Visa history', weight: 'recommended', appliesIf: (a) => a.hasRefusal,
    label: 'Previous visa refusal documentation (Ethiopia or elsewhere)',
    tip: "The eVisa application form asks whether you've been refused a visa before - having the refusal letter(s) and a short explanation of what's changed since ready can help if you're asked to clarify.",
  },

  // Translations
  {
    id: 'translations', cat: 'Translations', weight: 'recommended', appliesIf: (a) => a.translation,
    label: 'Certified English translations of any other-language documents',
    tip: 'The eVisa portal operates in English - if any of your supporting documents are in another language, a certified translation plus a copy of the original makes them usable.',
  },
];
