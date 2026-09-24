// Ported from index.html's CHECKLIST_UK / CAT_ORDER_UK (as of the September 2026 index.html).
// Item text, tips, and conditional appliesIf logic are carried over verbatim/faithfully — this is
// the same reviewed document list the live checklist uses, not a rewrite. Phase 2 of task #244
// starts with UK only (highest-traffic country per docs/marketing-plan.md); other countries stay
// on the /checklist stub until a later phase ports their data too.
export type Answers = {
  employed: boolean;
  selfEmployed: boolean;
  student: boolean;
  studentSponsor: boolean;
  married: boolean;
  spouseSponsoring: boolean;
  hasHost: boolean;
  hostFunding: boolean;
  hasChild: boolean;
  hasRefusal: boolean;
  translation: boolean;
  readyToSubmit: boolean;
  purpose: '' | 'tourism' | 'business' | 'conference' | 'medical' | 'family' | 'wedding' | 'academic' | 'training';
};

export const DEFAULT_ANSWERS: Answers = {
  employed: false,
  selfEmployed: false,
  student: false,
  studentSponsor: false,
  married: false,
  spouseSponsoring: false,
  hasHost: false,
  hostFunding: false,
  hasChild: false,
  hasRefusal: false,
  translation: false,
  readyToSubmit: false,
  purpose: '',
};

export type ChecklistItem = {
  id: string;
  cat: string;
  subcat?: string;
  label: string;
  weight: 'required' | 'recommended';
  tip?: string;
  appliesIf?: (a: Answers) => boolean;
};

export const CAT_ORDER_UK = [
  'Identity & application',
  'Financial evidence',
  'Ties to Nigeria',
  'Accommodation & UK host',
  'Travel details',
  'Purpose-specific',
  'If a child is travelling',
  'Visa history',
  'Translations',
];

export const CHECKLIST_UK: ChecklistItem[] = [
  // Identity & application
  {
    id: 'passport', cat: 'Identity & application', weight: 'required',
    label: 'Valid passport (covers your whole trip)',
    tip: 'Ideally valid for 6+ months beyond your planned return date, with at least one blank page.',
  },
  {
    id: 'photo', cat: 'Identity & application', weight: 'required',
    label: 'Passport-style photo meeting UK visa specifications',
    tip: 'Recent, plain light background, no filters — check the exact spec on gov.uk before your appointment.',
  },
  {
    id: 'applicationForm', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Completed online visa application & reference number',
    tip: 'Complete the form at gov.uk before booking your biometric appointment.',
  },
  {
    id: 'feePaid', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Visa application fee payment confirmation',
    tip: 'Confirm the current fee on gov.uk — it changes from time to time.',
  },
  {
    id: 'biometric', cat: 'Identity & application', weight: 'required', appliesIf: (a) => a.readyToSubmit,
    label: 'Biometric appointment booked/attended (VFS Global / TLScontact Nigeria)',
    tip: "You'll give fingerprints and a photo at a Visa Application Centre in Nigeria.",
  },
  {
    id: 'oldPassports', cat: 'Identity & application', weight: 'recommended',
    label: 'Previous passport(s) showing earlier travel history',
    tip: "Evidence you've travelled abroad and returned home before strengthens your application.",
  },
  {
    id: 'oldVisas', cat: 'Identity & application', weight: 'recommended',
    label: 'Previous visa(s) / entry stamps from earlier travel',
    tip: 'Photos of past visa pages and entry/exit stamps — shows a track record of travelling abroad and returning home.',
  },

  // Financial evidence
  {
    id: 'bankStatements', cat: 'Financial evidence', weight: 'required',
    label: 'Personal bank statements — last 6 months (up to 3 files)',
    tip: 'Should show a healthy, explainable balance and regular activity, not just a lump sum deposited right before applying.',
  },
  {
    id: 'bankLetter', cat: 'Financial evidence', weight: 'recommended',
    label: 'Bank reference / introduction letter',
    tip: 'A short letter from your bank confirming your account status.',
  },
  {
    id: 'payslips', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.employed,
    label: 'Payslips — last 4 months',
    tip: 'Matches the salary stated in your employment letter and the regular credit on your bank statement.',
  },
  {
    id: 'taxDocs', cat: 'Financial evidence', weight: 'recommended',
    label: 'Tax clearance certificate / TIN documents',
    tip: 'Extra proof of a stable financial and legal footing in Nigeria.',
  },
  {
    id: 'forexProof', cat: 'Financial evidence', weight: 'recommended',
    label: 'Proof of foreign currency savings/income (optional)',
    tip: 'Foreign bank statement, exchange receipt, or remittance confirmation.',
  },
  {
    id: 'bizFinance', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.selfEmployed,
    label: 'Business bank statements',
    tip: 'Upload 6 months of BUSINESS bank statements — they must show you drawing a personal salary from the business, not just money sitting in the business account.',
  },
  {
    id: 'cacDocs', cat: 'Financial evidence', weight: 'required', appliesIf: (a) => a.selfEmployed,
    label: 'CAC registration (business registration documents)',
    tip: 'Your CAC certificate and other business registration documents.',
  },
  {
    id: 'spouseSponsorFinance', cat: 'Financial evidence', weight: 'required',
    appliesIf: (a) => a.married && a.spouseSponsoring,
    label: "Spouse's financial documents + signed sponsor letter",
    tip: 'Their bank statements for the last 6 months, plus a signed letter confirming they’re funding your visit.',
  },

  // Ties to Nigeria
  {
    id: 'leaveLetter', cat: 'Ties to Nigeria', weight: 'required', appliesIf: (a) => a.employed,
    label: "Employer's leave-approval letter",
    tip: 'Should state the exact number of days approved, matching your travel dates and itinerary.',
  },
  {
    id: 'employmentLetter', cat: 'Ties to Nigeria', weight: 'required', appliesIf: (a) => a.employed,
    label: 'Employment letter on company letterhead (role, salary, start date)',
    tip: 'Your name on this letter must match your name exactly as entered above, and as it appears on your bank statement.',
  },
  {
    id: 'staffId', cat: 'Ties to Nigeria', weight: 'required', appliesIf: (a) => a.employed,
    label: 'Staff ID card',
    tip: 'A photo/scan of your staff ID card, front (and back too if it carries details).',
  },
  {
    id: 'officePhoto', cat: 'Ties to Nigeria', weight: 'required', appliesIf: (a) => a.employed,
    label: 'A photo of yourself at your workplace',
    tip: 'A recent, genuine photo of you at your office or place of work.',
  },
  {
    id: 'enrolmentLetter', cat: 'Ties to Nigeria', weight: 'required', appliesIf: (a) => a.student,
    label: 'School/university admission or enrolment letter + no-objection letter',
    tip: 'Confirms your current studies and that the institution expects you back.',
  },
  {
    id: 'studentSponsorLetter', cat: 'Ties to Nigeria', weight: 'required',
    appliesIf: (a) => a.student && a.studentSponsor,
    label: "Sponsor's financial documents + a short letter from them confirming support",
    tip: 'Their bank statement or employment letter, plus a brief letter in their own words confirming support.',
  },
  {
    id: 'landAsset', cat: 'Ties to Nigeria', subcat: 'Assets & investments', weight: 'recommended',
    label: 'Land or property ownership documents',
    tip: 'Certificate of Occupancy, deed, or title.',
  },
  {
    id: 'goldAsset', cat: 'Ties to Nigeria', subcat: 'Assets & investments', weight: 'recommended',
    label: 'Valuables (e.g. gold) purchase receipts or valuation',
    tip: 'Only useful with proof of ownership/value.',
  },
  {
    id: 'pensionAsset', cat: 'Ties to Nigeria', subcat: 'Assets & investments', weight: 'recommended',
    label: 'Pension / RSA statement',
    tip: 'A recent statement from your PenCom-registered Pension Fund Administrator.',
  },
  {
    id: 'investmentAsset', cat: 'Ties to Nigeria', subcat: 'Assets & investments', weight: 'recommended',
    label: 'Investment statements (shares, mutual funds, treasury bills, etc.)',
    tip: "Recent statements from your broker/fund manager.",
  },

  // Accommodation & UK host
  {
    id: 'invitationLetter', cat: 'Accommodation & UK host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: 'Invitation letter from your UK host',
    tip: "Should include the host's name, address, immigration status, your relationship, and exact dates of your stay.",
  },
  {
    id: 'hostStatus', cat: 'Accommodation & UK host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: "Copy of host's passport / BRP / visa",
    tip: 'Confirms your host is lawfully in the UK and able to host you.',
  },
  {
    id: 'hostAddress', cat: 'Accommodation & UK host', weight: 'required', appliesIf: (a) => a.hasHost,
    label: "Host's proof of address (recent utility bill)",
    tip: "Confirms where you'll actually be staying.",
  },
  {
    id: 'hostFinance', cat: 'Accommodation & UK host', weight: 'required',
    appliesIf: (a) => a.hasHost && a.hostFunding,
    label: "Host's bank statement or employment letter",
    tip: "Needed if your host is covering some or all of your costs.",
  },
  {
    id: 'hotelBooking', cat: 'Accommodation & UK host', weight: 'required', appliesIf: (a) => !a.hasHost,
    label: 'Hotel / accommodation booking confirmation',
    tip: "Doesn't need to be prepaid — a reservation confirmation is usually enough.",
  },

  // Travel details
  {
    id: 'flightItinerary', cat: 'Travel details', weight: 'required',
    label: 'Flight itinerary / reservation',
    tip: "You generally don't need a fully paid ticket — a reservation showing your planned dates is enough.",
  },
  {
    id: 'returnEvidence', cat: 'Travel details', weight: 'required',
    label: 'Evidence of return or onward travel',
    tip: 'Shows immigration officers you plan to leave the UK at the end of your visit.',
  },
  {
    id: 'ukItinerary', cat: 'Travel details', weight: 'required',
    label: 'Day-by-day itinerary of places you plan to visit in the UK',
    tip: "Named places/cities, roughly what you'll do each day — a simple typed list is fine.",
  },
  {
    id: 'accomVerified', cat: 'Travel details', weight: 'required',
    label: 'Accommodation verified (address is real and booking is genuine)',
    tip: 'No document to upload here — just double-check the booking reference is live and the address exists.',
  },
  {
    id: 'sightseeing', cat: 'Travel details', weight: 'recommended',
    label: "Sightseeing plans — name and ticket of places you'll visit",
    tip: 'Shows a genuine, specific plan rather than a vague one.',
  },
  {
    id: 'insurance', cat: 'Travel details', weight: 'recommended',
    label: 'Travel / medical insurance',
    tip: 'Not mandatory for a visit visa, but strongly advisable and sometimes asked for at the border.',
  },

  // Purpose-specific
  {
    id: 'bizLetterPair', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'business',
    label: "Letters from your Nigerian employer and the UK company you're visiting",
    tip: 'Should detail the business relationship and the purpose of your meetings.',
  },
  {
    id: 'confInvite', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'conference',
    label: 'Letter of invitation from the conference/event organiser',
    tip: 'Plus your registration confirmation if you have one.',
  },
  {
    id: 'medLetter', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'medical',
    label: 'Letter from the UK medical practitioner/clinic',
    tip: 'Diagnosis, proposed treatment, estimated cost and expected duration.',
  },
  {
    id: 'medFunds', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'medical',
    label: 'Proof of funds to cover the full cost of treatment',
    tip: 'On top of your general financial evidence above.',
  },
  {
    id: 'familyProof', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'family',
    label: "Proof of relationship to the family you're visiting",
    tip: 'Birth/marriage certificates or similar linking you to your UK-based family.',
  },
  {
    id: 'weddingInvite', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'wedding',
    label: 'Wedding/registrar appointment confirmation or invitation',
    tip: 'Confirms the event you are attending and the date.',
  },
  {
    id: 'academicLetters', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'academic',
    label: 'Letters from your employer and the UK host institution',
    tip: 'Required for academic visits/research stays of up to 12 months.',
  },
  {
    id: 'trainingProof', cat: 'Purpose-specific', weight: 'required', appliesIf: (a) => a.purpose === 'training',
    label: 'Proof of paid training / course enrolment',
    tip: 'Invoice/payment confirmation, course syllabus, and a letter from the UK training provider.',
  },

  // Children
  {
    id: 'birthCert', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: 'Full birth certificate showing both parents',
  },
  {
    id: 'consentLetter', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: 'Consent letter from the non-travelling parent(s)/guardian',
    tip: "Plus a copy of that parent's passport data page.",
  },
  {
    id: 'parentsPassports', cat: 'If a child is travelling', weight: 'required', appliesIf: (a) => a.hasChild,
    label: "Copies of both parents' passport data pages",
  },

  // Visa history
  {
    id: 'refusalDocs', cat: 'Visa history', weight: 'required', appliesIf: (a) => a.hasRefusal,
    label: 'Previous visa refusal documentation',
    tip: "The refusal letter(s) for each prior refusal, ideally alongside a short cover-letter explanation of what's changed since.",
  },

  // Translations
  {
    id: 'translations', cat: 'Translations', weight: 'required', appliesIf: (a) => a.translation,
    label: 'Certified English translations of any non-English documents',
    tip: "Must include the translator's confirmation of accuracy, date, full name, signature and contact details.",
  },
];

export function itemApplies(item: ChecklistItem, a: Answers): boolean {
  return item.appliesIf ? item.appliesIf(a) : true;
}

// Takes the checklist explicitly (rather than always using CHECKLIST_UK) so it works correctly
// for every ported country, not just the UK — see regression tests in __tests__/percent.test.ts
// for the bug this used to have when every country's percent was silently computed against the
// UK's (much longer) item list.
export function computeOverallPercent(checklist: ChecklistItem[], a: Answers, checked: Record<string, boolean>): number {
  const applicable = checklist.filter((it) => itemApplies(it, a));
  if (!applicable.length) return 0;
  const done = applicable.filter((it) => checked[it.id]).length;
  return Math.round((done / applicable.length) * 100);
}
